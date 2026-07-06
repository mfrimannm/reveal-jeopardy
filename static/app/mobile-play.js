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

	return (mobileSession.buzzers || []).find(
		(buzzer) => buzzer.player_id === mobilePlayer.id
	);
}

function isMobileQuizSession() {
	return Boolean(mobileSession && mobileSession.mode === "quiz");
}

function getMobileQuizQuestion() {
	if (!isMobileQuizSession() || !Array.isArray(mobileSession.quiz_questions)) {
		return null;
	}

	return (
		mobileSession.quiz_questions[
			Number(mobileSession.current_question_index || 0)
		] || null
	);
}

function getMobileQuizPhase() {
	if (!isMobileQuizSession()) {
		return "waiting";
	}

	if (mobileSession.quiz_phase) {
		return mobileSession.quiz_phase;
	}

	return mobileSession.question_open ? "question_open" : "waiting";
}

function getMobilePlayerAnswer() {
	if (!isMobileQuizSession() || !mobilePlayer || !Array.isArray(mobileSession.answers)) {
		return null;
	}

	const questionIndex = Number(mobileSession.current_question_index || 0);

	return mobileSession.answers.find(
		(answer) =>
			answer.player_id === mobilePlayer.id &&
			Number(answer.question_index) === questionIndex
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
	const quizPanel = document.getElementById("mobile-quiz-panel");
	const summary = document.getElementById("mobile-player-summary");
	const quizSummary = document.getElementById("mobile-quiz-player-summary");
	const buzzButton = document.getElementById("mobile-buzz-button");
	const buzzStatus = document.getElementById("mobile-buzz-status");
	const buzzer = getMobilePlayerBuzzer();
	const quizMode = isMobileQuizSession();
	const quizQuestion = getMobileQuizQuestion();
	const quizAnswer = getMobilePlayerAnswer();
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
		buzzerPanel.hidden = !mobilePlayer || quizMode;
	}

	if (quizPanel) {
		quizPanel.hidden = !mobilePlayer || !quizMode;
	}

	if (summary && mobilePlayer) {
		summary.textContent =
			mobilePlayer.name + (team ? " / " + team.name : "");
	}

	if (quizSummary && mobilePlayer) {
		quizSummary.textContent =
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

	renderMobileQuizPanel(quizQuestion, quizAnswer);
}

function renderMobileQuizPanel(question, existingAnswer) {
	const meta = document.getElementById("mobile-quiz-meta");
	const prompt = document.getElementById("mobile-quiz-prompt");
	const answers = document.getElementById("mobile-quiz-answers");
	const status = document.getElementById("mobile-quiz-status");
	const phase = getMobileQuizPhase();
	const revealAnswer = ["result_distribution", "answer_reveal", "scoreboard", "final_scoreboard"].includes(phase);
	const canAnswer =
		Boolean(mobilePlayer) &&
		isMobileQuizSession() &&
		Boolean(question) &&
		phase === "question_open" &&
		mobileSession.question_open &&
		!existingAnswer;

	if (meta) {
		if (!isMobileQuizSession()) {
			meta.textContent = "Afventer host";
		} else {
			meta.textContent =
				"Spørgsmål " +
				(Number(mobileSession.current_question_index || 0) + 1) +
				" / " +
				(mobileSession.quiz_questions || []).length +
				" - " +
				(phase === "question_open"
					? "åbent"
					: phase === "question_intro"
						? "gør klar"
						: phase === "waiting"
							? "venter"
							: "lukket");
		}
	}

	if (prompt) {
		prompt.textContent = question ? question.prompt : "Afventer spørgsmål";
	}

	if (answers) {
		answers.replaceChildren();

		if (question && Array.isArray(question.answers)) {
			question.answers.forEach((answer, index) => {
				const button = document.createElement("button");
				const symbols = ["▲", "◆", "●", "■"];

				button.className = "mobile-answer-button";
				button.type = "button";
				button.disabled = !canAnswer;
				button.onclick = () => submitMobileQuizAnswer(answer.id);

				if (existingAnswer && existingAnswer.answer_id === answer.id) {
					button.classList.add("selected");
				}
				if (revealAnswer && answer.correct) {
					button.classList.add("correct");
				}

				const symbol = document.createElement("span");
				symbol.className = "mobile-answer-symbol";
				symbol.textContent = symbols[index % symbols.length];

				const text = document.createElement("span");
				text.textContent = answer.text;

				button.appendChild(symbol);
				button.appendChild(text);

				answers.appendChild(button);
			});
		}
	}

	if (status) {
		if (!mobilePlayer) {
			status.textContent = "Join for at svare";
		} else if (!question) {
			status.textContent = "Afventer host";
		} else if (existingAnswer) {
			status.textContent = revealAnswer
				? "Point: " + Number(existingAnswer.earned_points || 0)
				: "Svar modtaget. Venter på de andre.";
		} else if (phase === "question_intro") {
			status.textContent = "Næste spørgsmål er på vej";
		} else if (!mobileSession.question_open) {
			status.textContent = "Spørgsmålet er lukket";
		} else {
			status.textContent = "Vælg et svar";
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

async function submitMobileQuizAnswer(answerId) {
	if (!mobilePlayer) {
		return;
	}

	try {
		const result = await submitQuizAnswer(
			getMobileSessionId(),
			mobilePlayer.id,
			answerId
		);

		mobileSession = result.session;
		setMobileError("");
		renderMobileSession();
	} catch (error) {
		console.warn("Could not submit answer.", error);
		setMobileError(error.message || "Kunne ikke sende svar.");
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
