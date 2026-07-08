let kanuunttDisplaySession = null;
let kanuunttDisplaySocket = null;
let kanuunttDisplayTimer = null;
let kanuunttDisplayScaleFrame = null;
let kanuunttDisplayAudioContext = null;
let kanuunttDisplaySoundKey = "";
let kanuunttDisplayLastTickSecond = null;
let kanuunttDisplayLastPhaseSoundKey = "";
let kanuunttDisplayActiveLoopSound = "";
let kanuunttDisplayTimeUpSoundKey = "";
const KANUUNTT_DISPLAY_SOUND_PATHS = {
	questionStart: "/static/sounds/kanuuntt/question-start.mp3",
	countdownLoop: "/static/sounds/kanuuntt/countdown-loop.mp3",
	urgentCountdownLoop: "/static/sounds/kanuuntt/urgent-countdown-loop.mp3",
	timeUp: "/static/sounds/kanuuntt/time-up.mp3",
	answerReveal: "/static/sounds/kanuuntt/answer-reveal.mp3",
	scoreboard: "/static/sounds/kanuuntt/scoreboard.mp3",
};
const KANUUNTT_DISPLAY_SOUND_VOLUMES = {
	questionStart: 0.85,
	countdownLoop: 0.55,
	urgentCountdownLoop: 0.65,
	timeUp: 0.9,
	answerReveal: 0.85,
	scoreboard: 0.8,
};
const KANUUNTT_DISPLAY_SCOREBOARD_SECONDS = 6;
const kanuunttDisplayFileSounds = {};
const kanuunttDisplayMissingFileSounds = new Set();

function fitKanuunttDisplayToViewport() {
	const display = document.querySelector(".kanuuntt-display");

	if (!display) {
		return;
	}

	display.style.transform = "none";
	display.style.width = "";
	display.style.height = "100vh";
	display.style.minHeight = "100vh";

	const requiredWidth = Math.max(display.scrollWidth, 1);
	const requiredHeight = Math.max(display.scrollHeight, 1);
	const scale = Math.min(
		1,
		window.innerWidth / requiredWidth,
		window.innerHeight / requiredHeight
	);

	display.style.setProperty("--kanuuntt-display-scale", String(scale));

	if (scale < 1) {
		display.style.width = (100 / scale) + "vw";
		display.style.height = (100 / scale) + "vh";
		display.style.minHeight = (100 / scale) + "vh";
		display.style.transform = "scale(" + scale + ")";
	}
}

function scheduleKanuunttDisplayFit() {
	if (kanuunttDisplayScaleFrame) {
		window.cancelAnimationFrame(kanuunttDisplayScaleFrame);
	}

	kanuunttDisplayScaleFrame = window.requestAnimationFrame(() => {
		kanuunttDisplayScaleFrame = null;
		fitKanuunttDisplayToViewport();
	});
}

function setKanuunttDisplayError(message) {
	const error = document.getElementById("kanuuntt-display-error");

	if (!error) {
		return;
	}

	error.textContent = message || "";
	error.hidden = !message;
}

function getKanuunttDisplayProgress(session, question) {
	if (!session || !question || !session.question_started_at) {
		return 0;
	}

	const startedAt = Date.parse(session.question_started_at);
	const timeLimit = Number(question.timeLimitSeconds || 0);

	if (!Number.isFinite(startedAt) || timeLimit <= 0) {
		return 0;
	}

	const elapsedSeconds = (Date.now() - startedAt) / 1000;

	return Math.max(0, Math.min(1, (timeLimit - elapsedSeconds) / timeLimit));
}

function getKanuunttDisplayQuestionKey(session) {
	if (!session) {
		return "";
	}

	return [
		session.session_id || "",
		Number(session.current_question_index || 0),
		session.question_started_at || "",
	].join(":");
}

function stopKanuunttDisplayCountdownSound() {
	kanuunttDisplaySoundKey = "";
	kanuunttDisplayLastTickSecond = null;
	stopKanuunttDisplayLoopSound();
}

