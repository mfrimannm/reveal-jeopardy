function getLiveHostSessionId() {
	return liveSessionState && liveSessionState.session_id;
}

function getStoredLiveSessionKey() {
	return LIVE_SESSION_STORAGE_KEY + gameKey;
}

function setHostLiveSession(session) {
	if (!session || !session.session_id) {
		liveSessionState = null;
		return;
	}

	if (session.host_token) {
		liveSessionHostToken = session.host_token;
	}

	liveSessionState = {
		...session,
	};
	delete liveSessionState.host_token;
}

function rememberLiveSession(sessionId, hostToken) {
	try {
		if (sessionId) {
			localStorage.setItem(
				getStoredLiveSessionKey(),
				JSON.stringify({
					session_id: sessionId,
					host_token: hostToken || "",
				})
			);
		}
	} catch (error) {
		console.warn("Could not remember live session.", error);
	}
}

function forgetLiveSession() {
	try {
		localStorage.removeItem(getStoredLiveSessionKey());
	} catch (error) {
		console.warn("Could not forget live session.", error);
	}

	liveSessionHostToken = "";
}

function getStoredLiveSession() {
	try {
		const savedValue = localStorage.getItem(getStoredLiveSessionKey());

		if (!savedValue) {
			return null;
		}

		if (savedValue.charAt(0) !== "{") {
			return {
				session_id: savedValue,
				host_token: "",
			};
		}

		const parsedValue = JSON.parse(savedValue);

		return {
			session_id: parsedValue.session_id || "",
			host_token: parsedValue.host_token || "",
		};
	} catch (error) {
		return null;
	}
}

function getLiveJoinUrl(sessionId) {
	return window.location.origin + "/play/" + encodeURIComponent(sessionId);
}

function setLiveSessionError(message) {
	liveSessionError = message || "";
	updateSessionStatus();
}

function setLiveSessionStatus(status) {
	liveSessionStatus = status;
	updateSessionStatus();
}

function closeLiveSessionSocket() {
	if (liveSessionSocket) {
		liveSessionSocket.onclose = null;
		liveSessionSocket.close();
		liveSessionSocket = null;
	}
}

function handleLiveSessionMessage(message) {
	if (!message || !message.type) {
		return;
	}

	if (message.type === "session_state") {
		setHostLiveSession(message.session);
		liveSessionError = "";
		liveSessionStatus = "connected";
		renderHostLiveSession();
		return;
	}

	if (message.type === "session_stopped") {
		liveSessionState = null;
		liveSessionHostToken = "";
		liveSessionStatus = "stopped";
		forgetLiveSession();
		closeLiveSessionSocket();
		renderHostLiveSession();
	}
}

function connectHostLiveSession(sessionId) {
	closeLiveSessionSocket();
	liveSessionStatus = "connecting";
	liveSessionSocket = connectLiveSessionSocket(sessionId, {
		open: () => setLiveSessionStatus("connected"),
		message: handleLiveSessionMessage,
		error: (message) => setLiveSessionError(message),
		close: () => {
			if (liveSessionState) {
				liveSessionStatus = "disconnected";
				liveSessionError = "Live forbindelse afbrudt. Prøv at starte sessionen igen.";
				updateSessionStatus();
			}
		},
	});
}

async function startLiveSession() {
	try {
		setLiveSessionStatus("starting");
		const session = await createLiveSession(gameKey);
		setHostLiveSession(session);
		liveSessionError = "";
		rememberLiveSession(session.session_id, liveSessionHostToken);
		connectHostLiveSession(session.session_id);
		renderHostLiveSession();
	} catch (error) {
		console.warn("Could not start live session.", error);
		setLiveSessionError(error.message || "Kunne ikke starte live session.");
	}
}

async function stopHostLiveSession() {
	const sessionId = getLiveHostSessionId();

	if (!sessionId) {
		return;
	}

	try {
		await stopLiveSession(sessionId, liveSessionHostToken);
		liveSessionState = null;
		liveSessionStatus = "stopped";
		forgetLiveSession();
		closeLiveSessionSocket();
		renderHostLiveSession();
	} catch (error) {
		console.warn("Could not stop live session.", error);
		setLiveSessionError(error.message || "Kunne ikke stoppe live session.");
	}
}

async function resetHostLiveSession() {
	const sessionId = getLiveHostSessionId();

	if (!sessionId) {
		return;
	}

	try {
		setHostLiveSession(await resetLiveSession(sessionId, liveSessionHostToken));
		syncScoresFromLiveSession();
		renderHostLiveSession();
	} catch (error) {
		console.warn("Could not reset live session.", error);
		setLiveSessionError(error.message || "Kunne ikke resette live session.");
	}
}

async function clearHostLiveBuzzers() {
	const sessionId = getLiveHostSessionId();

	if (!sessionId) {
		return;
	}

	try {
		setHostLiveSession(await clearLiveBuzzers(sessionId, liveSessionHostToken));
		renderHostLiveSession();
	} catch (error) {
		console.warn("Could not clear buzzers.", error);
		setLiveSessionError(error.message || "Kunne ikke rydde buzzers.");
	}
}

