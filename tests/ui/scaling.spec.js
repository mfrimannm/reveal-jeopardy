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
		reveal: document.querySelector(".reveal").scrollWidth - document.querySelector(".reveal").clientWidth,
	}));

	expect(overflow.documentElement).toBeLessThanOrEqual(1);
	expect(overflow.body).toBeLessThanOrEqual(1);
	expect(overflow.reveal).toBeLessThanOrEqual(1);
}

async function openQuestion(page, label) {
	await page.locator("#jeopardy-board").getByRole("link", { name: label }).click();
	await expect(page.locator(".question-slide.present")).toBeVisible();
}

async function expectMediaInsideSlide(page, selector) {
	const media = page.locator(`.question-slide.present ${selector}`).first();
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

test("question maker stays usable on laptop viewport", async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 720 });
	await openGame(page, "home");

	await page.getByRole("button", { name: "Question maker" }).click();
	await expect(page.locator("#question-maker")).toBeVisible();
	await page.locator("#builder-title").fill("UI Test Draft");
	await page.locator("#builder-id").fill("ui-test-draft");
	await page.getByRole("button", { name: "Lav board" }).click();

	const saveButton = page.locator("#builder-save-game-button");
	await saveButton.scrollIntoViewIfNeeded();
	await expect(saveButton).toBeVisible();
	await expectNoHorizontalOverflow(page);
});

test("question media stays inside slide bounds", async ({ page }) => {
	await page.setViewportSize({ width: 800, height: 600 });
	await openGame(page);

	await openQuestion(page, "Media for 100 points");
	await expectMediaInsideSlide(page, "img");

	await openGame(page);
	await openQuestion(page, "Media for 200 points");
	await expectMediaInsideSlide(page, "video");

	await openGame(page);
	await openQuestion(page, "Media for 300 points");
	await expectMediaInsideSlide(page, "iframe");
});
