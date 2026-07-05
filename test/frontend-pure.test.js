const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function loadFrontendContext() {
	const root = path.resolve(__dirname, "..");
	const context = {
		console,
		URLSearchParams,
		localStorage: {
			getItem() {
				return null;
			},
			setItem() {},
			removeItem() {},
		},
	};

	vm.createContext(context);

	[
		"static/app/state.js",
		"static/app/storage.js",
		"static/app/media.js",
		"static/app/content-renderer.js",
		"static/app/game-model.js",
		"static/app/question-maker.js",
		"static/app/scoring.js",
	].forEach((file) => {
		vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, {
			filename: file,
		});
	});

	return context;
}

function plain(value) {
	return JSON.parse(JSON.stringify(value));
}

function evaluate(app, source) {
	return vm.runInContext(source, app);
}

test("clamps team and builder counts", () => {
	const app = loadFrontendContext();

	assert.equal(app.clampTeamCount("0"), 1);
	assert.equal(app.clampTeamCount("7"), 6);
	assert.equal(app.clampTeamCount("nope"), 3);
	assert.equal(app.clampBuilderCount("0", 5), 1);
	assert.equal(app.clampBuilderCount("12", 5), 10);
	assert.equal(app.clampBuilderCount("nope", 4), 4);
});

test("normalizes game ids, questions and game config", () => {
	const app = loadFrontendContext();

	assert.equal(app.slugifyGameId("Mit Æble Spil!"), "mit-ble-spil");

	const questions = app.normalizeQuestions([
		{
			points: "200",
			question: { format: "rich", content: "**Q**" },
			answer: { format: "html", content: "<p>A</p>" },
		},
		{},
	]);
	assert.deepEqual(plain(questions), [
		{
			points: 200,
			question: { format: "rich", content: "**Q**" },
			answer: { format: "html", content: "<p>A</p>" },
			hints: [],
			media: null,
		},
		{
			points: 200,
			question: { format: "rich", content: "Question goes here." },
			answer: { format: "rich", content: "Answer goes here." },
			hints: [],
			media: null,
		},
	]);

	const game = app.normalizeGameConfig({
		id: "science",
		title: "Science",
		teams: ["Red", "Blue"],
		categories: [
			{
				title: "Physics",
				questions: [
					{
						points: 300,
						question: { format: "rich", content: "Q" },
						answer: { format: "rich", content: "A" },
					},
				],
			},
		],
	});
	assert.equal(game.id, "science");
	assert.deepEqual(plain(game.teams), [
		{ id: "team1", name: "Red" },
		{ id: "team2", name: "Blue" },
	]);
	assert.equal(game.categories[0].questions[0].points, 300);
});

test("treats explicit empty question and answer content as a blank board tile", () => {
	const app = loadFrontendContext();
	const questions = app.normalizeQuestions([
		{
			points: 100,
			question: { format: "rich", content: "" },
			answer: { format: "rich", content: "" },
		},
		{
			points: 200,
			question: "",
			answer: "",
		},
		{},
	]);

	assert.equal(app.isQuestionBlank(questions[0]), true);
	assert.equal(app.isQuestionBlank(questions[1]), true);
	assert.equal(app.isQuestionBlank(questions[2]), false);
	assert.deepEqual(plain(questions[2].question), {
		format: "rich",
		content: "Question goes here.",
	});
	assert.deepEqual(plain(questions[2].answer), {
		format: "rich",
		content: "Answer goes here.",
	});
});

test("normalizes configured team names from saved settings", () => {
	const app = loadFrontendContext();
	const savedSettings = JSON.stringify({
		teamCount: 4,
		teamNames: ["Alpha", "", "Gamma"],
	});

	app.localStorage.getItem = (key) =>
		key === "reveal-jeopardy-settings:pokemon" ? savedSettings : null;

	assert.deepEqual(plain(app.getConfiguredTeamNames(["Red", "Blue", "Green", "Yellow"])), [
		"Alpha",
		"Blue",
		"Gamma",
		"Yellow",
	]);
});

test("generates stable question ids", () => {
	const app = loadFrontendContext();

	assert.equal(app.getQuestionId(1, 100), "c1q100");
	assert.equal(app.getQuestionId(4, 500), "c4q500");
});

