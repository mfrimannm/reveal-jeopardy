function getLiveHostSessionId() {
	return liveSessionState && liveSessionState.session_id;
}

function isQuizLiveSession() {
	return Boolean(liveSessionState && liveSessionState.mode === "quiz");
}

const QUIZ_AUTO_ADVANCE_STORAGE_KEY = "reveal-jeopardy-kanuuntt-auto-advance";
const quizFlowConfig = {
	questionIntroSeconds: 3,
	resultSeconds: 6,
	scoreboardSeconds: 6,
	autoAdvance: true,
};
const quizAnswerStyles = [
	{ symbol: "▲", className: "quiz-answer-a" },
	{ symbol: "◆", className: "quiz-answer-b" },
	{ symbol: "●", className: "quiz-answer-c" },
	{ symbol: "■", className: "quiz-answer-d" },
];
let quizCountdownTimer = null;
let quizAutomationTimer = null;
let quizAutomationKey = "";
let quizAutoCloseKey = "";

function loadHostQuizAutoAdvanceSetting() {
	try {
		const stored = localStorage.getItem(QUIZ_AUTO_ADVANCE_STORAGE_KEY);

		if (stored !== null) {
			quizFlowConfig.autoAdvance = stored === "true";
		}
	} catch (error) {
		console.warn("Could not load KanUUNTt auto setting.", error);
	}
}

