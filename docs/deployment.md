# Deployment

Reveal Jeopardy kan deployes med lokal Docker build eller med det færdige image fra GHCR.

## Lokal Docker build

```sh
docker compose up --build -d
```

`docker-compose.yml` bygger `Dockerfile` lokalt og starter appen på port `8000`.

## Færdigt image

```sh
docker compose -f docker-compose.image.yml pull
docker compose -f docker-compose.image.yml up -d
```

Image:

```text
ghcr.io/mfrimannm/reveal-jeopardy:latest
```

## VPS compose-eksempel

```yaml
services:
  reveal-jeopardy:
    image: ghcr.io/mfrimannm/reveal-jeopardy:latest
    container_name: reveal-jeopardy
    restart: unless-stopped
    ports:
      - "8000:8000"
    environment:
      ADMIN_PASSWORD: "en-lang-staerk-kode"
      SESSION_SECRET: "en-anden-lang-hemmelighed"
      DATA_DIR: "/app/data"
      MAX_UPLOAD_MB: "10"
      MAX_VIDEO_UPLOAD_MB: "50"
    volumes:
      - ./data:/app/data
```

## Miljøvariabler

- `ADMIN_PASSWORD`: kode til admin-login. Standard er `change-me`.
- `SESSION_SECRET`: signering af admin-cookie. Hvis den ikke sættes, bruges `ADMIN_PASSWORD`.
- `DATA_DIR`: mappe til spil og uploads. I containeren bør den være `/app/data`.
- `MAX_UPLOAD_MB`: maks størrelse for billeder og fallback for videoer. Standard er `10`.
- `MAX_VIDEO_UPLOAD_MB`: maks størrelse for MP4/WebM. Standard er samme værdi som `MAX_UPLOAD_MB`.

## Data volume

Mount altid data på VPS:

```yaml
volumes:
  - ./data:/app/data
```

Serveren bruger:

```text
/app/data/games
/app/data/uploads
```

Uden volume kan nye spil og uploads forsvinde, når containeren udskiftes.

## Seed games

Dockerfile kopierer de games, der findes i repoets `data/games`, til `/app/seed-data/games` under build. Ved start kopierer serveren seed games ind i `DATA_DIR/games`, hvis mappen ikke allerede indeholder JSON-filer.

Eksisterende spil i volume overskrives ikke.

## Reverse proxy

Proxy til port `8000` i containeren. Live sessions bruger WebSockets på:

```text
/ws/sessions/<SESSION_ID>
```

Sørg for at proxyen tillader WebSocket upgrade.

## Opdatering

```sh
docker compose -f docker-compose.image.yml pull
docker compose -f docker-compose.image.yml up -d
```

Data bliver liggende i `./data`, hvis volume-mountet er uændret.