test("scores correct and wrong answers and marks questions used", () => {
	const app = loadFrontendContext();
	const state = evaluate(
		app,
		`
		window = { location: { hash: "" }, parent: null, opener: null, top: null };
		gameKey = "score-game";
		gameConfig = { id: "score-game" };
		teamIds = ["team1", "team2"];
		scores = { team1: 0, team2: 0 };
		usedQuestions = [];
		questionAwards = {};
		questionIdSet = new Set(["c1q100"]);
		getCurrentQuestionSlide = () => ({ id: "c1q100" });
		updateScore = () => {};
		updateTile = () => {};
		goToBoard = () => { window.location.hash = "/board"; };

		changeScore("team1", 100);
		changeScore("team2", -100);

		({ scores, usedQuestions, questionAwards, hash: window.location.hash });
		`
	);

	assert.deepEqual(plain(state.scores), { team1: 0, team2: -100 });
	assert.deepEqual(plain(state.usedQuestions), ["c1q100"]);
	assert.deepEqual(plain(state.questionAwards), {
		c1q100: { team: "team2", amount: -100 },
	});
	assert.equal(state.hash, "/board");
});

test("can reset a used question for correction", () => {
	const app = loadFrontendContext();
	const state = evaluate(
		app,
		`
		window = { location: { hash: "" }, parent: null, opener: null, top: null };
		gameKey = "score-game";
		gameConfig = { id: "score-game" };
		teamIds = ["team1"];
		scores = { team1: 100 };
		usedQuestions = ["c1q100"];
		questionAwards = { c1q100: { team: "team1", amount: 100 } };
		questionIdSet = new Set(["c1q100"]);
		updateScore = () => {};
		updateTile = (questionId) => { window.lastUpdatedQuestionId = questionId; };

		prepareQuestionForCorrection("c1q100");

		({ scores, usedQuestions, questionAwards, lastUpdatedQuestionId: window.lastUpdatedQuestionId });
		`
	);

	assert.deepEqual(plain(state.scores), { team1: 0 });
	assert.deepEqual(plain(state.usedQuestions), []);
	assert.deepEqual(plain(state.questionAwards), {});
	assert.equal(state.lastUpdatedQuestionId, "c1q100");
});

test("state updates target only the changed score and tile", () => {
	const app = loadFrontendContext();
	const state = evaluate(
		app,
		`
		window = { location: { hash: "" }, parent: null, opener: null, top: null };
		gameKey = "score-game";
		gameConfig = { id: "score-game" };
		teamIds = ["team1", "team2"];
		scores = { team1: 0, team2: 0 };
		usedQuestions = [];
		questionAwards = {};
		questionIdSet = new Set(["c1q100"]);
		const scoreUpdates = [];
		const tileUpdates = [];
		getCurrentQuestionSlide = () => ({ id: "c1q100" });
		updateScore = (teamId) => { scoreUpdates.push(teamId); };
		updateTile = (questionId) => { tileUpdates.push(questionId); };
		updateScoreboard = () => { throw new Error("full scoreboard update was not expected"); };
		updateUsedTiles = () => { throw new Error("full board update was not expected"); };
		goToBoard = () => { window.location.hash = "/board"; };

		changeScore("team1", 100);

		({ scores, usedQuestions, questionAwards, scoreUpdates, tileUpdates });
		`
	);

	assert.deepEqual(plain(state.scores), { team1: 100, team2: 0 });
	assert.deepEqual(plain(state.usedQuestions), ["c1q100"]);
	assert.deepEqual(plain(state.questionAwards), {
		c1q100: { team: "team1", amount: 100 },
	});
	assert.deepEqual(plain(state.scoreUpdates), ["team1"]);
	assert.deepEqual(plain(state.tileUpdates), ["c1q100"]);
});

test("multi-score can award more than one team before returning to board", () => {
	const app = loadFrontendContext();
	const state = evaluate(
		app,
		`
		window = { location: { hash: "" }, parent: null, opener: null, top: null };
		gameKey = "score-game";
		gameConfig = { id: "score-game" };
		teamIds = ["team1", "team2"];
		scores = { team1: 0, team2: 0 };
		usedQuestions = [];
		questionAwards = {};
		questionIdSet = new Set(["c1q100"]);
		getCurrentQuestionSlide = () => ({ id: "c1q100" });
		updateScore = () => {};
		updateTile = () => {};
		goToBoard = () => { window.location.hash = "/board"; };

		changeScore("team1", 100, { append: true, keepOpen: true });
		changeScore("team2", -100, { append: true, keepOpen: true });
		goBackWithoutScore("c1q100");

		({ scores, usedQuestions, questionAwards, hash: window.location.hash });
		`
	);

	assert.deepEqual(plain(state.scores), { team1: 100, team2: -100 });
	assert.deepEqual(plain(state.usedQuestions), ["c1q100"]);
	assert.deepEqual(plain(state.questionAwards), {
		c1q100: [
			{ team: "team1", amount: 100 },
			{ team: "team2", amount: -100 },
		],
	});
	assert.equal(state.hash, "/board");
});