async function toggleHostLiveBuzzerLock() {
	const sessionId = getLiveHostSessionId();

	if (!sessionId || !liveSessionState) {
		return;
	}

	try {
		setHostLiveSession(
			liveSessionState.buzzer_locked
				? await unlockLiveBuzzers(sessionId, liveSessionHostToken)
				: await lockLiveBuzzers(sessionId, liveSessionHostToken)
		);
		renderHostLiveSession();
	} catch (error) {
		console.warn("Could not toggle buzzer lock.", error);
		setLiveSessionError(error.message || "Kunne ikke ændre buzzer lås.");
	}
}

function syncTextList(container, tagName, emptyText, items, getKey, updateItem) {
	const values = Array.isArray(items) ? items : [];

	if (values.length === 0) {
		if (container.dataset.empty !== "true" || container.textContent !== emptyText) {
			container.replaceChildren(document.createTextNode(emptyText));
			container.dataset.empty = "true";
		}
		return;
	}

	let list = container.querySelector(tagName);

	if (!list || container.dataset.empty === "true") {
		list = document.createElement(tagName);
		container.replaceChildren(list);
		container.dataset.empty = "false";
	}

	const existingItems = new Map(
		Array.from(list.children).map((item) => [item.dataset.key, item])
	);
	const orderedItems = values.map((value, index) => {
		const key = String(getKey(value, index));
		const item = existingItems.get(key) || document.createElement("li");

		item.dataset.key = key;
		updateItem(item, value, index);
		existingItems.delete(key);
		return item;
	});

	existingItems.forEach((item) => item.remove());
	orderedItems.forEach((item, index) => {
		if (item.parentNode !== list || item !== list.children[index]) {
			list.insertBefore(item, list.children[index] || null);
		}
	});
}

function updateLiveSessionButtons() {
	const startButton = document.getElementById("live-session-start");
	const stopButton = document.getElementById("live-session-stop");
	const resetButton = document.getElementById("live-session-reset");
	const clearButton = document.getElementById("live-session-clear-buzzers");
	const lockButton = document.getElementById("live-session-lock-buzzers");
	const active = Boolean(liveSessionState);

	if (startButton) {
		startButton.disabled = active;
	}

	if (stopButton) {
		stopButton.disabled = !active;
	}

	if (resetButton) {
		resetButton.disabled = !active;
	}

	if (clearButton) {
		clearButton.disabled = !active;
	}

	if (lockButton) {
		lockButton.disabled = !active;
		lockButton.textContent =
			active && liveSessionState.buzzer_locked ? "Åbn buzzers" : "Lås buzzers";
	}
}

function updateLiveGameControls() {
	const active = Boolean(liveSessionState);

	document.querySelectorAll(".live-clear-buzzers").forEach((button) => {
		button.disabled = !active;
		button.onclick = clearHostLiveBuzzers;
	});

	document.querySelectorAll(".live-lock-buzzers").forEach((button) => {
		button.disabled = !active;
		button.textContent =
			active && liveSessionState.buzzer_locked ? "Åbn buzzers" : "Lås buzzers";
		button.onclick = toggleHostLiveBuzzerLock;
	});
}

function updateSessionStatus() {
	const boardPanel = document.getElementById("live-board-status");
	const statusElement = document.getElementById("live-session-status");
	const errorElement = document.getElementById("live-session-error");
	const gameStatusElements = document.querySelectorAll(".live-game-status");
	const active = Boolean(liveSessionState);
	const sessionId = getLiveHostSessionId();
	const gameStatus = active
		? "Live " +
			sessionId +
			" / " +
			liveSessionState.players.length +
			" deltagere / " +
			(liveSessionState.buzzer_locked ? "låst" : "åben")
		: "Ingen live session";

	if (statusElement) {
		statusElement.textContent = active
			? "Live: " +
				liveSessionStatus +
				" / " +
				(liveSessionState.buzzer_locked ? "buzzers låst" : "buzzers åbne")
			: "Ingen live session.";
	}

	if (errorElement) {
		errorElement.textContent = liveSessionError;
		errorElement.hidden = !liveSessionError;
	}

	if (boardPanel) {
		boardPanel.textContent = gameStatus;
	}

	gameStatusElements.forEach((element) => {
		element.textContent = gameStatus;
	});
}

function updateLiveSessionIdentity() {
	const idElement = document.getElementById("live-session-id");
	const linkElement = document.getElementById("live-session-join-link");
	const qrElement = document.getElementById("live-session-qr");
	const sessionId = getLiveHostSessionId();
	const joinUrl = sessionId ? getLiveJoinUrl(sessionId) : "";

	if (idElement) {
		idElement.textContent = sessionId || "-";
	}

	if (linkElement) {
		linkElement.textContent = joinUrl || "-";
		linkElement.href = joinUrl || "#";
	}

	if (qrElement) {
		if (joinUrl && qrElement.dataset.qrValue !== joinUrl) {
			try {
				renderQrCode(qrElement, joinUrl);
				qrElement.dataset.qrValue = joinUrl;
			} catch (error) {
				console.warn("Could not render QR code.", error);
				qrElement.replaceChildren();
				delete qrElement.dataset.qrValue;
				liveSessionError = "QR-koden kunne ikke genereres. Brug join-linket.";
			}
		} else if (!joinUrl && qrElement.dataset.qrValue) {
			qrElement.replaceChildren();
			delete qrElement.dataset.qrValue;
		}
	}
}

