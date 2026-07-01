# Reveal Jeopardy

Dette projekt er en måde at lave og afvikle Jeopardy-spil i browseren. Det bygger på reveal.js, men er sat op som et spilbræt med kategorier, spørgsmål, svar, point, hold og speaker view.

Brug det til quizzer, undervisning, workshops, fredagsbar eller andre situationer, hvor et Jeopardy-format gør spørgsmålene lidt sjovere at spille igennem.

## Kom i gang

Start spillet lokalt fra projektmappen:

```sh
python -m http.server 8000
```

Åbn derefter:

```text
http://localhost:8000
```

Du kan også åbne `index.html` direkte i browseren, men Python-serveren er mere stabil til lokale billeder, lyd, video og speaker view.

## Sådan laver du et spil

Spillene ligger i `games/` som JavaScript-filer. Hvert spil beskriver titel, hold, kategorier, spørgsmål og svar.

De vigtigste filer er:

- `index.html`: selve Jeopardy-appen med bræt, navigation, score og reveal.js.
- `games/science.js`: et simpelt eksempelspil.
- `games/pokemon.js`: et større eksempel med billeder, lyd, video, Markdown, LaTeX og speaker notes.
- `GUIDE.md`: dansk guide til at oprette og redigere spil.

Et meget simpelt spørgsmål ser sådan ud:

```js
{
	points: 100,
	question: "Hvad hedder Danmarks hovedstad?",
	answer: "København.",
}
```

Du kan også lave et nyt spil fra forsiden:

1. Åbn `Settings`.
2. Tryk `Question maker`.
3. Vælg antal kategorier og rækker.
4. Tryk `Lav board`.
5. Klik rundt på boardet og udfyld hvert spørgsmål med spørgsmål, svar, hints og speaker notes.
6. Tryk `Gem .js-fil`.
7. Gem filen i `games/` og tilføj den kopierede linje til `GAME_FILES` i `index.html`.

Browseren kan ikke skrive direkte til projektmappen uden en filvælger eller en lokal backend, så modulet gemmer kladden i browseren og eksporterer en færdig JavaScript-fil.

## Hvad kan det?

- Jeopardy-bræt med kategorier og pointværdier.
- Flere hold og løbende pointstyring.
- Spørgsmål og svar som tekst, HTML eller Markdown.
- Mulighed for hints, billeder, lyd, video, YouTube og LaTeX.
- Speaker view med noter til værten.
- Keyboard-navigation via reveal.js.

## Mere hjælp

Se [GUIDE.md](GUIDE.md) for den praktiske guide til at bygge egne Jeopardy-spil, ændre indstillinger og bruge de medfølgende eksempler.

## Licens

Projektet bygger på reveal.js, som er MIT-licenseret.