test("normalizes builder drafts and serializes games", () => {
	const app = loadFrontendContext();

	const question = app.normalizeBuilderQuestion(
		{
			points: "500",
			question: { format: "rich", content: "# Question" },
			answer: { format: "html", content: "<strong>Answer</strong>" },
			hints: [{ format: "rich", content: "Hint 1" }, "Hint 2"],
			backgroundVideoMuted: false,
		},
		0
	);

	assert.deepEqual(plain(question.question), { format: "rich", content: "# Question" });
	assert.deepEqual(plain(question.answer), { format: "html", content: "<strong>Answer</strong>" });
	assert.equal(question.hints, "Hint 1\nHint 2");
	assert.equal(question.backgroundVideoMuted, false);

	const draft = app.normalizeBuilderDraft({
		title: "Demo",
		id: "Demo Game",
		teams: ["A"],
		categories: [{ title: "Cat", questions: [question] }],
	});
	const game = app.buildGameFromBuilderDraft(draft);

	assert.equal(game.id, "demo-game");
	assert.deepEqual(plain(game.categories[0].questions[0].question), { format: "rich", content: "# Question" });
	assert.deepEqual(plain(game.categories[0].questions[0].answer), { format: "html", content: "<strong>Answer</strong>" });
	assert.deepEqual(plain(game.categories[0].questions[0].hints), [
		{ format: "rich", content: "Hint 1" },
		{ format: "rich", content: "Hint 2" },
	]);
	assert.equal(app.serializeBuilderGame(draft), JSON.stringify(game, null, "\t") + "\n");
});

test("builder export uses rich question and answer content", () => {
	const app = loadFrontendContext();
	const draft = app.normalizeBuilderDraft({
		title: "Compatibility",
		id: "compatibility",
		teams: ["A", "B"],
		categoryCount: 1,
		rowCount: 3,
		boardCreated: true,
		categories: [
			{
				title: "Formats",
				questions: [
					{
						points: 100,
						question: { format: "rich", content: "Plain question" },
						answer: { format: "rich", content: "Plain answer" },
					},
					{
						points: 200,
						question: { format: "rich", content: "**Markdown question**" },
						answer: { format: "rich", content: "**Markdown answer**" },
					},
					{
						points: 300,
						question: { format: "html", content: "<p>HTML question</p>" },
						answer: { format: "html", content: "<p>HTML answer</p>" },
					},
				],
			},
		],
	});
	const game = app.buildGameFromBuilderDraft(draft);
	const questions = game.categories[0].questions;

	assert.deepEqual(plain(questions[0].question), { format: "rich", content: "Plain question" });
	assert.deepEqual(plain(questions[0].answer), { format: "rich", content: "Plain answer" });
	assert.deepEqual(plain(questions[1].question), { format: "rich", content: "**Markdown question**" });
	assert.deepEqual(plain(questions[1].answer), { format: "rich", content: "**Markdown answer**" });
	assert.deepEqual(plain(questions[2].question), { format: "html", content: "<p>HTML question</p>" });
	assert.deepEqual(plain(questions[2].answer), { format: "html", content: "<p>HTML answer</p>" });
});

test("renders markdown images in rich and html content", () => {
	const app = loadFrontendContext();

	assert.equal(
		app.renderRichTextToHtml("![Billede](/uploads/sk-rmbillede.png)"),
		'<p><img src="/uploads/sk-rmbillede.png" alt="Billede"></p>'
	);
	assert.equal(
		app.renderMarkdownImagesInHtml('<div>![Pikachu](https://example.test/pikachu.png)</div>'),
		'<div><img src="https://example.test/pikachu.png" alt="Pikachu"></div>'
	);
});

