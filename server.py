import asyncio
import hashlib
import hmac
import io
import json
import math
import mimetypes
import os
import re
import secrets
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import Cookie, FastAPI, File, Header, HTTPException, Request, Response, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
import qrcode
import qrcode.image.svg


BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = Path(os.environ.get("DATA_DIR", BASE_DIR / "data")).resolve()
GAMES_DIR = DATA_DIR / "games"
JEOPARDY_GAMES_DIR = GAMES_DIR / "jeopardy"
KANUUNTT_GAMES_DIR = GAMES_DIR / "kanuuntt"
UPLOADS_DIR = DATA_DIR / "uploads"
SEED_GAMES_DIR = BASE_DIR / "seed-data" / "games"
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "change-me")
SESSION_SECRET = os.environ.get("SESSION_SECRET") or ADMIN_PASSWORD
MAX_UPLOAD_MB = int(os.environ.get("MAX_UPLOAD_MB", "10"))
MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024
MAX_VIDEO_UPLOAD_MB = int(os.environ.get("MAX_VIDEO_UPLOAD_MB", str(MAX_UPLOAD_MB)))
MAX_VIDEO_UPLOAD_BYTES = MAX_VIDEO_UPLOAD_MB * 1024 * 1024
SESSION_COOKIE = "reveal_jeopardy_admin"
LIVE_HOST_TOKEN_HEADER = "X-Live-Host-Token"
GAME_ID_PATTERN = re.compile(r"^[a-z0-9][a-z0-9-]{0,79}$")
SESSION_ID_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
SESSION_ID_LENGTH = 8
ALLOWED_STATIC_DIRS = {
    "css",
    "dist",
    "examples",
    "js",
    "lib",
    "plugin",
    "static",
}
ALLOWED_UPLOAD_CONTENT_TYPES = {
    "image/gif": ".gif",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "video/mp4": ".mp4",
    "video/webm": ".webm",
}


app = FastAPI(title="Reveal Jeopardy")
live_sessions: dict[str, dict[str, Any]] = {}
live_session_lock = asyncio.Lock()
session_websockets: dict[str, list[WebSocket]] = {}


def ensure_data_dirs() -> None:
    GAMES_DIR.mkdir(parents=True, exist_ok=True)
    JEOPARDY_GAMES_DIR.mkdir(parents=True, exist_ok=True)
    KANUUNTT_GAMES_DIR.mkdir(parents=True, exist_ok=True)
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

    if not any(GAMES_DIR.rglob("*.json")) and SEED_GAMES_DIR.exists():
        for seed_file in SEED_GAMES_DIR.rglob("*.json"):
            relative_path = seed_file.relative_to(SEED_GAMES_DIR)
            destination = GAMES_DIR / relative_path
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(seed_file, destination)


