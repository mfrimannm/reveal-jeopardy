# Reveal Jeopardy Architecture Notes

## Current Architecture

Reveal Jeopardy is served by a small FastAPI backend in `server.py`. The backend owns admin login, signed session cookies, game JSON persistence under `data/games/`, uploads under `data/uploads/`, in-memory live sessions, WebSockets, and static file serving for the browser app and reveal.js assets.

The frontend is a browser-only reveal.js app. `index.html` contains the main page markup and loads app-specific CSS and classic browser scripts from `static/`. There is intentionally no frontend build step.

## Backend Responsibilities

- `server.py`: FastAPI app, admin auth, game API, upload API, live session API, WebSocket broadcasting, static files, `/play/{session_id}` and `/uploads`.
- `DATA_DIR`: root for persistent runtime data.
- `data/games/*.json`: persisted games.
- `data/uploads/`: persisted uploaded images and videos.
- `live_sessions`: process-local dictionary for live session state. It is not persisted.

## Frontend Split

- `static/app/state.js`: shared constants and mutable browser runtime state.
- `static/app/storage.js`: browser `localStorage` keys and saved game/settings helpers.
- `static/app/api.js`: JSON fetch helper, admin state, login/logout, game loading and upload access.
- `static/app/game-model.js`: game normalization, team normalization, question IDs and board dimensions.
- `static/app/media.js`: HTML escaping and YouTube/embed URL helpers.
- `static/app/content-renderer.js`: rich content, image, audio, video and hint rendering.
- `static/app/renderer.js`: home, board, scoreboard, question slides, answer visibility and tile rendering.
- `static/app/scoring.js`: scores, used questions, awards, localStorage persistence and cross-window sync.
- `static/app/question-maker.js`: builder draft normalization, Question maker rendering, form handling, save, snippets and upload insertion.
- `static/app/live-session.js`: low-level live session API and WebSocket helpers.
- `static/app/host-controls.js`: host-side live session panel, buzzer controls and score sync.
- `static/app/mobile-play.js`: participant join and mobile buzzer page.
- `static/app/qr-code.js`: QR code rendering for join links.
- `static/app/main.js`: settings actions, navigation, keyboard handling, reveal.js initialization and boot sequence.

The files are loaded as classic scripts so inline handlers such as `onclick="resetGame()"` keep working.

## Test Coverage

- `tests/backend/test_api.py`: FastAPI endpoints for games, admin login, uploads, live sessions, buzzers and WebSockets.
- `tests/frontend/frontend-pure.test.js`: frontend pure logic with Node's built-in test runner.
- `tests/ui/*.spec.js`: Playwright coverage for board scaling, media rendering, Question maker, scoring and live buzzer sessions.

## Tight Coupling To Address Next

- Move mutable runtime state behind a small state API instead of reading and writing globals directly.
- Split DOM rendering from state transitions, especially around scoring, used questions and live sync.
- Separate Question maker pure conversion logic from DOM form binding and API save/upload behavior.
- Keep media/embed helpers independent of both runtime rendering and Question maker UI.
- Consider persistent storage for live sessions if sessions need to survive server restarts.
