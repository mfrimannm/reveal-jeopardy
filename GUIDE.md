# Guide til Jeopardy-filerne

Denne mappe er en Jeopardy-version bygget oven på reveal.js. Den vigtigste fil er `index.html`, som styrer layout, navigation, score, settings og reveal.js-plugins. Selve spørgsmålene ligger i `games/*.js`.

De to medfølgende spil er:

- `games/pokemon.js`: eksempelspil med markdown, billeder, YouTube, lyd, video, LaTeX, baggrunde og speaker notes.
- `games/science.js`: mere simpelt spil med almindelige tekstspørgsmål.

## Kort over filerne

- `index.html`: selve Jeopardy-appen. Her registreres spilfiler, settings, scorelogik, keyboard-navigation og reveal.js.
- `games/science.js`: et spil defineret som JavaScript-data.
- `games/pokemon.js`: et eksempelspil, der viser de fleste funktioner.
- `examples/assets/`: lokale eksempel-filer til lyd og video.
- `dist/` og `plugin/`: reveal.js-filer. Dem skal du normalt ikke ændre.

## Sådan skriver du spørgsmål ind

Et spil er et JavaScript-objekt i denne form:

```js
window.JEOPARDY_GAME = {
	id: "science",
	title: "Naturvidenskab Jeopardy",
	teams: ["Team 1", "Team 2", "Team 3"],
	categories: [
		{
			title: "Fysik",
			questions: [
				{
					points: 100,
					question: "Hvad kaldes kraften, der trækker genstande mod Jordens centrum?",
					answer: "Tyngdekraften.",
				},
			],
		},
	],
};
```

Hvert spørgsmål er et objekt inde i `questions`. De vigtigste felter er:

- `points`: pointværdien, for eksempel `100`.
- `question`: almindelig tekst til spørgsmålet.
- `answer`: almindelig tekst til svaret.
- `hints`: valgfri liste med hints, som vises som trin/fragments.
- `html`: spørgsmål skrevet som HTML.
- `answerHtml`: svar skrevet som HTML.
- `markdown`: spørgsmål skrevet som Markdown.
- `answerMarkdown`: svar skrevet som Markdown.
- `notes`: noter til speaker view.
- `notesHtml`: speaker notes skrevet som HTML.

Husk komma efter hvert felt og efter hvert spørgsmål, bortset fra at sidste komma i en liste er valgfrit.

## Flere eller færre kategorier

Kategorier styres af listen `categories`. Hvis du vil have færre kategorier, sletter du et kategori-objekt. Hvis du vil have flere, kopierer du et kategori-objekt og ændrer `title` og `questions`.

Eksempel med to kategorier:

```js
categories: [
	{
		title: "Historie",
		questions: [
			{ points: 100, question: "Hvem var ...?", answer: "..." },
			{ points: 200, question: "Hvornår skete ...?", answer: "..." },
		],
	},
	{
		title: "Geografi",
		questions: [
			{ points: 100, question: "Hvor ligger ...?", answer: "..." },
			{ points: 200, question: "Hvad hedder ...?", answer: "..." },
		],
	},
],
```

Boardet tilpasser sig automatisk antallet af kategorier.

## Flere eller færre rækker

Rækkerne styres af antallet af spørgsmål i hver kategori. Hvis hver kategori har 5 spørgsmål, får boardet 5 rækker. Hvis hver kategori har 7 spørgsmål, får boardet 7 rækker.

Eksempel med tre rækker:

```js
questions: [
	{ points: 100, question: "Let spørgsmål", answer: "Svar" },
	{ points: 200, question: "Mellem spørgsmål", answer: "Svar" },
	{ points: 300, question: "Svært spørgsmål", answer: "Svar" },
],
```

Det er bedst, at alle kategorier har samme antal spørgsmål. Hvis en kategori har færre spørgsmål end de andre, bliver der tomme felter i boardet.

## Question maker

Forsiden har et lille modul til at oprette en ny game-fil uden at skrive JavaScript i hånden.

