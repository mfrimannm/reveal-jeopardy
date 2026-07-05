const { expect, test } = require("@playwright/test");

const VIEWPORTS = [
	{ width: 1920, height: 1080 },
	{ width: 1366, height: 768 },
	{ width: 1280, height: 720 },
	{ width: 800, height: 600 },
	{ width: 390, height: 844 },
	{ width: 360, height: 740 },
];

async function openGame(page, hash = "board") {
	await page.addInitScript(() => localStorage.clear());
	await page.goto(`/?game=ui-scaling#/${hash}`);
	await expect(page.locator("#game-title")).toHaveText("UI Scaling Test");
}

async function expectNoHorizontalOverflow(page) {
	const overflow = await page.evaluate(() => ({
		documentElement: document.documentElement.scrollWidth - document.documentElement.clientWidth,
		body: document.body.scrollWidth - document.body.clientWidth,
	}));

	expect(overflow.documentElement).toBeLessThanOrEqual(1);
	expect(overflow.body).toBeLessThanOrEqual(1);
}

async function openQuestion(page, label) {
	await page.locator("#jeopardy-board").getByRole("link", { name: label }).click();
	await expect(page.locator(".reveal .slides > section.question-slide.present")).toBeVisible();
}

async function startGameFromHome(page) {
	await page.getByRole("button", { name: "Start game" }).click();
	await expect(page.locator("#board.present")).toBeVisible();
}

async function returnToBoard(page) {
	await page.keyboard.press("ArrowUp");
	await expect(page.locator("#board.present")).toBeVisible();
}

async function expectMediaInsideSlide(page, selector) {
	const media = page.locator(`.reveal .slides > section.question-slide.present ${selector}`).first();
	await expect(media).toBeVisible();

	const box = await media.evaluate((element) => {
		const mediaRect = element.getBoundingClientRect();
		const slideRect = element.closest(".question-slide").getBoundingClientRect();

		return {
			leftOverflow: slideRect.left - mediaRect.left,
			rightOverflow: mediaRect.right - slideRect.right,
			topOverflow: slideRect.top - mediaRect.top,
			bottomOverflow: mediaRect.bottom - slideRect.bottom,
			scrollOverflow: element.scrollWidth - element.clientWidth,
		};
	});

	expect(box.leftOverflow).toBeLessThanOrEqual(1);
	expect(box.rightOverflow).toBeLessThanOrEqual(1);
	expect(box.topOverflow).toBeLessThanOrEqual(1);
	expect(box.bottomOverflow).toBeLessThanOrEqual(1);
	expect(box.scrollOverflow).toBeLessThanOrEqual(1);
}

for (const viewport of VIEWPORTS) {
	test(`board scales at ${viewport.width}x${viewport.height}`, async ({ page }) => {
		await page.setViewportSize(viewport);
		await openGame(page);

		await expect(page.locator("#scoreboard")).toBeVisible();
		await expect(page.locator("#category-row .category").first()).toBeVisible();
		await expect(page.locator("#jeopardy-board .points a").first()).toBeVisible();
		await expectNoHorizontalOverflow(page);
	});
}

test("question flow can show answer and award points", async ({ page }) => {
	await page.setViewportSize({ width: 1366, height: 768 });
	await openGame(page);

	await openQuestion(page, "Media for 100 points");
	await page.getByRole("button", { name: "Show answer" }).click();
	await expect(page.locator(".question-slide.present .answer")).toHaveClass(/visible/);

	await page.getByRole("button", { name: "Red correct, plus 100" }).click();
	await expect(page.locator("#score-team1")).toHaveText("100");
	await expect(page.locator("#board.present")).toBeVisible();
});

test("keyboard navigation is locked on board and question slides", async ({ page }) => {
	await page.setViewportSize({ width: 1366, height: 768 });
	await openGame(page);

	for (const key of ["ArrowLeft", "ArrowRight", "ArrowDown", "Space", "H"]) {
		await page.keyboard.press(key);
		await expect(page.locator("#board.present")).toBeVisible();
	}

	await page.keyboard.press("ArrowUp");
	await expect(page.locator("#home.present")).toBeVisible();

	await startGameFromHome(page);
	await openQuestion(page, "Media for 100 points");

	for (const key of ["ArrowLeft", "ArrowRight", "ArrowDown"]) {
		await page.keyboard.press(key);
		await expect(page.locator("#c1q100.present")).toBeVisible();
	}

	await page.keyboard.press("H");
	await expect(page.locator("#c1q100.present .question-hints .visible")).toContainText(
		"Billedet er hintet."
	);
	await expect(page.locator("#c1q100.present")).toBeVisible();

	await page.getByRole("button", { name: "Show answer" }).focus();
	await page.keyboard.press("Space");
	await expect(page.locator("#c1q100.present .answer")).not.toHaveClass(/visible/);
	await expect(page.locator("#c1q100.present")).toBeVisible();

	await page.keyboard.press("Escape");
	await expect(page.locator("#home.present")).toBeVisible();

	await startGameFromHome(page);
	await openQuestion(page, "Media for 100 points");
	await page.keyboard.press("ArrowUp");
	await expect(page.locator("#board.present")).toBeVisible();
});

