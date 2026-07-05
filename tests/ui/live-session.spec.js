const { expect, test } = require("@playwright/test");

async function openHost(page) {
	await page.goto("/");
	await page.evaluate(() => localStorage.clear());
	await page.goto("/?game=ui-scaling#/home");
	await expect(page.locator("#game-title")).toHaveText("UI Scaling Test");
}

async function joinMobilePlayer(page, joinUrl, name, teamId) {
	await page.goto(joinUrl);
	await expect(page.locator("#mobile-session-id")).toHaveText(/^[A-Z2-9]{8}$/);
	await page.locator("#mobile-player-name").fill(name);
	await page.locator("#mobile-team-select").selectOption(teamId);
	await page.locator("#mobile-join-button").click();
	await expect(page.locator("#mobile-buzz-status")).toHaveText("Klar");
}

test("host can start live session and see mobile buzzers", async ({ browser, page }) => {
	await openHost(page);

	await expect(page.locator("#live-session-start")).toBeEnabled();
	await page.locator("#live-session-start").click();
	await expect(page.locator("#live-session-id")).toHaveText(/^[A-Z2-9]{8}$/);
	await expect(page.locator("#live-session-join-link")).toContainText("/play/");
	await expect(page.locator("#live-session-qr svg")).toBeVisible();

	const joinUrl = await page.locator("#live-session-join-link").getAttribute("href");
	const mobileOne = await browser.newContext({
		viewport: { width: 360, height: 740 },
	});
	const mobileTwo = await browser.newContext({
		viewport: { width: 390, height: 844 },
	});
	const playerOne = await mobileOne.newPage();
	const playerTwo = await mobileTwo.newPage();

	await joinMobilePlayer(playerOne, joinUrl, "Alice", "team1");
	await joinMobilePlayer(playerTwo, joinUrl, "Bob", "team2");

	await expect(page.locator("#live-session-players")).toContainText("Alice");
	await expect(page.locator("#live-session-players")).toContainText("Bob");

	await page.evaluate(() => {
		window.__livePanelNode = document.getElementById("live-session-panel");
		window.__buzzerPanelNode = document.getElementById("live-session-buzzers");
	});

	await playerOne.locator("#mobile-buzz-button").click();
	await expect(playerOne.locator("#mobile-buzz-status")).toHaveText("Du buzzede først");
	await playerTwo.locator("#mobile-buzz-button").click();
	await expect(playerTwo.locator("#mobile-buzz-status")).toHaveText("Du buzzede som nr. 2");

	await expect(page.locator("#live-session-buzzers")).toContainText("Alice - først");
	await expect(page.locator("#live-session-buzzers")).toContainText("Bob - nr. 2");
	await expect(
		await page.evaluate(
			() =>
				window.__livePanelNode === document.getElementById("live-session-panel") &&
				window.__buzzerPanelNode === document.getElementById("live-session-buzzers")
		)
	).toBe(true);

	await page.locator("#live-session-clear-buzzers").click();
	await expect(page.locator("#live-session-buzzers")).toHaveText("Ingen buzzers.");
	await expect(playerOne.locator("#mobile-buzz-status")).toHaveText("Klar");

	await page.locator("#live-session-stop").click();
	await expect(page.locator("#live-session-id")).toHaveText("-");

	await mobileOne.close();
	await mobileTwo.close();
	await page.close();
});

test("live session reconnects after starting the game and syncs score", async ({ browser, page }) => {
	await openHost(page);
	await page.locator("#live-session-start").click();
	await expect(page.locator("#live-session-id")).toHaveText(/^[A-Z2-9]{8}$/);
	const sessionId = await page.locator("#live-session-id").textContent();
	const joinUrl = await page.locator("#live-session-join-link").getAttribute("href");
	const mobileContext = await browser.newContext({
		viewport: { width: 360, height: 740 },
	});
	const player = await mobileContext.newPage();

	await joinMobilePlayer(player, joinUrl, "Alice", "team1");
	await player.locator("#mobile-buzz-button").click();
	await expect(page.locator("#live-session-buzzers")).toContainText("Alice - først");

	await page.getByRole("button", { name: "Start game" }).click();
	await expect(page.locator("#board.present")).toBeVisible();
	await expect(page.locator(".board-live-panel .live-game-buzzers")).toContainText("Alice - først");

	await page.locator("#jeopardy-board").getByRole("link", { name: "Media for 100 points" }).click();
	await expect(page.locator(".question-slide.present .live-game-buzzers")).toHaveText("Ingen buzzers.");
	await expect(player.locator("#mobile-buzz-status")).toHaveText("Klar");
	await player.locator("#mobile-buzz-button").click();
	await expect(page.locator(".question-slide.present .live-game-buzzers")).toContainText("Alice - først");
	await page.getByRole("button", { name: "Red correct, plus 100" }).click();
	await expect(page.locator("#score-team1")).toHaveText("100");
	await expect(page.locator("#board.present")).toBeVisible();

	const liveScores = await page.evaluate(async (activeSessionId) => {
		const response = await fetch("/api/sessions/" + encodeURIComponent(activeSessionId));
		const session = await response.json();

		return session.scores;
	}, sessionId);

	expect(liveScores.team1).toBe(100);
	await mobileContext.close();
});

test("local scoring still works when live score sync fails", async ({ page }) => {
	await openHost(page);
	await page.locator("#live-session-start").click();
	await expect(page.locator("#live-session-id")).toHaveText(/^[A-Z2-9]{8}$/);
	await page.getByRole("button", { name: "Start game" }).click();
	await expect(page.locator("#board.present")).toBeVisible();

	await page.route("**/api/sessions/*/score", async (route) => {
		await route.fulfill({
			status: 500,
			contentType: "application/json",
			body: JSON.stringify({ detail: "Score sync failed" }),
		});
	});

	await page.locator("#jeopardy-board").getByRole("link", { name: "Media for 100 points" }).click();
	await page.getByRole("button", { name: "Red correct, plus 100" }).click();
	await expect(page.locator("#score-team1")).toHaveText("100");
	await expect(page.locator("#board.present")).toBeVisible();
	await expect(page.locator("#live-session-error")).toContainText("Live score kunne ikke opdateres.");
});
