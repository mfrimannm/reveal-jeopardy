let kanuunttBackendSession = null;
let kanuunttBackendSocket = null;
let kanuunttBackendTimer = null;
let kanuunttBackendHostToken = "";
let kanuunttBackendAutomationTimer = null;
let kanuunttBackendAutomationKey = "";
const KANUUNTT_BACKEND_AUTO_CONFIG = {
	resultSeconds: 6,
	scoreboardSeconds: 6,
	answerRevealSeconds: 1.6,
};

function getKanuunttBackendAutoAdvance() {
	return Boolean(kanuunttBackendSession && kanuunttBackendSession.auto_advance_enabled);
}

function clearKanuunttBackendAutomationTimer() {
	if (kanuunttBackendAutomationTimer) {
		window.clearTimeout(kanuunttBackendAutomationTimer);
		kanuunttBackendAutomationTimer = null;
	}
}

function setKanuunttBackendError(message) {
	const error = document.getElementById("kanuuntt-backend-error");

	if (!error) {
		return;
	}

	error.textContent = message || "";
	error.hidden = !message;
}

function getKanuunttBackendControlCopy(session, phase) {
	if (!session) {
		return {
			current: "Ingen aktiv session.",
			next: "Start en KanUUNTt-session fra forsiden, og åbn derefter backend-kontrollen igen.",
		};
	}

	if (phase === "waiting") {
		return {
			current: "Spillet venter i lobbyen.",
			next: "Tryk Start quiz for at åbne første spørgsmål. Deltagere kan stadig joine.",
		};
	}

	if (phase === "question_intro") {
		return {
			current: "Klar mellem spørgsmål.",
			next: "Tryk Start spørgsmål når oplæseren er klar. Timeren starter først der.",
		};
	}

	if (phase === "question_open") {
		return {
			current: "Spørgsmålet er åbent.",
			next: "Svar lukker automatisk når timeren er færdig. Du kan også trykke Luk for svar.",
		};
	}

	if (phase === "result_distribution") {
		return {
			current: "Svarfordelingen vises.",
			next: "Tryk Vis korrekt svar, eller gå direkte til Scoreboard.",
		};
	}

	if (phase === "answer_reveal") {
		return {
			current: "Det korrekte svar vises.",
			next: "Scoreboard vises automatisk om lidt.",
		};
	}

	if (phase === "scoreboard") {
		return {
			current: "Scoreboard vises.",
			next: getKanuunttBackendAutoAdvance()
				? "Auto fortsæt går videre til næste spørgsmål eller final scoreboard."
				: "Tryk Næste spørgsmål. Spillet stopper på næste spørgsmål, indtil du trykker Start.",
		};
	}

	return {
		current: "Final scoreboard vises.",
		next: "Brug Reset for at starte forfra eller Stop for at lukke sessionen.",
	};
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

function renderKanuunttBackendQuestionList(session) {
	const container = document.getElementById("kanuuntt-backend-question-list");

	if (!container) {
		return;
	}

	container.replaceChildren();

	const questions = session && Array.isArray(session.quiz_questions) ? session.quiz_questions : [];
	const answers = session && Array.isArray(session.answers) ? session.answers : [];
	const currentIndex = Number(session && session.current_question_index || 0);

	if (!questions.length) {
		container.textContent = "Ingen spoergsmaal.";
		return;
	}

	questions.forEach((question, index) => {
		const button = document.createElement("button");
		const title = document.createElement("span");
		const meta = document.createElement("span");
		const answerCount = answers.filter((answer) => Number(answer.question_index) === index).length;

		button.className = "kanuuntt-question-list-item";
		button.type = "button";
		button.disabled = !session || index === currentIndex && session.question_open;
		button.onclick = () =>
			runKanuunttBackendAction((sessionId, hostToken) =>
				jumpQuizQuestion(sessionId, hostToken, index)
			);
		if (index === currentIndex) {
			button.classList.add("active");
		}
		if (answerCount > 0) {
			button.classList.add("answered");
		}

		title.className = "kanuuntt-question-list-title";
		title.textContent = (index + 1) + ". " + (question.prompt || "Spoergsmaal");
		meta.className = "kanuuntt-question-list-meta";
		meta.textContent =
			Number(question.points || 0) +
			" point · " +
			answerCount +
			" svar";

		button.appendChild(title);
		button.appendChild(meta);
		container.appendChild(button);
	});
}

function scheduleKanuunttBackendAutomation(phase, question, remainingSeconds) {
	if (!kanuunttBackendSession) {
		clearKanuunttBackendAutomationTimer();
		return;
	}

	const key = [
		kanuunttBackendSession.session_id,
		phase,
		kanuunttBackendSession.current_question_index,
		kanuunttBackendSession.phase_started_at || kanuunttBackendSession.question_started_at || "",
	].join(":");

	if (kanuunttBackendAutomationKey === key && kanuunttBackendAutomationTimer) {
		return;
	}

	clearKanuunttBackendAutomationTimer();
	kanuunttBackendAutomationKey = key;

	if (phase === "question_open" && remainingSeconds !== null) {
		kanuunttBackendAutomationTimer = window.setTimeout(
			() => runKanuunttBackendAction(closeQuizQuestion),
			Math.max(remainingSeconds, 0) * 1000
		);
	} else if (phase === "result_distribution") {
		const resultRemaining = getKanuunttPhaseRemainingSeconds(
			kanuunttBackendSession,
			KANUUNTT_BACKEND_AUTO_CONFIG.resultSeconds
		);
		kanuunttBackendAutomationTimer = window.setTimeout(
			() => runKanuunttBackendAction((sessionId, hostToken) =>
				setQuizPhase(sessionId, hostToken, "answer_reveal")
			),
			Math.max(resultRemaining ?? KANUUNTT_BACKEND_AUTO_CONFIG.resultSeconds, 0) * 1000
		);
	} else if (phase === "answer_reveal") {
		const answerRemaining = getKanuunttPhaseRemainingSeconds(
			kanuunttBackendSession,
			KANUUNTT_BACKEND_AUTO_CONFIG.answerRevealSeconds
		);
		kanuunttBackendAutomationTimer = window.setTimeout(
			() => runKanuunttBackendAction((sessionId, hostToken) =>
				setQuizPhase(sessionId, hostToken, "scoreboard")
			),
			Math.max(answerRemaining ?? KANUUNTT_BACKEND_AUTO_CONFIG.answerRevealSeconds, 0) * 1000
		);
	} else if (phase === "scoreboard") {
		if (getKanuunttBackendAutoAdvance()) {
			const scoreboardRemaining = getKanuunttPhaseRemainingSeconds(
				kanuunttBackendSession,
				KANUUNTT_BACKEND_AUTO_CONFIG.scoreboardSeconds
			);
			kanuunttBackendAutomationTimer = window.setTimeout(
				() => runKanuunttBackendAction(nextQuizQuestion),
				Math.max(scoreboardRemaining ?? KANUUNTT_BACKEND_AUTO_CONFIG.scoreboardSeconds, 0) * 1000
			);
		}
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
	renderKanuunttBackendQuestionList(session);

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
	renderKanuunttQuestionContent("kanuuntt-backend-prompt", question, "Afventer Spørgsmål", {
		autoplayMedia: phase === "question_open",
	});
	setKanuunttHidden("kanuuntt-backend-media", true);
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
	const autoAdvance = document.getElementById("kanuuntt-auto-advance");
	const hasSession = Boolean(session);
	const controlCopy = getKanuunttBackendControlCopy(session, phase);
	const autoAdvanceRemaining =
		phase === "scoreboard" && getKanuunttBackendAutoAdvance()
			? getKanuunttPhaseRemainingSeconds(session, KANUUNTT_BACKEND_AUTO_CONFIG.scoreboardSeconds)
			: null;

	setKanuunttText("kanuuntt-control-current-step", controlCopy.current);
	if (autoAdvanceRemaining !== null) {
		const lastQuestion =
			hasSession &&
			Array.isArray(session.quiz_questions) &&
			Number(session.current_question_index || 0) >= session.quiz_questions.length - 1;
		setKanuunttText(
			"kanuuntt-control-next-step",
			(lastQuestion ? "Final scoreboard" : "Næste spørgsmål") +
				" om " +
				autoAdvanceRemaining +
				"s."
		);
	} else {
		setKanuunttText("kanuuntt-control-next-step", controlCopy.next);
	}

	if (startButton) {
		startButton.disabled =
			!hasSession ||
			questionOpen ||
			["result_distribution", "answer_reveal", "scoreboard", "final_scoreboard"].includes(phase);
		startButton.textContent = phase === "waiting" ? "Start quiz" : "Start spørgsmål";
	}
	if (closeButton) {
		closeButton.disabled = !hasSession || !questionOpen;
		closeButton.textContent = "Luk for svar";
	}
	if (resultButton) {
		resultButton.disabled = !hasSession || ["waiting", "question_intro", "question_open", "final_scoreboard"].includes(phase);
		resultButton.textContent = "Vis korrekt svar";
	}
	if (scoreboardButton) {
		scoreboardButton.disabled = !hasSession || ["waiting", "question_intro", "question_open"].includes(phase);
	}
	if (nextButton) {
		nextButton.disabled = !hasSession || phase === "final_scoreboard";
		nextButton.textContent =
			hasSession &&
			Array.isArray(session.quiz_questions) &&
			Number(session.current_question_index || 0) >= session.quiz_questions.length - 1
				? "Final scoreboard"
				: "Næste spørgsmål";
	}
	if (pauseButton) {
		pauseButton.disabled = !hasSession || ["waiting", "question_intro", "final_scoreboard"].includes(phase);
		pauseButton.textContent = phase === "question_open" ? "Pause spørgsmål" : "Pause her";
	}
	if (resetButton) {
		resetButton.disabled = !hasSession;
	}
	if (stopButton) {
		stopButton.disabled = !hasSession;
	}
	if (autoAdvance) {
		autoAdvance.checked = getKanuunttBackendAutoAdvance();
		autoAdvance.disabled = !hasSession;
	}

	scheduleKanuunttBackendAutomation(phase, question, remainingSeconds);
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
				setQuizPhase(sessionId, hostToken, "question_intro")
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
	const autoAdvance = document.getElementById("kanuuntt-auto-advance");
	if (autoAdvance) {
		autoAdvance.onchange = async () => {
			await runKanuunttBackendAction((sessionId, hostToken) =>
				setQuizAutoAdvance(sessionId, hostToken, autoAdvance.checked)
			);
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
