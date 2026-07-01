import hashlib
import hmac
import json
import mimetypes
import os
import re
import secrets
import shutil
from pathlib import Path
from typing import Any

from fastapi import Cookie, FastAPI, File, HTTPException, Request, Response, UploadFile
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
SESSION_COOKIE = "reveal_jeopardy_admin"
GAME_ID_PATTERN = re.compile(r"^[a-z0-9][a-z0-9-]{0,79}$")
ALLOWED_STATIC_DIRS = {
    "css",
    "dist",
    "examples",
    "js",
    "lib",
    "plugin",
}
ALLOWED_UPLOAD_CONTENT_TYPES = {
    "image/gif": ".gif",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


app = FastAPI(title="Reveal Jeopardy")


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
        raise HTTPException(status_code=400, detail="Only PNG, JPG, GIF and WebP images are allowed")

    stem = Path(original_name or "image").stem.lower()
    stem = re.sub(r"[^a-z0-9-]+", "-", stem).strip("-") or "image"
    return f"{stem}-{secrets.token_hex(4)}{suffix}"


def is_allowed_static_path(path: Path) -> bool:
    try:
        relative = path.relative_to(BASE_DIR)
    except ValueError:
        return False

    return len(relative.parts) > 1 and relative.parts[0] in ALLOWED_STATIC_DIRS


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
    filename = safe_upload_name(file.filename or "image", file.content_type or "")
    destination = UPLOADS_DIR / filename
    total_size = 0

    with destination.open("wb") as output:
        while True:
            chunk = await file.read(1024 * 1024)
            if not chunk:
                break

            total_size += len(chunk)
            if total_size > MAX_UPLOAD_BYTES:
                output.close()
                destination.unlink(missing_ok=True)
                raise HTTPException(status_code=413, detail=f"Upload is larger than {MAX_UPLOAD_MB} MB")

            output.write(chunk)

    return {"url": f"/uploads/{filename}", "filename": filename}


ensure_data_dirs()
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")


@app.get("/")
def index() -> FileResponse:
    return FileResponse(BASE_DIR / "index.html")


@app.get("/{path:path}")
def static_files(path: str) -> FileResponse:
    requested = (BASE_DIR / path).resolve()

    if not is_allowed_static_path(requested) or not requested.is_file():
        raise HTTPException(status_code=404, detail="Not found")

    media_type, _ = mimetypes.guess_type(str(requested))
    return FileResponse(requested, media_type=media_type)
