import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dataDir =
	process.env.DATA_DIR || path.join(os.tmpdir(), "reveal-jeopardy-playwright-data");
const gamesDir = path.join(dataDir, "games");
const jeopardyDir = path.join(gamesDir, "jeopardy");
const uploadsDir = path.join(dataDir, "uploads");
const fixtureDir = path.join(process.cwd(), "tests", "ui", "fixtures");

fs.rmSync(dataDir, { recursive: true, force: true });
fs.mkdirSync(gamesDir, { recursive: true });
fs.mkdirSync(jeopardyDir, { recursive: true });
fs.mkdirSync(uploadsDir, { recursive: true });

fs.copyFileSync(
	path.join(fixtureDir, "ui-scaling.json"),
	path.join(jeopardyDir, "ui-scaling.json")
);
fs.copyFileSync(
	path.join(fixtureDir, "pokemon.json"),
	path.join(jeopardyDir, "pokemon.json")
);

const kanuunttDir = path.join(gamesDir, "kanuuntt");
fs.mkdirSync(kanuunttDir, { recursive: true });
fs.copyFileSync(
	path.join(fixtureDir, "kanuuntt-demo.json"),
	path.join(kanuunttDir, "kanuuntt-demo.json")
);

fs.writeFileSync(
	path.join(kanuunttDir, "ui-quiz.json"),
	JSON.stringify(
		{
			id: "ui-quiz",
			title: "UI Quiz Test",
			teams: ["Red", "Blue"],
			categories: [
				{
					title: "Quiz",
					questions: [
						{
							points: 100,
							question: { format: "rich", content: "Quiz placeholder?" },
							answer: { format: "rich", content: "Quiz placeholder." },
						},
					],
				},
			],
			quiz_questions: [
				{
					type: "multiple-choice",
					prompt: "What does the image show?",
					media: {
						type: "image",
						src: "examples/assets/image1.png",
						alt: "Test image",
					},
					answers: [
						{ id: "a", text: "A local image", correct: true },
						{ id: "b", text: "An audio clip", correct: false },
						{ id: "c", text: "A timer", correct: false },
						{ id: "d", text: "A scoreboard", correct: false },
					],
					timeLimitSeconds: 30,
					points: 1000,
				},
				{
					type: "multiple-choice",
					prompt: "Which rule counts in this quiz?",
					answers: [
						{ id: "a", text: "The first submitted answer counts", correct: true },
						{ id: "b", text: "The last answer replaces it", correct: false },
						{ id: "c", text: "Wrong answers subtract points", correct: false },
						{ id: "d", text: "Scores are random", correct: false },
					],
					timeLimitSeconds: 30,
					points: 500,
				},
			],
		},
		null,
		"\t"
	) + "\n",
	"utf8"
);