function getKanuunttDisplayFileSound(name) {
	if (!KANUUNTT_DISPLAY_SOUND_PATHS[name] || kanuunttDisplayMissingFileSounds.has(name)) {
		return null;
	}

	if (!kanuunttDisplayFileSounds[name]) {
		const audio = new Audio(KANUUNTT_DISPLAY_SOUND_PATHS[name]);

		audio.preload = "auto";
		audio.volume = KANUUNTT_DISPLAY_SOUND_VOLUMES[name] || 0.75;
		audio.addEventListener("error", () => {
			kanuunttDisplayMissingFileSounds.add(name);
			if (kanuunttDisplayActiveLoopSound === name) {
				kanuunttDisplayActiveLoopSound = "";
			}
		});
		kanuunttDisplayFileSounds[name] = audio;
	}

	return kanuunttDisplayFileSounds[name];
}

function playKanuunttDisplayFileSound(name, options) {
	const audio = getKanuunttDisplayFileSound(name);
	const settings = options || {};

	if (!audio) {
		return false;
	}

	audio.loop = Boolean(settings.loop);
	audio.volume = settings.volume || KANUUNTT_DISPLAY_SOUND_VOLUMES[name] || 0.75;

	if (settings.restart !== false) {
		audio.pause();
		try {
			audio.currentTime = 0;
		} catch (error) {
			console.warn("Could not reset KanUUNTt sound.", error);
		}
	}

	const playResult = audio.play();

	if (playResult && typeof playResult.catch === "function") {
		playResult.catch(() => {
			kanuunttDisplayMissingFileSounds.add(name);
			if (kanuunttDisplayActiveLoopSound === name) {
				kanuunttDisplayActiveLoopSound = "";
			}
			if (typeof settings.fallback === "function") {
				settings.fallback();
			}
		});
	}

	return true;
}

function stopKanuunttDisplayLoopSound() {
	if (!kanuunttDisplayActiveLoopSound) {
		return;
	}

	const audio = getKanuunttDisplayFileSound(kanuunttDisplayActiveLoopSound);

	if (audio) {
		audio.pause();
		audio.loop = false;
	}

	kanuunttDisplayActiveLoopSound = "";
}

function startKanuunttDisplayLoopSound(name) {
	if (kanuunttDisplayActiveLoopSound === name) {
		return true;
	}

	stopKanuunttDisplayLoopSound();

	if (!playKanuunttDisplayFileSound(name, { loop: true })) {
		return false;
	}

	kanuunttDisplayActiveLoopSound = name;
	return true;
}

function playKanuunttDisplayTone(context, frequency, startTime, duration, volume, type) {
	const oscillator = context.createOscillator();
	const gain = context.createGain();

	oscillator.type = type || "square";
	oscillator.frequency.setValueAtTime(frequency, startTime);
	gain.gain.setValueAtTime(0.0001, startTime);
	gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.012);
	gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
	oscillator.connect(gain);
	gain.connect(context.destination);
	oscillator.start(startTime);
	oscillator.stop(startTime + duration + 0.02);
}

function playKanuunttDisplayQuizLoop(remainingSeconds) {
	const AudioContext = window.AudioContext || window.webkitAudioContext;

	if (!AudioContext) {
		return;
	}

	if (!kanuunttDisplayAudioContext) {
		kanuunttDisplayAudioContext = new AudioContext();
	}

	const context = kanuunttDisplayAudioContext;

	if (context.state === "suspended") {
		context.resume().catch(() => {});
	}

	const now = context.currentTime;
	const urgent = remainingSeconds <= 5;
	const patterns = [
		[523.25, 659.25, 783.99, 659.25],
		[587.33, 739.99, 880, 739.99],
		[659.25, 783.99, 987.77, 783.99],
		[493.88, 659.25, 739.99, 880],
	];
	const pattern = patterns[Math.max(0, remainingSeconds) % patterns.length];
	const step = urgent ? 0.12 : 0.16;
	const noteDuration = urgent ? 0.09 : 0.11;
	const leadVolume = urgent ? 0.085 : 0.06;

	pattern.forEach((frequency, index) => {
		playKanuunttDisplayTone(
			context,
			frequency,
			now + (index * step),
			noteDuration,
			leadVolume,
			"square"
		);
	});
	playKanuunttDisplayTone(context, pattern[0] / 2, now, 0.18, urgent ? 0.07 : 0.045, "sawtooth");
}

