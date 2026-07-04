const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function loadFrontendContext() {
	const root = path.resolve(__dirname, "..");
	const context = {
		console,
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
		"static/app/game-model.js",
		"static/app/media.js",
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
		{ points: "200", markdown: "**Q**", answerHtml: "<p>A</p>" },
		{},
	]);
	assert.deepEqual(plain(questions), [
		{ points: 200, markdown: "**Q**", answerHtml: "<p>A</p>", question: "", answer: "" },
		{ points: 200, question: "Question goes here.", answer: "Answer goes here." },
	]);

	const game = app.normalizeGameConfig({
		id: "science",
		title: "Science",
		teams: ["Red", "Blue"],
		categories: [{ title: "Physics", questions: [{ points: 300, question: "Q", answer: "A" }] }],
	});
	assert.equal(game.id, "science");
	assert.deepEqual(plain(game.teams), [
		{ id: "team1", name: "Red" },
		{ id: "team2", name: "Blue" },
	]);
	assert.equal(game.categories[0].questions[0].points, 300);
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
		updateScoreboard = () => {};
		updateUsedTiles = () => {};
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
		updateScoreboard = () => {};
		setTileAvailable = (questionId) => { window.lastAvailableQuestionId = questionId; };

		prepareQuestionForCorrection("c1q100");

		({ scores, usedQuestions, questionAwards, lastAvailableQuestionId: window.lastAvailableQuestionId });
		`
	);

	assert.deepEqual(plain(state.scores), { team1: 0 });
	assert.deepEqual(plain(state.usedQuestions), []);
	assert.deepEqual(plain(state.questionAwards), {});
	assert.equal(state.lastAvailableQuestionId, "c1q100");
});

test("normalizes builder drafts and serializes games", () => {
	const app = loadFrontendContext();

	const question = app.normalizeBuilderQuestion(
		{
			points: "500",
			markdown: "# Question",
			answerHtml: "<strong>Answer</strong>",
			hints: [{ text: "Hint 1" }, "Hint 2"],
			backgroundVideoMuted: false,
		},
		0
	);

	assert.equal(question.questionType, "markdown");
	assert.equal(question.answerType, "answerHtml");
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
	assert.equal(game.categories[0].questions[0].markdown, "# Question");
	assert.equal(game.categories[0].questions[0].answerHtml, "<strong>Answer</strong>");
	assert.deepEqual(plain(game.categories[0].questions[0].hints), ["Hint 1", "Hint 2"]);
	assert.equal(app.serializeBuilderGame(draft), JSON.stringify(game, null, "\t") + "\n");
});

test("keeps question content fields backward compatible in builder export", () => {
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
					{ points: 100, question: "Plain question", answer: "Plain answer" },
					{ points: 200, markdown: "**Markdown question**", answerMarkdown: "**Markdown answer**" },
					{ points: 300, html: "<p>HTML question</p>", answerHtml: "<p>HTML answer</p>" },
				],
			},
		],
	});
	const game = app.buildGameFromBuilderDraft(draft);
	const questions = game.categories[0].questions;

	assert.equal(questions[0].question, "Plain question");
	assert.equal(questions[0].answer, "Plain answer");
	assert.equal(questions[1].markdown, "**Markdown question**");
	assert.equal(questions[1].answerMarkdown, "**Markdown answer**");
	assert.equal(questions[2].html, "<p>HTML question</p>");
	assert.equal(questions[2].answerHtml, "<p>HTML answer</p>");
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
