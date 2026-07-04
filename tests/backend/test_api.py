import importlib
import json
import sys

import pytest
from httpx import ASGITransport, AsyncClient


TEST_PASSWORD = "test-admin-password"


@pytest.fixture()
def anyio_backend():
    return "asyncio"


@pytest.fixture()
def server_module(tmp_path, monkeypatch):
    data_dir = tmp_path / "data"
    games_dir = data_dir / "games"
    uploads_dir = data_dir / "uploads"
    games_dir.mkdir(parents=True)
    uploads_dir.mkdir(parents=True)

    (games_dir / "alpha.json").write_text(
        json.dumps(
            {
                "id": "alpha",
                "title": "Alpha Game",
                "teams": ["Red", "Blue"],
                "categories": [
                    {
                        "title": "General",
                        "questions": [
                            {
                                "points": 100,
                                "question": "Question?",
                                "answer": "Answer.",
                            }
                        ],
                    }
                ],
            }
        ),
        encoding="utf-8",
    )
    (games_dir / "beta.json").write_text(
        json.dumps(
            {
                "id": "beta",
                "title": "Beta Game",
                "categories": [
                    {
                        "title": "Media",
                        "questions": [{"points": 200, "html": "<p>Q</p>", "answerHtml": "<p>A</p>"}],
                    }
                ],
            }
        ),
        encoding="utf-8",
    )

    monkeypatch.setenv("DATA_DIR", str(data_dir))
    monkeypatch.setenv("ADMIN_PASSWORD", TEST_PASSWORD)
    monkeypatch.setenv("SESSION_SECRET", "test-session-secret")
    monkeypatch.setenv("MAX_UPLOAD_MB", "1")

    sys.modules.pop("server", None)
    module = importlib.import_module("server")
    return module


@pytest.fixture()
async def client(server_module):
    transport = ASGITransport(app=server_module.app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as async_client:
        yield async_client


async def login(client):
    response = await client.post("/api/login", json={"password": TEST_PASSWORD})
    assert response.status_code == 200
    assert response.json() == {"authenticated": True}
    return response


@pytest.mark.anyio
async def test_list_games(client):
    response = await client.get("/api/games")

    assert response.status_code == 200
    assert response.json() == [
        {"id": "alpha", "title": "Alpha Game"},
        {"id": "beta", "title": "Beta Game"},
    ]


@pytest.mark.anyio
async def test_get_game(client):
    response = await client.get("/api/games/alpha")

    assert response.status_code == 200
    assert response.json()["title"] == "Alpha Game"
    assert response.json()["categories"][0]["questions"][0]["answer"] == "Answer."


@pytest.mark.anyio
async def test_save_game_requires_admin_and_persists_to_test_data(client, server_module):
    await login(client)
    payload = {
        "id": "new-game",
        "title": "New Game",
        "teams": ["One"],
        "categories": [{"title": "Only", "questions": [{"points": 100, "question": "Q", "answer": "A"}]}],
    }

    response = await client.put("/api/games/new-game", json=payload)

    assert response.status_code == 200
    assert response.json() == {"id": "new-game", "title": "New Game"}
    assert (server_module.GAMES_DIR / "new-game.json").exists()
    assert not (server_module.BASE_DIR / "data" / "games" / "new-game.json").exists()


@pytest.mark.anyio
async def test_login_logout_and_me(client):
    assert (await client.get("/api/me")).json() == {"authenticated": False}

    await login(client)
    assert (await client.get("/api/me")).json() == {"authenticated": True}

    logout_response = await client.post("/api/logout")
    assert logout_response.status_code == 200
    assert logout_response.json() == {"authenticated": False}
    assert (await client.get("/api/me")).json() == {"authenticated": False}


@pytest.mark.anyio
async def test_upload_image(client, server_module):
    await login(client)

    response = await client.post(
        "/api/uploads",
        files={"file": ("tiny.png", b"\x89PNG\r\n\x1a\n", "image/png")},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["url"].startswith("/uploads/tiny-")
    assert body["filename"].endswith(".png")
    assert (server_module.UPLOADS_DIR / body["filename"]).read_bytes() == b"\x89PNG\r\n\x1a\n"


@pytest.mark.anyio
async def test_invalid_game_id(client):
    response = await client.get("/api/games/not_valid")

    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid game id"


@pytest.mark.anyio
async def test_invalid_json(client):
    await login(client)

    response = await client.put(
        "/api/games/alpha",
        content="{bad json",
        headers={"Content-Type": "application/json"},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid JSON"


@pytest.mark.anyio
async def test_wrong_admin_code(client):
    response = await client.post("/api/login", json={"password": "wrong"})

    assert response.status_code == 401
    assert response.json()["detail"] == "Wrong password"


@pytest.mark.anyio
async def test_upload_without_admin_login(client):
    response = await client.post(
        "/api/uploads",
        files={"file": ("tiny.png", b"\x89PNG\r\n\x1a\n", "image/png")},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Admin login required"


@pytest.mark.anyio
async def test_upload_too_large(client, server_module):
    await login(client)

    response = await client.post(
        "/api/uploads",
        files={"file": ("large.png", b"x" * (server_module.MAX_UPLOAD_BYTES + 1), "image/png")},
    )

    assert response.status_code == 413
    assert response.json()["detail"] == "Upload is larger than 1 MB"
    assert not list(server_module.UPLOADS_DIR.glob("large-*.png"))


@pytest.mark.anyio
async def test_upload_wrong_filetype(client):
    await login(client)

    response = await client.post(
        "/api/uploads",
        files={"file": ("notes.txt", b"hello", "text/plain")},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Only PNG, JPG, GIF and WebP images are allowed"
