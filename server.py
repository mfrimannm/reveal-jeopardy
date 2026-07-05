import asyncio
import hashlib
import hmac
import json
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


BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = Path(os.environ.get("DATA_DIR", BASE_DIR / "data")).resolve()
GAMES_DIR = DATA_DIR / "games"
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
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

    if not any(GAMES_DIR.glob("*.json")) and SEED_GAMES_DIR.exists():
        for seed_file in SEED_GAMES_DIR.glob("*.json"):
            shutil.copy2(seed_file, GAMES_DIR / seed_file.name)


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
    return GAMES_DIR / f"{validate_game_id(game_id)}.json"


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


def copy_session(session: dict[str, Any]) -> dict[str, Any]:
	return json.loads(json.dumps(session))


def copy_public_session(session: dict[str, Any]) -> dict[str, Any]:
    session_snapshot = copy_session(session)
    session_snapshot.pop("host_token", None)
    return session_snapshot


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


def get_game_teams(game_id: str) -> list[dict[str, str]]:
    path = game_path(game_id)

    if not path.exists():
        raise HTTPException(status_code=404, detail="Game not found")

    game = read_game(path)
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


@app.get("/api/games")
def list_games() -> list[dict[str, str]]:
    ensure_data_dirs()
    games: list[dict[str, str]] = []

    for path in sorted(GAMES_DIR.glob("*.json")):
        data = read_game(path)
        game_id = validate_game_id(str(data.get("id") or path.stem))
        games.append(
            {
                "id": game_id,
                "title": str(data.get("title") or game_id),
            }
        )

    return games


@app.get("/api/games/{game_id}")
def get_game(game_id: str) -> dict[str, Any]:
    path = game_path(game_id)

    if not path.exists():
        raise HTTPException(status_code=404, detail="Game not found")

    return read_game(path)


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
    path = game_path(game_id)

    with path.open("w", encoding="utf-8") as file:
        json.dump(payload, file, ensure_ascii=False, indent="\t")
        file.write("\n")

    return {"id": payload["id"], "title": payload["title"]}


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


@app.post("/api/sessions")
async def create_live_session(
    request: Request,
) -> dict[str, Any]:
    body = await read_json_body(request)
    game_id = validate_game_id(str(body.get("game_id") or ""))
    mode = str(body.get("mode") or "jeopardy")
    teams = get_game_teams(game_id)
    timestamp = now_iso()
    host_token = generate_host_token()

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
            "scores": {team["id"]: 0 for team in teams},
            "used_questions": [],
            "buzzers": [],
            "buzzer_locked": False,
            "created_at": timestamp,
            "updated_at": timestamp,
            "status": "active",
            "participant_mode": "team",
        }
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
        session["updated_at"] = now_iso()
        session_snapshot = copy_public_session(session)

    await broadcast_session_state(session_snapshot["session_id"], session_snapshot)
    return {
        "player": player,
        "session": session_snapshot,
    }


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
        session["current_question"] = None
        session["scores"] = {team["id"]: 0 for team in session["teams"]}
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
        buzzer = {
            "player_id": player_id,
            "player_name": player["name"],
            "team_id": player.get("team_id"),
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


@app.get("/{path:path}")
def static_files(path: str) -> FileResponse:
    requested = (BASE_DIR / path).resolve()

    if not is_allowed_static_path(requested) or not requested.is_file():
        raise HTTPException(status_code=404, detail="Not found")

    media_type, _ = mimetypes.guess_type(str(requested))
    return FileResponse(requested, media_type=media_type)
