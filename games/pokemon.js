window.JEOPARDY_GAME = {
	"id": "pokemon",
	"title": "Pokemon Feature Jeopardy",
	"teams": [
		"Team Rød",
		"Team Blå",
		"Team Gul"
	],
	"categories": [
		{
			"title": "Markdown",
			"questions": [
				{
					"points": 100,
					"question": {
						"format": "rich",
						"content": "\n\t\t\t\t\t\t**Pikachu** bruger *Thunder Shock*.\n\n\t\t\t\t\t\tHvilken Pokemon er skrevet med **fed** markdown?\n\t\t\t\t\t\t"
					},
					"answer": {
						"format": "rich",
						"content": "**Pikachu** er skrevet med fed markdown."
					}
				},
				{
					"points": 200,
					"question": {
						"format": "rich",
						"content": "\n\t\t\t\t\t\tProfessor Oak har denne liste:\n\n\t\t\t\t\t\t- Bulbasaur\n\t\t\t\t\t\t- Charmander\n\t\t\t\t\t\t- Squirtle\n\n\t\t\t\t\t\tHvilken starter er vandtypen?\n\t\t\t\t\t\t"
					},
					"answer": {
						"format": "rich",
						"content": "**Squirtle** er vandtypen."
					}
				},
				{
					"points": 300,
					"question": {
						"format": "rich",
						"content": "\n\t\t\t\t\t\t> \"Jeg vælger dig!\"\n\n\t\t\t\t\t\tHvilken reveal.js/markdown-form vises citatet som?\n\t\t\t\t\t\t"
					},
					"answer": {
						"format": "rich",
						"content": "Det er et **blockquote**."
					}
				},
				{
					"points": 400,
					"question": {
						"format": "rich",
						"content": "\n\t\t\t\t\t\t| Pokemon | Type |\n\t\t\t\t\t\t| --- | --- |\n\t\t\t\t\t\t| Bulbasaur | Grass/Poison |\n\t\t\t\t\t\t| Charmander | Fire |\n\t\t\t\t\t\t| Squirtle | Water |\n\n\t\t\t\t\t\tHvilken type har Charmander i tabellen?\n\t\t\t\t\t\t"
					},
					"answer": {
						"format": "rich",
						"content": "**Fire**."
					}
				},
				{
					"points": 500,
					"question": {
						"format": "rich",
						"content": "\n\t\t\t\t\t\tMarkdown kan også lave links.\n\n\t\t\t\t\t\t[PokeAPI](https://pokeapi.co/) har data om Pokemon.\n\n\t\t\t\t\t\tHvad hedder API'et i linket?\n\t\t\t\t\t\t"
					},
					"answer": {
						"format": "rich",
						"content": "Det hedder **PokeAPI**."
					}
				},
				{
					"points": 600,
					"question": {
						"format": "rich",
						"content": "\n\t\t\t\t\t\t~~~js [1|3|5]\n\t\t\t\t\t\tconst team = [\"Pikachu\", \"Eevee\", \"Snorlax\"];\n\t\t\t\t\t\tconst sleepy = team.includes(\"Snorlax\");\n\t\t\t\t\t\tconst mascot = team[0];\n\n\t\t\t\t\t\tconsole.log(mascot, sleepy);\n\t\t\t\t\t\t~~~\n\n\t\t\t\t\t\tHvilken Pokemon bliver gemt i variablen `mascot`?\n\t\t\t\t\t\t"
					},
					"answer": {
						"format": "rich",
						"content": "`mascot` bliver **Pikachu**."
					}
				},
				{
					"points": 900,
					"question": {
						"format": "rich",
						"content": "\n\t\t\t\t\t\t~~~js [1|3|5]\n\t\t\t\t\t\tconst team = [\"Pikachu\", \"Eevee\", \"Snorlax\"];\n\t\t\t\t\t\tconst sleepy = team.includes(\"Snorlax\");\n\t\t\t\t\t\tconst mascot = team[0];\n\n\t\t\t\t\t\tconsole.log(mascot, sleepy);\n\t\t\t\t\t\t~~~\n\n\t\t\t\t\t\tHvilken Pokemon bliver gemt i variablen `mascot`?\n\t\t\t\t\t\t"
					},
					"answer": {
						"format": "rich",
						"content": "`mascot` bliver **Pikachu**."
					}
				}
			]
		},
		{
			"title": "Billeder",
			"questions": [
				{
					"points": 100,
					"question": {
						"format": "html",
						"content": "\n<div class=\"media-row\">\n\t<img class=\"pokemon-sprite\" src=\"https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png\" alt=\"Pikachu\">\n\t<p>Hvilken elektrisk maskot er vist på billedet?</p>\n</div>\n"
					},
					"answer": {
						"format": "rich",
						"content": "Pikachu."
					}
				},
				{
					"points": 200,
					"question": {
						"format": "html",
						"content": "\n<div class=\"media-row\">\n\t<img class=\"pokemon-sprite\" src=\"https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/1.png\" alt=\"Bulbasaur\">\n\t<p>Hvilken Kanto-starter har en planteknop på ryggen?</p>\n</div>\n"
					},
					"answer": {
						"format": "rich",
						"content": "Bulbasaur."
					}
				},
				{
					"points": 300,
					"question": {
						"format": "html",
						"content": "\n<div class=\"media-row\">\n\t<img class=\"pokemon-sprite\" src=\"https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/4.png\" alt=\"Charmander\">\n\t<p>Hvad hedder den ildtype, der har flamme på halen?</p>\n</div>\n"
					},
					"answer": {
						"format": "rich",
						"content": "Charmander."
					}
				},
				{
					"points": 400,
					"question": {
						"format": "html",
						"content": "\n<div class=\"media-row\">\n\t<img class=\"pokemon-sprite\" src=\"https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/7.png\" alt=\"Squirtle\">\n\t<p>Hvilken starter bruger skjoldet på ryggen som tema?</p>\n</div>\n"
					},
					"answer": {
						"format": "rich",
						"content": "Squirtle."
					}
				},
				{
					"points": 500,
					"question": {
						"format": "html",
						"content": "\n<div class=\"media-row\">\n\t<img class=\"pokemon-sprite\" src=\"https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/133.png\" alt=\"Eevee\">\n\t<p>Hvilken Pokemon er kendt for mange mulige evolutioner?</p>\n</div>\n"
					},
					"answer": {
						"format": "rich",
						"content": "Eevee."
					}
				},
				{
					"points": 600,
					"question": {
						"format": "html",
						"content": "\n<div class=\"media-row\">\n\t<img class=\"pokemon-sprite\" src=\"https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/143.png\" alt=\"Snorlax\">\n\t<p>Hvilken Pokemon blokerer ofte vejen, fordi den sover?</p>\n</div>\n"
					},
					"answer": {
						"format": "rich",
						"content": "Snorlax."
					}
				}
			]
		},
		{
			"title": "YouTube",
			"questions": [
				{
					"points": 100,
					"question": {
						"format": "html",
						"content": "\n<iframe data-autoplay src=\"https://www.youtube.com/embed/bILE5BEyhdo?rel=0\" title=\"Pokemon YouTube clip\" allow=\"accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share\" allowfullscreen></iframe>\n<p>Hvilken reveal.js-medietype bruges til at vise YouTube-klippet?</p>\n"
					},
					"answer": {
						"format": "rich",
						"content": "Et iframe-embed."
					}
				},
				{
					"points": 200,
					"question": {
						"format": "html",
						"content": "\n<iframe src=\"https://www.youtube.com/embed/wmnkAOO6Qo4?rel=0\" title=\"Pokemon YouTube clip\" allow=\"accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share\" allowfullscreen></iframe>\n<p>Hvilken Pokemon-art er gul og forbindes med lyn?</p>\n"
					},
					"answer": {
						"format": "rich",
						"content": "Pikachu."
					}
				},
				{
					"points": 300,
					"question": {
						"format": "html",
						"content": "\n<iframe src=\"https://www.youtube.com/embed/bILE5BEyhdo?start=20&rel=0\" title=\"Pokemon YouTube clip with start time\" allow=\"accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share\" allowfullscreen></iframe>\n<p>Hvilken iframe-parameter starter klippet inde i videoen?</p>\n"
					},
					"answer": {
						"format": "rich",
						"content": "Parameteren start."
					}
				},
				{
					"points": 400,
					"question": {
						"format": "html",
						"content": "\n<iframe src=\"https://www.youtube.com/embed/bILE5BEyhdo?rel=0\" title=\"Pokemon YouTube clip as slide content\" allow=\"accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share\" allowfullscreen></iframe>\n<p>YouTube ligger her som almindeligt slide-indhold, så score-knapperne stadig er nemme at ramme.</p>\n<p>Hvilket HTML-element bruges til embed'et?</p>\n"
					},
					"answer": {
						"format": "rich",
						"content": "iframe."
					}
				},
				{
					"points": 600,
					"question": {
						"format": "html",
						"content": "\n<iframe src=\"https://www.youtube.com/embed/bILE5BEyhdo?rel=0&modestbranding=1\" title=\"Pokemon YouTube clip with modest branding\" allow=\"accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share\" allowfullscreen></iframe>\n<p>Hvilken Pokemon-franchise-feature viser vi her: lokal video, billede eller online iframe?</p>\n"
					},
					"answer": {
						"format": "rich",
						"content": "Online iframe."
					}
				}
			]
		},
		{
			"title": "Video og lyd",
			"questions": [
				{
					"points": 100,
					"question": {
						"format": "html",
						"content": "\n<video src=\"examples/assets/video.mp4\" controls data-autoplay></video>\n<p>Hvilket HTML-element afspiller klippet?</p>\n"
					},
					"answer": {
						"format": "rich",
						"content": "video-elementet."
					}
				},
				{
					"points": 200,
					"question": {
						"format": "html",
						"content": "\n<div style=\"background: rgba(0, 0, 0, 0.74); padding: 24px; max-width: 760px;\">\n\t<p>Videoen koerer kun som muted loop-baggrundsgrafik.</p>\n\t<p>Hvilke to data-attributter holder den i baggrunden uden lyd?</p>\n</div>\n"
					},
					"answer": {
						"format": "rich",
						"content": "data-background-video-muted og data-background-video-loop."
					},
					"backgroundColor": "#000000",
					"backgroundVideo": "examples/assets/video.mp4",
					"backgroundVideoLoop": true,
					"backgroundVideoMuted": true
				},
				{
					"points": 300,
					"question": {
						"format": "html",
						"content": "\n<audio src=\"examples/assets/beeping.wav\" controls></audio>\n<p>Hvilket reveal.js-medie kan bruges til Pokemon-lydeffekter?</p>\n"
					},
					"answer": {
						"format": "rich",
						"content": "audio-elementet."
					}
				},
				{
					"points": 400,
					"question": {
						"format": "html",
						"content": "\n<p>Træd gennem lydene som fragments:</p>\n<div class=\"fragment\">Pika! <audio src=\"examples/assets/beeping.wav\" data-autoplay></audio></div>\n<div class=\"fragment\">Chu! <audio src=\"examples/assets/beeping.wav\" data-autoplay></audio></div>\n<p>Hvilken klasse får elementer til at komme frem trinvis?</p>\n"
					},
					"answer": {
						"format": "rich",
						"content": "fragment."
					}
				},
				{
					"points": 500,
					"question": {
						"format": "html",
						"content": "\n<div class=\"media-row\">\n\t<video src=\"examples/assets/video.mp4\" muted loop controls></video>\n\t<img class=\"pokemon-sprite\" src=\"https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/150.png\" alt=\"Mewtwo\">\n</div>\n<p>Hvilken attribut gør, at videoen kan køre uden lyd?</p>\n"
					},
					"answer": {
						"format": "rich",
						"content": "muted."
					}
				},
				{
					"points": 600,
					"question": {
						"format": "html",
						"content": "\n<video src=\"examples/assets/video.mp4\" controls poster=\"https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/6.png\"></video>\n<p>Hvilken attribut viser et billede, før videoen afspilles?</p>\n"
					},
					"answer": {
						"format": "rich",
						"content": "poster."
					}
				}
			]
		},
		{
			"title": "LaTeX og matematik",
			"questions": [
				{
					"points": 100,
					"question": {
						"format": "html",
						"content": "\n<p>Pikachu har base speed 90. Agility fordobler speed.</p>\n<p>$$90 \\times 2 = ?$$</p>\n"
					},
					"answer": {
						"format": "html",
						"content": "<p>$$180$$</p>"
					}
				},
				{
					"points": 200,
					"question": {
						"format": "html",
						"content": "\n<p>En potion healer 20 HP. Tre potions giver:</p>\n<p>$$3 \\cdot 20 = ?$$</p>\n"
					},
					"answer": {
						"format": "html",
						"content": "<p>$$60\\text{ HP}$$</p>"
					}
				},
				{
					"points": 300,
					"question": {
						"format": "html",
						"content": "\n<p>En kamp giver 240 XP fordelt på 2 Pokemon.</p>\n<p>$$\\frac{240}{2} = ?$$</p>\n"
					},
					"answer": {
						"format": "html",
						"content": "<p>$$120\\text{ XP}$$</p>"
					}
				},
				{
					"points": 400,
					"question": {
						"format": "html",
						"content": "\n<p>En typebonus på 1,5 gange bruges på et angreb med styrke 80.</p>\n<p>$$80 \\times 1.5 = ?$$</p>\n"
					},
					"answer": {
						"format": "html",
						"content": "<p>$$120$$</p>"
					},
					"notes": "120"
				},
				{
					"points": 500,
					"question": {
						"format": "html",
						"content": "\n<p>Et hold har 6 Pokemon. 4 er klar til kamp.</p>\n<p>$$\\frac{4}{6}=\\frac{?}{3}$$</p>\n"
					},
					"answer": {
						"format": "html",
						"content": "<p>$$\\frac{4}{6}=\\frac{2}{3}$$</p>"
					}
				},
				{
					"points": 600,
					"question": {
						"format": "html",
						"content": "\n<p>Hvis en skadeformel forenkles til:</p>\n<p>$$D = \\left\\lfloor \\frac{(42 \\cdot 90 \\cdot 1.5)}{50} \\right\\rfloor + 2$$</p>\n<p>Hvad bliver D?</p>\n"
					},
					"answer": {
						"format": "html",
						"content": "<p>$$D = 115$$</p>"
					}
				}
			]
		},
		{
			"title": "Reveal tricks",
			"questions": [
				{
					"points": 100,
					"question": {
						"format": "html",
						"content": "\n<p class=\"fragment\">Hint 1: Den er elektrisk.</p>\n<p class=\"fragment\">Hint 2: Den siger ofte sit eget navn.</p>\n<p class=\"fragment\">Hint 3: Den er Ashs mest kendte makker.</p>\n<p>Hvilken Pokemon er det?</p>\n"
					},
					"answer": {
						"format": "rich",
						"content": "Pikachu."
					}
				},
				{
					"points": 200,
					"question": {
						"format": "html",
						"content": "\n<h3 class=\"r-fit-text\">CHARIZARD</h3>\n<p>Hvilken layout-helper får teksten til at passe stort i sliden?</p>\n"
					},
					"answer": {
						"format": "rich",
						"content": "r-fit-text."
					}
				},
				{
					"points": 300,
					"question": {
						"format": "html",
						"content": "\n<pre><code class=\"language-js\" data-line-numbers=\"1|2|4\">const pokeball = { open: false };\npokeball.open = true;\n\nconsole.log(\"Gotcha!\");\n</code></pre>\n<p>Hvilket plugin farver kode og kan markere linjer?</p>\n"
					},
					"answer": {
						"format": "rich",
						"content": "Highlight-pluginet."
					}
				},
				{
					"points": 400,
					"question": {
						"format": "html",
						"content": "\n<div style=\"background: rgba(0, 0, 0, 0.78); padding: 24px; max-width: 760px;\">\n\t<p>Gengar ligger som billedbaggrund.</p>\n\t<p>Hvilken attribut sætter et baggrundsbillede på sliden?</p>\n</div>\n"
					},
					"answer": {
						"format": "rich",
						"content": "data-background."
					},
					"background": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/94.png",
					"slideAttributes": {
						"data-background-size": "contain",
						"data-background-opacity": "0.32"
					}
				},
				{
					"points": 500,
					"question": {
						"format": "html",
						"content": "\n<p>Denne slide har en zoom-transition.</p>\n<p>Hvilken data-attribut kan ændre overgangen for en enkelt slide?</p>\n"
					},
					"answer": {
						"format": "rich",
						"content": "data-transition."
					},
					"backgroundColor": "#1b4d89",
					"transition": "zoom"
				},
				{
					"points": 600,
					"question": {
						"format": "html",
						"content": "\n\t\t\t\t\t\t<p>Tryk <strong>S</strong> i reveal.js for speaker view.</p>\n\t\t\t\t\t\t<p>Hvilket skjult element indeholder noter til oplægsholderen?</p>\n\t\t\t\t\t\t"
					},
					"answer": {
						"format": "rich",
						"content": "aside.notes."
					},
					"notes": "Speaker note: Svaret er aside.notes. Denne note vises i speaker view, ikke på selve sliden."
				}
			]
		}
	]
};
