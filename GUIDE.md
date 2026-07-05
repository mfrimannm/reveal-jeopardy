# Guide til Reveal Jeopardy

Denne guide er skrevet til hosten, der skal oprette og afvikle et spil. Den korte version er: start appen, vælg eller lav et spil, start eventuelt en live session, del QR-koden og kør boardet.

## Start appen

Med Docker:

```sh
docker compose up --build
```

Åbn derefter:

```text
http://localhost:8000
```

Med det færdige Docker image:

```sh
docker compose -f docker-compose.image.yml pull
docker compose -f docker-compose.image.yml up -d
```

Uden Docker:

```sh
python -m pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8000
```

## Før du holder quiz eller Jeopardy

1. Åbn appen i browseren.
2. Vælg spil, hvis forsiden viser flere spil.
3. Åbn `Settings`.
4. Tjek holdnavne og gem settings, hvis du vil ændre dem for denne browser.
5. Tryk `Start game`, når du er klar til at gå til boardet.

Settings for hold gemmes kun i browseren. Selve spillet ligger på serveren.

## Admin-login

Admin-login bruges kun til ting, der skriver til serveren:

- gemme spil fra Question maker
- uploade billeder
- uploade videoer

Gå til `Settings`, åbn `Question maker`, skriv admin-koden og tryk login. Koden sættes med `ADMIN_PASSWORD` i Docker eller miljøet. Standardværdien er `change-me`, og den bør altid ændres på en server.

## Lav et nyt spil

1. Gå til `Settings`.
2. Tryk `Question maker`.
3. Log ind som admin.
4. Skriv titel, game id og holdnavne.
5. Vælg antal kategorier og antal rækker.
6. Tryk `Lav board`.
7. Klik på et pointfelt i builder-boardet.
8. Udfyld spørgsmål, svar, hints og eventuelle medier.
9. Gentag for alle felter.
10. Tryk `Gem kladde`, hvis du vil gemme lokalt i browseren.
11. Tryk `Gem spil`, når spillet skal gemmes på serveren.

Når spillet gemmes, opretter backend filen:

```text
data/games/<game-id>.json
```

Hvis du ændrer game id, sender appen dig videre til det gemte spil.

## Spilformat kort fortalt

Et spil består af titel, id, teams og kategorier:

```json
{
  "id": "fredagsquiz",
  "title": "Fredagsquiz",
  "teams": ["Rødt hold", "Blåt hold"],
  "categories": [
    {
      "title": "Musik",
      "questions": [
        {
          "points": 100,
          "question": { "format": "rich", "content": "Hvem sang **Purple Rain**?" },
          "answer": { "format": "rich", "content": "Prince" }
        }
      ]
    }
  ]
}
```

Question maker skriver dette format for dig. Du behøver normalt ikke redigere JSON manuelt.

## Afvikl Jeopardy

1. Tryk `Start game`.
2. Klik på en pointcelle på boardet.
3. Læs spørgsmålet op.
4. Tryk `Show answer`, når svaret skal vises.
5. Giv point med knapperne for korrekt eller forkert svar.
6. Appen markerer feltet som brugt og går tilbage til boardet.

Hvis flere hold skal have point på samme spørgsmål, slå `Flere teams` til på spørgsmålsslidet. Så kan du give flere pointændringer, før du går tilbage.

## Brug buzzer-systemet

Live buzzer er til spil, hvor deltagere skal buzze fra deres telefon.

1. Gå til `Settings`.
2. Find `Live session`.
3. Tryk `Start live session`.
4. Vis QR-koden eller del join-linket.
5. Lad deltagere joine med navn og hold.
6. Tryk `Start game`.
7. Åbn et spørgsmål. Buzzer-listen ryddes automatisk, og buzzers åbnes.
8. Når deltagere buzzer, vises rækkefølgen hos hosten.
9. Brug `Lås buzzers`, hvis ingen flere må buzze.
10. Brug `Ryd buzzers`, hvis du vil starte forfra på samme spørgsmål.
11. Brug `Stop session`, når spillet er færdigt.

Deltagerlinket har denne form:

```text
http://<din-server>/play/<SESSION_ID>
```

På lokalt netværk skal deltagerne bruge en adresse, deres mobil kan nå. `localhost` virker kun på hostens egen computer.

Mere detaljeret guide: [docs/live-sessions.md](docs/live-sessions.md).

## Quiz-mode

Quiz-mode er ikke en separat knap i appen. Det er en måde at bruge samme flow på:

- Lav kategorier som runder eller emner.
- Brug point som spørgsmålsværdi.
- Vis spørgsmålet, lad holdene svare, og tryk `Show answer`.
- Giv point manuelt med scoreknapperne.
- Brug `Flere teams`, hvis flere hold skal have point på samme spørgsmål.
- Start en live session, hvis deltagerne skal buzze fra mobilen.

Mere detaljeret guide: [docs/quiz-mode.md](docs/quiz-mode.md).

## Upload billeder og videoer

Uploads kræver admin-login.

I Question maker kan du uploade:

- billede til spørgsmål
- billede til svar
- video til spørgsmål
- video til svar

Tilladte formater:

- PNG, JPG, GIF, WebP
- MP4, WebM

Når en fil uploades, gemmes den i `data/uploads/` og indsættes automatisk i spørgsmålet eller svaret. URL'en starter med `/uploads/`.

## Video og medier

Question maker kan indsætte:

- YouTube
- lokal video
- lyd
- billede
- LaTeX/math

For medier kan du sætte starttidspunkt, sluttidspunkt, autoplay, loop, controls og muted. For baggrundsvideo kan du sætte `Baggrundsvideo`, `Loop baggrundsvideo` og `Mute baggrundsvideo`.

Lokale videoer bør normalt komme fra uploads, for eksempel:

```text
/uploads/min-video-1a2b3c4d.mp4
```

## Hvad gemmes hvor?

- Spil gemmes på serveren i `data/games/`.
- Uploads gemmes på serveren i `data/uploads/`.
- Score og brugte spørgsmål gemmes i browserens `localStorage`.
- Question maker-kladde gemmes i browserens `localStorage`.
- Live sessions gemmes i serverens hukommelse og forsvinder ved restart.

Hvis du kører Docker, skal `./data` mountes til `/app/data`, ellers forsvinder spil og uploads ved containerudskiftning.

## Tests for udviklere

Installer afhængigheder:

```sh
python -m pip install -r requirements-test.txt
npm install
```

Kør backend-tests:

```sh
python -m pytest tests/backend
```

Kør frontend unit tests:

```sh
npm run test:frontend
```

Kør UI-tests:

```sh
npx playwright install
npm run test:ui
```

Flere detaljer: [docs/testing.md](docs/testing.md).

## Fejlfinding

- Hvis `Gem spil` fejler, tjek admin-login.
- Hvis upload fejler, tjek admin-login, filtype og filstørrelse.
- Hvis deltagere ikke kan åbne QR-linket, brug serverens LAN-IP eller domæne i stedet for `localhost`.
- Hvis live session forsvinder, er serveren eller containeren sandsynligvis genstartet.
- Hvis spil forsvinder efter Docker-opdatering, mangler volume-mountet til `/app/data`.
