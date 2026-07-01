# Reveal Jeopardy

Reveal Jeopardy er en browserbaseret Jeopardy-app bygget oven på reveal.js. Den har spilbræt, kategorier, spørgsmål, svar, point, hold, speaker view og en indbygget Question maker.

Projektet kan nu køres som en FastAPI-app i Docker, så det kan ligge på en VPS. Spil gemmes som JSON i `data/games/`, og uploadede billeder gemmes i `data/uploads/`.

## Kom i gang lokalt

Kør med Docker Compose:

```sh
docker compose up --build
```

Åbn derefter:

```text
http://localhost:8000
```

Standard admin-koden i `docker-compose.yml` er `change-me`. Skift den før appen lægges på en offentlig VPS.

Du kan også køre backend direkte:

```sh
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8000
```

## Sådan laver du et spil

1. Åbn `Settings`.
2. Tryk `Question maker`.
3. Log ind med admin-koden.
4. Vælg antal kategorier og rækker.
5. Tryk `Lav board`.
6. Klik rundt på boardet og udfyld spørgsmål, svar, hints og speaker notes.
7. Upload billeder direkte i spørgsmålseditoren, hvis du skal bruge lokale billeder.
8. Tryk `Gem spil`.

Browseren gemmer stadig en lokal kladde i `localStorage`, men den færdige version gemmes på serveren i `data/games/<game-id>.json`.

## Docker/VPS

`docker-compose.yml` mapper `./data` til `/app/data` i containeren:

```yaml
volumes:
  - ./data:/app/data
```

Det betyder, at spil og uploads overlever container-restart. På en VPS bør du som minimum ændre:

```yaml
environment:
  ADMIN_PASSWORD: "en-lang-stærk-kode"
  DATA_DIR: "/app/data"
  MAX_UPLOAD_MB: "10"
```

Hvis du kører bag en reverse proxy, kan proxyen pege på containerens port `8000`.

## Vigtige filer

- `server.py`: FastAPI-backend, API, login, uploads og statisk filserver.
- `index.html`: Jeopardy-appen, Question maker og frontend-API-kald.
- `data/games/*.json`: spildata, som kan redigeres via interfacet.
- `data/uploads/`: uploadede billeder.
- `Dockerfile` og `docker-compose.yml`: container-setup.
- `GUIDE.md`: dansk guide til spilformat og brug.

## Hvad kan det?

- Jeopardy-bræt med kategorier og pointværdier.
- Flere hold og løbende pointstyring.
- Spørgsmål og svar som tekst, HTML eller Markdown.
- Hints, billeder, lyd, video, YouTube, LaTeX og speaker notes.
- Admin-beskyttet oprettelse/redigering af spil.
- Admin-beskyttet billed-upload.

## Licens

Projektet bygger på reveal.js, som er MIT-licenseret.