test("h advances fragments and starts autoplay media when fragments become visible", async ({ page }) => {
	await page.setViewportSize({ width: 1366, height: 768 });
	await page.addInitScript(() => {
		HTMLMediaElement.prototype.play = function play() {
			this.dataset.playCallCount = String(Number(this.dataset.playCallCount || "0") + 1);
			return Promise.resolve();
		};
		HTMLMediaElement.prototype.pause = function pause() {};
	});
	await openGame(page);

	await openQuestion(page, "Media for 400 points");
	await expect(page.locator("#c1q400.present .fragment.visible")).toHaveCount(0);
	await expect(page.locator("#c1q400.present audio").first()).toHaveAttribute("data-autoplay", "true");
	await expect(page.locator("#c1q400.present audio").first()).not.toHaveAttribute("data-play-call-count", /./);

	await page.keyboard.press("Space");
	await expect(page.locator("#c1q400.present .fragment.visible")).toHaveCount(0);
	await expect(page.locator("#c1q400.present audio").first()).not.toHaveAttribute("data-play-call-count", /./);

	await page.keyboard.press("H");
	await expect(page.locator("#c1q400.present .fragment.visible")).toHaveCount(1);
	await expect(page.locator("#c1q400.present .fragment.visible").first()).toContainText("Pika!");
	await expect
		.poll(() =>
			page.locator("#c1q400.present audio").first().evaluate((audio) =>
				Number(audio.dataset.playCallCount || "0")
			)
		)
		.toBeGreaterThan(0);

	await page.keyboard.press("H");
	await expect(page.locator("#c1q400.present .fragment.visible")).toHaveCount(2);
	await expect(page.locator("#c1q400.present .fragment.visible").nth(1)).toContainText("Chu!");
	await expect
		.poll(() =>
			page.locator("#c1q400.present audio").nth(1).evaluate((audio) =>
				Number(audio.dataset.playCallCount || "0")
			)
		)
		.toBeGreaterThan(0);
	await expect(page.locator("#c1q400.present")).toBeVisible();
});

test("score update keeps board DOM in place", async ({ page }) => {
	await page.setViewportSize({ width: 1366, height: 768 });
	await openGame(page);

	await page.evaluate(() => {
		window.__boardNode = document.getElementById("jeopardy-board");
		window.__firstTileNode = document.querySelector("#jeopardy-board .points");
	});

	await openQuestion(page, "Media for 100 points");
	await page.getByRole("button", { name: "Red correct, plus 100" }).click();
	await expect(page.locator("#score-team1")).toHaveText("100");
	await expect(page.locator("#board.present")).toBeVisible();

	const nodesKept = await page.evaluate(
		() =>
			window.__boardNode === document.getElementById("jeopardy-board") &&
			window.__firstTileNode === document.querySelector("#jeopardy-board .points")
	);

	expect(nodesKept).toBe(true);
});

test("multi-score shows live team scores on question slide", async ({ page }) => {
	await page.setViewportSize({ width: 1366, height: 768 });
	await openGame(page);

	await openQuestion(page, "Media for 100 points");
	const redRow = page.locator(".question-slide.present .team-score-row").filter({ hasText: "Red" });
	const blueRow = page.locator(".question-slide.present .team-score-row").filter({ hasText: "Blue" });

	await expect(redRow.locator(".team-question-score")).toHaveText("0");
	await expect(blueRow.locator(".team-question-score")).toHaveText("0");
	await page.locator(".question-slide.present").getByLabel("Flere teams").check();
	await page.locator(".question-slide.present").getByRole("button", { name: "Red correct, plus 100" }).click();
	await expect(redRow.locator(".team-question-score")).toHaveText("100");
	await expect(page.locator(".reveal .slides > section.question-slide.present")).toBeVisible();

	await page.locator(".question-slide.present").getByRole("button", { name: "Blue wrong, minus 100" }).click();
	await expect(blueRow.locator(".team-question-score")).toHaveText("-100");
	await expect(page.locator(".reveal .slides > section.question-slide.present")).toBeVisible();
});

