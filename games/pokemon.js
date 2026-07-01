window.JEOPARDY_GAME = {
	id: "pokemon",
	title: "Pokemon Feature Jeopardy",
	teams: ["Team Rød", "Team Blå", "Team Gul"],
	categories: [
		{ // Markdown
			title: "Markdown",
			questions: [
				{
					points: 100,
					markdown: `
						**Pikachu** bruger *Thunder Shock*.

						Hvilken Pokemon er skrevet med **fed** markdown?
						`,
					answerMarkdown: `**Pikachu** er skrevet med fed markdown.`,
				},
				{
					points: 200,
					markdown: `
						Professor Oak har denne liste:

						- Bulbasaur
						- Charmander
						- Squirtle

						Hvilken starter er vandtypen?
						`,
					answerMarkdown: `**Squirtle** er vandtypen.`,
				},
				{
					points: 300,
					markdown: `
						> "Jeg vælger dig!"

						Hvilken reveal.js/markdown-form vises citatet som?
						`,
					answerMarkdown: `Det er et **blockquote**.`,
				},
				{
					points: 400,
					markdown: `
						| Pokemon | Type |
						| --- | --- |
						| Bulbasaur | Grass/Poison |
						| Charmander | Fire |
						| Squirtle | Water |

						Hvilken type har Charmander i tabellen?
						`,
					answerMarkdown: `**Fire**.`,
				},
				{
					points: 500,
					markdown: `
						Markdown kan også lave links.

						[PokeAPI](https://pokeapi.co/) har data om Pokemon.

						Hvad hedder API'et i linket?
						`,
					answerMarkdown: `Det hedder **PokeAPI**.`,
				},
				{
					points: 600,
					markdown: `
						~~~js [1|3|5]
						const team = ["Pikachu", "Eevee", "Snorlax"];
						const sleepy = team.includes("Snorlax");
						const mascot = team[0];

						console.log(mascot, sleepy);
						~~~

						Hvilken Pokemon bliver gemt i variablen \`mascot\`?
						`,
					answerMarkdown: `\`mascot\` bliver **Pikachu**.`,
				},
				{
					points: 900,
					markdown: `
						~~~js [1|3|5]
						const team = ["Pikachu", "Eevee", "Snorlax"];
						const sleepy = team.includes("Snorlax");
						const mascot = team[0];

						console.log(mascot, sleepy);
						~~~

						Hvilken Pokemon bliver gemt i variablen \`mascot\`?
						`,
					answerMarkdown: `\`mascot\` bliver **Pikachu**.`,
				},
			],
		},
		{ // Billeder
			title: "Billeder",
			questions: [
				{
					points: 100,
					html: `
<div class="media-row">
	<img class="pokemon-sprite" src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png" alt="Pikachu">
	<p>Hvilken elektrisk maskot er vist på billedet?</p>
</div>
`,
					answer: "Pikachu.",
				},
				{
					points: 200,
					html: `
<div class="media-row">
	<img class="pokemon-sprite" src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/1.png" alt="Bulbasaur">
	<p>Hvilken Kanto-starter har en planteknop på ryggen?</p>
</div>
`,
					answer: "Bulbasaur.",
				},
				{
					points: 300,
					html: `
<div class="media-row">
	<img class="pokemon-sprite" src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/4.png" alt="Charmander">
	<p>Hvad hedder den ildtype, der har flamme på halen?</p>
</div>
`,
					answer: "Charmander.",
				},
				{
					points: 400,
					html: `
<div class="media-row">
	<img class="pokemon-sprite" src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/7.png" alt="Squirtle">
	<p>Hvilken starter bruger skjoldet på ryggen som tema?</p>
</div>
`,
					answer: "Squirtle.",
				},
				{
					points: 500,
					html: `
<div class="media-row">
	<img class="pokemon-sprite" src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/133.png" alt="Eevee">
	<p>Hvilken Pokemon er kendt for mange mulige evolutioner?</p>
</div>
`,
					answer: "Eevee.",
				},
				{
					points: 600,
					html: `
<div class="media-row">
	<img class="pokemon-sprite" src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/143.png" alt="Snorlax">
	<p>Hvilken Pokemon blokerer ofte vejen, fordi den sover?</p>
</div>
`,
					answer: "Snorlax.",
				},
			],
		},
		{ // YouTube
			title: "YouTube",
			questions: [
				{
					points: 100,
					html: `
<iframe data-autoplay src="https://www.youtube.com/embed/bILE5BEyhdo?rel=0" title="Pokemon YouTube clip" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
<p>Hvilken reveal.js-medietype bruges til at vise YouTube-klippet?</p>
`,
					answer: "Et iframe-embed.",
				},
				{
					points: 200,
					html: `
<iframe src="https://www.youtube.com/embed/wmnkAOO6Qo4?rel=0" title="Pokemon YouTube clip" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
<p>Hvilken Pokemon-art er gul og forbindes med lyn?</p>
`,
					answer: "Pikachu.",
				},
				{
					points: 300,
					html: `
<iframe src="https://www.youtube.com/embed/bILE5BEyhdo?start=20&rel=0" title="Pokemon YouTube clip with start time" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
<p>Hvilken iframe-parameter starter klippet inde i videoen?</p>
`,
					answer: "Parameteren start.",
				},
				{
					points: 400,
					html: `
<iframe src="https://www.youtube.com/embed/bILE5BEyhdo?rel=0" title="Pokemon YouTube clip as slide content" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
<p>YouTube ligger her som almindeligt slide-indhold, så score-knapperne stadig er nemme at ramme.</p>
<p>Hvilket HTML-element bruges til embed'et?</p>
`,
					answer: "iframe.",
				},
				{
					points: 600,
					html: `
<iframe src="https://www.youtube.com/embed/bILE5BEyhdo?rel=0&modestbranding=1" title="Pokemon YouTube clip with modest branding" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
<p>Hvilken Pokemon-franchise-feature viser vi her: lokal video, billede eller online iframe?</p>
`,
					answer: "Online iframe.",
				},
			],
		},
		{ // Video og lyd
			title: "Video og lyd",
			questions: [
				{
					points: 100,
					html: `
<video src="examples/assets/video.mp4" controls data-autoplay></video>
<p>Hvilket HTML-element afspiller klippet?</p>
`,
					answer: "video-elementet.",
				},
				{
					points: 200,
					backgroundVideo: "examples/assets/video.mp4",
					backgroundVideoLoop: true,
					backgroundVideoMuted: true,
					backgroundColor: "#000000",
					html: `
<div style="background: rgba(0, 0, 0, 0.74); padding: 24px; max-width: 760px;">
	<p>Videoen koerer kun som muted loop-baggrundsgrafik.</p>
	<p>Hvilke to data-attributter holder den i baggrunden uden lyd?</p>
</div>
`,
					answer: "data-background-video-muted og data-background-video-loop.",
				},
				{
					points: 300,
					html: `
<audio src="examples/assets/beeping.wav" controls></audio>
<p>Hvilket reveal.js-medie kan bruges til Pokemon-lydeffekter?</p>
`,
					answer: "audio-elementet.",
				},
				{
					points: 400,
					html: `
<p>Træd gennem lydene som fragments:</p>
<div class="fragment">Pika! <audio src="examples/assets/beeping.wav" data-autoplay></audio></div>
<div class="fragment">Chu! <audio src="examples/assets/beeping.wav" data-autoplay></audio></div>
<p>Hvilken klasse får elementer til at komme frem trinvis?</p>
`,
					answer: "fragment.",
				},
				{
					points: 500,
					html: `
<div class="media-row">
	<video src="examples/assets/video.mp4" muted loop controls></video>
	<img class="pokemon-sprite" src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/150.png" alt="Mewtwo">
</div>
<p>Hvilken attribut gør, at videoen kan køre uden lyd?</p>
`,
					answer: "muted.",
				},
				{
					points: 600,
					html: `
<video src="examples/assets/video.mp4" controls poster="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/6.png"></video>
<p>Hvilken attribut viser et billede, før videoen afspilles?</p>
`,
					answer: "poster.",
				},
			],
		},
		{ // LaTeX og matematik
			title: "LaTeX og matematik",
			questions: [
				{
					points: 100,
					html: `
<p>Pikachu har base speed 90. Agility fordobler speed.</p>
<p>$$90 \\times 2 = ?$$</p>
`,
					answerHtml: `<p>$$180$$</p>`,
				},
				{
					points: 200,
					html: `
<p>En potion healer 20 HP. Tre potions giver:</p>
<p>$$3 \\cdot 20 = ?$$</p>
`,
					answerHtml: `<p>$$60\\text{ HP}$$</p>`,
				},
				{
					points: 300,
					html: `
<p>En kamp giver 240 XP fordelt på 2 Pokemon.</p>
<p>$$\\frac{240}{2} = ?$$</p>
`,
					answerHtml: `<p>$$120\\text{ XP}$$</p>`,
				},
				{
					points: 400,
					html: `
<p>En typebonus på 1,5 gange bruges på et angreb med styrke 80.</p>
<p>$$80 \\times 1.5 = ?$$</p>
`,
					answerHtml: `<p>$$120$$</p>`,
					notes: "120",
				},
				{
					points: 500,
					html: `
<p>Et hold har 6 Pokemon. 4 er klar til kamp.</p>
<p>$$\\frac{4}{6}=\\frac{?}{3}$$</p>
`,
					answerHtml: `<p>$$\\frac{4}{6}=\\frac{2}{3}$$</p>`,
				},
				{
					points: 600,
					html: `
<p>Hvis en skadeformel forenkles til:</p>
<p>$$D = \\left\\lfloor \\frac{(42 \\cdot 90 \\cdot 1.5)}{50} \\right\\rfloor + 2$$</p>
<p>Hvad bliver D?</p>
`,
					answerHtml: `<p>$$D = 115$$</p>`,
				},
			],
		},
		{ // Reveal tricks
			title: "Reveal tricks",
			questions: [
				{
					points: 100,
					html: `
<p class="fragment">Hint 1: Den er elektrisk.</p>
<p class="fragment">Hint 2: Den siger ofte sit eget navn.</p>
<p class="fragment">Hint 3: Den er Ashs mest kendte makker.</p>
<p>Hvilken Pokemon er det?</p>
`,
					answer: "Pikachu.",
				},
				{
					points: 200,
					html: `
<h3 class="r-fit-text">CHARIZARD</h3>
<p>Hvilken layout-helper får teksten til at passe stort i sliden?</p>
`,
					answer: "r-fit-text.",
				},
				{
					points: 300,
					html: `
<pre><code class="language-js" data-line-numbers="1|2|4">const pokeball = { open: false };
pokeball.open = true;

console.log("Gotcha!");
</code></pre>
<p>Hvilket plugin farver kode og kan markere linjer?</p>
`,
					answer: "Highlight-pluginet.",
				},
				{
					points: 400,
					background: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/94.png",
					slideAttributes: {
						"data-background-size": "contain",
						"data-background-opacity": "0.32",
					},
					html: `
<div style="background: rgba(0, 0, 0, 0.78); padding: 24px; max-width: 760px;">
	<p>Gengar ligger som billedbaggrund.</p>
	<p>Hvilken attribut sætter et baggrundsbillede på sliden?</p>
</div>
`,
					answer: "data-background.",
				},
				{
					points: 500,
					transition: "zoom",
					backgroundColor: "#1b4d89",
					html: `
<p>Denne slide har en zoom-transition.</p>
<p>Hvilken data-attribut kan ændre overgangen for en enkelt slide?</p>
`,
					answer: "data-transition.",
				},
				{
					points: 600,
					html: `
						<p>Tryk <strong>S</strong> i reveal.js for speaker view.</p>
						<p>Hvilket skjult element indeholder noter til oplægsholderen?</p>
						`,
					answer: "aside.notes.",
					notes: "Speaker note: Svaret er aside.notes. Denne note vises i speaker view, ikke på selve sliden.",
				},
			],
		},
	],
};
