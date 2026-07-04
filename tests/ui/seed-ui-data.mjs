import fs from "node:fs";
import path from "node:path";

const dataDir = "/tmp/reveal-jeopardy-playwright-data";
const gamesDir = path.join(dataDir, "games");
const uploadsDir = path.join(dataDir, "uploads");

fs.rmSync(dataDir, { recursive: true, force: true });
fs.mkdirSync(gamesDir, { recursive: true });
fs.mkdirSync(uploadsDir, { recursive: true });

const categories = [
	{
		title: "Media",
		questions: [
			{
				points: 100,
				html: '<p>Billede</p><img src="examples/assets/image1.png" alt="Test image">',
				answer: "Image answer",
			},
			{
				points: 200,
				html: '<p>Video</p><video src="examples/assets/video.mp4" controls></video>',
				answer: "Video answer",
			},
			{
				points: 300,
				html: '<p>Iframe</p><iframe src="examples/media.html" title="Test iframe"></iframe>',
				answer: "Iframe answer",
			},
			{ points: 400, question: "Media question 400", answer: "Media answer 400" },
			{ points: 500, question: "Media question 500", answer: "Media answer 500" },
		],
	},
	...["Science", "History", "Words", "Numbers", "Final"].map((title) => ({
		title,
		questions: [100, 200, 300, 400, 500].map((points) => ({
			points,
			question: `${title} question ${points}`,
			answer: `${title} answer ${points}`,
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
