let kanuunttDisplaySession = null;
let kanuunttDisplaySocket = null;
let kanuunttDisplayTimer = null;

function setKanuunttDisplayError(message) {
	const error = document.getElementById("kanuuntt-display-error");

	if (!error) {
		return;
	}

	error.textContent = message || "";
	error.hidden = !message;
}

function renderKanuunttDisplay() {
	const session = kanuunttDisplaySession;
	const sessionId = getKanuunttSessionIdFromPath();
	const phase = getKanuunttPhase(session);
	const question = getKanuunttQuestion(session);
	const remainingSeconds = getKanuunttRemainingSeconds(session, question);
	const revealResults = ["result_distribution", "answer_reveal", "scoreboard", "final_scoreboard"].includes(phase);
	const showScoreboard = ["scoreboard", "final_scoreboard"].includes(phase);
	const playerCount = session && Array.isArray(session.players) ? session.players.length : 0;
	const answerCount = session ? Number(session.answer_count || 0) : 0;
	const joinUrl = getKanuunttJoinUrl(sessionId);

	setKanuunttText("kanuuntt-display-title", session ? "Live quiz: " + session.game_id : "Live quiz");
	setKanuunttText("kanuuntt-display-stage", getKanuunttPhaseLabel(phase));
	setKanuunttText("kanuuntt-display-session-id", sessionId || "-");
	setKanuunttLink("kanuuntt-display-join-link", joinUrl, joinUrl);
	renderKanuunttQr("kanuuntt-display-qr", joinUrl);
	renderKanuunttPlayers("kanuuntt-display-players", session);

	setKanuunttHidden("kanuuntt-display-waiting", phase !== "waiting");
	setKanuunttHidden("kanuuntt-display-question", phase === "waiting");

	if (!session || session.mode !== "quiz") {
		return;
	}

	setKanuunttText(
		"kanuuntt-display-meta",
		"Spørgsmål " +
			(Number(session.current_question_index || 0) + 1) +
			" / " +
			(session.quiz_questions || []).length
	);
	setKanuunttText("kanuuntt-display-prompt", question ? question.prompt : "Afventer Spørgsmål");
	setKanuunttText("kanuuntt-display-timer", phase === "question_open" && remainingSeconds !== null ? remainingSeconds + "s" : "Pause");
	setKanuunttText("kanuuntt-display-answer-count", answerCount + " / " + playerCount + " har svaret");
	renderKanuunttMedia("kanuuntt-display-media", question && question.media);
	renderKanuunttAnswerCards("kanuuntt-display-answers", session, question, {
		showCorrect: revealResults,
		showDistribution: revealResults,
	});
	setKanuunttHidden("kanuuntt-display-result", !revealResults);
	renderKanuunttResultDetails("kanuuntt-display-result", session, question);
	setKanuunttHidden("kanuuntt-display-scoreboard", !showScoreboard);
	renderKanuunttScoreboard("kanuuntt-display-scoreboard", session, phase === "final_scoreboard");
}

function startKanuunttDisplayTimer() {
	if (kanuunttDisplayTimer) {
		return;
	}

	kanuunttDisplayTimer = window.setInterval(renderKanuunttDisplay, 500);
}

function handleKanuunttDisplayMessage(message) {
	if (!message || !message.type) {
		return;
	}

	if (message.type === "session_state") {
		kanuunttDisplaySession = message.session;
		setKanuunttDisplayError("");
		renderKanuunttDisplay();
		return;
	}

	if (message.type === "session_stopped") {
		kanuunttDisplaySession = null;
		setKanuunttDisplayError("Sessionen er stoppet af host.");
		renderKanuunttDisplay();
	}
}

async function initializeKanuunttDisplay() {
	const sessionId = getKanuunttSessionIdFromPath();

	try {
		kanuunttDisplaySession = await fetchLiveSession(sessionId);
		if (kanuunttDisplaySession.mode !== "quiz") {
			throw new Error("Sessionen er ikke en KanUUNTt quiz.");
		}
		renderKanuunttDisplay();
		kanuunttDisplaySocket = connectLiveSessionSocket(sessionId, {
			message: handleKanuunttDisplayMessage,
			error: () => setKanuunttDisplayError("Live forbindelse fejlede."),
			close: () => {
				if (kanuunttDisplaySession) {
					setKanuunttDisplayError("Live forbindelse afbrudt.");
				}
			},
		});
		startKanuunttDisplayTimer();
	} catch (error) {
		console.warn("Could not initialize KanUUNTt display.", error);
		setKanuunttDisplayError(error.message || "Sessionen blev ikke fundet.");
		renderKanuunttDisplay();
	}
}

document.addEventListener("DOMContentLoaded", initializeKanuunttDisplay);
