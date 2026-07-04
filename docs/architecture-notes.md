# Reveal Jeopardy Architecture Notes

## Current Architecture

Reveal Jeopardy is served by a small FastAPI backend in `server.py`. The backend owns admin login, signed session cookies, game JSON persistence under `data/games/`, image uploads under `data/uploads/`, and static file serving for the browser app and Reveal.js assets.

The frontend is a browser-only Reveal.js app. `index.html` now contains the page markup and loads app-specific CSS and classic browser scripts from separate files. There is intentionally no frontend build step in this refactor.

## Frontend Split

- `css/reveal-jeopardy.css`: app-specific layout, board, scoreboard, question, and Question maker styles.
- `js/jeopardy/globals.js`: shared constants and current runtime state.
- `js/jeopardy/api.js`: JSON fetch helper, admin state, login/logout, and game loading.
- `js/jeopardy/game-model.js`: settings helpers, game normalization, question IDs, and board dimensions.
- `js/jeopardy/media.js`: HTML escaping and YouTube/embed URL helpers.
- `js/jeopardy/question-maker.js`: builder draft normalization, Question maker rendering, form handling, save, snippets, and image upload.
- `js/jeopardy/render.js`: home, board, scoreboard, question slide, answer, hint, and tile rendering.
- `js/jeopardy/game-state.js`: scores, used questions, awards, localStorage persistence, and cross-window sync.
- `js/jeopardy/app.js`: navigation, keyboard handling, Reveal.js initialization, and boot sequence.

The files are still loaded as classic scripts so existing inline handlers such as `onclick="resetGame()"` keep working.

## Tight Coupling To Address Next

- Move mutable runtime state behind a small state API instead of reading and writing globals directly.
- Split DOM rendering from state transitions, especially around `changeScore`, `markUsedAndGoBack`, `loadGameState`, `updateScoreboard`, and tile updates.
- Separate Question maker pure conversion logic from DOM form binding and API save/upload behavior.
- Keep media/embed helpers independent of both runtime rendering and Question maker UI.

## First Unit-Test Targets

Frontend pure functions now have a lightweight Node test in `test/frontend-pure.test.js`. The first covered targets are count clamping, game/question normalization, builder normalization/serialization, YouTube URL helpers, URL parameter helpers, and sync message parsing.

Good next backend tests are `validate_game_id`, `validate_game_payload`, `safe_upload_name`, and `is_valid_session`.