test("question maker stays usable on laptop viewport", async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 720 });
	await openGame(page, "home");

	await page.getByRole("button", { name: "Question maker" }).click();
	await expect(page.locator("#question-maker")).toBeVisible();
	await page.locator("#builder-title").fill("UI Test Draft");
	await page.locator("#builder-id").fill("ui-test-draft");
	await page.getByRole("button", { name: "Lav board" }).click();
	await expect(page.locator("#builder-question-type")).toHaveCount(0);
	await expect(page.locator("#builder-answer-type")).toHaveCount(0);
	await expect(page.locator("#builder-image-upload")).toBeVisible();
	await expect(page.locator("#builder-answer-image-upload")).toBeVisible();
	await expect(page.locator("#builder-question-video-upload")).toBeVisible();
	await expect(page.locator("#builder-answer-video-upload")).toBeVisible();
	await expect(page.locator("#builder-video-upload")).toHaveCount(0);
	await expect(page.locator(".builder-media-settings")).toHaveCount(0);
	await expect(page.locator(".builder-media-note")).toContainText("src, start, autoplay, loop, controls og muted");
	await expect(page.locator("#builder-question-text")).toBeHidden();
	await expect(page.locator("#builder-question-preview")).toBeVisible();
	await page.locator("#builder-question-code-toggle").click();
	await page.locator("#builder-question-text").fill("**Preview question**");
	await page.locator("#builder-question-code-toggle").click();
	await expect(page.locator("#builder-question-preview strong")).toHaveText("Preview question");
	await page.locator("#builder-answer-code-toggle").click();
	await page.locator("#builder-answer-text").fill("Preview answer");
	await page.locator("#builder-answer-code-toggle").click();
	await expect(page.locator("#builder-answer-preview")).toContainText("Preview answer");
	let videoDialogCount = 0;
	page.on("dialog", async (dialog) => {
		videoDialogCount += 1;

		if (dialog.type() === "prompt" && videoDialogCount === 1) {
			await dialog.accept("examples/assets/video.mp4");
			return;
		}

		await dialog.dismiss();
	});
	await page.locator('[aria-label="Hjælp til svar"]').getByRole("button", { name: "Video" }).click();
	await expect(page.locator("#builder-answer-preview video")).toBeVisible();
	await expect(page.locator("#builder-answer-preview .question-media-source")).toHaveText("examples/assets/video.mp4");
	await page.locator("#builder-answer-code-toggle").click();
	await expect(page.locator("#builder-answer-text")).toHaveValue(/::video src="examples\/assets\/video\.mp4"/);
	await expect(page.locator("#builder-answer-text")).toHaveValue(/start="0"/);
	await expect(page.locator("#builder-answer-text")).toHaveValue(/autoplay="false"/);
	await expect(page.locator("#builder-answer-text")).toHaveValue(/loop="false"/);
	await expect(page.locator("#builder-answer-text")).toHaveValue(/controls="true"/);
	await expect(page.locator("#builder-answer-text")).toHaveValue(/muted="false"/);
	expect(videoDialogCount).toBe(1);

	const saveButton = page.locator("#builder-save-game-button");
	await saveButton.scrollIntoViewIfNeeded();
	await expect(saveButton).toBeVisible();
	await expectNoHorizontalOverflow(page);
});

test("home screen can scroll to live session controls", async ({ page }) => {
	await page.setViewportSize({ width: 1366, height: 768 });
	await openGame(page, "home");

	const homeSlide = page.locator("#home");
	const livePanel = page.locator("#live-session-panel");
	const before = await homeSlide.evaluate((element) => ({
		clientHeight: element.clientHeight,
		scrollHeight: element.scrollHeight,
		scrollTop: element.scrollTop,
	}));
	const panelBottomBefore = await livePanel.evaluate(
		(element) => element.getBoundingClientRect().bottom
	);

	expect(before.scrollHeight).toBeGreaterThan(before.clientHeight);
	expect(panelBottomBefore).toBeGreaterThan(768);

	await homeSlide.evaluate((element) => {
		element.scrollTop = element.scrollHeight;
	});

	const after = await homeSlide.evaluate((element) => element.scrollTop);
	const panelBottomAfter = await livePanel.evaluate(
		(element) => element.getBoundingClientRect().bottom
	);

	expect(after).toBeGreaterThan(before.scrollTop);
	expect(panelBottomAfter).toBeLessThanOrEqual(768);
	await expect(livePanel).toBeInViewport();
	await expect(page.locator("#live-session-start")).toBeVisible();
	const liveFontSizes = await page.evaluate(() => ({
		status: Number.parseFloat(
			getComputedStyle(document.querySelector("#live-session-status")).fontSize
		),
		startButton: Number.parseFloat(
			getComputedStyle(document.querySelector("#live-session-start")).fontSize
		),
		id: Number.parseFloat(
			getComputedStyle(document.querySelector("#live-session-id")).fontSize
		),
	}));

	expect(liveFontSizes.status).toBeGreaterThanOrEqual(10);
	expect(liveFontSizes.startButton).toBeGreaterThanOrEqual(10);
	expect(liveFontSizes.id).toBeGreaterThanOrEqual(20);
	await expectNoHorizontalOverflow(page);
});

test("question media stays inside slide bounds", async ({ page }) => {
	await page.setViewportSize({ width: 800, height: 600 });
	await openGame(page);

	await openQuestion(page, "Media for 100 points");
	await expectMediaInsideSlide(page, "img");

	await returnToBoard(page);
	await openQuestion(page, "Media for 200 points");
	await expectMediaInsideSlide(page, "video");

	await returnToBoard(page);
	await openQuestion(page, "Media for 300 points");
	await expectMediaInsideSlide(page, "iframe");
});
