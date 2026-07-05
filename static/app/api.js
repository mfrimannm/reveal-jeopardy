async function fetchJson(url, options) {
	const response = await fetch(url, options || {});

	if (!response.ok) {
		let message = response.statusText || "Request failed";

		try {
			const errorBody = await response.json();

			if (errorBody && errorBody.detail) {
				message = errorBody.detail;
			}
		} catch (error) {
			// Keep the HTTP status text when the response is not JSON.
		}

		throw new Error(message);
	}

	return response.json();
}

async function refreshAdminState() {
	try {
		adminState = await fetchJson("/api/me");
	} catch (error) {
		adminState = { authenticated: false };
	}

	updateAdminControls();
}

function isAdmin() {
	return Boolean(adminState && adminState.authenticated);
}

function getGameRecord(key) {
	return availableGames.find((game) => game.id === key) || null;
}

function getRequestedGameKey() {
	const params = new URLSearchParams(window.location.search);
	const requestedGame = params.get("game") || DEFAULT_GAME_KEY;
	const firstGame = availableGames[0] && availableGames[0].id;

	if (getGameRecord(requestedGame)) {
		return requestedGame;
	}

	if (getGameRecord(DEFAULT_GAME_KEY)) {
		return DEFAULT_GAME_KEY;
	}

	return firstGame || DEFAULT_GAME_KEY;
}

async function loadGameFile() {
	await refreshAdminState();

	try {
		availableGames = await fetchJson("/api/games");
	} catch (error) {
		console.warn("Could not load game list.", error);
		availableGames = [];
	}

	gameKey = getRequestedGameKey();

	try {
		window.JEOPARDY_GAME = await fetchJson(
			"/api/games/" + encodeURIComponent(gameKey)
		);
		gameKey = window.JEOPARDY_GAME.id || gameKey;
	} catch (error) {
		console.warn("Could not load game.", error);
		window.JEOPARDY_GAME = {
			id: gameKey,
			title: "Jeopardy",
			teams: ["Team 1", "Team 2", "Team 3"],
			categories: [
				{
					title: "Ingen spil",
					questions: [
						{
							points: 100,
							question: {
								format: "rich",
								content: "Der kunne ikke hentes et spil fra serveren.",
							},
							answer: {
								format: "rich",
								content: "Tjek at FastAPI-serveren kører.",
							},
						},
					],
				},
			],
		};
	}
}

function updateAdminControls() {
	const status = document.getElementById("admin-status");
	const password = document.getElementById("admin-password");
	const loginButton = document.getElementById("admin-login-button");
	const logoutButton = document.getElementById("admin-logout-button");
	const saveButton = document.getElementById("builder-save-game-button");

	if (status) {
		status.textContent = isAdmin()
			? "Logget ind som admin. Du kan gemme spil og uploade media."
			: "Log ind som admin for at gemme spil og uploade media.";
	}

	if (password) {
		password.hidden = isAdmin();
		password.disabled = isAdmin();
	}

	if (loginButton) {
		loginButton.hidden = isAdmin();
	}

	if (logoutButton) {
		logoutButton.hidden = !isAdmin();
	}

	if (saveButton) {
		saveButton.disabled = !isAdmin();
	}

	document.querySelectorAll(".builder-upload-button").forEach((uploadButton) => {
		uploadButton.disabled = !isAdmin();
	});

	if (typeof renderHostLiveSession === "function") {
		renderHostLiveSession();
	}
}

async function loginAdmin() {
	const password = document.getElementById("admin-password");

	try {
		await fetchJson("/api/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ password: password ? password.value : "" }),
		});
		if (password) {
			password.value = "";
		}
		await refreshAdminState();
		setBuilderStatus("Admin login OK.");
	} catch (error) {
		console.warn("Could not log in.", error);
		setBuilderStatus("Admin login fejlede.");
	}
}

async function logoutAdmin() {
	try {
		await fetchJson("/api/logout", { method: "POST" });
	} catch (error) {
		console.warn("Could not log out.", error);
	}

	await refreshAdminState();
	setBuilderStatus("Logget ud.");
}
