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
		"js/jeopardy/globals.js",
		"js/jeopardy/game-model.js",
		"js/jeopardy/media.js",
		"js/jeopardy/question-maker.js",
		"js/jeopardy/game-state.js",
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