1. Åbn `Settings`.
2. Tryk `Question maker`.
3. Skriv game titel, game id og teams.
4. Vælg antal kategorier og rækker.
5. Tryk `Lav board`.
6. Skriv kategorinavne direkte i toppen af boardet.
7. Klik på en point-celle og udfyld spørgsmål, svar og eventuelle ekstra felter under `Andet`, for eksempel hints og speaker notes.
8. Tryk `Gem kladde`, hvis du vil gemme arbejdet i browseren.
9. Tryk `Gem .js-fil`, når spillet skal eksporteres.

Hvis browseren understøtter filvælgeren, kan du vælge hvor `.js`-filen skal gemmes. Ellers bliver filen downloadet. Læg den færdige fil i `games/`.

Tryk derefter `Kopier GAME_FILES-linje` og indsæt linjen i `GAME_FILES` i `index.html`, for eksempel:

```js
"mit-spil": "games/mit-spil.js",
```

Browseren må normalt ikke skrive direkte ind i projektmappen af sig selv. Derfor gemmer modulet kladden i browserens `localStorage` og eksporterer en færdig JavaScript-fil.

## Teams og settings

Der er to typer settings:

1. Settings i spilfilen.
2. Settings valgt på forsiden i browseren.

I spilfilen kan du skrive standard-teams:

```js
teams: ["Rødt hold", "Blåt hold", "Grønt hold"],
```

På forsiden i `index.html` kan du vælge:

- antal teams, fra 1 til 6
- teamnavne
- hvilket game der skal spilles

Når du trykker `Gem settings` eller `Start game`, gemmes team-settings i browserens `localStorage`. Det betyder, at settings gemmes per game på den samme computer og i den samme browser. `Reset settings` sletter de gemte team-settings for det valgte game.

Hvis du vil ændre maksimum antal teams, ligger grænsen i `index.html`:

```js
const MAX_TEAM_COUNT = 6;
```

## Sådan tilføjer du et nyt game

1. Kopier for eksempel `games/science.js`.
2. Gem kopien som `games/mit-spil.js`.
3. Ret `id`, `title`, `teams`, `categories` og spørgsmålene.
4. Åbn `index.html`.
5. Tilføj spillet i `GAME_FILES`:

```js
const GAME_FILES = {
	pokemon: "games/pokemon.js",
	science: "games/science.js",
	mitspil: "games/mit-spil.js",
};
```

Hvis det nye spil skal være standardvalget, ændrer du:

```js
const DEFAULT_GAME_KEY = "mitspil";
```

Du kan også åbne et bestemt spil direkte med URL-parameter:

```txt
index.html?game=science
index.html?game=pokemon
index.html?game=mitspil
```

## Almindelig tekst, HTML og Markdown

Brug `question` og `answer`, når du bare skal skrive tekst:

```js
{
	points: 100,
	question: "Hvad er H2O?",
	answer: "Vand.",
}
```

Brug `html` og `answerHtml`, når du vil bruge billeder, video, lyd, tabeller eller special-layout:

```js
{
	points: 100,
	html: `
<p>Se på billedet:</p>
<img src="billeder/eksempel.png" alt="Eksempel">
<p>Hvad viser billedet?</p>
`,
	answerHtml: `<p>Det viser et eksempel.</p>`,
}
```

Brug `markdown` og `answerMarkdown`, når du vil skrive enklere formatteret tekst:

```js
{
	points: 200,
	markdown: `
		**Fed tekst** og *kursiv tekst*

		- Punkt 1
		- Punkt 2

		Hvad viser listen?
		`,
	answerMarkdown: `Den viser **to punkter**.`,
}
```

Markdown er godt til tekst, lister, citater, links, tabeller og kodeblokke. HTML er bedst til medier og mere præcis kontrol.

## Hints og fragments

Du kan lave hints sådan:

```js
{
	points: 200,
	question: "Hvilken planet kaldes den røde planet?",
	hints: ["Den er i vores solsystem.", "Den ligger efter Jorden."],
	answer: "Mars.",
}
```

På en spørgsmålsslide viser højre/ned-pil næste hint. Venstre/op går tilbage til boardet.

Du kan også lave dine egne fragments i HTML:

