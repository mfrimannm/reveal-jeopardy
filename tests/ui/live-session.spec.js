const { expect, test } = require("@playwright/test");

async function openHost(page) {
	await page.goto("/");
	await page.evaluate(() => localStorage.clear());
	await page.goto("/?game=ui-scaling#/home");
	await expect(page.locator("#game-title")).toHaveText("UI Scaling Test");
}

async function openQuizHost(page) {
	await page.goto("/");
	await page.evaluate(() => localStorage.clear());
	await page.goto("/?game=ui-quiz#/home");
	await expect(page.locator("#game-title")).toHaveText("UI Quiz Test");
}

async function joinMobilePlayer(page, joinUrl, name, teamId) {
	await page.goto(joinUrl);
	await expect(page.locator("#mobile-session-id")).toHaveText(/^[A-Z2-9]{8}$/);
	await page.locator("#mobile-player-name").fill(name);
	await page.locator("#mobile-team-select").selectOption(teamId);
	await page.locator("#mobile-join-button").click();
	await expect(page.locator("#mobile-buzz-status")).toHaveText("Klar");
}

async function joinMobileQuizPlayer(page, joinUrl, name, teamId) {
	await page.goto(joinUrl);
	await expect(page.locator("#mobile-session-id")).toHaveText(/^[A-Z2-9]{8}$/);
	await page.locator("#mobile-player-name").fill(name);
	await page.locator("#mobile-team-select").selectOption(teamId);
	await page.locator("#mobile-join-button").click();
	await expect(page.locator("#mobile-quiz-panel")).toBeVisible();
}

