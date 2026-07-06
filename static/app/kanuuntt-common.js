const KANUUNTT_HOST_TOKEN_KEY = "reveal-jeopardy-live-host-token:";
const KANUUNTT_ANSWER_STYLES = [
	{ symbol: "A", className: "quiz-answer-a" },
	{ symbol: "B", className: "quiz-answer-b" },
	{ symbol: "C", className: "quiz-answer-c" },
	{ symbol: "D", className: "quiz-answer-d" },
];

function getKanuunttSessionIdFromPath() {
	const parts = window.location.pathname.split("/").filter(Boolean);

	return (parts[2] || "").toUpperCase();
}

function getKanuunttHostToken(sessionId) {
	try {
		return localStorage.getItem(KANUUNTT_HOST_TOKEN_KEY + sessionId) || "";
	} catch (error) {
		return "";
	}
}

function rememberKanuunttHostToken(sessionId, hostToken) {
	if (!sessionId || !hostToken) {
		return;
	}

	try {
		localStorage.setItem(KANUUNTT_HOST_TOKEN_KEY + sessionId, hostToken);
	} catch (error) {
		console.warn("Could not remember KanUUNTt host token.", error);
	}
}

function forgetKanuunttHostToken(sessionId) {
	try {
		localStorage.removeItem(KANUUNTT_HOST_TOKEN_KEY + sessionId);
	} catch (error) {
		console.warn("Could not forget KanUUNTt host token.", error);
	}
}

function getKanuunttJoinUrl(sessionId) {
	return window.location.origin + "/play/" + encodeURIComponent(sessionId);
}

function getKanuunttDisplayUrl(sessionId) {
	return window.location.origin + "/kanuuntt/display/" + encodeURIComponent(sessionId);
}

function getKanuunttBackendUrl(sessionId) {
	return window.location.origin + "/kanuuntt/backend/" + encodeURIComponent(sessionId);
}

function getKanuunttPhase(session) {
	if (!session || session.mode !== "quiz") {
		return "waiting";
	}

	return session.quiz_phase || (session.question_open ? "question_open" : "waiting");
}

function getKanuunttPhaseLabel(phase) {
	return phase === "question_intro"
		? "Næste Spørgsmål"
		: phase === "question_open"
			? "Spørgsmålet er åbent"
			: phase === "result_distribution"
				? "Resultat"
				: phase === "answer_reveal"
					? "Korrekt svar"
					: phase === "scoreboard"
						? "Scoreboard"
						: phase === "final_scoreboard"
							? "Final scoreboard"
							: "Waiting room";
}

function getKanuunttQuestion(session) {
	if (!session || !Array.isArray(session.quiz_questions)) {
		return null;
	}

	return session.quiz_questions[Number(session.current_question_index || 0)] || null;
}

function getKanuunttRemainingSeconds(session, question) {
	if (!session || !question || !session.question_started_at) {
		return null;
	}

	const startedAt = Date.parse(session.question_started_at);

	if (!Number.isFinite(startedAt)) {
		return null;
	}

	const elapsedSeconds = (Date.now() - startedAt) / 1000;
	const remaining = Number(question.timeLimitSeconds || 0) - elapsedSeconds;

	return Math.max(0, Math.ceil(remaining));
}

function getKanuunttCurrentAnswers(session) {
	if (!session || !Array.isArray(session.answers)) {
		return [];
	}

	const questionIndex = Number(session.current_question_index || 0);

	return session.answers.filter(
		(answer) => Number(answer.question_index) === questionIndex
	);
}

function getKanuunttScoreRows(session) {
	if (!session) {
		return [];
	}

	const scores = session.scores || {};

	return [...(session.players || [])]
		.map((player) => ({
			player,
			score: Number(scores[player.id] || 0),
		}))
		.sort((left, right) => right.score - left.score || left.player.name.localeCompare(right.player.name));
}

function setKanuunttText(id, text) {
	const element = document.getElementById(id);

	if (element) {
		element.textContent = text;
	}
}