```js
html: `
<p class="fragment">Hint 1: Den er elektrisk.</p>
<p class="fragment">Hint 2: Den er gul.</p>
<p>Hvilken figur er det?</p>
`,
```

## Billeder

Brug almindelig HTML:

```js
{
	points: 100,
	html: `
<img src="billeder/foto.jpg" alt="Beskrivelse af billedet">
<p>Hvad ser vi her?</p>
`,
	answer: "Svaret.",
}
```

Lokale billeder kan for eksempel lægges i en mappe som `billeder/`. Hvis billedet ligger ved siden af `index.html`, skal stien passe derfra.

## Lyd

Lyd kan afspilles med kontroller:

```js
{
	points: 300,
	html: `
<audio src="examples/assets/beeping.wav" controls></audio>
<p>Hvilken lyd hører vi?</p>
`,
	answer: "En biplyd.",
}
```

Lyd kan også starte automatisk, når fragmentet vises:

```js
html: `
<div class="fragment">
	Lyd 1
	<audio src="examples/assets/beeping.wav" data-autoplay></audio>
</div>
`,
```

Browsere kan blokere autoplay med lyd, især før man har klikket på siden. `controls` er derfor mest stabilt, hvis du vil være sikker.

## Video

Video som indhold på sliden:

```js
{
	points: 100,
	html: `
<video src="examples/assets/video.mp4" controls></video>
<p>Hvad sker der i videoen?</p>
`,
	answer: "Svar.",
}
```

Video som baggrund:

```js
{
	points: 200,
	backgroundVideo: "examples/assets/video.mp4",
	backgroundVideoLoop: true,
	backgroundVideoMuted: true,
	backgroundColor: "#000000",
	html: `<p>Spørgsmål oven på video-baggrunden.</p>`,
	answer: "Svar.",
}
```

Baggrundsvideoer bør normalt være muted. Det giver færre problemer med browserens autoplay-regler.

## YouTube

YouTube bruges som `iframe` i `html`:

```js
{
	points: 100,
	html: `
<iframe
	src="https://www.youtube.com/embed/bILE5BEyhdo?rel=0"
	title="YouTube clip"
	allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
	allowfullscreen></iframe>
<p>Hvad vises i klippet?</p>
`,
	answer: "Svar.",
}
```

Hvis du vil starte et klip et bestemt sted, kan du bruge `start`:

```txt
https://www.youtube.com/embed/bILE5BEyhdo?start=20&rel=0
```

YouTube kræver internetforbindelse. Hvis du skal bruge spillet offline, er lokale video- eller lydfiler mere sikre.

Kræver som regel at man kører python serveren.

## LaTeX og matematik

Matematik er slået til i `index.html` med MathJax 4. Du kan skrive inline-matematik med `$...$` og display-matematik med `$$...$$`.

```js
{
	points: 100,
	html: `
<p>Hvad er resultatet?</p>
<p>$$90 \\times 2 = ?$$</p>
`,
	answerHtml: `<p>$$180$$</p>`,
}
```

Når du skriver LaTeX inde i en JavaScript-string, skal backslash normalt skrives som dobbelt backslash:

```js
"$$\\frac{4}{6}=\\frac{2}{3}$$"
```

## Slide-settings for enkelte spørgsmål

Du kan give enkelte spørgsmål deres egne reveal.js-settings.

Baggrundsfarve:

```js
{
	points: 100,
	backgroundColor: "#1b4d89",
	question: "Spørgsmål med blå baggrund.",
	answer: "Svar.",
}
```

Baggrundsbillede:

```js
{
	points: 200,
	background: "billeder/baggrund.jpg",
	slideAttributes: {
		"data-background-size": "contain",
		"data-background-opacity": "0.35",
	},
	html: `<p>Spørgsmål oven på billedet.</p>`,
	answer: "Svar.",
}
```

Transition:

```js
{
	points: 300,
	transition: "zoom",
	question: "Denne slide bruger zoom-transition.",
	answer: "Svar.",
}
```

Auto-animate:

```js
{
	points: 400,
	autoAnimate: true,
	question: "Denne slide får data-auto-animate.",
	answer: "Svar.",
}
```

Ekstra CSS-klasse:

```js
{
	points: 500,
	className: "min-special-slide",
	question: "Denne slide får en ekstra CSS-klasse.",
	answer: "Svar.",
}
```

Avancerede data-attributter kan sættes med `slideAttributes`:

```js
slideAttributes: {
	"data-background-opacity": "0.4",
	"data-background-size": "contain",
}
```

## Sådan starter du spillet via HTML

Den hurtigste måde:

1. Dobbeltklik på `index.html`.
2. Vælg game på forsiden.
3. Sæt antal teams og teamnavne.
4. Tryk `Start game`.

Fordele:

- Kræver ingen installation.
- Godt til hurtig test.
- Virker ofte fint med lokale filer.

Ulemper:

- Nogle browsere kan have strengere regler for lokale filer.
- Popups, speaker view, lokale medier eller eksterne embeds kan være mindre stabile.
- URL'er starter med `file:///`, hvilket ikke altid opfører sig som en rigtig webserver.
- Youtube klip via Iframe virker som regel ikke.

## Sådan starter du spillet via Python

Hvis Python er installeret, kan du starte en lille lokal webserver fra projektmappen:

```powershell
python -m http.server 8000
```

Åbn derefter:

```txt
http://localhost:8000/
```

Direkte til et bestemt spil:

```txt
http://localhost:8000/?game=science
http://localhost:8000/?game=pokemon
```

Fordele:

- Minder mere om en rigtig hjemmeside.
- Mere stabilt for scripts, medier, speaker view og URL-hash.
- Gør det nemmere at teste på en anden enhed på samme netværk.

Ulemper:

- Kræver Python.
- Serveren skal køre, mens du spiller.
- Terminalvinduet skal holdes åbent.

Stop serveren med `Ctrl+C` i terminalen.

## Keyboard

På forsiden og boardet:

- Brug musen til at vælge game, settings og spørgsmål.
- Piletasterne kan navigere mellem reveal.js-slides.
- Klik på et pointfelt for at åbne spørgsmålet.

På en spørgsmålsslide:

- Højre eller ned: viser næste hint/fragment.
- Venstre eller op: går tilbage til boardet uden at markere spørgsmålet som brugt.
- `Show answer`: viser svaret.
- `+` ved et team: giver teamet point og går tilbage til boardet.
- `-` ved et team: trækker point fra teamet og går tilbage til boardet.

Når et spørgsmål er scoret med `+` eller `-`, markeres feltet som brugt på boardet.

Andre reveal.js-genveje:

- `S`: åbner speaker view.
- `F`: fullscreen, hvis browseren tillader det.
- `Esc`: overview over slides.
- `Alt` + piletast: springer fragments over i reveal.js-navigation.

## Speaker view

Speaker view åbnes med `S`. Det åbner et ekstra vindue med den aktuelle slide, næste slide, tid og speaker notes.

Du tilføjer noter til et spørgsmål med `notes`:

```js
{
	points: 600,
	question: "Hvilket element bruges til speaker notes?",
	answer: "aside.notes.",
	notes: "Denne note vises kun i speaker view.",
}
```

Eller med HTML:

```js
{
	points: 600,
	question: "Spørgsmål",
	answer: "Svar",
	notesHtml: "<strong>Husk:</strong> sig dette højt til sidst.",
}
```

Hvis speaker view ikke åbner, skal du tillade popups i browseren. Det er ofte mere stabilt, når spillet køres via `python -m http.server 8000` i stedet for direkte som `file:///`.

## Praktiske fejlkilder

- Hvis spillet ikke dukker op i listen, mangler det sandsynligvis i `GAME_FILES` i `index.html`.
- Hvis siden bliver blank, er der ofte en JavaScript-syntaxfejl i `games/*.js`, typisk et manglende komma, citationstegn eller en forkert backtick.
- Hvis æ, ø og å ser forkerte ud, så gem filen som UTF-8.
- Hvis YouTube ikke virker, så tjek internetforbindelse og embed-linket.
- Hvis autoplay-lyd ikke virker, så brug `controls` eller klik på siden først.
- Hvis LaTeX ikke vises rigtigt, så tjek om backslashes er skrevet som `\\` inde i JavaScript-strings.
