# Guide til Reveal Jeopardy

Reveal Jeopardy kører som en FastAPI-app med en reveal.js-frontend. Spil gemmes som JSON i `data/games/`, og billeder uploadet fra interfacet gemmes i `data/uploads/`.

## Start Appen

Med Docker:

```sh
docker compose up --build
```

Åbn derefter:

```text
http://localhost:8000
```

Uden Docker:

```sh
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8000
```

## Vigtige Filer

- `server.py`: backend, API, admin-login og uploads.
- `index.html`: spilbræt, settings, Question maker og reveal.js.
- `data/games/*.json`: spilfiler.
- `data/uploads/`: uploadede billeder.
- `Dockerfile` og `docker-compose.yml`: container-setup.
- `examples/assets/`: lokale eksempelmedier.

## Spilformat

Et spil er et JSON-objekt:

```json
{
	"id": "science",
	"title": "Naturvidenskab Jeopardy",
	"teams": ["Team 1", "Team 2", "Team 3"],
	"categories": [
		{
			"title": "Fysik",
			"questions": [
				{
					"points": 100,
					"question": "Hvad kaldes kraften, der trækker genstande mod Jordens centrum?",
					"answer": "Tyngdekraften."
				}
			]
		}
	]
}
```

De vigtigste felter på et spørgsmål er:

- `points`: pointværdi.
- `question`: spørgsmål som almindelig tekst.
- `answer`: svar som almindelig tekst.
- `markdown` og `answerMarkdown`: spørgsmål/svar skrevet som Markdown.
- `html` og `answerHtml`: spørgsmål/svar skrevet som HTML.
- `hints`: liste med hints, som vises som fragments.
- `notes` eller `notesHtml`: speaker notes.
- `background`, `backgroundColor`, `backgroundVideo`, `backgroundIframe`: reveal.js-baggrunde.

Hvis du redigerer JSON manuelt, skal feltnavne og tekst stå i citationstegn, og sidste felt i et objekt må ikke have et ekstra komma.

## Question Maker

1. Åbn `Settings`.
2. Tryk `Question maker`.
3. Log ind med admin-koden.
4. Skriv game titel, game id og teams.
5. Vælg antal kategorier og rækker.
6. Tryk `Lav board`.
7. Klik på en point-celle og udfyld spørgsmål, svar, hints og speaker notes.
8. Upload eventuelle billeder direkte i spørgsmålseditoren.
9. Tryk `Gem kladde`, hvis du vil gemme arbejdet lokalt i browseren.
10. Tryk `Gem spil`, når spillet skal gemmes på serveren.

Når du trykker `Gem spil`, skriver backend spillet til `data/games/<game-id>.json`. Listen over spil hentes automatisk fra serveren, så du skal ikke længere redigere `index.html`.

## Billeder Og Medier

Uploadede billeder får en URL i denne form:

```text
/uploads/filnavn.webp
```

Question maker indsætter automatisk billedet i spørgsmålet. Hvis spørgsmålet er Markdown, indsættes det som:

```md
![Beskrivelse](/uploads/filnavn.webp)
```

Hvis spørgsmålet er HTML, indsættes det som:

```html
<img src="/uploads/filnavn.webp" alt="Beskrivelse">
```

Du kan stadig bruge eksterne billeder, YouTube-iframes, HTML, Markdown og lokale filer fra `examples/assets/`.

## Teams Og Settings

Et spil kan have standardteams:

```json
"teams": ["Rødt hold", "Blåt hold", "Grønt hold"]
```

På forsiden kan du vælge antal teams og teamnavne for den aktuelle browser. De settings gemmes i browserens `localStorage`, ikke i spilfilen.

## Docker På VPS

`docker-compose.yml` mapper `./data` til `/app/data`, så spil og uploads overlever container-restart:

```yaml
volumes:
  - ./data:/app/data
```

Skift altid admin-koden før deployment:

```yaml
environment:
  ADMIN_PASSWORD: "en-lang-stærk-kode"
  DATA_DIR: "/app/data"
  MAX_UPLOAD_MB: "10"
```

Hvis appen ligger bag en reverse proxy, skal proxyen sende trafik til port `8000` i containeren.

## Fejlfinding

- Hvis spil ikke vises, så tjek at `data/games/*.json` findes og er gyldig JSON.
- Hvis `Gem spil` eller upload fejler, så tjek at du er logget ind som admin.
- Hvis uploads forsvinder efter restart, så tjek Docker volume-mountet til `/app/data`.
- Hvis billeder ikke vises, så tjek at URL’en starter med `/uploads/`.