function toggleHostQuizAutoAdvance(enabled) {
	quizFlowConfig.autoAdvance = Boolean(enabled);
	try {
		localStorage.setItem(QUIZ_AUTO_ADVANCE_STORAGE_KEY, quizFlowConfig.autoAdvance ? "true" : "false");
	} catch (error) {
		console.warn("Could not save KanUUNTt auto setting.", error);
	}
	renderHostLiveSession();
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
			if (hostToken) {
				localStorage.setItem(
					"reveal-jeopardy-live-host-token:" + sessionId,
					hostToken
				);
			}
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
		const session = await createLiveSession(gameKey, "jeopardy");
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

async function startQuizLiveSession() {
	try {
		setLiveSessionStatus("starting");
		const session = await createLiveSession(gameKey, "quiz");
		setHostLiveSession(session);
		liveSessionError = "";
		rememberLiveSession(session.session_id, liveSessionHostToken);
		connectHostLiveSession(session.session_id);
		renderHostLiveSession();
	} catch (error) {
		console.warn("Could not start KanUUNTt session.", error);
		setLiveSessionError(
			error.message ||
				"Kunne ikke starte KanUUNTt. Vaelg et game med quiz_questions."
		);
	}
}

function getSelectedKanuunttGameKey() {
	const select = document.getElementById("kanuuntt-game-select");

	return (select && select.value) || gameKey;
}

async function startSelectedQuizLiveSession() {
	try {
		setLiveSessionStatus("starting");
		const session = await createLiveSession(getSelectedKanuunttGameKey(), "quiz");
		setHostLiveSession(session);
		liveSessionError = "";
		rememberLiveSession(session.session_id, liveSessionHostToken);
		connectHostLiveSession(session.session_id);
		renderHostLiveSession();
	} catch (error) {
		console.warn("Could not start selected KanUUNTt session.", error);
		setLiveSessionError(
			error.message ||
				"Kunne ikke starte KanUUNTt. Vaelg et game med quiz_questions."
		);
	}
}

function openKanuunttDisplay() {
	const sessionId = getLiveHostSessionId();

	if (sessionId) {
		window.open("/kanuuntt/display/" + encodeURIComponent(sessionId), "_blank", "noreferrer");
	}
}

function openKanuunttBackend() {
	const sessionId = getLiveHostSessionId();

	if (sessionId) {
		window.open("/kanuuntt/backend/" + encodeURIComponent(sessionId), "_blank", "noreferrer");
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

async function setHostQuizPhase(quizPhase) {
	const sessionId = getLiveHostSessionId();

	if (!sessionId) {
		return;
	}

	try {
		setHostLiveSession(await setQuizPhase(sessionId, liveSessionHostToken, quizPhase));
		renderHostLiveSession();
	} catch (error) {
		console.warn("Could not update quiz phase.", error);
		setLiveSessionError(error.message || "Kunne ikke opdatere quizfase.");
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
	const quizStartButton = document.getElementById("quiz-session-start");
	const selectedQuizStartButton = document.getElementById("kanuuntt-session-start");
	const displayButton = document.getElementById("kanuuntt-open-display-button");
	const backendButton = document.getElementById("kanuuntt-open-backend-button");
	const stopButton = document.getElementById("live-session-stop");
	const resetButton = document.getElementById("live-session-reset");
	const clearButton = document.getElementById("live-session-clear-buzzers");
	const lockButton = document.getElementById("live-session-lock-buzzers");
	const quizStartQuestionButton = document.getElementById("quiz-start-question");
	const quizCloseQuestionButton = document.getElementById("quiz-close-question");
	const quizNextQuestionButton = document.getElementById("quiz-next-question");
	const quizAutoAdvance = document.getElementById("quiz-auto-advance");
	const active = Boolean(liveSessionState);
	const quizActive = isQuizLiveSession();
	const questionOpen = quizActive && liveSessionState.question_open;

	if (startButton) {
		startButton.disabled = active;
	}

	if (quizStartButton) {
		quizStartButton.disabled = active;
	}

	if (selectedQuizStartButton) {
		selectedQuizStartButton.disabled = active;
	}

	if (displayButton) {
		displayButton.disabled = !quizActive;
	}

	if (backendButton) {
		backendButton.disabled = !quizActive;
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
	if (quizAutoAdvance) {
		quizAutoAdvance.checked = quizFlowConfig.autoAdvance;
	}
}

function updateQuizSessionButtons() {
	const quizStartQuestionButton = document.getElementById("quiz-start-question");
	const quizCloseQuestionButton = document.getElementById("quiz-close-question");
	const quizNextQuestionButton = document.getElementById("quiz-next-question");
	const quizActive = isQuizLiveSession();
	const questionOpen = quizActive && liveSessionState.question_open;
	const phase = getQuizPhase();

	if (quizStartQuestionButton) {
		quizStartQuestionButton.disabled =
			!quizActive ||
			questionOpen ||
			["result_distribution", "answer_reveal", "scoreboard", "final_scoreboard"].includes(phase);
		quizStartQuestionButton.textContent =
			phase === "waiting" ? "Start quiz" : "Start spørgsmål";
	}

	if (quizCloseQuestionButton) {
		quizCloseQuestionButton.disabled = !quizActive || !questionOpen;
	}

	if (quizNextQuestionButton) {
		quizNextQuestionButton.disabled = !quizActive || phase === "final_scoreboard";
		quizNextQuestionButton.textContent =
			quizActive &&
			Number(liveSessionState.current_question_index || 0) >=
				(liveSessionState.quiz_questions || []).length - 1
				? "Vis finale"
				: "Næste spørgsmål";
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

function getLiveBuzzerTeamName(buzzer) {
	if (buzzer.team_name) {
		return buzzer.team_name;
	}

	const team = liveSessionState
		? liveSessionState.teams.find((entry) => entry.id === buzzer.team_id)
		: null;

	return team ? team.name : "";
}

function getLiveBuzzerLabel(buzzer) {
	const teamName = getLiveBuzzerTeamName(buzzer);
	const playerLabel = buzzer.player_name + (teamName ? " (" + teamName + ")" : "");

	return playerLabel + (buzzer.first ? " - først" : " - nr. " + buzzer.order);
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
				item.textContent = getLiveBuzzerLabel(buzzer);
			}
		);
	});
}

function getCurrentQuizQuestion() {
	if (!isQuizLiveSession() || !Array.isArray(liveSessionState.quiz_questions)) {
		return null;
	}

	return (
		liveSessionState.quiz_questions[
			Number(liveSessionState.current_question_index || 0)
		] || null
	);
}

function getCurrentQuizQuestionIndex() {
	return Number(liveSessionState && liveSessionState.current_question_index || 0);
}

function getQuizPhase() {
	if (!isQuizLiveSession()) {
		return "waiting";
	}

	if (liveSessionState.quiz_phase) {
		return liveSessionState.quiz_phase;
	}

	return liveSessionState.question_open ? "question_open" : "waiting";
}

function getQuizQuestionRemainingSeconds(question) {
	if (!question || !liveSessionState || !liveSessionState.question_started_at) {
		return null;
	}

	const startedAt = Date.parse(liveSessionState.question_started_at);

	if (!Number.isFinite(startedAt)) {
		return null;
	}

	const elapsedSeconds = (Date.now() - startedAt) / 1000;
	const remaining = Number(question.timeLimitSeconds || 0) - elapsedSeconds;

	return Math.max(0, Math.ceil(remaining));
}

function clearQuizCountdownTimer() {
	if (quizCountdownTimer) {
		clearInterval(quizCountdownTimer);
		quizCountdownTimer = null;
	}
}

function clearQuizAutomationTimer() {
	if (quizAutomationTimer) {
		clearTimeout(quizAutomationTimer);
		quizAutomationTimer = null;
	}
}

function renderQuizMedia(container, media) {
	container.replaceChildren();

	if (!media || !media.type || !media.src) {
		const empty = document.createElement("div");
		empty.className = "quiz-media-empty";
		empty.textContent = "Tekstspørgsmål";
		container.appendChild(empty);
		return;
	}

	const wrapper = document.createElement("div");
	wrapper.className = "quiz-media-frame";

	if (media.type === "image") {
		const image = document.createElement("img");
		image.src = media.src;
		image.alt = media.alt || "";
		image.loading = "eager";
		wrapper.appendChild(image);
	} else if (media.type === "video") {
		const video = document.createElement("video");
		video.src = media.src;
		video.controls = true;
		video.autoplay = Boolean(media.autoplay);
		video.loop = Boolean(media.loop);
		video.muted = Boolean(media.muted || media.autoplay);
		video.playsInline = true;
		if (media.poster) {
			video.poster = media.poster;
		}
		wrapper.appendChild(video);
	} else if (media.type === "audio") {
		const audio = document.createElement("audio");
		audio.src = media.src;
		audio.controls = true;
		audio.autoplay = Boolean(media.autoplay);
		audio.loop = Boolean(media.loop);
		wrapper.appendChild(audio);
	} else if (media.type === "embed") {
		const iframe = document.createElement("iframe");
		iframe.src = media.src;
		iframe.title = media.title || "Quiz embed";
		iframe.allowFullscreen = true;
		iframe.referrerPolicy = "strict-origin-when-cross-origin";
		wrapper.appendChild(iframe);
	} else {
		const unsupported = document.createElement("div");
		unsupported.className = "quiz-media-empty";
		unsupported.textContent = "Media kunne ikke vises";
		wrapper.appendChild(unsupported);
	}

	container.appendChild(wrapper);
}

function getCurrentQuizAnswers() {
	if (!liveSessionState || !Array.isArray(liveSessionState.answers)) {
		return [];
	}

	const questionIndex = getCurrentQuizQuestionIndex();

	return liveSessionState.answers.filter(
		(answer) => Number(answer.question_index) === questionIndex
	);
}

function getQuizScoreRows() {
	if (!liveSessionState) {
		return [];
	}

	return getKanuunttRankedScoreRows(
		liveSessionState.players || [],
		liveSessionState.scores || {}
	);
}

function renderQuizAnswerGrid(container, question, options) {
	container.replaceChildren();

	if (!question || !Array.isArray(question.answers)) {
		return;
	}

	const settings = options || {};
	const currentAnswers = getCurrentQuizAnswers();
	const answerCounts = new Map();

	currentAnswers.forEach((answer) => {
		answerCounts.set(answer.answer_id, Number(answerCounts.get(answer.answer_id) || 0) + 1);
	});

	question.answers.forEach((answer, index) => {
		const style = quizAnswerStyles[index % quizAnswerStyles.length];
		const card = document.createElement("div");
		const count = Number(answerCounts.get(answer.id) || 0);
		const percent = currentAnswers.length
			? Math.round((count / currentAnswers.length) * 100)
			: 0;

		card.className = "quiz-answer-card " + style.className;
		if (settings.showCorrect && answer.correct) {
			card.classList.add("correct");
		}
		if (settings.showCorrect && !answer.correct) {
			card.classList.add("dimmed");
		}

		const symbol = document.createElement("span");
		symbol.className = "quiz-answer-symbol";
		symbol.textContent = style.symbol;

		const text = document.createElement("span");
		text.className = "quiz-answer-text";
		text.textContent = answer.text;

		card.appendChild(symbol);
		card.appendChild(text);

		if (settings.showDistribution) {
			const result = document.createElement("span");
			result.className = "quiz-answer-result";
			result.textContent = count + " svar" + (currentAnswers.length ? " / " + percent + "%" : "");
			card.appendChild(result);
		}

		container.appendChild(card);
	});
}

function renderQuizResultDetails(container, question) {
	container.replaceChildren();

	if (!question) {
		return;
	}

	const correctAnswers = new Set(
		(question.answers || [])
			.filter((answer) => answer.correct)
			.map((answer) => answer.id)
	);
	const correctRows = getCurrentQuizAnswers().filter((answer) =>
		correctAnswers.has(answer.answer_id)
	);

	if (!correctRows.length) {
		const empty = document.createElement("div");
		empty.className = "quiz-result-empty";
		empty.textContent = "Ingen korrekte svar endnu.";
		container.appendChild(empty);
		return;
	}

	const title = document.createElement("div");
	title.className = "quiz-result-title";
	title.textContent = "Korrekte svar";
	container.appendChild(title);

	correctRows.forEach((answer) => {
		const row = document.createElement("div");
		row.className = "quiz-result-row";
		row.textContent =
			answer.player_name + " +" + Number(answer.earned_points || 0) + " point";
		container.appendChild(row);
	});
}

function renderQuizScoreboard(container, finalMode) {
	renderKanuunttScoreboardElement(container, getQuizScoreRows(), finalMode);
}

function scheduleQuizAutomation(phase, question, remainingSeconds) {
	if (!quizFlowConfig.autoAdvance || !isQuizLiveSession()) {
		clearQuizAutomationTimer();
		return;
	}

	const questionIndex = getCurrentQuizQuestionIndex();
	const key =
		getLiveHostSessionId() +
		":" +
		phase +
		":" +
		questionIndex +
		":" +
		(liveSessionState.phase_started_at || liveSessionState.question_started_at || "");

	if (quizAutomationKey === key && quizAutomationTimer) {
		return;
	}

	clearQuizAutomationTimer();
	quizAutomationKey = key;

	if (phase === "question_intro") {
		quizAutomationTimer = setTimeout(startHostQuizQuestion, quizFlowConfig.questionIntroSeconds * 1000);
	} else if (phase === "result_distribution") {
		quizAutomationTimer = setTimeout(() => setHostQuizPhase("answer_reveal"), quizFlowConfig.resultSeconds * 1000);
	} else if (phase === "answer_reveal") {
		quizAutomationTimer = setTimeout(() => setHostQuizPhase("scoreboard"), 1600);
	} else if (phase === "scoreboard") {
		quizAutomationTimer = setTimeout(nextHostQuizQuestion, quizFlowConfig.scoreboardSeconds * 1000);
	} else if (phase === "question_open" && remainingSeconds !== null) {
		const closeKey = key + ":close";
		if (quizAutoCloseKey !== closeKey) {
			quizAutoCloseKey = closeKey;
			quizAutomationTimer = setTimeout(closeHostQuizQuestion, Math.max(remainingSeconds, 1) * 1000);
		}
	}
}

function updateQuizPanel() {
	const panel = document.getElementById("quiz-session-panel");
	const questionElement = document.getElementById("quiz-session-question");
	const metaElement = document.getElementById("quiz-session-meta");
	const answersElement = document.getElementById("quiz-session-answers");
	const mediaElement = document.getElementById("quiz-session-media");
	const timerElement = document.getElementById("quiz-session-timer");
	const liveCountElement = document.getElementById("quiz-live-answer-count");
	const resultElement = document.getElementById("quiz-result-details");
	const scoreboardElement = document.getElementById("quiz-scoreboard");
	const stageElement = document.getElementById("quiz-session-stage");
	const quizActive = isQuizLiveSession();
	const question = getCurrentQuizQuestion();
	const phase = getQuizPhase();
	const remainingSeconds = getQuizQuestionRemainingSeconds(question);

	if (!panel) {
		return;
	}

	panel.hidden = !quizActive;

	if (!quizActive) {
		clearQuizCountdownTimer();
		clearQuizAutomationTimer();
		return;
	}

	panel.dataset.quizPhase = phase;

	if (stageElement) {
		stageElement.textContent =
			phase === "waiting"
				? "Waiting room"
				: phase === "question_intro"
					? "Næste spørgsmål"
					: phase === "question_open"
						? "Spørgsmålet er åbent"
						: phase === "result_distribution"
							? "Resultatfordeling"
							: phase === "answer_reveal"
								? "Korrekt svar og point"
								: phase === "final_scoreboard"
									? "Final scoreboard"
									: "Scoreboard";
	}

	if (questionElement) {
		questionElement.textContent = question ? question.prompt : "Venter på quizspørgsmål.";
	}

	if (metaElement) {
		const questionIndex = Number(liveSessionState.current_question_index || 0) + 1;
		const questionTotal = (liveSessionState.quiz_questions || []).length;
		metaElement.textContent =
			"Spørgsmål " +
			questionIndex +
			" / " +
			questionTotal +
			" - " +
			(liveSessionState.players || []).length +
			" deltagere";
	}

	if (mediaElement) {
		renderQuizMedia(mediaElement, question && question.media);
	}

	if (timerElement) {
		if (phase === "question_open" && remainingSeconds !== null) {
			timerElement.textContent = remainingSeconds + "s";
			timerElement.style.setProperty(
				"--quiz-progress",
				question && question.timeLimitSeconds
					? String(Math.max(0, Math.min(1, remainingSeconds / Number(question.timeLimitSeconds))))
					: "0"
			);
		} else {
			timerElement.textContent = phase === "waiting" ? "Klar" : "Pause";
			timerElement.style.setProperty("--quiz-progress", "0");
		}
	}

	if (liveCountElement) {
		liveCountElement.textContent =
			Number(liveSessionState.answer_count || 0) +
			" / " +
			(liveSessionState.players || []).length +
			" har svaret";
	}

	if (answersElement) {
		renderQuizAnswerGrid(answersElement, question, {
			showCorrect: ["result_distribution", "answer_reveal", "scoreboard", "final_scoreboard"].includes(phase),
			showDistribution: ["result_distribution", "answer_reveal", "scoreboard", "final_scoreboard"].includes(phase),
		});
	}

	if (resultElement) {
		resultElement.hidden = !["result_distribution", "answer_reveal", "scoreboard", "final_scoreboard"].includes(phase);
		renderQuizResultDetails(resultElement, question);
	}

	if (scoreboardElement) {
		scoreboardElement.hidden = !["scoreboard", "final_scoreboard"].includes(phase);
		renderQuizScoreboard(scoreboardElement, phase === "final_scoreboard");
	}

	if (phase === "question_open") {
		if (!quizCountdownTimer) {
			quizCountdownTimer = setInterval(renderHostLiveSession, 500);
		}
	} else {
		clearQuizCountdownTimer();
	}

	scheduleQuizAutomation(phase, question, remainingSeconds);
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
	updateQuizPanel();
	updateQuizSessionButtons();
	updateSessionStatus();
	updateLiveGameControls();
}

async function startHostQuizQuestion() {
	const sessionId = getLiveHostSessionId();

	if (!sessionId) {
		return;
	}

	try {
		setHostLiveSession(await startQuizQuestion(sessionId, liveSessionHostToken));
		renderHostLiveSession();
	} catch (error) {
		console.warn("Could not start quiz question.", error);
		setLiveSessionError(error.message || "Kunne ikke starte sporgsmal.");
	}
}

async function closeHostQuizQuestion() {
	const sessionId = getLiveHostSessionId();

	if (!sessionId) {
		return;
	}

	try {
		setHostLiveSession(await closeQuizQuestion(sessionId, liveSessionHostToken));
		renderHostLiveSession();
	} catch (error) {
		console.warn("Could not close quiz question.", error);
		setLiveSessionError(error.message || "Kunne ikke lukke sporgsmal.");
	}
}

async function nextHostQuizQuestion() {
	const sessionId = getLiveHostSessionId();

	if (!sessionId) {
		return;
	}

	try {
		setHostLiveSession(await nextQuizQuestion(sessionId, liveSessionHostToken));
		renderHostLiveSession();
	} catch (error) {
		console.warn("Could not advance quiz question.", error);
		setLiveSessionError(error.message || "Kunne ikke ga til næste sporgsmal.");
	}
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
	loadHostQuizAutoAdvanceSetting();
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
