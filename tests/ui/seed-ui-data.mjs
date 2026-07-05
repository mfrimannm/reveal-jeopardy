import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dataDir =
	process.env.DATA_DIR || path.join(os.tmpdir(), "reveal-jeopardy-playwright-data");
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
				question: {
					format: "rich",
					content: "Billede\n\n![Test image](examples/assets/image1.png)",
				},
				answer: { format: "rich", content: "Image answer" },
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
				question: { format: "rich", content: "Media question 400" },
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