function playKanuunttDisplayTimeUpFallback() {
	const AudioContext = window.AudioContext || window.webkitAudioContext;

	if (!AudioContext) {
		return;
	}

	if (!kanuunttDisplayAudioContext) {
		kanuunttDisplayAudioContext = new AudioContext();
	}

	const context = kanuunttDisplayAudioContext;
	const now = context.currentTime;

	playKanuunttDisplayTone(context, 880, now, 0.16, 0.12, "square");
	playKanuunttDisplayTone(context, 659.25, now + 0.17, 0.16, 0.12, "square");
	playKanuunttDisplayTone(context, 440, now + 0.34, 0.28, 0.14, "sawtooth");
}

function playKanuunttDisplayPhaseSound(phase, questionKey) {
	const phaseSoundKey = phase + ":" + questionKey;

	if (kanuunttDisplayLastPhaseSoundKey === phaseSoundKey) {
		return;
	}

	kanuunttDisplayLastPhaseSoundKey = phaseSoundKey;

	if (phase === "question_open") {
		playKanuunttDisplayFileSound("questionStart");
		return;
	}

	if (phase === "answer_reveal") {
		playKanuunttDisplayFileSound("answerReveal");
		return;
	}

	if (phase === "scoreboard" || phase === "final_scoreboard") {
		playKanuunttDisplayFileSound("scoreboard");
	}
}

function updateKanuunttDisplayCountdown() {
	const session = kanuunttDisplaySession;
	const phase = getKanuunttPhase(session);
	const question = getKanuunttQuestion(session);
	const remainingSeconds = getKanuunttRemainingSeconds(session, question);
	const progress = phase === "question_open"
		? getKanuunttDisplayProgress(session, question)
		: 0;
	const timer = document.getElementById("kanuuntt-display-timer");
	const bar = document.getElementById("kanuuntt-display-countdown-bar");
	const fill = document.getElementById("kanuuntt-display-countdown-fill");

	if (timer) {
		timer.textContent = phase === "question_open" && remainingSeconds !== null
			? remainingSeconds + "s"
			: "Pause";
	}

	if (bar) {
		bar.hidden = phase !== "question_open" || remainingSeconds === null;
	}

	if (fill) {
		fill.style.setProperty("--kanuuntt-countdown-progress", String(progress));
	}

	if (phase !== "question_open" || remainingSeconds === null || remainingSeconds <= 0) {
		if (remainingSeconds === 0 && session && question) {
			const timeUpKey = getKanuunttDisplayQuestionKey(session);

			if (kanuunttDisplayTimeUpSoundKey !== timeUpKey) {
				kanuunttDisplayTimeUpSoundKey = timeUpKey;
				playKanuunttDisplayFileSound("timeUp", {
					fallback: playKanuunttDisplayTimeUpFallback,
				});
			}
		}
		stopKanuunttDisplayCountdownSound();
		return;
	}

	const soundKey = getKanuunttDisplayQuestionKey(session);

	if (kanuunttDisplaySoundKey !== soundKey) {
		kanuunttDisplaySoundKey = soundKey;
		kanuunttDisplayLastTickSecond = null;
	}

	if (!startKanuunttDisplayLoopSound(remainingSeconds <= 5 ? "urgentCountdownLoop" : "countdownLoop")) {
		stopKanuunttDisplayLoopSound();
	}

	if (kanuunttDisplayLastTickSecond !== remainingSeconds) {
		kanuunttDisplayLastTickSecond = remainingSeconds;
		if (!kanuunttDisplayActiveLoopSound) {
			playKanuunttDisplayQuizLoop(remainingSeconds);
		}
	}
}

