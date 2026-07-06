import importlib
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient


TEST_PASSWORD = "test-admin-password"
ROOT_DIR = Path(__file__).resolve().parents[2]

if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))


@pytest.fixture()
def anyio_backend():
    return "asyncio"


@pytest.fixture()
def server_module(tmp_path, monkeypatch):
    data_dir = tmp_path / "data"
    games_dir = data_dir / "games"
    jeopardy_games_dir = games_dir / "jeopardy"
    kanuuntt_games_dir = games_dir / "kanuuntt"
    uploads_dir = data_dir / "uploads"
    jeopardy_games_dir.mkdir(parents=True)
    kanuuntt_games_dir.mkdir(parents=True)
    uploads_dir.mkdir(parents=True)

    (jeopardy_games_dir / "alpha.json").write_text(
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
                                "question": {"format": "rich", "content": "Question?"},
                                "answer": {"format": "rich", "content": "Answer."},
                            }
                        ],
                    }
                ],
            }
        ),
        encoding="utf-8",
    )
    (kanuuntt_games_dir / "quiz-alpha.json").write_text(
        json.dumps(
            {
                "id": "quiz-alpha",
                "title": "Quiz Alpha Game",
                "teams": ["Red", "Blue"],
                "categories": [
                    {
                        "title": "Quiz",
                        "questions": [
                            {
                                "points": 100,
                                "question": {"format": "rich", "content": "Quiz placeholder?"},
                                "answer": {"format": "rich", "content": "Quiz placeholder."},
                            }
                        ],
                    }
                ],
                "quiz_questions": [
                    {
                        "type": "multiple-choice",
                        "prompt": "What is 2 + 2?",
                        "media": {
                            "type": "image",
                            "src": "/uploads/example.png",
                            "alt": "Example image",
                        },
                        "answers": [
                            {"id": "a", "text": "3", "correct": False},
                            {"id": "b", "text": "4", "correct": True},
                        ],
                        "timeLimitSeconds": 30,
                        "points": 1000,
                    },
                    {
                        "type": "multiple-choice",
                        "prompt": "Which color is the sky on a clear day?",
                        "answers": [
                            {"id": "a", "text": "Blue", "correct": True},
                            {"id": "b", "text": "Green", "correct": False},
                        ],
                        "timeLimitSeconds": 20,
                        "points": 500,
                    },
                ],
            }
        ),
        encoding="utf-8",
    )
    (kanuuntt_games_dir / "quiz-invalid-media.json").write_text(
        json.dumps(
            {
                "id": "quiz-invalid-media",
                "title": "Quiz Invalid Media",
                "categories": [
                    {
                        "title": "Quiz",
                        "questions": [
                            {
                                "points": 100,
                                "question": {"format": "rich", "content": "Placeholder?"},
                                "answer": {"format": "rich", "content": "Placeholder."},
                            }
                        ],
                    }
                ],
                "quiz_questions": [
                    {
                        "type": "multiple-choice",
                        "prompt": "Invalid media?",
                        "media": {"type": "pdf", "src": "/uploads/file.pdf"},
                        "answers": [
                            {"id": "a", "text": "Yes", "correct": True},
                            {"id": "b", "text": "No", "correct": False},
                        ],
                        "timeLimitSeconds": 30,
                        "points": 1000,
                    }
                ],
            }
        ),
        encoding="utf-8",
    )
    (jeopardy_games_dir / "beta.json").write_text(
        json.dumps(
            {
                "id": "beta",
                "title": "Beta Game",
                "categories": [
                    {
                        "title": "Media",
                        "questions": [
                            {
                                "points": 200,
                                "question": {"format": "html", "content": "<p>Q</p>"},
                                "answer": {"format": "html", "content": "<p>A</p>"},
                            }
                        ],
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
    monkeypatch.setenv("MAX_VIDEO_UPLOAD_MB", "2")

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


async def create_quiz_session(client):
    response = await client.post("/api/sessions", json={"game_id": "quiz-alpha", "mode": "quiz"})
    assert response.status_code == 200
    return response.json()


async def join_player(client, session_id, name="Alice", team_id="team1"):
    response = await client.post(
        f"/api/sessions/{session_id}/join",
        json={"name": name, "team_id": team_id},
    )
    assert response.status_code == 200
    return response.json()["player"]


@pytest.mark.anyio
async def test_list_games(client):
    response = await client.get("/api/games")

    assert response.status_code == 200
    assert response.json() == [
        {"id": "alpha", "title": "Alpha Game", "mode": "jeopardy"},
        {"id": "beta", "title": "Beta Game", "mode": "jeopardy"},
        {"id": "quiz-alpha", "title": "Quiz Alpha Game", "mode": "quiz"},
        {"id": "quiz-invalid-media", "title": "Quiz Invalid Media", "mode": "quiz"},
    ]


@pytest.mark.anyio
async def test_get_game(client):
    response = await client.get("/api/games/alpha")

    assert response.status_code == 200
    assert response.json()["title"] == "Alpha Game"
    assert response.json()["categories"][0]["questions"][0]["answer"] == {
        "format": "rich",
        "content": "Answer.",
    }


@pytest.mark.anyio
async def test_qr_code_endpoint_returns_svg(client):
    response = await client.get(
        "/api/qr-code",
        params={"value": "https://quiz.unf.dk/play/DEBHXBUS"},
    )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("image/svg+xml")
    assert b"<svg" in response.content


@pytest.mark.anyio
async def test_favicon_does_not_404(client):
    response = await client.get("/favicon.ico")

    assert response.status_code == 200
    assert "image/svg+xml" in response.headers["content-type"]
    assert response.text.startswith("<svg")


@pytest.mark.anyio
async def test_save_game_requires_admin_and_persists_to_test_data(client, server_module):
    await login(client)
    payload = {
        "id": "new-game",
        "title": "New Game",
        "teams": ["One"],
        "categories": [
            {
                "title": "Only",
                "questions": [
                    {
                        "points": 100,
                        "question": {"format": "rich", "content": "Q"},
                        "answer": {"format": "rich", "content": "A"},
                    }
                ],
            }
        ],
    }

    response = await client.put("/api/games/new-game", json=payload)

    assert response.status_code == 200
    assert response.json() == {"id": "new-game", "title": "New Game"}
    assert (server_module.JEOPARDY_GAMES_DIR / "new-game.json").exists()
    assert not (server_module.BASE_DIR / "data" / "games" / "new-game.json").exists()


@pytest.mark.anyio
async def test_save_kanuuntt_game_persists_to_kanuuntt_data(client, server_module):
    await login(client)
    payload = {
        "id": "new-quiz",
        "title": "New Quiz",
        "teams": ["One", "Two"],
        "categories": [
            {
                "title": "KanUUNTt",
                "questions": [
                    {
                        "points": 100,
                        "question": {"format": "rich", "content": "Placeholder"},
                        "answer": {"format": "rich", "content": "Placeholder"},
                    }
                ],
            }
        ],
        "quiz_questions": [
            {
                "type": "multiple-choice",
                "prompt": "Pick one",
                "answers": [
                    {"id": "a", "text": "Correct", "correct": True},
                    {"id": "b", "text": "Wrong", "correct": False},
                ],
                "timeLimitSeconds": 20,
                "points": 500,
            }
        ],
    }

    response = await client.put("/api/games/new-quiz", json=payload)

    assert response.status_code == 200
    assert response.json() == {"id": "new-quiz", "title": "New Quiz"}
    assert (server_module.KANUUNTT_GAMES_DIR / "new-quiz.json").exists()
    assert not (server_module.JEOPARDY_GAMES_DIR / "new-quiz.json").exists()


@pytest.mark.anyio
async def test_kanuuntt_display_and_backend_routes_return_html(client):
    display_response = await client.get("/kanuuntt/display/ABCDEFGH")
    backend_response = await client.get("/kanuuntt/backend/ABCDEFGH")

    assert display_response.status_code == 200
    assert "text/html" in display_response.headers["content-type"]
    assert "KanUUNTt Display" in display_response.text
    assert backend_response.status_code == 200
    assert "text/html" in backend_response.headers["content-type"]
    assert "KanUUNTt Backend" in backend_response.text


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
async def test_upload_video(client, server_module):
    await login(client)

    response = await client.post(
        "/api/uploads",
        files={"file": ("clip.mp4", b"\x00\x00\x00\x18ftypmp42", "video/mp4")},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["url"].startswith("/uploads/clip-")
    assert body["filename"].endswith(".mp4")
    assert (server_module.UPLOADS_DIR / body["filename"]).read_bytes() == b"\x00\x00\x00\x18ftypmp42"


@pytest.mark.anyio
async def test_upload_webm_video(client):
    await login(client)

    response = await client.post(
        "/api/uploads",
        files={"file": ("clip.webm", b"\x1a\x45\xdf\xa3", "video/webm")},
    )

    assert response.status_code == 200
    assert response.json()["filename"].endswith(".webm")


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
async def test_upload_video_too_large_uses_video_limit(client, server_module):
    await login(client)

    response = await client.post(
        "/api/uploads",
        files={"file": ("large.mp4", b"x" * (server_module.MAX_VIDEO_UPLOAD_BYTES + 1), "video/mp4")},
    )

    assert response.status_code == 413
    assert response.json()["detail"] == "Upload is larger than 2 MB"
    assert not list(server_module.UPLOADS_DIR.glob("large-*.mp4"))


@pytest.mark.anyio
async def test_upload_wrong_filetype(client):
    await login(client)

    response = await client.post(
        "/api/uploads",
        files={"file": ("notes.txt", b"hello", "text/plain")},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Only PNG, JPG, GIF, WebP, MP4 and WebM files are allowed"


@pytest.mark.anyio
async def test_create_session_without_admin_returns_host_token(client):
    response = await client.post("/api/sessions", json={"game_id": "alpha", "mode": "jeopardy"})

    assert response.status_code == 200
    session = response.json()
    assert len(session["session_id"]) == 8
    assert isinstance(session["host_token"], str)
    assert len(session["host_token"]) > 20


@pytest.mark.anyio
async def test_create_get_and_join_session(client):
    create_response = await client.post("/api/sessions", json={"game_id": "alpha", "mode": "jeopardy"})

    assert create_response.status_code == 200
    session = create_response.json()
    assert len(session["session_id"]) == 8
    assert session["game_id"] == "alpha"
    assert session["mode"] == "jeopardy"
    assert session["teams"] == [{"id": "team1", "name": "Red"}, {"id": "team2", "name": "Blue"}]
    assert session["players"] == []
    assert session["current_question"] is None
    assert session["scores"] == {"team1": 0, "team2": 0}
    assert session["used_questions"] == []
    assert session["buzzers"] == []
    assert session["buzzer_locked"] is False
    assert session["status"] == "active"
    assert session["participant_mode"] == "team"
    assert "quiz_questions" not in session
    assert "current_question_index" not in session
    assert "answer_count" not in session
    assert "question_open" not in session
    assert "question_started_at" not in session
    assert "host_token" in session

    get_response = await client.get(f"/api/sessions/{session['session_id'].lower()}")
    assert get_response.status_code == 200
    public_session = get_response.json()
    assert public_session["session_id"] == session["session_id"]
    assert "host_token" not in public_session

    join_response = await client.post(
        f"/api/sessions/{session['session_id']}/join",
        json={"name": "Alice", "team_id": "team1"},
    )

    assert join_response.status_code == 200
    body = join_response.json()
    assert body["player"]["name"] == "Alice"
    assert body["player"]["team_id"] == "team1"
    assert body["session"]["players"][0]["id"] == body["player"]["id"]
    assert "host_token" not in body["session"]


@pytest.mark.anyio
async def test_create_quiz_session_initializes_quiz_state(client):
    session = await create_quiz_session(client)

    assert len(session["session_id"]) == 8
    assert session["mode"] == "quiz"
    assert session["scores"] == {}
    assert session["current_question_index"] == 0
    assert session["answers"] == []
    assert session["answer_count"] == 0
    assert session["question_open"] is False
    assert session["question_started_at"] is None
    assert session["quiz_phase"] == "waiting"
    assert isinstance(session["phase_started_at"], str)
    assert session["quiz_questions"][0]["type"] == "multiple-choice"
    assert session["quiz_questions"][0]["media"] == {
        "type": "image",
        "src": "/uploads/example.png",
        "alt": "Example image",
    }
    assert "media" not in session["quiz_questions"][1]
    assert "correct" not in session["quiz_questions"][0]["answers"][0]
    assert "host_token" in session


@pytest.mark.anyio
async def test_create_quiz_session_rejects_invalid_media(client):
    response = await client.post("/api/sessions", json={"game_id": "quiz-invalid-media", "mode": "quiz"})

    assert response.status_code == 400
    assert response.json()["detail"] == "Unsupported quiz question media type"


@pytest.mark.anyio
async def test_start_quiz_question_opens_current_question(client):
    session = await create_quiz_session(client)
    host_headers = {"X-Live-Host-Token": session["host_token"]}

    response = await client.post(
        f"/api/sessions/{session['session_id']}/quiz/start-question",
        headers=host_headers,
    )

    assert response.status_code == 200
    updated = response.json()
    assert updated["current_question_index"] == 0
    assert updated["question_open"] is True
    assert updated["quiz_phase"] == "question_open"
    assert isinstance(updated["question_started_at"], str)
    assert updated["answer_count"] == 0
    assert "host_token" not in updated


@pytest.mark.anyio
async def test_submit_correct_quiz_answer_scores_question_points(client):
    session = await create_quiz_session(client)
    session_id = session["session_id"]
    host_headers = {"X-Live-Host-Token": session["host_token"]}
    player = await join_player(client, session_id)
    await client.post(f"/api/sessions/{session_id}/quiz/start-question", headers=host_headers)

    response = await client.post(
        f"/api/sessions/{session_id}/quiz/submit-answer",
        json={"player_id": player["id"], "answer_id": "b"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["answer"]["earned_points"] == 1000
    assert body["session"]["scores"][player["id"]] == 1000
    assert body["session"]["answer_count"] == 1


@pytest.mark.anyio
async def test_submit_wrong_quiz_answer_scores_zero(client):
    session = await create_quiz_session(client)
    session_id = session["session_id"]
    host_headers = {"X-Live-Host-Token": session["host_token"]}
    player = await join_player(client, session_id)
    await client.post(f"/api/sessions/{session_id}/quiz/start-question", headers=host_headers)

    response = await client.post(
        f"/api/sessions/{session_id}/quiz/submit-answer",
        json={"player_id": player["id"], "answer_id": "a"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["answer"]["earned_points"] == 0
    assert body["session"]["scores"][player["id"]] == 0
    assert body["session"]["answer_count"] == 1


@pytest.mark.anyio
async def test_first_quiz_answer_counts_for_repeat_submissions(client):
    session = await create_quiz_session(client)
    session_id = session["session_id"]
    host_headers = {"X-Live-Host-Token": session["host_token"]}
    player = await join_player(client, session_id)
    await client.post(f"/api/sessions/{session_id}/quiz/start-question", headers=host_headers)

    first = await client.post(
        f"/api/sessions/{session_id}/quiz/submit-answer",
        json={"player_id": player["id"], "answer_id": "b"},
    )
    second = await client.post(
        f"/api/sessions/{session_id}/quiz/submit-answer",
        json={"player_id": player["id"], "answer_id": "a"},
    )

    # Deterministic v1 rule: first answer counts; later submissions return the original answer.
    assert first.status_code == 200
    assert second.status_code == 200
    assert second.json()["answer"]["answer_id"] == "b"
    assert second.json()["answer"]["earned_points"] == 1000
    assert second.json()["session"]["scores"][player["id"]] == 1000
    assert second.json()["session"]["answer_count"] == 1
    assert len(second.json()["session"]["answers"]) == 1


@pytest.mark.anyio
async def test_close_quiz_question_blocks_new_answers(client):
    session = await create_quiz_session(client)
    session_id = session["session_id"]
    host_headers = {"X-Live-Host-Token": session["host_token"]}
    player = await join_player(client, session_id)
    await client.post(f"/api/sessions/{session_id}/quiz/start-question", headers=host_headers)

    close_response = await client.post(
        f"/api/sessions/{session_id}/quiz/close-question",
        headers=host_headers,
    )
    blocked = await client.post(
        f"/api/sessions/{session_id}/quiz/submit-answer",
        json={"player_id": player["id"], "answer_id": "b"},
    )

    assert close_response.status_code == 200
    assert close_response.json()["question_open"] is False
    assert close_response.json()["quiz_phase"] == "result_distribution"
    assert close_response.json()["quiz_questions"][0]["answers"][1]["correct"] is True
    assert blocked.status_code == 409
    assert blocked.json()["detail"] == "Question is closed"


@pytest.mark.anyio
async def test_late_quiz_answer_is_rejected_by_server_timer(client, server_module):
    session = await create_quiz_session(client)
    session_id = session["session_id"]
    host_headers = {"X-Live-Host-Token": session["host_token"]}
    player = await join_player(client, session_id)
    await client.post(f"/api/sessions/{session_id}/quiz/start-question", headers=host_headers)
    server_module.live_sessions[session_id]["question_started_at"] = (
        datetime.now(timezone.utc) - timedelta(seconds=120)
    ).isoformat()

    response = await client.post(
        f"/api/sessions/{session_id}/quiz/submit-answer",
        json={"player_id": player["id"], "answer_id": "b"},
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "Question time has expired"
    session_state = (await client.get(f"/api/sessions/{session_id}")).json()
    assert session_state["question_open"] is False
    assert session_state["quiz_phase"] == "result_distribution"
    assert session_state["scores"][player["id"]] == 0


@pytest.mark.anyio
async def test_next_quiz_question_advances_and_resets_open_state(client):
    session = await create_quiz_session(client)
    session_id = session["session_id"]
    host_headers = {"X-Live-Host-Token": session["host_token"]}
    player = await join_player(client, session_id)
    await client.post(f"/api/sessions/{session_id}/quiz/start-question", headers=host_headers)
    await client.post(
        f"/api/sessions/{session_id}/quiz/submit-answer",
        json={"player_id": player["id"], "answer_id": "b"},
    )

    next_response = await client.post(
        f"/api/sessions/{session_id}/quiz/next-question",
        headers=host_headers,
    )

    assert next_response.status_code == 200
    updated = next_response.json()
    assert updated["current_question_index"] == 1
    assert updated["question_open"] is False
    assert updated["question_started_at"] is None
    assert updated["quiz_phase"] == "question_intro"
    assert updated["answer_count"] == 0
    assert len(updated["answers"]) == 1


@pytest.mark.anyio
async def test_score_requires_admin_and_updates_session(client):
    session = (await client.post("/api/sessions", json={"game_id": "alpha", "mode": "jeopardy"})).json()
    host_headers = {"X-Live-Host-Token": session["host_token"]}

    unauthorized = await client.post(
        f"/api/sessions/{session['session_id']}/score",
        json={"team_id": "team1", "delta": 100, "question_id": "c1q100"},
    )
    assert unauthorized.status_code == 401
    assert unauthorized.json()["detail"] == "Live host authorization required"

    wrong_token = await client.post(
        f"/api/sessions/{session['session_id']}/score",
        json={"team_id": "team1", "delta": 100, "question_id": "c1q100"},
        headers={"X-Live-Host-Token": "wrong"},
    )
    assert wrong_token.status_code == 401

    response = await client.post(
        f"/api/sessions/{session['session_id']}/score",
        json={"team_id": "team1", "delta": 100, "question_id": "c1q100"},
        headers=host_headers,
    )

    assert response.status_code == 200
    updated = response.json()
    assert updated["scores"]["team1"] == 100
    assert updated["used_questions"] == ["c1q100"]
    assert "host_token" not in updated

    await login(client)
    admin_response = await client.post(
        f"/api/sessions/{session['session_id']}/score",
        json={"team_id": "team2", "delta": -100, "question_id": "c1q100"},
    )
    assert admin_response.status_code == 200
    assert admin_response.json()["scores"]["team2"] == -100


@pytest.mark.anyio
async def test_buzz_order_and_buzzer_controls(client):
    session = (await client.post("/api/sessions", json={"game_id": "alpha", "mode": "jeopardy"})).json()
    session_id = session["session_id"]
    host_headers = {"X-Live-Host-Token": session["host_token"]}
    alice = (
        await client.post(f"/api/sessions/{session_id}/join", json={"name": "Alice", "team_id": "team1"})
    ).json()["player"]
    bob = (
        await client.post(f"/api/sessions/{session_id}/join", json={"name": "Bob", "team_id": "team2"})
    ).json()["player"]

    first = (await client.post(f"/api/sessions/{session_id}/buzz", json={"player_id": alice["id"]})).json()
    second = (await client.post(f"/api/sessions/{session_id}/buzz", json={"player_id": bob["id"]})).json()

    assert first["buzzer"]["order"] == 1
    assert first["buzzer"]["first"] is True
    assert first["buzzer"]["team_name"] == "Red"
    assert second["buzzer"]["order"] == 2
    assert second["buzzer"]["first"] is False
    assert second["buzzer"]["team_name"] == "Blue"

    await client.post("/api/logout")
    unauthorized_lock = await client.post(f"/api/sessions/{session_id}/lock-buzzers")
    unauthorized_clear = await client.post(f"/api/sessions/{session_id}/clear-buzzers")
    unauthorized_reset = await client.post(f"/api/sessions/{session_id}/reset")
    assert unauthorized_lock.status_code == 401
    assert unauthorized_clear.status_code == 401
    assert unauthorized_reset.status_code == 401

    locked = await client.post(f"/api/sessions/{session_id}/lock-buzzers", headers=host_headers)
    assert locked.status_code == 200
    assert locked.json()["buzzer_locked"] is True
    assert "host_token" not in locked.json()
    blocked = await client.post(f"/api/sessions/{session_id}/buzz", json={"player_id": alice["id"]})
    assert blocked.status_code == 409

    unlocked = await client.post(f"/api/sessions/{session_id}/unlock-buzzers", headers=host_headers)
    assert unlocked.status_code == 200
    assert unlocked.json()["buzzer_locked"] is False

    cleared = await client.post(f"/api/sessions/{session_id}/clear-buzzers", headers=host_headers)
    assert cleared.status_code == 200
    assert cleared.json()["buzzers"] == []

    reset = await client.post(f"/api/sessions/{session_id}/reset", headers=host_headers)
    assert reset.status_code == 200
    assert reset.json()["scores"] == {"team1": 0, "team2": 0}
    assert reset.json()["current_question"] is None


@pytest.mark.anyio
async def test_stop_session_requires_admin_and_removes_session(client):
    session = (await client.post("/api/sessions", json={"game_id": "alpha", "mode": "jeopardy"})).json()
    session_id = session["session_id"]
    host_headers = {"X-Live-Host-Token": session["host_token"]}

    await client.post("/api/logout")
    unauthorized = await client.delete(f"/api/sessions/{session_id}")
    assert unauthorized.status_code == 401

    stopped = await client.delete(f"/api/sessions/{session_id}", headers=host_headers)
    assert stopped.status_code == 200
    assert stopped.json() == {"session_id": session_id, "status": "stopped"}

    missing = await client.get(f"/api/sessions/{session_id}")
    assert missing.status_code == 404


def test_session_websocket_receives_updates(server_module):
    with TestClient(server_module.app) as test_client:
        session = test_client.post("/api/sessions", json={"game_id": "alpha", "mode": "jeopardy"}).json()
        session_id = session["session_id"]

        with test_client.websocket_connect(f"/ws/sessions/{session_id}") as websocket:
            initial = websocket.receive_json()
            assert initial["type"] == "session_state"
            assert initial["session"]["session_id"] == session_id
            assert "host_token" not in initial["session"]

            join_response = test_client.post(
                f"/api/sessions/{session_id}/join",
                json={"name": "Alice", "team_id": "team1"},
            )
            assert join_response.status_code == 200

            update = websocket.receive_json()
            assert update["type"] == "session_state"
            assert update["session"]["players"][0]["name"] == "Alice"
            assert "host_token" not in update["session"]


def test_quiz_websocket_receives_live_answer_count(server_module):
    with TestClient(server_module.app) as test_client:
        session = test_client.post("/api/sessions", json={"game_id": "quiz-alpha", "mode": "quiz"}).json()
        session_id = session["session_id"]
        host_headers = {"X-Live-Host-Token": session["host_token"]}
        player = test_client.post(
            f"/api/sessions/{session_id}/join",
            json={"name": "Alice", "team_id": "team1"},
        ).json()["player"]
        start_response = test_client.post(
            f"/api/sessions/{session_id}/quiz/start-question",
            headers=host_headers,
        )
        assert start_response.status_code == 200

        with test_client.websocket_connect(f"/ws/sessions/{session_id}") as websocket:
            initial = websocket.receive_json()
            assert initial["type"] == "session_state"
            assert initial["session"]["answer_count"] == 0
            assert "correct" not in initial["session"]["quiz_questions"][0]["answers"][0]

            submit_response = test_client.post(
                f"/api/sessions/{session_id}/quiz/submit-answer",
                json={"player_id": player["id"], "answer_id": "b"},
            )
            assert submit_response.status_code == 200

            update = websocket.receive_json()
            assert update["type"] == "session_state"
            assert update["session"]["answer_count"] == 1
            assert update["session"]["scores"][player["id"]] == 1000
            assert "host_token" not in update["session"]