def sign_session(value: str) -> str:
    signature = hmac.new(
        SESSION_SECRET.encode("utf-8"),
        value.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return f"{value}.{signature}"


def is_valid_session(cookie_value: str | None) -> bool:
    if not cookie_value or "." not in cookie_value:
        return False

    value, signature = cookie_value.rsplit(".", 1)
    expected = sign_session(value).rsplit(".", 1)[1]
    return hmac.compare_digest(signature, expected) and value == "admin"


def require_admin(reveal_jeopardy_admin: str | None = Cookie(default=None)) -> None:
    if not is_valid_session(reveal_jeopardy_admin):
        raise HTTPException(status_code=401, detail="Admin login required")


def validate_game_id(game_id: str) -> str:
    normalized = game_id.strip().lower()

    if not GAME_ID_PATTERN.match(normalized):
        raise HTTPException(status_code=400, detail="Invalid game id")

    return normalized


def game_path(game_id: str) -> Path:
    return JEOPARDY_GAMES_DIR / f"{validate_game_id(game_id)}.json"


def game_write_path(game_id: str, payload: dict[str, Any]) -> Path:
    filename = f"{validate_game_id(game_id)}.json"

    if isinstance(payload.get("quiz_questions"), list):
        return KANUUNTT_GAMES_DIR / filename

    return JEOPARDY_GAMES_DIR / filename


def game_search_paths(game_id: str, mode: str | None = None) -> list[Path]:
    filename = f"{validate_game_id(game_id)}.json"

    if mode == "quiz":
        return [
            KANUUNTT_GAMES_DIR / filename,
            GAMES_DIR / filename,
            JEOPARDY_GAMES_DIR / filename,
        ]

    if mode == "jeopardy":
        return [
            JEOPARDY_GAMES_DIR / filename,
            GAMES_DIR / filename,
            KANUUNTT_GAMES_DIR / filename,
        ]

    return [
        JEOPARDY_GAMES_DIR / filename,
        KANUUNTT_GAMES_DIR / filename,
        GAMES_DIR / filename,
    ]


def find_game_path(game_id: str, mode: str | None = None) -> Path:
    for path in game_search_paths(game_id, mode):
        if path.exists():
            return path

    raise HTTPException(status_code=404, detail="Game not found")


def game_mode_from_path(path: Path) -> str:
    try:
        relative_path = path.relative_to(GAMES_DIR)
    except ValueError:
        return "jeopardy"

    if relative_path.parts and relative_path.parts[0] == "kanuuntt":
        return "quiz"

    return "jeopardy"


def read_game(path: Path) -> dict[str, Any]:
    try:
        with path.open("r", encoding="utf-8") as file:
            data = json.load(file)
    except json.JSONDecodeError as error:
        raise HTTPException(status_code=500, detail=f"Invalid game file: {path.name}") from error

    if not isinstance(data, dict):
        raise HTTPException(status_code=500, detail=f"Invalid game file: {path.name}")

    return data


def validate_game_payload(game_id: str, payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Game must be a JSON object")

    payload["id"] = validate_game_id(str(payload.get("id") or game_id))
    if payload["id"] != validate_game_id(game_id):
        raise HTTPException(status_code=400, detail="Game id does not match URL")

    if not isinstance(payload.get("title"), str) or not payload["title"].strip():
        raise HTTPException(status_code=400, detail="Game title is required")

    if not isinstance(payload.get("categories"), list) or not payload["categories"]:
        raise HTTPException(status_code=400, detail="At least one category is required")

    if "teams" in payload and not isinstance(payload["teams"], list):
        raise HTTPException(status_code=400, detail="Teams must be a list")

    return payload


def safe_upload_name(original_name: str, content_type: str) -> str:
    suffix = ALLOWED_UPLOAD_CONTENT_TYPES.get(content_type)

    if not suffix:
        raise HTTPException(status_code=400, detail="Only PNG, JPG, GIF, WebP, MP4 and WebM files are allowed")

    stem = Path(original_name or "upload").stem.lower()
    stem = re.sub(r"[^a-z0-9-]+", "-", stem).strip("-") or "image"
    return f"{stem}-{secrets.token_hex(4)}{suffix}"


def validate_upload_filename(filename: str) -> str:
    if not filename or Path(filename).name != filename:
        raise HTTPException(status_code=400, detail="Invalid upload filename")

    if not re.fullmatch(r"[a-z0-9][a-z0-9-]*-[a-f0-9]{8}\.(gif|jpg|png|webp|mp4|webm)", filename):
        raise HTTPException(status_code=400, detail="Invalid upload filename")

    return filename


def get_upload_content_type(path: Path) -> str:
    content_type, _ = mimetypes.guess_type(path.name)
    return content_type or "application/octet-stream"


def serialize_upload(path: Path) -> dict[str, Any]:
    stat = path.stat()

    return {
        "filename": path.name,
        "url": f"/uploads/{path.name}",
        "contentType": get_upload_content_type(path),
        "sizeBytes": stat.st_size,
        "modifiedAt": datetime.fromtimestamp(stat.st_mtime, timezone.utc).isoformat(),
    }


def upload_size_limit(content_type: str) -> tuple[int, int]:
    if content_type.startswith("video/"):
        return MAX_VIDEO_UPLOAD_BYTES, MAX_VIDEO_UPLOAD_MB

    return MAX_UPLOAD_BYTES, MAX_UPLOAD_MB


def is_allowed_static_path(path: Path) -> bool:
    try:
        relative = path.relative_to(BASE_DIR)
    except ValueError:
        return False

    return len(relative.parts) > 1 and relative.parts[0] in ALLOWED_STATIC_DIRS


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def parse_iso_datetime(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value.strip():
        return None

    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        return None

    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)

    return parsed.astimezone(timezone.utc)


def is_quiz_question_expired(session: dict[str, Any], question: dict[str, Any]) -> bool:
    started_at = parse_iso_datetime(session.get("question_started_at"))
    time_limit_seconds = int(question.get("timeLimitSeconds") or 0)

    if not started_at or time_limit_seconds <= 0:
        return False

    elapsed_seconds = (datetime.now(timezone.utc) - started_at).total_seconds()

    return elapsed_seconds >= time_limit_seconds


def get_quiz_remaining_seconds(session: dict[str, Any], question: dict[str, Any]) -> int | None:
    started_at = parse_iso_datetime(session.get("question_started_at"))
    time_limit_seconds = int(question.get("timeLimitSeconds") or 0)

    if not started_at or time_limit_seconds <= 0:
        return None

    elapsed_seconds = (datetime.now(timezone.utc) - started_at).total_seconds()

    return max(0, math.ceil(time_limit_seconds - elapsed_seconds))


def copy_session(session: dict[str, Any]) -> dict[str, Any]:
	return json.loads(json.dumps(session))


def copy_public_session(session: dict[str, Any]) -> dict[str, Any]:
    session_snapshot = copy_session(session)
    session_snapshot.pop("host_token", None)
    sanitize_public_quiz_session(session_snapshot)
    return session_snapshot


def sanitize_public_quiz_session(session: dict[str, Any]) -> None:
    quiz_questions = session.get("quiz_questions")
    reveal_correct_answers = session.get("quiz_phase") in {
        "result_distribution",
        "answer_reveal",
        "scoreboard",
        "final_scoreboard",
    }

    if not isinstance(quiz_questions, list):
        return

    for question in quiz_questions:
        if not isinstance(question, dict) or not isinstance(question.get("answers"), list):
            continue

        for answer in question["answers"]:
            if isinstance(answer, dict) and not reveal_correct_answers:
                answer.pop("correct", None)


def generate_session_id() -> str:
    while True:
        session_id = "".join(secrets.choice(SESSION_ID_ALPHABET) for _ in range(SESSION_ID_LENGTH))

        if session_id not in live_sessions:
            return session_id


def generate_host_token() -> str:
    return secrets.token_urlsafe(32)


def normalize_session_id(session_id: str) -> str:
    normalized = session_id.strip().upper()

    if (
        len(normalized) != SESSION_ID_LENGTH
        or any(character not in SESSION_ID_ALPHABET for character in normalized)
    ):
        raise HTTPException(status_code=404, detail="Session not found")

    return normalized


def get_live_session(session_id: str) -> dict[str, Any]:
    normalized = normalize_session_id(session_id)
    session = live_sessions.get(normalized)

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    return session


def require_live_host(
    session: dict[str, Any],
    reveal_jeopardy_admin: str | None,
    live_host_token: str | None,
) -> None:
    if is_valid_session(reveal_jeopardy_admin):
        return

    expected_token = str(session.get("host_token") or "")
    provided_token = str(live_host_token or "")

    if expected_token and hmac.compare_digest(provided_token, expected_token):
        return

    raise HTTPException(status_code=401, detail="Live host authorization required")


def get_game_data(game_id: str, mode: str | None = None) -> dict[str, Any]:
    return read_game(find_game_path(game_id, mode))


def get_game_teams_from_data(game: dict[str, Any]) -> list[dict[str, str]]:
    source_teams = game.get("teams") if isinstance(game.get("teams"), list) else []

    if not source_teams:
        source_teams = ["Team 1", "Team 2", "Team 3"]

    return [
        {
            "id": f"team{index + 1}",
            "name": str(team_name or f"Team {index + 1}"),
        }
        for index, team_name in enumerate(source_teams)
    ]


def get_game_teams(game_id: str) -> list[dict[str, str]]:
    return get_game_teams_from_data(get_game_data(game_id))


def normalize_session_mode(mode: str) -> str:
    normalized = mode.strip().lower() or "jeopardy"

    if normalized in {"quiz", "kanuuntt"}:
        return "quiz"

    return normalized


def normalize_quiz_media(raw_media: Any) -> dict[str, Any] | None:
    if raw_media is None:
        return None

    if not isinstance(raw_media, dict):
        raise HTTPException(status_code=400, detail="Quiz question media must be an object")

    media_type = str(raw_media.get("type") or "").strip().lower()
    src = str(raw_media.get("src") or "").strip()

    if media_type not in {"image", "video", "audio", "embed"}:
        raise HTTPException(status_code=400, detail="Unsupported quiz question media type")
    if not src:
        raise HTTPException(status_code=400, detail="Quiz question media src is required")

    media: dict[str, Any] = {
        "type": media_type,
        "src": src,
    }

    if media_type == "image":
        alt = str(raw_media.get("alt") or "").strip()
        if alt:
            media["alt"] = alt
    elif media_type == "video":
        poster = str(raw_media.get("poster") or "").strip()
        if poster:
            media["poster"] = poster
        media["autoplay"] = bool(raw_media.get("autoplay"))
        media["loop"] = bool(raw_media.get("loop"))
        media["muted"] = bool(raw_media.get("muted"))
    elif media_type == "audio":
        media["autoplay"] = bool(raw_media.get("autoplay"))
        media["loop"] = bool(raw_media.get("loop"))
    elif media_type == "embed":
        title = str(raw_media.get("title") or "").strip()
        media["title"] = title or "Embedded quiz media"

    return media


def validate_quiz_questions(game: dict[str, Any]) -> list[dict[str, Any]]:
    raw_questions = game.get("quiz_questions")

    if not isinstance(raw_questions, list) or not raw_questions:
        raise HTTPException(status_code=400, detail="Quiz questions are required")

    questions: list[dict[str, Any]] = []

    for question_index, raw_question in enumerate(raw_questions):
        if not isinstance(raw_question, dict):
            raise HTTPException(status_code=400, detail=f"Quiz question {question_index + 1} must be an object")

        question_type = str(raw_question.get("type") or "").strip()
        if question_type != "multiple-choice":
            raise HTTPException(status_code=400, detail="Only multiple-choice quiz questions are supported")

        prompt = str(raw_question.get("prompt") or "").strip()
        if not prompt:
            raise HTTPException(status_code=400, detail=f"Quiz question {question_index + 1} prompt is required")

        try:
            time_limit_seconds = int(raw_question.get("timeLimitSeconds"))
        except (TypeError, ValueError) as error:
            raise HTTPException(status_code=400, detail="Quiz question timeLimitSeconds is required") from error

        if time_limit_seconds <= 0:
            raise HTTPException(status_code=400, detail="Quiz question timeLimitSeconds must be positive")

        try:
            points = int(raw_question.get("points"))
        except (TypeError, ValueError) as error:
            raise HTTPException(status_code=400, detail="Quiz question points are required") from error

        if points < 0:
            raise HTTPException(status_code=400, detail="Quiz question points cannot be negative")

        raw_answers = raw_question.get("answers")
        if not isinstance(raw_answers, list) or len(raw_answers) < 2:
            raise HTTPException(status_code=400, detail="Quiz questions need at least two answers")

        answers: list[dict[str, Any]] = []
        answer_ids: set[str] = set()
        correct_answers = 0

        for answer_index, raw_answer in enumerate(raw_answers):
            if not isinstance(raw_answer, dict):
                raise HTTPException(status_code=400, detail="Quiz answers must be objects")

            answer_id = str(raw_answer.get("id") or "").strip()
            answer_text = str(raw_answer.get("text") or "").strip()
            correct = bool(raw_answer.get("correct"))

            if not answer_id:
                raise HTTPException(status_code=400, detail=f"Quiz answer {answer_index + 1} id is required")
            if answer_id in answer_ids:
                raise HTTPException(status_code=400, detail=f"Duplicate quiz answer id: {answer_id}")
            if not answer_text:
                raise HTTPException(status_code=400, detail=f"Quiz answer {answer_id} text is required")

            answer_ids.add(answer_id)
            correct_answers += 1 if correct else 0
            answers.append(
                {
                    "id": answer_id,
                    "text": answer_text,
                    "correct": correct,
                }
            )

        if correct_answers == 0:
            raise HTTPException(status_code=400, detail="Quiz questions need at least one correct answer")

        question = {
            "type": "multiple-choice",
            "prompt": prompt,
            "answers": answers,
            "timeLimitSeconds": time_limit_seconds,
            "points": points,
        }
        media = normalize_quiz_media(raw_question.get("media"))
        if media:
            question["media"] = media

        questions.append(question)

    return questions


def create_quiz_session_state(questions: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "quiz_questions": questions,
        "current_question_index": 0,
        "answers": [],
        "answer_count": 0,
        "question_open": False,
        "question_started_at": None,
        "quiz_phase": "waiting",
        "phase_started_at": now_iso(),
        "auto_advance_enabled": False,
    }


def require_quiz_session(session: dict[str, Any]) -> None:
    if session.get("mode") != "quiz":
        raise HTTPException(status_code=400, detail="Session is not in quiz mode")


def get_current_quiz_question(session: dict[str, Any]) -> dict[str, Any]:
    questions = session.get("quiz_questions")
    question_index = int(session.get("current_question_index") or 0)

    if not isinstance(questions, list) or question_index < 0 or question_index >= len(questions):
        raise HTTPException(status_code=409, detail="No active quiz question")

    return questions[question_index]


def count_current_quiz_answers(session: dict[str, Any]) -> int:
    question_index = int(session.get("current_question_index") or 0)
    answers = session.get("answers") if isinstance(session.get("answers"), list) else []

    return sum(1 for answer in answers if answer.get("question_index") == question_index)


def score_quiz_answer(session: dict[str, Any], question: dict[str, Any], answer_id: str) -> int:
    for answer in question["answers"]:
        if answer["id"] == answer_id:
            if not answer.get("correct"):
                return 0

            points = int(question["points"])
            time_limit_seconds = int(question.get("timeLimitSeconds") or 0)
            remaining_seconds = get_quiz_remaining_seconds(session, question)

            if time_limit_seconds <= 0 or remaining_seconds is None:
                return points

            return max(0, min(points, math.ceil(points * remaining_seconds / time_limit_seconds)))

    raise HTTPException(status_code=400, detail="Unknown answer")


async def read_json_body(request: Request) -> dict[str, Any]:
    try:
        body = await request.json()
    except json.JSONDecodeError as error:
        raise HTTPException(status_code=400, detail="Invalid JSON") from error

    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="Body must be a JSON object")

    return body


async def broadcast_session_state(session_id: str, session: dict[str, Any]) -> None:
    await broadcast_session_message(
        session_id,
        {
            "type": "session_state",
            "session": copy_public_session(session),
        },
    )


async def broadcast_session_message(session_id: str, message: dict[str, Any]) -> None:
    sockets = list(session_websockets.get(session_id, []))
    connected: list[WebSocket] = []

    for websocket in sockets:
        try:
            await websocket.send_json(message)
            connected.append(websocket)
        except Exception:
            pass

    if connected:
        session_websockets[session_id] = connected
    else:
        session_websockets.pop(session_id, None)


@app.on_event("startup")
def on_startup() -> None:
    ensure_data_dirs()


@app.post("/api/login")
async def login(request: Request, response: Response) -> dict[str, bool]:
    try:
        body = await request.json()
    except json.JSONDecodeError as error:
        raise HTTPException(status_code=400, detail="Invalid JSON") from error

    password = str(body.get("password") or "")

    if not hmac.compare_digest(password, ADMIN_PASSWORD):
        raise HTTPException(status_code=401, detail="Wrong password")

    response.set_cookie(
        SESSION_COOKIE,
        sign_session("admin"),
        httponly=True,
        samesite="lax",
        secure=request.url.scheme == "https",
    )
    return {"authenticated": True}


@app.post("/api/logout")
def logout(response: Response) -> dict[str, bool]:
    response.delete_cookie(SESSION_COOKIE)
    return {"authenticated": False}


@app.get("/api/me")
def me(reveal_jeopardy_admin: str | None = Cookie(default=None)) -> dict[str, bool]:
    return {"authenticated": is_valid_session(reveal_jeopardy_admin)}


@app.get("/api/qr-code")
def qr_code(value: str) -> Response:
    if not value or len(value.encode("utf-8")) > 2048:
        raise HTTPException(status_code=400, detail="Invalid QR value")

    qr = qrcode.QRCode(
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        border=4,
        box_size=8,
    )
    qr.add_data(value)
    qr.make(fit=True)
    image = qr.make_image(
        image_factory=qrcode.image.svg.SvgPathImage,
        attrib={
            "class": "live-qr-svg",
            "role": "img",
            "aria-label": "QR kode til join-link",
        },
    )
    output = io.BytesIO()
    image.save(output)

    return Response(
        content=output.getvalue(),
        media_type="image/svg+xml",
        headers={"Cache-Control": "no-store"},
    )


@app.get("/api/games")
def list_games() -> list[dict[str, str]]:
    ensure_data_dirs()
    games: list[dict[str, str]] = []
    paths = [
        *JEOPARDY_GAMES_DIR.glob("*.json"),
        *KANUUNTT_GAMES_DIR.glob("*.json"),
        *GAMES_DIR.glob("*.json"),
    ]

    for path in sorted(paths):
        data = read_game(path)
        game_id = validate_game_id(str(data.get("id") or path.stem))
        games.append(
            {
                "id": game_id,
                "title": str(data.get("title") or game_id),
                "mode": game_mode_from_path(path),
            }
        )

    return games


@app.get("/api/games/{game_id}")
def get_game(game_id: str, mode: str | None = None) -> dict[str, Any]:
    normalized_mode = normalize_session_mode(mode) if mode else None

    return read_game(find_game_path(game_id, normalized_mode))


@app.put("/api/games/{game_id}")
async def save_game(
    game_id: str,
    request: Request,
    reveal_jeopardy_admin: str | None = Cookie(default=None),
) -> dict[str, str]:
    require_admin(reveal_jeopardy_admin)
    try:
        body = await request.json()
    except json.JSONDecodeError as error:
        raise HTTPException(status_code=400, detail="Invalid JSON") from error

    payload = validate_game_payload(game_id, body)
    path = game_write_path(game_id, payload)
    path.parent.mkdir(parents=True, exist_ok=True)

    with path.open("w", encoding="utf-8") as file:
        json.dump(payload, file, ensure_ascii=False, indent="\t")
        file.write("\n")

    return {"id": payload["id"], "title": payload["title"]}


@app.get("/api/uploads")
async def list_uploads() -> list[dict[str, Any]]:
    files = [
        serialize_upload(path)
        for path in UPLOADS_DIR.iterdir()
        if path.is_file() and path.name != ".gitkeep"
    ]

    return sorted(files, key=lambda upload: upload["modifiedAt"], reverse=True)


@app.post("/api/uploads")
async def upload_image(
    file: UploadFile = File(...),
    reveal_jeopardy_admin: str | None = Cookie(default=None),
) -> dict[str, str]:
    require_admin(reveal_jeopardy_admin)
    content_type = file.content_type or ""
    filename = safe_upload_name(file.filename or "upload", content_type)
    destination = UPLOADS_DIR / filename
    total_size = 0
    max_upload_bytes, max_upload_mb = upload_size_limit(content_type)

    with destination.open("wb") as output:
        while True:
            chunk = await file.read(1024 * 1024)
            if not chunk:
                break

            total_size += len(chunk)
            if total_size > max_upload_bytes:
                output.close()
                destination.unlink(missing_ok=True)
                raise HTTPException(status_code=413, detail=f"Upload is larger than {max_upload_mb} MB")

            output.write(chunk)

    return {"url": f"/uploads/{filename}", "filename": filename}


@app.delete("/api/uploads/{filename}")
async def delete_upload(
    filename: str,
    reveal_jeopardy_admin: str | None = Cookie(default=None),
) -> dict[str, str]:
    require_admin(reveal_jeopardy_admin)
    safe_filename = validate_upload_filename(filename)
    path = UPLOADS_DIR / safe_filename

    if not path.is_file():
        raise HTTPException(status_code=404, detail="Upload not found")

    path.unlink()

    return {"filename": safe_filename, "status": "deleted"}


@app.post("/api/sessions")
async def create_live_session(
    request: Request,
) -> dict[str, Any]:
    body = await read_json_body(request)
    game_id = validate_game_id(str(body.get("game_id") or ""))
    mode = normalize_session_mode(str(body.get("mode") or "jeopardy"))
    game = get_game_data(game_id, mode)
    teams = get_game_teams_from_data(game)
    timestamp = now_iso()
    host_token = generate_host_token()
    quiz_state = create_quiz_session_state(validate_quiz_questions(game)) if mode == "quiz" else {}

    async with live_session_lock:
        session_id = generate_session_id()
        session = {
            "session_id": session_id,
            "host_token": host_token,
            "game_id": game_id,
            "mode": mode,
            "teams": teams,
            "players": [],
            "current_question": None,
            "scores": {} if mode == "quiz" else {team["id"]: 0 for team in teams},
            "used_questions": [],
            "buzzers": [],
            "buzzer_locked": False,
            "created_at": timestamp,
            "updated_at": timestamp,
            "status": "active",
            "participant_mode": "team",
        }
        session.update(quiz_state)
        live_sessions[session_id] = session
        session_snapshot = copy_public_session(session)
        session_snapshot["host_token"] = host_token

    return session_snapshot


@app.get("/api/sessions/{session_id}")
async def get_live_session_state(session_id: str) -> dict[str, Any]:
    async with live_session_lock:
        return copy_public_session(get_live_session(session_id))


@app.post("/api/sessions/{session_id}/join")
async def join_live_session(session_id: str, request: Request) -> dict[str, Any]:
    body = await read_json_body(request)
    name = str(body.get("name") or "").strip()
    team_id = str(body.get("team_id") or "").strip()

    if not name:
        raise HTTPException(status_code=400, detail="Player name is required")

    async with live_session_lock:
        session = get_live_session(session_id)
        team_ids = {team["id"] for team in session["teams"]}

        if team_id and team_id not in team_ids:
            raise HTTPException(status_code=400, detail="Unknown team")

        player = {
            "id": secrets.token_urlsafe(8),
            "name": name[:80],
            "team_id": team_id or None,
            "joined_at": now_iso(),
        }
        session["players"].append(player)
        if session.get("mode") == "quiz":
            session["scores"][player["id"]] = 0
        session["updated_at"] = now_iso()
        session_snapshot = copy_public_session(session)

    await broadcast_session_state(session_snapshot["session_id"], session_snapshot)
    return {
        "player": player,
        "session": session_snapshot,
    }


@app.post("/api/sessions/{session_id}/quiz/start-question")
async def start_quiz_question(
    session_id: str,
    reveal_jeopardy_admin: str | None = Cookie(default=None),
    live_host_token: str | None = Header(default=None, alias=LIVE_HOST_TOKEN_HEADER),
) -> dict[str, Any]:
    async with live_session_lock:
        session = get_live_session(session_id)
        require_live_host(session, reveal_jeopardy_admin, live_host_token)
        require_quiz_session(session)
        get_current_quiz_question(session)
        timestamp = now_iso()
        session["question_open"] = True
        session["question_started_at"] = timestamp
        session["quiz_phase"] = "question_open"
        session["phase_started_at"] = timestamp
        session["answer_count"] = count_current_quiz_answers(session)
        session["updated_at"] = timestamp
        session_snapshot = copy_public_session(session)

    await broadcast_session_state(session_snapshot["session_id"], session_snapshot)
    return session_snapshot


@app.post("/api/sessions/{session_id}/quiz/submit-answer")
async def submit_quiz_answer(session_id: str, request: Request) -> dict[str, Any]:
    body = await read_json_body(request)
    player_id = str(body.get("player_id") or "").strip()
    answer_id = str(body.get("answer_id") or "").strip()

    if not player_id:
        raise HTTPException(status_code=400, detail="Player id is required")
    if not answer_id:
        raise HTTPException(status_code=400, detail="Answer id is required")

    should_broadcast = False
    expired_snapshot: dict[str, Any] | None = None

    async with live_session_lock:
        session = get_live_session(session_id)
        require_quiz_session(session)

        if not session.get("question_open"):
            raise HTTPException(status_code=409, detail="Question is closed")

        question = get_current_quiz_question(session)

        if is_quiz_question_expired(session, question):
            timestamp = now_iso()
            session["question_open"] = False
            session["quiz_phase"] = "result_distribution"
            session["phase_started_at"] = timestamp
            session["answer_count"] = count_current_quiz_answers(session)
            session["updated_at"] = timestamp
            expired_snapshot = copy_public_session(session)

        player = None if expired_snapshot is not None else next((item for item in session["players"] if item["id"] == player_id), None)
        if not player:
            if expired_snapshot is None:
                raise HTTPException(status_code=404, detail="Player not found")
            quiz_answer = None
            session_snapshot = expired_snapshot
        else:
            question_index = int(session.get("current_question_index") or 0)
            existing_answer = next(
                (
                    answer
                    for answer in session["answers"]
                    if answer.get("question_index") == question_index and answer.get("player_id") == player_id
                ),
                None,
            )

            if existing_answer:
                quiz_answer = existing_answer
            else:
                earned_points = score_quiz_answer(session, question, answer_id)
                quiz_answer = {
                    "question_index": question_index,
                    "player_id": player_id,
                    "player_name": player["name"],
                    "team_id": player.get("team_id"),
                    "answer_id": answer_id,
                    "earned_points": earned_points,
                    "answered_at": now_iso(),
                }
                session["answers"].append(quiz_answer)
                session["scores"][player_id] = int(session["scores"].get(player_id) or 0) + earned_points
                session["answer_count"] = count_current_quiz_answers(session)
                session["updated_at"] = now_iso()
                should_broadcast = True

            session_snapshot = copy_public_session(session)

    if expired_snapshot is not None:
        await broadcast_session_state(expired_snapshot["session_id"], expired_snapshot)
        raise HTTPException(status_code=409, detail="Question time has expired")

    if should_broadcast:
        await broadcast_session_state(session_snapshot["session_id"], session_snapshot)

    return {
        "answer": copy_session(quiz_answer),
        "session": session_snapshot,
    }


@app.post("/api/sessions/{session_id}/quiz/close-question")
async def close_quiz_question(
    session_id: str,
    reveal_jeopardy_admin: str | None = Cookie(default=None),
    live_host_token: str | None = Header(default=None, alias=LIVE_HOST_TOKEN_HEADER),
) -> dict[str, Any]:
    async with live_session_lock:
        session = get_live_session(session_id)
        require_live_host(session, reveal_jeopardy_admin, live_host_token)
        require_quiz_session(session)
        get_current_quiz_question(session)
        timestamp = now_iso()
        session["question_open"] = False
        session["answer_count"] = count_current_quiz_answers(session)
        session["quiz_phase"] = "result_distribution"
        session["phase_started_at"] = timestamp
        session["updated_at"] = timestamp
        session_snapshot = copy_public_session(session)

    await broadcast_session_state(session_snapshot["session_id"], session_snapshot)
    return session_snapshot


@app.post("/api/sessions/{session_id}/quiz/next-question")
async def next_quiz_question(
    session_id: str,
    reveal_jeopardy_admin: str | None = Cookie(default=None),
    live_host_token: str | None = Header(default=None, alias=LIVE_HOST_TOKEN_HEADER),
) -> dict[str, Any]:
    async with live_session_lock:
        session = get_live_session(session_id)
        require_live_host(session, reveal_jeopardy_admin, live_host_token)
        require_quiz_session(session)
        questions = session.get("quiz_questions") if isinstance(session.get("quiz_questions"), list) else []
        question_index = int(session.get("current_question_index") or 0)

        if question_index >= len(questions) - 1:
            timestamp = now_iso()
            session["question_open"] = False
            session["quiz_phase"] = "final_scoreboard"
            session["phase_started_at"] = timestamp
            session["answer_count"] = count_current_quiz_answers(session)
            session["updated_at"] = timestamp
            session_snapshot = copy_public_session(session)
        else:
            timestamp = now_iso()
            session["current_question_index"] = question_index + 1
            session["question_open"] = False
            session["question_started_at"] = None
            session["answer_count"] = count_current_quiz_answers(session)
            session["quiz_phase"] = "question_intro"
            session["phase_started_at"] = timestamp
            session["updated_at"] = timestamp
            session_snapshot = copy_public_session(session)


    await broadcast_session_state(session_snapshot["session_id"], session_snapshot)
    return session_snapshot


@app.post("/api/sessions/{session_id}/quiz/jump-question")
async def jump_quiz_question(
    session_id: str,
    request: Request,
    reveal_jeopardy_admin: str | None = Cookie(default=None),
    live_host_token: str | None = Header(default=None, alias=LIVE_HOST_TOKEN_HEADER),
) -> dict[str, Any]:
    body = await read_json_body(request)

    try:
        question_index = int(body.get("question_index"))
    except (TypeError, ValueError) as error:
        raise HTTPException(status_code=400, detail="Question index is required") from error

    async with live_session_lock:
        session = get_live_session(session_id)
        require_live_host(session, reveal_jeopardy_admin, live_host_token)
        require_quiz_session(session)
        questions = session.get("quiz_questions") if isinstance(session.get("quiz_questions"), list) else []

        if question_index < 0 or question_index >= len(questions):
            raise HTTPException(status_code=400, detail="Question index is out of range")

        timestamp = now_iso()
        session["current_question_index"] = question_index
        session["question_open"] = False
        session["question_started_at"] = None
        session["answer_count"] = count_current_quiz_answers(session)
        session["quiz_phase"] = "question_intro"
        session["phase_started_at"] = timestamp
        session["updated_at"] = timestamp
        session_snapshot = copy_public_session(session)

    await broadcast_session_state(session_snapshot["session_id"], session_snapshot)
    return session_snapshot


@app.post("/api/sessions/{session_id}/quiz/phase")
async def set_quiz_phase(
    session_id: str,
    request: Request,
    reveal_jeopardy_admin: str | None = Cookie(default=None),
    live_host_token: str | None = Header(default=None, alias=LIVE_HOST_TOKEN_HEADER),
) -> dict[str, Any]:
    body = await read_json_body(request)
    quiz_phase = str(body.get("quiz_phase") or "").strip()
    allowed_phases = {
        "waiting",
        "question_intro",
        "question_open",
        "result_distribution",
        "answer_reveal",
        "scoreboard",
        "final_scoreboard",
    }

    if quiz_phase not in allowed_phases:
        raise HTTPException(status_code=400, detail="Unknown quiz phase")

    async with live_session_lock:
        session = get_live_session(session_id)
        require_live_host(session, reveal_jeopardy_admin, live_host_token)
        require_quiz_session(session)
        timestamp = now_iso()
        session["quiz_phase"] = quiz_phase
        session["phase_started_at"] = timestamp
        if quiz_phase != "question_open":
            session["question_open"] = False
        session["answer_count"] = count_current_quiz_answers(session)
        session["updated_at"] = timestamp
        session_snapshot = copy_public_session(session)

    await broadcast_session_state(session_snapshot["session_id"], session_snapshot)
    return session_snapshot


@app.post("/api/sessions/{session_id}/quiz/auto-advance")
async def set_quiz_auto_advance(
    session_id: str,
    request: Request,
    reveal_jeopardy_admin: str | None = Cookie(default=None),
    live_host_token: str | None = Header(default=None, alias=LIVE_HOST_TOKEN_HEADER),
) -> dict[str, Any]:
    body = await read_json_body(request)

    async with live_session_lock:
        session = get_live_session(session_id)
        require_live_host(session, reveal_jeopardy_admin, live_host_token)
        require_quiz_session(session)
        timestamp = now_iso()
        session["auto_advance_enabled"] = bool(body.get("auto_advance_enabled"))
        session["updated_at"] = timestamp
        session_snapshot = copy_public_session(session)

    await broadcast_session_state(session_snapshot["session_id"], session_snapshot)
    return session_snapshot


@app.post("/api/sessions/{session_id}/current-question")
async def set_live_current_question(
    session_id: str,
    request: Request,
    reveal_jeopardy_admin: str | None = Cookie(default=None),
    live_host_token: str | None = Header(default=None, alias=LIVE_HOST_TOKEN_HEADER),
) -> dict[str, Any]:
    body = await read_json_body(request)
    question_id = body.get("question_id")

    if question_id is not None:
        question_id = str(question_id).strip() or None

    async with live_session_lock:
        session = get_live_session(session_id)
        require_live_host(session, reveal_jeopardy_admin, live_host_token)
        session["current_question"] = question_id
        session["updated_at"] = now_iso()
        session_snapshot = copy_public_session(session)

    await broadcast_session_state(session_snapshot["session_id"], session_snapshot)
    return session_snapshot


@app.post("/api/sessions/{session_id}/score")
async def change_live_score(
    session_id: str,
    request: Request,
    reveal_jeopardy_admin: str | None = Cookie(default=None),
    live_host_token: str | None = Header(default=None, alias=LIVE_HOST_TOKEN_HEADER),
) -> dict[str, Any]:
    body = await read_json_body(request)
    team_id = str(body.get("team_id") or "").strip()
    question_id = body.get("question_id")

    try:
        delta = int(body.get("delta"))
    except (TypeError, ValueError) as error:
        raise HTTPException(status_code=400, detail="Score delta is required") from error

    async with live_session_lock:
        session = get_live_session(session_id)
        require_live_host(session, reveal_jeopardy_admin, live_host_token)

        if team_id not in session["scores"]:
            raise HTTPException(status_code=400, detail="Unknown team")

        session["scores"][team_id] = int(session["scores"].get(team_id) or 0) + delta

        if question_id is not None:
            question_id = str(question_id).strip()
            if question_id and question_id not in session["used_questions"]:
                session["used_questions"].append(question_id)

        session["updated_at"] = now_iso()
        session_snapshot = copy_public_session(session)

    await broadcast_session_state(session_snapshot["session_id"], session_snapshot)
    return session_snapshot


@app.post("/api/sessions/{session_id}/reset")
async def reset_live_session(
    session_id: str,
    reveal_jeopardy_admin: str | None = Cookie(default=None),
    live_host_token: str | None = Header(default=None, alias=LIVE_HOST_TOKEN_HEADER),
) -> dict[str, Any]:
    async with live_session_lock:
        session = get_live_session(session_id)
        require_live_host(session, reveal_jeopardy_admin, live_host_token)
        if session.get("mode") == "quiz":
            timestamp = now_iso()
            session["scores"] = {player["id"]: 0 for player in session["players"]}
            session["current_question_index"] = 0
            session["answers"] = []
            session["answer_count"] = 0
            session["question_open"] = False
            session["question_started_at"] = None
            session["quiz_phase"] = "waiting"
            session["phase_started_at"] = timestamp
        else:
            session["scores"] = {team["id"]: 0 for team in session["teams"]}
        session["current_question"] = None
        session["used_questions"] = []
        session["buzzers"] = []
        session["buzzer_locked"] = False
        session["updated_at"] = now_iso()
        session_snapshot = copy_public_session(session)

    await broadcast_session_state(session_snapshot["session_id"], session_snapshot)
    return session_snapshot


@app.post("/api/sessions/{session_id}/buzz")
async def buzz_live_session(session_id: str, request: Request) -> dict[str, Any]:
    body = await read_json_body(request)
    player_id = str(body.get("player_id") or "").strip()

    if not player_id:
        raise HTTPException(status_code=400, detail="Player id is required")

    async with live_session_lock:
        session = get_live_session(session_id)

        if session["buzzer_locked"]:
            raise HTTPException(status_code=409, detail="Buzzers are locked")

        player = next((item for item in session["players"] if item["id"] == player_id), None)

        if not player:
            raise HTTPException(status_code=404, detail="Player not found")

        existing_buzzer = next(
            (buzzer for buzzer in session["buzzers"] if buzzer["player_id"] == player_id),
            None,
        )

        if existing_buzzer:
            session_snapshot = copy_public_session(session)
            return {
                "buzzer": existing_buzzer,
                "session": session_snapshot,
            }

        order = len(session["buzzers"]) + 1
        team = next(
            (item for item in session["teams"] if item["id"] == player.get("team_id")),
            None,
        )
        buzzer = {
            "player_id": player_id,
            "player_name": player["name"],
            "team_id": player.get("team_id"),
            "team_name": team["name"] if team else None,
            "order": order,
            "first": order == 1,
            "buzzed_at": now_iso(),
        }
        session["buzzers"].append(buzzer)
        session["updated_at"] = now_iso()
        session_snapshot = copy_public_session(session)

    await broadcast_session_state(session_snapshot["session_id"], session_snapshot)
    return {
        "buzzer": buzzer,
        "session": session_snapshot,
    }


@app.post("/api/sessions/{session_id}/clear-buzzers")
async def clear_live_buzzers(
    session_id: str,
    reveal_jeopardy_admin: str | None = Cookie(default=None),
    live_host_token: str | None = Header(default=None, alias=LIVE_HOST_TOKEN_HEADER),
) -> dict[str, Any]:
    async with live_session_lock:
        session = get_live_session(session_id)
        require_live_host(session, reveal_jeopardy_admin, live_host_token)
        session["buzzers"] = []
        session["updated_at"] = now_iso()
        session_snapshot = copy_public_session(session)

    await broadcast_session_state(session_snapshot["session_id"], session_snapshot)
    return session_snapshot


@app.post("/api/sessions/{session_id}/lock-buzzers")
async def lock_live_buzzers(
    session_id: str,
    reveal_jeopardy_admin: str | None = Cookie(default=None),
    live_host_token: str | None = Header(default=None, alias=LIVE_HOST_TOKEN_HEADER),
) -> dict[str, Any]:
    async with live_session_lock:
        session = get_live_session(session_id)
        require_live_host(session, reveal_jeopardy_admin, live_host_token)
        session["buzzer_locked"] = True
        session["updated_at"] = now_iso()
        session_snapshot = copy_public_session(session)

    await broadcast_session_state(session_snapshot["session_id"], session_snapshot)
    return session_snapshot


@app.post("/api/sessions/{session_id}/unlock-buzzers")
async def unlock_live_buzzers(
    session_id: str,
    reveal_jeopardy_admin: str | None = Cookie(default=None),
    live_host_token: str | None = Header(default=None, alias=LIVE_HOST_TOKEN_HEADER),
) -> dict[str, Any]:
    async with live_session_lock:
        session = get_live_session(session_id)
        require_live_host(session, reveal_jeopardy_admin, live_host_token)
        session["buzzer_locked"] = False
        session["updated_at"] = now_iso()
        session_snapshot = copy_public_session(session)

    await broadcast_session_state(session_snapshot["session_id"], session_snapshot)
    return session_snapshot


@app.delete("/api/sessions/{session_id}")
async def stop_live_session(
    session_id: str,
    reveal_jeopardy_admin: str | None = Cookie(default=None),
    live_host_token: str | None = Header(default=None, alias=LIVE_HOST_TOKEN_HEADER),
) -> dict[str, str]:
    async with live_session_lock:
        normalized_session_id = normalize_session_id(session_id)

        if normalized_session_id not in live_sessions:
            raise HTTPException(status_code=404, detail="Session not found")

        require_live_host(
            live_sessions[normalized_session_id],
            reveal_jeopardy_admin,
            live_host_token,
        )
        live_sessions[normalized_session_id]["status"] = "stopped"
        live_sessions[normalized_session_id]["updated_at"] = now_iso()
        del live_sessions[normalized_session_id]

    await broadcast_session_message(
        normalized_session_id,
        {
            "type": "session_stopped",
            "session_id": normalized_session_id,
        },
    )
    session_websockets.pop(normalized_session_id, None)
    return {
        "session_id": normalized_session_id,
        "status": "stopped",
    }


@app.websocket("/ws/sessions/{session_id}")
async def live_session_websocket(websocket: WebSocket, session_id: str) -> None:
    try:
        normalized_session_id = normalize_session_id(session_id)
    except HTTPException:
        await websocket.close(code=1008)
        return

    async with live_session_lock:
        session = live_sessions.get(normalized_session_id)

    if not session:
        await websocket.close(code=1008)
        return

    await websocket.accept()
    session_websockets.setdefault(normalized_session_id, []).append(websocket)
    await websocket.send_json(
        {
            "type": "session_state",
            "session": copy_public_session(session),
        }
    )

    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        sockets = session_websockets.get(normalized_session_id, [])
        if websocket in sockets:
            sockets.remove(websocket)
        if sockets:
            session_websockets[normalized_session_id] = sockets
        else:
            session_websockets.pop(normalized_session_id, None)


ensure_data_dirs()
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")


@app.get("/")
def index() -> FileResponse:
    return FileResponse(BASE_DIR / "index.html")


@app.get("/favicon.ico")
def favicon() -> FileResponse:
    return FileResponse(BASE_DIR / "static" / "favicon.svg", media_type="image/svg+xml")


@app.get("/favicon.svg")
def favicon_svg() -> FileResponse:
    return FileResponse(BASE_DIR / "static" / "favicon.svg", media_type="image/svg+xml")


@app.get("/play/{session_id}")
def play(session_id: str) -> FileResponse:
    return FileResponse(BASE_DIR / "play.html")


@app.get("/kanuuntt/display/{session_id}")
def kanuuntt_display(session_id: str) -> FileResponse:
    return FileResponse(BASE_DIR / "kanuuntt-display.html")


@app.get("/kanuuntt/backend/{session_id}")
def kanuuntt_backend(session_id: str) -> FileResponse:
    return FileResponse(BASE_DIR / "kanuuntt-backend.html")


@app.get("/{path:path}")
def static_files(path: str) -> FileResponse:
    requested = (BASE_DIR / path).resolve()

    if not is_allowed_static_path(requested) or not requested.is_file():
        raise HTTPException(status_code=404, detail="Not found")

    media_type, _ = mimetypes.guess_type(str(requested))
    return FileResponse(requested, media_type=media_type)
