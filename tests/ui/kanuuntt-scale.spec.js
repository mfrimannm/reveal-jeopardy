const { expect, test } = require("@playwright/test");

const JEOPARDY_HOST_GAME_ID = "ui-scaling";
const JEOPARDY_HOST_GAME_TITLE = "UI Scaling Test";
const KANUUNTT_SCALE_GAME_ID = "kanuuntt-demo";

const VIEWPORTS = [
	{ name: "desktop", width: 1440, height: 900 },
	{ name: "tablet", width: 1024, height: 768 },
	{ name: "mobile", width: 390, height: 844 },
	{ name: "small mobile", width: 360, height: 640 },
];

async function expectSurfaceFits(page, selector, label) {
	const result = await page.locator(selector).evaluate((surface) => {
		const viewportWidth = document.documentElement.clientWidth;
		const pageOverflow = document.documentElement.scrollWidth - viewportWidth;
		const rect = surface.getBoundingClientRect();
		const visibleElements = Array.from(surface.querySelectorAll("button, a, input, select, textarea, h1, h2, h3, .game-button"))
			.filter((element) => {
				const style = window.getComputedStyle(element);
				const bounds = element.getBoundingClientRect();

				return (
					style.display !== "none" &&
					style.visibility !== "hidden" &&
					bounds.width > 0 &&
					bounds.height > 0
				);
			});
		const overflowingElement = visibleElements.find((element) => {
			const bounds = element.getBoundingClientRect();

			return bounds.left < -2 || bounds.right > viewportWidth + 2;
		});

		return {
			pageOverflow,
			surfaceLeft: rect.left,
			surfaceRight: rect.right,
			viewportWidth,
			overflowingElement: overflowingElement
				? {
					tag: overflowingElement.tagName.toLowerCase(),
					id: overflowingElement.id,
					className: overflowingElement.className,
					text: overflowingElement.textContent.trim().slice(0, 80),
				}
				: null,
		};
	});

	expect(result.pageOverflow, `${label} should not create horizontal page scroll`).toBeLessThanOrEqual(2);
	expect(result.surfaceLeft, `${label} surface should not start outside viewport`).toBeGreaterThanOrEqual(-2);
	expect(result.surfaceRight, `${label} surface should not exceed viewport width`).toBeLessThanOrEqual(result.viewportWidth + 2);
	expect(result.overflowingElement, `${label} has a visible control/text element outside the viewport`).toBeNull();
}

async function checkAtViewports(page, selector, label) {
	for (const viewport of VIEWPORTS) {
		await page.setViewportSize({ width: viewport.width, height: viewport.height });
		await expectSurfaceFits(page, selector, `${label} at ${viewport.name}`);
	}
}

async function openQuizHost(page) {
	await page.goto("/");
	await page.evaluate(() => localStorage.clear());
	await page.goto(`/?game=${JEOPARDY_HOST_GAME_ID}#/home`);
	await expect(page.locator("#game-title")).toHaveText(JEOPARDY_HOST_GAME_TITLE);
}

test("Kanuuntt UI scales across desktop, tablet and mobile resolutions", async ({ browser, page }) => {
	await openQuizHost(page);
	await page.locator("#kanuuntt-game-select").evaluate((select, gameId) => {
		select.value = gameId;
	}, KANUUNTT_SCALE_GAME_ID);
	await expect(page.locator("#kanuuntt-game-select")).toHaveValue(KANUUNTT_SCALE_GAME_ID);
	await checkAtViewports(page, "#home", "Kanuuntt home");

	await page.evaluate(() => toggleKanuunttMaker(true));
	await expect(page.locator("#kanuuntt-maker")).toBeVisible();
	await checkAtViewports(page, "#kanuuntt-maker", "Kanuuntt maker");
	await page.evaluate(() => toggleKanuunttMaker(false));

	await page.locator("#kanuuntt-session-start").click();
	await expect(page.locator("#quiz-session-panel")).toBeVisible();
	await expect(page.locator("#live-session-id")).toHaveText(/^[A-Z2-9]{8}$/);
	await checkAtViewports(page, "#quiz-session-panel", "Kanuuntt host panel");

	const sessionId = await page.locator("#live-session-id").textContent();
	const joinUrl = await page.locator("#live-session-join-link").getAttribute("href");
	const backendPage = await page.context().newPage();
	const displayPage = await page.context().newPage();
	const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
	const mobilePage = await mobileContext.newPage();

	await backendPage.goto("/kanuuntt/backend/" + sessionId);
	await displayPage.goto("/kanuuntt/display/" + sessionId);
	await mobilePage.goto(joinUrl);
	await expect(backendPage.locator("#kanuuntt-backend-stage")).toHaveText("Waiting room");
	await expect(displayPage.locator("#kanuuntt-display-stage")).toHaveText("Waiting room");
	await expect(mobilePage.locator("#mobile-session-id")).toHaveText(sessionId);

	await checkAtViewports(backendPage, ".kanuuntt-backend", "Kanuuntt backend");
	await checkAtViewports(displayPage, ".kanuuntt-display", "Kanuuntt display");
	await checkAtViewports(mobilePage, ".mobile-play-shell", "Kanuuntt mobile join");

	await mobilePage.locator("#mobile-player-name").fill("Scale Test");
	await mobilePage.locator("#mobile-team-select").selectOption("team1");
	await mobilePage.locator("#mobile-join-button").click();
	await expect(mobilePage.locator("#mobile-quiz-panel")).toBeVisible();
	await checkAtViewports(mobilePage, ".mobile-play-shell", "Kanuuntt mobile quiz");

	await backendPage.locator("#kanuuntt-start-question").click();
	await expect(backendPage.locator("#kanuuntt-backend-stage")).toHaveText("Spørgsmålet er åbent");
	await expect(displayPage.locator("#kanuuntt-display-stage")).toHaveText("Spørgsmålet er åbent");
	await expect(mobilePage.locator("#mobile-quiz-prompt")).toContainText("Velkommen til KanUUNTt");
	await expect(displayPage.locator("#kanuuntt-display-prompt")).toContainText("Velkommen til KanUUNTt");
	await checkAtViewports(page, "#quiz-session-panel", "Kanuuntt active host panel");
	await checkAtViewports(backendPage, ".kanuuntt-backend", "Kanuuntt active backend");
	await checkAtViewports(displayPage, ".kanuuntt-display", "Kanuuntt active display");
	await checkAtViewports(mobilePage, ".mobile-play-shell", "Kanuuntt active mobile quiz");

	await backendPage.close();
	await displayPage.close();
	await mobileContext.close();
});
