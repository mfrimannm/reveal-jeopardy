let kanuunttBackendSession = null;
let kanuunttBackendSocket = null;
let kanuunttBackendTimer = null;
let kanuunttBackendHostToken = "";

function setKanuunttBackendError(message) {
	const error = document.getElementById("kanuuntt-backend-error");

	if (!error) {
		return;
	}

	error.textContent = message || "";
	error.hidden = !message;
}

function getKanuunttBackendHostHeaders() {
	return kanuunttBackendHostToken
		? {
				"X-Live-Host-Token": kanuunttBackendHostToken,
			}
		: {};
}

async function runKanuunttBackendAction(action) {
	const sessionId = getKanuunttSessionIdFromPath();

	try {
		kanuunttBackendSession = await action(sessionId, kanuunttBackendHostToken);
		setKanuunttBackendError("");
		renderKanuunttBackend();
	} catch (error) {
		console.warn("KanUUNTt backend action failed.", error);
		setKanuunttBackendError(error.message || "Handlingen fejlede.");
	}
}

function renderKanuunttBackend() {
	const session = kanuunttBackendSession;
	const sessionId = getKanuunttSessionIdFromPath();
	const phase = getKanuunttPhase(session);
	const question = getKanuunttQuestion(session);
	const remainingSeconds = getKanuunttRemainingSeconds(session, question);
	const revealResults = ["result_distribution", "answer_reveal", "scoreboard", "final_scoreboard"].includes(phase);
	const showScoreboard = ["scoreboard", "final_scoreboard"].includes(phase);
	const playerCount = session && Array.isArray(session.players) ? session.players.length : 0;
	const answerCount = session ? Number(session.answer_count || 0) : 0;
	const joinUrl = getKanuunttJoinUrl(sessionId);
	const displayUrl = getKanuunttDisplayUrl(sessionId);
	const questionOpen = Boolean(session && session.question_open);

	setKanuunttText("kanuuntt-backend-title", session ? "Live quiz: " + session.game_id : "Live quiz");
	setKanuunttText("kanuuntt-backend-stage", getKanuunttPhaseLabel(phase));
	setKanuunttText("kanuuntt-backend-session-id", sessionId || "-");
	setKanuunttLink("kanuuntt-backend-join-link", joinUrl, joinUrl);
	setKanuunttLink("kanuuntt-open-display", displayUrl, "Åben display");
	setKanuunttLink("kanuuntt-open-mobile", joinUrl, "Åben mobil");
	renderKanuunttQr("kanuuntt-backend-qr", joinUrl);
	renderKanuunttPlayers("kanuuntt-backend-players", session);

	setKanuunttText("kanuuntt-backend-player-count", String(playerCount));
	setKanuunttText("kanuuntt-backend-answer-count", answerCount + " / " + playerCount);
	setKanuunttText("kanuuntt-backend-timer", phase === "question_open" && remainingSeconds !== null ? remainingSeconds + "s" : "Pause");
	setKanuunttText(
		"kanuuntt-backend-meta",
		session
			? "Spørgsmål " +
					(Number(session.current_question_index || 0) + 1) +
					" / " +
					(session.quiz_questions || []).length
			: "Spørgsmål"
	);
	setKanuunttText("kanuuntt-backend-prompt", question ? question.prompt : "Afventer Spørgsmål");
	renderKanuunttMedia("kanuuntt-backend-media", question && question.media);
	renderKanuunttAnswerCards("kanuuntt-backend-answers", session, question, {
		showCorrect: revealResults,
		showDistribution: revealResults,
	});
	setKanuunttHidden("kanuuntt-backend-result", !revealResults);
	renderKanuunttResultDetails("kanuuntt-backend-result", session, question);
	setKanuunttHidden("kanuuntt-backend-scoreboard", !showScoreboard);
	renderKanuunttScoreboard("kanuuntt-backend-scoreboard", session, phase === "final_scoreboard");

	const startButton = document.getElementById("kanuuntt-start-question");
	const closeButton = document.getElementById("kanuuntt-close-question");
	const resultButton = document.getElementById("kanuuntt-show-results");
	const scoreboardButton = document.getElementById("kanuuntt-show-scoreboard");
	const nextButton = document.getElementById("kanuuntt-next-question");
	const pauseButton = document.getElementById("kanuuntt-pause");
	const resetButton = document.getElementById("kanuuntt-reset");
	const stopButton = document.getElementById("kanuuntt-stop");
	const hasSession = Boolean(session);

	if (startButton) {
		startButton.disabled =
			!hasSession ||
			questionOpen ||
			["result_distribution", "answer_reveal", "scoreboard", "final_scoreboard"].includes(phase);
		startButton.textContent = phase === "waiting" ? "Start quiz" : "Start Spørgsmål";
	}
	if (closeButton) {
		closeButton.disabled = !hasSession || !questionOpen;
	}
	if (resultButton) {
		resultButton.disabled = !hasSession || phase === "waiting";
	}
	if (scoreboardButton) {
		scoreboardButton.disabled = !hasSession || phase === "waiting";
	}
	if (nextButton) {
		nextButton.disabled = !hasSession || phase === "final_scoreboard";
	}
	if (pauseButton) {
		pauseButton.disabled = !hasSession;
	}
	if (resetButton) {
		resetButton.disabled = !hasSession;
	}
	if (stopButton) {
		stopButton.disabled = !hasSession;
	}
}