function updateLivePlayersPanel() {
	const playersElement = document.getElementById("live-session-players");
	const players = liveSessionState ? liveSessionState.players : [];

	if (!playersElement) {
		return;
	}

	syncTextList(
		playersElement,
		"ul",
		"Ingen deltagere endnu.",
		players,
		(player) => player.id || player.name,
		(item, player) => {
			const team = liveSessionState.teams.find((entry) => entry.id === player.team_id);

			item.textContent = player.name + (team ? " (" + team.name + ")" : "");
		}
	);
}

function updateBuzzerPanel() {
	const buzzersElements = [
		document.getElementById("live-session-buzzers"),
		...document.querySelectorAll(".live-game-buzzers"),
	].filter(Boolean);
	const buzzers = liveSessionState ? liveSessionState.buzzers : [];

	if (buzzersElements.length === 0) {
		return;
	}

	buzzersElements.forEach((buzzersElement) => {
		syncTextList(
			buzzersElement,
			"ol",
			"Ingen buzzers.",
			buzzers,
			(buzzer, index) => buzzer.player_id || buzzer.player_name || index,
			(item, buzzer) => {
				item.textContent =
					buzzer.player_name +
					(buzzer.first ? " - først" : " - nr. " + buzzer.order);
			}
		);
	});
}

function renderHostLiveSession() {
	const panel = document.getElementById("live-session-panel");

	if (!panel) {
		return;
	}

	updateLiveSessionButtons();
	updateLiveSessionIdentity();
	updateLivePlayersPanel();
	updateBuzzerPanel();
	updateSessionStatus();
	updateLiveGameControls();
}

function syncScoresFromLiveSession() {
	if (!liveSessionState || !liveSessionState.scores) {
		return;
	}

	teamIds.forEach((teamId) => {
		scores[teamId] = Number(liveSessionState.scores[teamId]) || 0;
		updateScore(teamId);
	});
}

async function restoreHostLiveSession() {
	const storedSession = getStoredLiveSession();
	const sessionId = storedSession && storedSession.session_id;

	if (!sessionId) {
		return;
	}

	try {
		liveSessionStatus = "connecting";
		liveSessionHostToken = storedSession.host_token || "";
		setHostLiveSession(await fetchLiveSession(sessionId));
		syncScoresFromLiveSession();
		connectHostLiveSession(sessionId);
	} catch (error) {
		console.warn("Could not restore live session.", error);
		liveSessionState = null;
		liveSessionStatus = "idle";
		forgetLiveSession();
	}
}

async function initializeHostControls() {
	await restoreHostLiveSession();
	renderHostLiveSession();
}

function syncLiveScoreChange(teamId, amount, questionId) {
	const sessionId = getLiveHostSessionId();

	if (!sessionId) {
		return;
	}

	changeLiveScore(sessionId, teamId, amount, questionId, liveSessionHostToken).catch((error) => {
		console.warn("Could not sync live score.", error);
		setLiveSessionError("Live score kunne ikke opdateres.");
	});
}

function syncLiveReset() {
	const sessionId = getLiveHostSessionId();

	if (!sessionId) {
		return;
	}

	resetLiveSession(sessionId, liveSessionHostToken).catch((error) => {
		console.warn("Could not reset live session.", error);
		setLiveSessionError("Live session kunne ikke resettes.");
	});
}

function syncLiveCurrentQuestion(questionId) {
	const sessionId = getLiveHostSessionId();

	if (!sessionId) {
		return;
	}

	setLiveCurrentQuestion(sessionId, questionId, liveSessionHostToken).catch((error) => {
		console.warn("Could not sync current question.", error);
		setLiveSessionError("Live spørgsmål kunne ikke opdateres.");
	});
}

function syncLiveSlideChange(questionId) {
	if (!questionId) {
		syncLiveCurrentQuestion(null);
		return;
	}

	syncLiveQuestionOpened(questionId);
}

async function syncLiveQuestionOpened(questionId) {
	const sessionId = getLiveHostSessionId();

	if (!sessionId) {
		return;
	}

	try {
		setHostLiveSession(await clearLiveBuzzers(sessionId, liveSessionHostToken));

		if (liveSessionState && liveSessionState.buzzer_locked) {
			setHostLiveSession(await unlockLiveBuzzers(sessionId, liveSessionHostToken));
		}

		setHostLiveSession(
			await setLiveCurrentQuestion(
				sessionId,
				questionId,
				liveSessionHostToken
			)
		);
		renderHostLiveSession();
	} catch (error) {
		console.warn("Could not prepare live question.", error);
		setLiveSessionError("Live buzzer kunne ikke nulstilles.");
	}
}