test("renders markdown tables in rich content", () => {
	const app = loadFrontendContext();

	assert.equal(
		app.renderRichTextToHtml(
			[
				"| Pokemon | Type |",
				"| --- | --- |",
				"| Bulbasaur | Grass/Poison |",
				"| Charmander | **Fire** |",
				"| Squirtle | Water |",
				"",
				"Hvilken type har Charmander i tabellen?",
			].join("\n")
		),
		"<table><thead><tr><th>Pokemon</th><th>Type</th></tr></thead><tbody>" +
			"<tr><td>Bulbasaur</td><td>Grass/Poison</td></tr>" +
			"<tr><td>Charmander</td><td><strong>Fire</strong></td></tr>" +
			"<tr><td>Squirtle</td><td>Water</td></tr>" +
			"</tbody></table><p>Hvilken type har Charmander i tabellen?</p>"
	);
});

test("renders markdown code fences with reveal line numbers", () => {
	const app = loadFrontendContext();

	assert.equal(
		app.renderRichTextToHtml(
			[
				"~~~js [1|3|5]",
				'const team = ["Pikachu", "Eevee", "Snorlax"];',
				'const sleepy = team.includes("Snorlax");',
				"const mascot = team[0];",
				"",
				"console.log(mascot, sleepy);",
				"~~~",
			].join("\n")
		),
		'<pre><code class="language-js" data-line-numbers="1|3|5">' +
			"const team = [&quot;Pikachu&quot;, &quot;Eevee&quot;, &quot;Snorlax&quot;];\n" +
			"const sleepy = team.includes(&quot;Snorlax&quot;);\n" +
			"const mascot = team[0];\n\n" +
			"console.log(mascot, sleepy);" +
			"</code></pre>"
	);
});

test("creates and prepares YouTube URLs", () => {
	const app = loadFrontendContext();

	assert.equal(app.getYouTubeVideoId("https://youtu.be/abcDEF12345?t=30"), "abcDEF12345");
	assert.equal(app.getYouTubeVideoId("https://www.youtube.com/watch?v=xyz98765432"), "xyz98765432");
	assert.equal(app.getYouTubeStartSeconds("https://youtu.be/abcDEF12345?t=30s"), "30");
	assert.equal(
		app.createYouTubeEmbedUrl("https://youtu.be/abcDEF12345?t=30s"),
		"https://www.youtube.com/embed/abcDEF12345?rel=0&start=30"
	);
	assert.equal(app.appendUrlParam("https://example.test?a=1", "b", "2"), "https://example.test?a=1&b=2");
	assert.equal(
		app.prepareYouTubeEmbedUrl("https://www.youtube.com/embed/abcDEF12345?rel=0"),
		"https://www.youtube.com/embed/abcDEF12345?rel=0&autoplay=1&enablejsapi=1"
	);
	assert.equal(
		app.createYouTubeEmbedUrlFromMedia({
			type: "youtube",
			url: "https://www.youtube.com/watch?v=abcDEF12345",
			start: 42,
			end: 75,
			autoplay: true,
			loop: true,
			controls: false,
			muted: true,
		}),
		"https://www.youtube.com/embed/abcDEF12345?rel=0&start=42&end=75&autoplay=1&loop=1&playlist=abcDEF12345&controls=0&mute=1"
	);
	assert.deepEqual(plain(app.normalizeMedia({
		type: "video",
		src: "/uploads/clip.mp4",
		start: "10",
		autoplay: true,
		loop: true,
		controls: true,
		muted: false,
	})), {
		type: "video",
		src: "/uploads/clip.mp4",
		start: 10,
		autoplay: true,
		loop: true,
		controls: true,
		muted: false,
	});
	assert.deepEqual(plain(app.parseRichMediaToken(
		'::youtube url="https://www.youtube.com/watch?v=abcDEF12345" start="42" end="75" autoplay="true" loop="true" controls="false" muted="true"::'
	)), {
		type: "youtube",
		url: "https://www.youtube.com/watch?v=abcDEF12345",
		start: 42,
		end: 75,
		autoplay: true,
		loop: true,
		controls: false,
		muted: true,
	});
	assert.deepEqual(plain(app.parseRichMediaToken(
		'::video src="/uploads/clip.mp4" start="10" autoplay="false" loop="true" controls="true" muted="true"::'
	)), {
		type: "video",
		src: "/uploads/clip.mp4",
		start: 10,
		autoplay: false,
		loop: true,
		controls: true,
		muted: true,
	});
});

test("parses game sync messages defensively", () => {
	const app = loadFrontendContext();

	assert.equal(app.parseGameMessage("not json"), null);
	assert.equal(app.parseGameMessage("{bad"), null);
	assert.deepEqual(plain(app.parseGameMessage('{"namespace":"reveal-jeopardy","type":"state-changed"}')), {
		namespace: "reveal-jeopardy",
		type: "state-changed",
	});
});