test("host can start live session and see mobile buzzers", async ({ browser, page }) => {
	await openHost(page);

	await expect(page.locator("#live-session-start")).toBeEnabled();
	await page.locator("#live-session-start").click();
	await expect(page.locator("#live-session-id")).toHaveText(/^[A-Z2-9]{8}$/);
	await expect(page.locator("#live-session-join-link")).toContainText("/play/");
	await expect(page.locator("#live-session-qr img")).toBeVisible();

	const joinUrl = await page.locator("#live-session-join-link").getAttribute("href");
	const qrSrc = await page.locator("#live-session-qr img").getAttribute("src");
	expect(new URL(qrSrc, "http://127.0.0.1:8010").searchParams.get("value")).toBe(joinUrl);
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

	await expect(page.locator("#live-session-buzzers")).toContainText("Alice (Red) - først");
	await expect(page.locator("#live-session-buzzers")).toContainText("Bob (Blue) - nr. 2");
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

test("host can run a quiz question with mobile answers and scoreboard", async ({ browser, page }) => {
	test.setTimeout(45_000);
	await openQuizHost(page);

	await expect(page.locator("#quiz-session-start")).toBeEnabled();
	await page.locator("#quiz-session-start").click();
	await expect(page.locator("#live-session-id")).toHaveText(/^[A-Z2-9]{8}$/);
	await expect(page.locator("#live-session-join-link")).toContainText("/play/");
	await expect(page.locator("#live-session-qr img")).toBeVisible();
	await expect(page.locator("#quiz-session-panel")).toBeVisible();
	await expect(page.locator("#quiz-session-stage")).toHaveText("Waiting room");

	const joinUrl = await page.locator("#live-session-join-link").getAttribute("href");
	const sessionId = await page.locator("#live-session-id").textContent();
	const displayPage = await browser.newContext().then(ctx => ctx.newPage());
	const backendPage = await browser.newContext().then(ctx => ctx.newPage());

	await displayPage.goto("/kanuuntt/display/" + sessionId);
	await backendPage.goto("/kanuuntt/backend/" + sessionId);
	await expect(displayPage.locator("#kanuuntt-display-stage")).toHaveText("Waiting room");
	await expect(displayPage.locator("#kanuuntt-display-session-id")).toHaveText(sessionId);
	await expect(displayPage.locator("#kanuuntt-display-qr img")).toBeVisible();
	await expect(backendPage.locator("#kanuuntt-backend-stage")).toHaveText("Waiting room");
	await expect(backendPage.locator("#kanuuntt-open-display")).toHaveAttribute("href", /\/kanuuntt\/display\//);
	const mobileContext = await browser.newContext({
		viewport: { width: 360, height: 740 },
	});
	const player = await mobileContext.newPage();
	const secondPlayer = await mobileContext.newPage();
	const thirdPlayer = await mobileContext.newPage();
	const fourthPlayer = await mobileContext.newPage();

	await joinMobileQuizPlayer(player, joinUrl, "Alice", "team1");
	await joinMobileQuizPlayer(secondPlayer, joinUrl, "Bob", "team2");
	await joinMobileQuizPlayer(thirdPlayer, joinUrl, "Cara", "team1");
	await joinMobileQuizPlayer(fourthPlayer, joinUrl, "Dan", "team2");
	await expect(page.locator("#live-session-players")).toContainText("Alice");
	await expect(page.locator("#live-session-players")).toContainText("Bob");
	await expect(page.locator("#live-session-players")).toContainText("Cara");
	await expect(page.locator("#live-session-players")).toContainText("Dan");
	await expect(displayPage.locator("#kanuuntt-display-players")).toContainText("Alice");
	await expect(displayPage.locator("#kanuuntt-display-players")).toContainText("Bob");
	await expect(displayPage.locator("#kanuuntt-display-players")).toContainText("Cara");
	await expect(displayPage.locator("#kanuuntt-display-players")).toContainText("Dan");
	await expect(backendPage.locator("#kanuuntt-backend-player-count")).toHaveText("4");

	await backendPage.locator("#kanuuntt-start-question").click();
	await expect(page.locator("#quiz-session-stage")).toHaveText("Spørgsmålet er åbent");
	await expect(page.locator("#quiz-session-question")).toHaveText("What does the image show?");
	await expect(displayPage.locator("#kanuuntt-display-stage")).toHaveText("Spørgsmålet er åbent");
	await expect(displayPage.locator("#kanuuntt-display-prompt")).toHaveText("What does the image show?");
	await expect(page.locator("#quiz-session-media img")).toBeVisible();
	await expect(player.locator("#mobile-quiz-prompt")).toHaveText("What does the image show?");
	await expect(player.locator(".mobile-answer-button")).toHaveCount(4);
	await expect(player.locator("#mobile-quiz-status")).toHaveText("Vælg et svar");

	await player.getByRole("button", { name: /A local image/ }).click();
	await secondPlayer.getByRole("button", { name: /A local image/ }).click();
	await thirdPlayer.getByRole("button", { name: /An audio clip/ }).click();
	await fourthPlayer.getByRole("button", { name: /A timer/ }).click();
	await expect(player.locator("#mobile-quiz-status")).toHaveText("Svar modtaget. Venter på de andre.");
	await expect(page.locator("#quiz-live-answer-count")).toHaveText("4 / 4 har svaret");
	await expect(backendPage.locator("#kanuuntt-backend-answer-count")).toHaveText("4 / 4");

	await backendPage.locator("#kanuuntt-close-question").click();
	await expect(page.locator("#quiz-session-stage")).toHaveText("Resultatfordeling");
	await expect(page.locator("#quiz-session-answers")).toContainText("2 svar / 50%");
	await expect(displayPage.locator("#kanuuntt-display-stage")).toHaveText("Resultat");
	await expect(displayPage.locator("#kanuuntt-display-answers")).toContainText("2 svar / 50%");
	await expect(page.locator("#quiz-result-details")).toContainText("Alice +1000 point");

	await backendPage.locator("#kanuuntt-show-scoreboard").click();
	await expect(page.locator("#quiz-session-stage")).toHaveText("Scoreboard", { timeout: 12_000 });
	await expect(displayPage.locator("#kanuuntt-display-stage")).toHaveText("Scoreboard", { timeout: 12_000 });
	await expect(page.locator("#quiz-scoreboard")).toContainText("Alice");
	await expect(page.locator("#quiz-scoreboard")).toContainText("Bob");
	await expect(page.locator("#quiz-scoreboard")).toContainText("1000 point");

	await backendPage.locator("#kanuuntt-next-question").click();
	await backendPage.locator("#kanuuntt-start-question").click();
	await expect(page.locator("#quiz-session-question")).toHaveText("Which rule counts in this quiz?", { timeout: 12_000 });
	await expect(player.locator("#mobile-quiz-prompt")).toHaveText("Which rule counts in this quiz?");

	await player.getByRole("button", { name: /The first submitted answer counts/ }).click();
	await secondPlayer.getByRole("button", { name: /Scores are random/ }).click();
	await thirdPlayer.getByRole("button", { name: /The first submitted answer counts/ }).click();
	await fourthPlayer.getByRole("button", { name: /Scores are random/ }).click();
	await expect(page.locator("#quiz-live-answer-count")).toHaveText("4 / 4 har svaret");

	await backendPage.locator("#kanuuntt-close-question").click();
	await backendPage.locator("#kanuuntt-show-scoreboard").click();
	await expect(page.locator("#quiz-session-stage")).toHaveText("Scoreboard", { timeout: 12_000 });
	await backendPage.locator("#kanuuntt-next-question").click();
	await expect(page.locator("#quiz-session-stage")).toHaveText("Final scoreboard");
	await expect(displayPage.locator("#kanuuntt-display-stage")).toHaveText("Final scoreboard");
	await expect(page.locator("#quiz-scoreboard")).toContainText("Vinder: Alice");
	await expect(page.locator("#quiz-scoreboard .quiz-final-podium")).toContainText("1. plads");
	await expect(page.locator("#quiz-scoreboard .quiz-final-podium")).toContainText("Alice");
	await expect(page.locator("#quiz-scoreboard .quiz-final-podium")).toContainText("Bob");
	await expect(page.locator("#quiz-scoreboard .quiz-final-podium")).toContainText("Cara");
	await expect(page.locator("#quiz-scoreboard .quiz-final-rest")).toContainText("Dan");
	await expect(page.locator("#quiz-scoreboard .quiz-final-rest")).toContainText("4");
	await expect(page.locator("#quiz-scoreboard .quiz-final-rest")).toContainText("0 point");

	const tieMarkup = await page.evaluate(() => {
		liveSessionState = {
			session_id: "TESTTIE1",
			mode: "quiz",
			players: [
				{ id: "alice", name: "Alice" },
				{ id: "bob", name: "Bob" },
				{ id: "cara", name: "Cara" },
			],
			scores: { alice: 100, bob: 100, cara: 50 },
		};
		const container = document.createElement("div");

		renderQuizScoreboard(container, true);

		return container.textContent;
	});

	expect(tieMarkup).toContain("Vindere: Alice og Bob");
	expect(tieMarkup).toContain("1. plads");
	expect(tieMarkup).toContain("3. plads");

	await displayPage.close();
	await backendPage.close();
	await mobileContext.close();
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
	await expect(page.locator("#live-session-buzzers")).toContainText("Alice (Red) - først");

	await page.getByRole("button", { name: "Start game" }).click();
	await expect(page.locator("#board.present")).toBeVisible();
	await expect(page.locator(".board-live-panel .live-game-buzzers")).toContainText("Alice (Red) - først");

	await page.locator("#jeopardy-board").getByRole("link", { name: "Media for 100 points" }).click();
	await expect(page.locator(".question-slide.present .live-game-buzzers")).toHaveText("Ingen buzzers.");
	await expect(player.locator("#mobile-buzz-status")).toHaveText("Klar");
	await player.locator("#mobile-buzz-button").click();
	await expect(page.locator(".question-slide.present .live-game-buzzers")).toContainText("Alice (Red) - først");
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