function handleKanuunttBackendMessage(message) {
	if (!message || !message.type) {
		return;
	}

	if (message.type === "session_state") {
		kanuunttBackendSession = message.session;
		setKanuunttBackendError("");
		renderKanuunttBackend();
		return;
	}

	if (message.type === "session_stopped") {
		kanuunttBackendSession = null;
		forgetKanuunttHostToken(getKanuunttSessionIdFromPath());
		setKanuunttBackendError("Sessionen er stoppet.");
		renderKanuunttBackend();
	}
}

function startKanuunttBackendTimer() {
	if (kanuunttBackendTimer) {
		return;
	}

	kanuunttBackendTimer = window.setInterval(renderKanuunttBackend, 500);
}

function wireKanuunttBackendControls() {
	const startButton = document.getElementById("kanuuntt-start-question");
	const closeButton = document.getElementById("kanuuntt-close-question");
	const resultButton = document.getElementById("kanuuntt-show-results");
	const scoreboardButton = document.getElementById("kanuuntt-show-scoreboard");
	const nextButton = document.getElementById("kanuuntt-next-question");
	const pauseButton = document.getElementById("kanuuntt-pause");
	const resetButton = document.getElementById("kanuuntt-reset");
	const stopButton = document.getElementById("kanuuntt-stop");

	if (startButton) {
		startButton.onclick = () => runKanuunttBackendAction(startQuizQuestion);
	}
	if (closeButton) {
		closeButton.onclick = () => runKanuunttBackendAction(closeQuizQuestion);
	}
	if (resultButton) {
		resultButton.onclick = () =>
			runKanuunttBackendAction((sessionId, hostToken) =>
				setQuizPhase(sessionId, hostToken, "answer_reveal")
			);
	}
	if (scoreboardButton) {
		scoreboardButton.onclick = () =>
			runKanuunttBackendAction((sessionId, hostToken) =>
				setQuizPhase(sessionId, hostToken, "scoreboard")
			);
	}
	if (nextButton) {
		nextButton.onclick = () => runKanuunttBackendAction(nextQuizQuestion);
	}
	if (pauseButton) {
		pauseButton.onclick = () =>
			runKanuunttBackendAction((sessionId, hostToken) =>
				setQuizPhase(sessionId, hostToken, "waiting")
			);
	}
	if (resetButton) {
		resetButton.onclick = () => runKanuunttBackendAction(resetLiveSession);
	}
	if (stopButton) {
		stopButton.onclick = async () => {
			const sessionId = getKanuunttSessionIdFromPath();

			try {
				await stopLiveSession(sessionId, kanuunttBackendHostToken);
				kanuunttBackendSession = null;
				forgetKanuunttHostToken(sessionId);
				setKanuunttBackendError("");
				renderKanuunttBackend();
			} catch (error) {
				console.warn("Could not stop KanUUNTt session.", error);
				setKanuunttBackendError(error.message || "Kunne ikke stoppe sessionen.");
			}
		};
	}
}

async function initializeKanuunttBackend() {
	const sessionId = getKanuunttSessionIdFromPath();

	kanuunttBackendHostToken = getKanuunttHostToken(sessionId);
	wireKanuunttBackendControls();

	try {
		kanuunttBackendSession = await fetchLiveSession(sessionId);
		if (kanuunttBackendSession.mode !== "quiz") {
			throw new Error("Sessionen er ikke en KanUUNTt quiz.");
		}
		renderKanuunttBackend();
		kanuunttBackendSocket = connectLiveSessionSocket(sessionId, {
			message: handleKanuunttBackendMessage,
			error: () => setKanuunttBackendError("Live forbindelse fejlede."),
			close: () => {
				if (kanuunttBackendSession) {
					setKanuunttBackendError("Live forbindelse afbrudt.");
				}
			},
		});
		startKanuunttBackendTimer();
	} catch (error) {
		console.warn("Could not initialize KanUUNTt backend.", error);
		setKanuunttBackendError(error.message || "Sessionen blev ikke fundet.");
		renderKanuunttBackend();
	}
}

document.addEventListener("DOMContentLoaded", initializeKanuunttBackend);
