let mobileSession = null;
let mobilePlayer = null;
let mobileSocket = null;

function getMobileSessionId() {
	const parts = window.location.pathname.split("/").filter(Boolean);

	return (parts[1] || "").toUpperCase();
}

function setMobileError(message) {
	const error = document.getElementById("mobile-error");

	if (!error) {
		return;
	}

	error.textContent = message || "";
	error.hidden = !message;
}

function getMobilePlayerBuzzer() {
	if (!mobileSession || !mobilePlayer) {
		return null;
	}

	return mobileSession.buzzers.find(
		(buzzer) => buzzer.player_id === mobilePlayer.id
	);
}

function renderMobileTeams() {
	const select = document.getElementById("mobile-team-select");

	if (!select || !mobileSession) {
		return;
	}

	select.innerHTML = "";
	mobileSession.teams.forEach((team) => {
		const option = document.createElement("option");

		option.value = team.id;
		option.textContent = team.name;
		select.appendChild(option);
	});
}

function renderMobileSession() {
	const sessionId = document.getElementById("mobile-session-id");
	const sessionStatus = document.getElementById("mobile-session-status");
	const joinPanel = document.getElementById("mobile-join-panel");
	const buzzerPanel = document.getElementById("mobile-buzzer-panel");
	const summary = document.getElementById("mobile-player-summary");
	const buzzButton = document.getElementById("mobile-buzz-button");
	const buzzStatus = document.getElementById("mobile-buzz-status");
	const buzzer = getMobilePlayerBuzzer();
	const team =
		mobileSession && mobilePlayer
			? mobileSession.teams.find((entry) => entry.id === mobilePlayer.team_id)
			: null;

	if (sessionId) {
		sessionId.textContent = getMobileSessionId() || "-";
	}

	if (sessionStatus) {
		sessionStatus.textContent = mobileSession ? "Tilsluttet" : "Afventer host";
	}

	if (joinPanel) {
		joinPanel.hidden = Boolean(mobilePlayer);
	}

	if (buzzerPanel) {
		buzzerPanel.hidden = !mobilePlayer;
	}

	if (summary && mobilePlayer) {
		summary.textContent =
			mobilePlayer.name + (team ? " / " + team.name : "");
	}

	if (buzzButton) {
		buzzButton.disabled = !mobilePlayer || !mobileSession || mobileSession.buzzer_locked || Boolean(buzzer);
	}

	if (buzzStatus) {
		if (!mobilePlayer) {
			buzzStatus.textContent = "Afventer host";
		} else if (mobileSession && mobileSession.buzzer_locked) {
			buzzStatus.textContent = "Buzzers låst";
		} else if (buzzer && buzzer.order === 1) {
			buzzStatus.textContent = "Du buzzede først";
		} else if (buzzer) {
			buzzStatus.textContent = "Du buzzede som nr. " + buzzer.order;
		} else {
			buzzStatus.textContent = "Klar";
		}
	}
}

function handleMobileMessage(message) {
	if (!message || !message.type) {
		return;
	}

	if (message.type === "session_state") {
		mobileSession = message.session;
		renderMobileSession();
		return;
	}

	if (message.type === "session_stopped") {
		mobileSession = null;
		setMobileError("Sessionen er stoppet af host.");
		renderMobileSession();
	}
}

function connectMobileSocket() {
	if (mobileSocket) {
		mobileSocket.close();
	}

	mobileSocket = connectLiveSessionSocket(getMobileSessionId(), {
		message: handleMobileMessage,
		error: () => setMobileError("Live forbindelse fejlede."),
		close: () => {
			if (mobileSession) {
				setMobileError("Live forbindelse afbrudt.");
			}
		},
	});
}

async function initializeMobilePlay() {
	try {
		mobileSession = await fetchLiveSession(getMobileSessionId());
		renderMobileTeams();
		renderMobileSession();
		connectMobileSocket();
	} catch (error) {
		console.warn("Could not load session.", error);
		setMobileError(error.message || "Sessionen blev ikke fundet.");
		renderMobileSession();
	}
}

async function joinMobilePlay() {
	const nameInput = document.getElementById("mobile-player-name");
	const teamSelect = document.getElementById("mobile-team-select");

	try {
		const result = await joinLiveSession(
			getMobileSessionId(),
			nameInput ? nameInput.value : "",
			teamSelect ? teamSelect.value : ""
		);

		mobilePlayer = result.player;
		mobileSession = result.session;
		setMobileError("");
		renderMobileSession();
	} catch (error) {
		console.warn("Could not join session.", error);
		setMobileError(error.message || "Kunne ikke joine sessionen.");
	}
}

async function buzzMobilePlay() {
	if (!mobilePlayer) {
		return;
	}

	try {
		const result = await buzzLiveSession(getMobileSessionId(), mobilePlayer.id);
		mobileSession = result.session;
		setMobileError("");
		renderMobileSession();
	} catch (error) {
		console.warn("Could not buzz.", error);
		setMobileError(error.message || "Kunne ikke buzze.");

		if (error.message === "Buzzers are locked") {
			const status = document.getElementById("mobile-buzz-status");

			if (status) {
				status.textContent = "Buzzers låst";
			}
		}
	}
}

document.addEventListener("DOMContentLoaded", () => {
	const joinButton = document.getElementById("mobile-join-button");
	const buzzButton = document.getElementById("mobile-buzz-button");

	if (joinButton) {
		joinButton.addEventListener("click", joinMobilePlay);
	}

	if (buzzButton) {
		buzzButton.addEventListener("click", buzzMobilePlay);
	}

	initializeMobilePlay();
});