function renderKanuunttDisplay() {
	const session = kanuunttDisplaySession;
	const sessionId = getKanuunttSessionIdFromPath();
	const phase = getKanuunttPhase(session);
	const question = getKanuunttQuestion(session);
	const questionKey = getKanuunttDisplayQuestionKey(session);
	const revealResults = ["result_distribution", "answer_reveal", "scoreboard", "final_scoreboard"].includes(phase);
	const showScoreboard = ["answer_reveal", "scoreboard", "final_scoreboard"].includes(phase);
	const finalScoreboard = phase === "final_scoreboard";
	const playerCount = session && Array.isArray(session.players) ? session.players.length : 0;
	const answerCount = session ? Number(session.answer_count || 0) : 0;
	const joinUrl = getKanuunttJoinUrl(sessionId);
	const questionView = document.getElementById("kanuuntt-display-question");

	setKanuunttText("kanuuntt-display-title", session ? "Live quiz: " + session.game_id : "Live quiz");
	setKanuunttText("kanuuntt-display-stage", getKanuunttPhaseLabel(phase));
	setKanuunttText("kanuuntt-display-session-id", sessionId || "-");
	setKanuunttText("kanuuntt-display-corner-session-id", sessionId || "-");
	setKanuunttLink("kanuuntt-display-join-link", joinUrl, joinUrl);
	setKanuunttLink("kanuuntt-display-corner-join-link", joinUrl, joinUrl);
	renderKanuunttQr("kanuuntt-display-qr", joinUrl);
	renderKanuunttPlayers("kanuuntt-display-players", session);

	setKanuunttHidden("kanuuntt-display-waiting", phase !== "waiting");
	setKanuunttHidden("kanuuntt-display-question", phase === "waiting" || finalScoreboard);
	setKanuunttHidden("kanuuntt-display-final", !finalScoreboard);
	setKanuunttHidden("kanuuntt-display-corner-join", phase === "waiting");
	if (questionView) {
		questionView.classList.toggle("is-results-visible", revealResults);
	}

	if (!session || session.mode !== "quiz") {
		scheduleKanuunttDisplayFit();
		return;
	}

	if (finalScoreboard) {
		renderKanuunttScoreboard("kanuuntt-display-final-scoreboard", session, true);
		playKanuunttDisplayPhaseSound(phase, questionKey);
		updateKanuunttDisplayCountdown();
		scheduleKanuunttDisplayFit();
		window.setTimeout(scheduleKanuunttDisplayFit, 120);
		return;
	}

	setKanuunttText(
		"kanuuntt-display-meta",
		"Spørgsmål " +
			(Number(session.current_question_index || 0) + 1) +
			" / " +
			(session.quiz_questions || []).length
	);
	renderKanuunttQuestionContent("kanuuntt-display-prompt", question, "Afventer Spørgsmål", {
		autoplayMedia: phase === "question_open",
	});
	if (phase === "scoreboard" && session.auto_advance_enabled) {
		const autoAdvanceRemaining = getKanuunttPhaseRemainingSeconds(
			session,
			KANUUNTT_DISPLAY_SCOREBOARD_SECONDS
		);
		const lastQuestion =
			Array.isArray(session.quiz_questions) &&
			Number(session.current_question_index || 0) >= session.quiz_questions.length - 1;

		setKanuunttText(
			"kanuuntt-display-answer-count",
			(lastQuestion ? "Final scoreboard" : "Næste spørgsmål") +
				" om " +
				(autoAdvanceRemaining ?? KANUUNTT_DISPLAY_SCOREBOARD_SECONDS) +
				"s"
		);
	} else {
		setKanuunttText("kanuuntt-display-answer-count", answerCount + " / " + playerCount + " har svaret");
	}
	setKanuunttHidden("kanuuntt-display-media", true);
	renderKanuunttAnswerCards("kanuuntt-display-answers", session, question, {
		showCorrect: revealResults,
		showDistribution: revealResults,
	});
	setKanuunttHidden("kanuuntt-display-result", !revealResults);
	renderKanuunttResultDetails("kanuuntt-display-result", session, question);
	setKanuunttHidden("kanuuntt-display-scoreboard", !showScoreboard);
	renderKanuunttScoreboard("kanuuntt-display-scoreboard", session, phase === "final_scoreboard");
	playKanuunttDisplayPhaseSound(phase, questionKey);
	updateKanuunttDisplayCountdown();
	scheduleKanuunttDisplayFit();
	window.setTimeout(scheduleKanuunttDisplayFit, 120);
}

function startKanuunttDisplayTimer() {
	if (kanuunttDisplayTimer) {
		return;
	}

	kanuunttDisplayTimer = window.setInterval(updateKanuunttDisplayCountdown, 200);
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
window.addEventListener("resize", scheduleKanuunttDisplayFit);
window.addEventListener("load", scheduleKanuunttDisplayFit);