function setKanuunttHidden(id, hidden) {
	const element = document.getElementById(id);

	if (element) {
		element.hidden = Boolean(hidden);
	}
}

function setKanuunttLink(id, href, text) {
	const element = document.getElementById(id);

	if (element) {
		element.href = href || "#";
		element.textContent = text || href || "-";
	}
}

function renderKanuunttQr(id, value) {
	const element = document.getElementById(id);

	if (!element) {
		return;
	}

	if (!value) {
		element.replaceChildren();
		delete element.dataset.qrValue;
		return;
	}

	if (element.dataset.qrValue === value) {
		return;
	}

	renderQrCode(element, value);
	element.dataset.qrValue = value;
}

function renderKanuunttPlayers(id, session) {
	const element = document.getElementById(id);
	const players = session && Array.isArray(session.players) ? session.players : [];

	if (!element) {
		return;
	}

	if (!players.length) {
		element.replaceChildren(document.createTextNode("Ingen deltagere endnu."));
		return;
	}

	const list = document.createElement("ul");

	players.forEach((player) => {
		const item = document.createElement("li");

		item.textContent = player.name;
		list.appendChild(item);
	});

	element.replaceChildren(list);
}

function renderKanuunttMedia(id, media) {
	const container = document.getElementById(id);

	if (!container) {
		return;
	}

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
	}

	container.appendChild(wrapper);
}

function renderKanuunttAnswerCards(id, session, question, options) {
	const container = document.getElementById(id);

	if (!container) {
		return;
	}

	container.replaceChildren();

	if (!question || !Array.isArray(question.answers)) {
		return;
	}

	const settings = options || {};
	const currentAnswers = getKanuunttCurrentAnswers(session);
	const answerCounts = new Map();

	currentAnswers.forEach((answer) => {
		answerCounts.set(answer.answer_id, Number(answerCounts.get(answer.answer_id) || 0) + 1);
	});

	question.answers.forEach((answer, index) => {
		const style = KANUUNTT_ANSWER_STYLES[index % KANUUNTT_ANSWER_STYLES.length];
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
		const text = document.createElement("span");

		symbol.className = "quiz-answer-symbol";
		symbol.textContent = style.symbol;
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

function renderKanuunttResultDetails(id, session, question) {
	const container = document.getElementById(id);

	if (!container) {
		return;
	}

	container.replaceChildren();

	if (!question) {
		return;
	}

	const correctAnswers = new Set(
		(question.answers || [])
			.filter((answer) => answer.correct)
			.map((answer) => answer.id)
	);
	const correctRows = getKanuunttCurrentAnswers(session).filter((answer) =>
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
		row.textContent = answer.player_name + " +" + Number(answer.earned_points || 0) + " point";
		container.appendChild(row);
	});
}

function renderKanuunttScoreboard(id, session, finalMode) {
	const container = document.getElementById(id);

	if (!container) {
		return;
	}

	container.replaceChildren();

	const title = document.createElement("div");

	title.className = "quiz-scoreboard-title";
	title.textContent = finalMode ? "Final scoreboard" : "Scoreboard";
	container.appendChild(title);

	const rows = getKanuunttScoreRows(session);

	if (!rows.length) {
		const empty = document.createElement("div");

		empty.className = "quiz-result-empty";
		empty.textContent = "Ingen deltagere endnu.";
		container.appendChild(empty);
		return;
	}

	rows.forEach((entry, index) => {
		const row = document.createElement("div");
		const rank = document.createElement("span");
		const name = document.createElement("span");
		const points = document.createElement("span");

		row.className = "quiz-scoreboard-row";
		rank.className = "quiz-scoreboard-rank";
		name.className = "quiz-scoreboard-name";
		points.className = "quiz-scoreboard-points";
		rank.textContent = String(index + 1);
		name.textContent = entry.player.name;
		points.textContent = entry.score + " point";
		row.appendChild(rank);
		row.appendChild(name);
		row.appendChild(points);
		container.appendChild(row);
	});
}
