# Testing

Projektet har backend API-tests, frontend unit tests og Playwright UI-tests under `tests/`.

## Installer afhængigheder

```sh
python -m pip install -r requirements-test.txt
npm install
```

Installer Playwright-browser første gang:

```sh
npx playwright install
```

## Backend API-tests

```sh
python -m pytest tests/backend
```

Backend-testene bruger midlertidige data-mapper via pytest fixtures og sætter blandt andet:

- `DATA_DIR`
- `ADMIN_PASSWORD`
- `SESSION_SECRET`
- `MAX_UPLOAD_MB`
- `MAX_VIDEO_UPLOAD_MB`

De dækker login, spil-API, uploads, live sessions, buzzers og WebSocket-opdateringer.

## Frontend unit tests

```sh
npm run test:frontend
```

Disse tests kører med Node test runner og loader rene frontendmoduler i en VM-context. De tester blandt andet game-id normalisering, scoring, Question maker-serialisering og media parsing.
Testfilen ligger i `tests/frontend/`.

## UI-tests

```sh
npm run test:ui
```

Playwright-konfigurationen starter selv appen via:

```sh
node tests/ui/start-ui-server.mjs
```

UI-tests ligger i `tests/ui/` og køres samlet af `npm run test:ui`.

Standard testserver:

```text
http://127.0.0.1:8010
```

UI-testdata ligger isoleret i systemets temp-mappe:

```text
reveal-jeopardy-playwright-data
```

## Nyttige miljøvariabler

- `PLAYWRIGHT_BASE_URL`: brug en ekstern allerede startet server.
- `PLAYWRIGHT_SKIP_WEBSERVER`: spring automatisk serverstart over.
- `PYTHON`: vælg Python-binær til UI-testserveren.
- `PLAYWRIGHT_BROWSERS_PATH`: browser-cache, standard er `.playwright-browsers`.
- `UI_SERVER_MAX_MS`: hvor længe testserver-helperen må vente.

Eksempel med eksisterende server:

```sh
PLAYWRIGHT_SKIP_WEBSERVER=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:8000 npm run test:ui
```

På Windows PowerShell:

```powershell
$env:PLAYWRIGHT_SKIP_WEBSERVER="1"
$env:PLAYWRIGHT_BASE_URL="http://127.0.0.1:8000"
npm run test:ui
```
