# Reveal Jeopardy

Reveal Jeopardy er en browserbaseret Jeopardy- og quiz-app bygget oven på reveal.js med en FastAPI-backend. Appen kan køre lokalt, i Docker eller på en VPS med et færdigt GHCR-image.

## Hvad appen kan

- Vise et Jeopardy-board med kategorier, pointfelter, spørgsmål og svar.
- Køre almindelig Jeopardy med hold, score, brugte spørgsmål og point for rigtige/forkerte svar.
- Køre quiz-mode, hvor hosten bruger samme spørgsmål/svar-flow uden at være bundet til klassisk Jeopardy-afvikling.
- Starte live buzzer sessions med join-link og QR-kode til deltagernes mobiler.
- Lade deltagere joine på `/play/<SESSION_ID>`, vælge navn og hold og buzze i realtid.
- Oprette og redigere spil i Question maker.
- Bruge rich text, simple Markdown-lignende formater, HTML, hints, speaker notes, billeder, YouTube, lokal video og lyd.
- Uploade billeder og videoer via admin-login.
- Gemme spil og uploads på serverens disk, mens aktuel score og kladder gemmes i browseren.

## Kom i gang med Docker

Den hurtigste måde at starte appen lokalt er Docker Compose:

```sh
docker compose up --build
```

Åbn derefter:

```text
http://localhost:8000
```

Standard admin-koden i `docker-compose.yml` er `change-me`. Skift den før appen lægges på en offentlig server.

## Kør lokalt uden Docker

```sh
python -m pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8000
```

Åbn `http://localhost:8000`.

## Brug færdigt Docker image

Det færdige image publiceres som:

```text
ghcr.io/mfrimannm/unf-quiz:latest
```

Start med den medfølgende image-compose-fil:

```sh
docker compose -f docker-compose.image.yml pull
docker compose -f docker-compose.image.yml up -d
```

Et minimalt VPS-eksempel:

```yaml
services:
  reveal-jeopardy:
    image: ghcr.io/mfrimannm/unf-quiz:latest
    restart: unless-stopped
    ports:
      - "8000:8000"
    environment:
      ADMIN_PASSWORD: "skift-denne-kode"
      DATA_DIR: "/app/data"
      MAX_UPLOAD_MB: "10"
      MAX_VIDEO_UPLOAD_MB: "50"
    volumes:
      - ./data:/app/data
```

Hvis appen kører bag en reverse proxy, skal proxyen sende trafik til containerens port `8000`. Se også [docs/deployment.md](docs/deployment.md).

## Admin-login

Admin-login bruges til at gemme spil og uploade medier.

- Koden læses fra miljøvariablen `ADMIN_PASSWORD`.
- Hvis den ikke sættes, bruger serveren `change-me`.
- Login sker i `Settings` under `Question maker`.
- Backend sætter en HTTP-only cookie med navnet `reveal_jeopardy_admin`.
- `SESSION_SECRET` kan sættes separat. Hvis den ikke sættes, bruges `ADMIN_PASSWORD` som signeringshemmelighed.

Live host-handlinger kan enten godkendes af admin-cookie eller af det host-token, som oprettes når en live session startes.

## Opret spil

1. Åbn appen og gå til `Settings`.
2. Tryk `Question maker`.
3. Log ind med admin-koden.
4. Skriv titel, game id og teamnavne.
5. Vælg antal kategorier og rækker.
6. Tryk `Lav board`.
7. Klik på pointfelter og udfyld spørgsmål, svar, hints, medier, baggrunde og speaker notes.
8. Brug `Gem kladde` til browserens lokale kladde.
9. Brug `Gem spil` til at gemme spillet på serveren i `data/games/<game-id>.json`.

Game id skal være små bogstaver, tal og bindestreger, for eksempel `fredagsquiz` eller `firma-jeopardy`.

## Start Jeopardy

1. Vælg spil på forsiden, hvis der er flere spil.
2. Juster hold i `Settings`, hvis du vil overskrive spillets standardhold for den aktuelle browser.
3. Tryk `Start game`.
4. Vælg et pointfelt på boardet.
5. Brug `Show answer` når svaret skal vises.
6. Giv point med holdknapperne for korrekt eller forkert svar.
7. Spørgsmålet markeres som brugt, og appen går tilbage til boardet.

Scoren og brugte spørgsmål gemmes i browserens `localStorage` for det valgte spil.

## Start live buzzer session

