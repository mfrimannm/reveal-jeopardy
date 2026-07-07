import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dataDir =
	process.env.DATA_DIR || path.join(os.tmpdir(), "reveal-jeopardy-playwright-data");
const gamesDir = path.join(dataDir, "games");
const uploadsDir = path.join(dataDir, "uploads");
const fixtureDir = path.join(process.cwd(), "tests", "ui", "fixtures");

fs.rmSync(dataDir, { recursive: true, force: true });
fs.mkdirSync(gamesDir, { recursive: true });
fs.mkdirSync(uploadsDir, { recursive: true });

const categories = [
	{
		title: "Media",
		questions: [
			{
				points: 100,
				question: {
					format: "rich",
					content: "Billede\n\n![Test image](examples/assets/image1.png)",
				},
				answer: { format: "rich", content: "Image answer" },
				hints: ["Billedet er hintet."],
			},
			{
				points: 200,
				question: { format: "rich", content: "Video" },
				answer: { format: "rich", content: "Video answer" },
				media: {
					type: "video",
					src: "examples/assets/video.mp4",
					start: 0,
					autoplay: false,
					loop: false,
					controls: true,
					muted: false,
				},
			},
			{
				points: 300,
				question: {
					format: "html",
					content: '<p>Iframe</p><iframe src="examples/media.html" title="Test iframe"></iframe>',
				},
				answer: { format: "rich", content: "Iframe answer" },
			},
			{
				points: 400,
				question: {
					format: "html",
					content:
						'<p>Step through audio fragments:</p><div class="fragment">Pika! <audio src="examples/assets/beeping.wav" data-autoplay></audio></div><div class="fragment">Chu! <audio src="examples/assets/beeping.wav" data-autoplay></audio></div><p>Which class reveals elements step by step?</p>',
				},
				answer: { format: "rich", content: "Media answer 400" },
			},
			{
				points: 500,
				question: { format: "rich", content: "Media question 500" },
				answer: { format: "rich", content: "Media answer 500" },
			},
		],
	},
	...["Science", "History", "Words", "Numbers", "Final"].map((title) => ({
		title,
		questions: [100, 200, 300, 400, 500].map((points) => ({
			points,
			question: { format: "rich", content: `${title} question ${points}` },
			answer: { format: "rich", content: `${title} answer ${points}` },
		})),
	})),
];

fs.writeFileSync(
	path.join(gamesDir, "ui-scaling.json"),
	JSON.stringify(
		{
			id: "ui-scaling",
			title: "UI Scaling Test",
			teams: ["Red", "Blue", "Green"],
			categories,
		},
		null,
		"\t"
	) + "\n",
	"utf8"
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