1. Gå til `Settings`.
2. Find panelet `Live session`.
3. Tryk `Start live session`.
4. Del QR-koden eller join-linket med deltagerne.
5. Start spillet med `Start game`.
6. Når et spørgsmål åbnes, rydder hosten automatisk buzzer-listen og åbner buzzers.
7. Deltagernes buzzes vises i rækkefølge hos hosten.
8. Brug `Ryd buzzers`, `Lås buzzers` eller `Åbn buzzers` efter behov.
9. Brug `Stop session` når sessionen er færdig.

Live sessions ligger i serverens hukommelse og forsvinder ved server- eller container-restart. Se [docs/live-sessions.md](docs/live-sessions.md).

## Deltagere på mobil

Deltagere joiner fra mobilen via join-linket eller QR-koden:

```text
http://<host>/play/<SESSION_ID>
```

På join-siden skriver deltageren navn, vælger hold og trykker `Join`. Derefter vises en stor buzzer-knap. Hvis buzzers er låst, kan deltageren ikke buzze.

Alle deltagere skal kunne nå samme host-navn eller IP-adresse som linket bruger. På et lokalt netværk er `localhost` kun hostens egen maskine, så brug typisk maskinens LAN-IP eller et rigtigt domæne.

## Quiz-mode

Der er ikke en separat quiz-engine i koden. Quiz-mode er den praktiske brug af samme spørgsmål/svar-flow til quizafvikling:

- Opret spil med kategorier som runder eller emner.
- Brug `Show answer` til at afsløre facit.
- Brug holdknapperne til score.
- Slå `Flere teams` til på et spørgsmål, hvis flere hold skal have point før hosten går tilbage til boardet.
- Brug live session, hvis deltagerne skal buzze fra mobilen.

Se [docs/quiz-mode.md](docs/quiz-mode.md).

## Uploads

Uploads kræver admin-login og sker via Question maker.

Tilladte filtyper:

- Billeder: PNG, JPG, GIF, WebP.
- Video: MP4, WebM.

Miljøvariabler:

- `MAX_UPLOAD_MB`: størrelsesgrænse for billeder og fallback for video. Standard er `10`.
- `MAX_VIDEO_UPLOAD_MB`: separat videogrænse. Hvis den ikke sættes, bruges `MAX_UPLOAD_MB`.

Uploadede filer gemmes i `data/uploads/` og serveres fra `/uploads/<filnavn>`. Filnavne normaliseres og får en tilfældig suffix.

## Video settings

Spørgsmål og svar kan indeholde medier via Question maker:

- `YouTube`: gemmer en YouTube URL og viser den som embed.
- `Lokal video`: bruger en lokal sti, typisk `/uploads/clip.mp4` eller `examples/assets/video.mp4`.
- `Starttidspunkt` og `Sluttidspunkt`: sendes videre til YouTube og bruges til start på lokale videoer.
- `Autoplay`, `Loop`, `Controls` og `Muted`: styrer indlejrede medier.

Spørgsmål kan også have reveal.js-baggrundsvideo via `Baggrundsvideo` samt `Loop baggrundsvideo` og `Mute baggrundsvideo`.

## Data og persistens

- `data/games/*.json`: servergemte spil.
- `data/uploads/`: uploadede billeder og videoer.
- `./data:/app/data`: Docker volume, der gør spil og uploads persistente.
- Browserens `localStorage`: aktuel score, brugte spørgsmål, lokale settings og Question maker-kladde.
- Serverhukommelse: live sessions, deltagere, buzzers og live score. Det overlever ikke restart.

Containeren kopierer seed games ind ved første start, hvis `data/games/` er tom. Eksisterende spil i den mountede `data`-mappe overskrives ikke.

## Tests

Installer testafhængigheder:

```sh
python -m pip install -r requirements-test.txt
npm install
```

Kør backend API-tests:

```sh
python -m pytest tests/backend
```

Kør frontend unit tests:

```sh
npm run test:frontend
```

Installer Playwright-browser første gang:

```sh
npx playwright install
```

Kør UI-tests:

```sh
npm run test:ui
```

UI-testene starter selv FastAPI på port `8010` med isoleret testdata i systemets temp-mappe. Se [docs/testing.md](docs/testing.md).

## Mere dokumentation

- [GUIDE.md](GUIDE.md): brugerorienteret dansk guide.
- [docs/live-sessions.md](docs/live-sessions.md): live sessions og buzzer-system.
- [docs/quiz-mode.md](docs/quiz-mode.md): quiz-afvikling med samme app.
- [docs/deployment.md](docs/deployment.md): Docker, image og VPS.
- [docs/testing.md](docs/testing.md): testkommandoer og miljø.

## Licens

Projektet bygger på reveal.js, som er MIT-licenseret.
