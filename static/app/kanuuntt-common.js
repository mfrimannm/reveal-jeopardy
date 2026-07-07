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

function getKanuunttRankedScoreRows(players, scores) {
	let previousScore = null;
	let previousRank = 0;

	return [...(players || [])]
		.map((player) => ({
			player,
			score: Number((scores || {})[player.id] || 0),
		}))
		.sort((left, right) => right.score - left.score || left.player.name.localeCompare(right.player.name))
		.map((entry, index) => {
			const rank = previousScore === entry.score ? previousRank : index + 1;

			previousScore = entry.score;
			previousRank = rank;

			return {
				...entry,
				rank,
			};
		});
}

function getKanuunttScoreRows(session) {
	if (!session) {
		return [];
	}

	return getKanuunttRankedScoreRows(session.players || [], session.scores || {});
}

function getKanuunttRankGroups(rows) {
	const groups = [];

	(rows || []).forEach((entry) => {
		const currentGroup = groups[groups.length - 1];

		if (currentGroup && currentGroup.rank === entry.rank) {
			currentGroup.entries.push(entry);
			return;
		}

		groups.push({
			rank: entry.rank,
			score: entry.score,
			entries: [entry],
		});
	});

	return groups;
}

function formatKanuunttNames(entries) {
	const names = (entries || []).map((entry) => entry.player.name);

	if (names.length <= 2) {
		return names.join(" og ");
	}

	return names.slice(0, -1).join(", ") + " og " + names[names.length - 1];
}

function appendKanuunttScoreboardRow(container, entry) {
	const row = document.createElement("div");
	const rank = document.createElement("span");
	const name = document.createElement("span");
	const points = document.createElement("span");

	row.className = "quiz-scoreboard-row";
	rank.className = "quiz-scoreboard-rank";
	name.className = "quiz-scoreboard-name";
	points.className = "quiz-scoreboard-points";
	rank.textContent = String(entry.rank || 0);
	name.textContent = entry.player.name;
	points.textContent = entry.score + " point";
	row.appendChild(rank);
	row.appendChild(name);
	row.appendChild(points);
	container.appendChild(row);
}

function appendKanuunttFinalScoreboard(container, rows) {
	const groups = getKanuunttRankGroups(rows);
	const winners = groups[0] ? groups[0].entries : [];
	const winner = document.createElement("div");
	const podium = document.createElement("div");
	const rest = document.createElement("div");
	const restTitle = document.createElement("div");
	const restGroups = groups.filter((group) => group.rank > 3);

	winner.className = "quiz-final-winner";
	winner.textContent =
		(winners.length > 1 ? "Vindere: " : "Vinder: ") +
		formatKanuunttNames(winners);
	container.appendChild(winner);

	podium.className = "quiz-final-podium";
	groups
		.filter((group) => group.rank <= 3)
		.forEach((group) => {
			const place = document.createElement("div");
			const placeLabel = document.createElement("div");
			const name = document.createElement("div");
			const points = document.createElement("div");

			place.className = "quiz-final-podium-place rank-" + group.rank;
			place.dataset.rank = String(group.rank);
			placeLabel.className = "quiz-final-podium-rank";
			name.className = "quiz-final-podium-name";
			points.className = "quiz-final-podium-points";
			placeLabel.textContent = group.rank + ". plads";
			name.textContent = formatKanuunttNames(group.entries);
			points.textContent = group.score + " point";
			place.appendChild(placeLabel);
			place.appendChild(name);
			place.appendChild(points);
			podium.appendChild(place);
		});
	container.appendChild(podium);

	if (!restGroups.length) {
		return;
	}

	rest.className = "quiz-final-rest";
	restTitle.className = "quiz-final-rest-title";
	restTitle.textContent = "Resten";
	rest.appendChild(restTitle);

	restGroups.forEach((group) => {
		group.entries.forEach((entry) => {
			appendKanuunttScoreboardRow(rest, entry);
		});
	});

	container.appendChild(rest);
}

function renderKanuunttScoreboardElement(container, rows, finalMode) {
	container.replaceChildren();

	const title = document.createElement("div");

	title.className = "quiz-scoreboard-title";
	title.textContent = finalMode ? "Final scoreboard" : "Scoreboard";
	container.appendChild(title);

	if (!rows.length) {
		const empty = document.createElement("div");

		empty.className = "quiz-result-empty";
		empty.textContent = "Ingen deltagere endnu.";
		container.appendChild(empty);
		return;
	}

	if (finalMode) {
		appendKanuunttFinalScoreboard(container, rows);
		return;
	}

	rows.forEach((entry) => {
		appendKanuunttScoreboardRow(container, entry);
	});
}

function setKanuunttText(id, text) {
	const element = document.getElementById(id);

	if (element) {
		element.textContent = text;
	}
}

function setKanuunttRichContent(id, value) {
	const element = document.getElementById(id);

	if (!element) {
		return;
	}

	if (typeof renderRichContent === "function") {
		renderRichContent(element, {
			format: "rich",
			content: String(value || ""),
		});
		return;
	}

	element.textContent = String(value || "");
}

function getKanuunttQuestionContentKey(question, fallback) {
	const media = question && question.media ? question.media : null;

	return JSON.stringify({
		prompt: String((question && question.prompt) || fallback || ""),
		media: media
			? {
					type: media.type || "",
					src: media.src || media.url || "",
					alt: media.alt || "",
					poster: media.poster || "",
					title: media.title || "",
					start: media.start ?? null,
					end: media.end ?? null,
					loop: Boolean(media.loop),
					controls: media.controls !== false,
					muted: Boolean(media.muted),
				}
			: null,
	});
}

function setKanuunttMediaAutoplaySource(iframe) {
	if (!iframe || !iframe.src) {
		return;
	}

	if (!iframe.dataset.baseSrc) {
		iframe.dataset.baseSrc = iframe.src;
	}

	if (iframe.dataset.autoplaySrc) {
		return;
	}

	try {
		const url = new URL(iframe.dataset.baseSrc, window.location.href);

		url.searchParams.set("autoplay", "1");
		if (url.hostname.includes("youtube") || url.hostname.includes("youtu.be")) {
			url.searchParams.set("mute", "1");
		}
		iframe.dataset.autoplaySrc = url.toString();
	} catch (error) {
		iframe.dataset.autoplaySrc =
			iframe.dataset.baseSrc +
			(iframe.dataset.baseSrc.includes("?") ? "&" : "?") +
			"autoplay=1";
	}
}

function setKanuunttQuestionMediaAutoplay(container, enabled) {
	if (!container) {
		return;
	}

	container.querySelectorAll("video, audio").forEach((media) => {
		if (enabled) {
			media.dataset.autoplay = "true";
			return;
		}

		delete media.dataset.autoplay;
		media.pause();
	});

	container.querySelectorAll("iframe").forEach((iframe) => {
		if (enabled) {
			iframe.dataset.autoplay = "true";
			setKanuunttMediaAutoplaySource(iframe);
			return;
		}

		delete iframe.dataset.autoplay;
		if (iframe.dataset.baseSrc && iframe.src !== iframe.dataset.baseSrc) {
			iframe.src = iframe.dataset.baseSrc;
		}
	});

	if (typeof syncRenderedMediaPlayback === "function") {
		syncRenderedMediaPlayback(container);
	}
}

function appendKanuunttQuestionMedia(container, media) {
	if (!container || !media || !media.type) {
		return;
	}

	const wrapper = document.createElement("div");

	wrapper.className = "question-media";

	if (media.type === "image" && media.src) {
		const image = document.createElement("img");

		image.src = media.src;
		image.alt = media.alt || "";
		image.loading = "eager";
		wrapper.appendChild(image);
	} else if (typeof createMediaElement === "function") {
		const element = createMediaElement(media);

		if (element) {
			wrapper.appendChild(element);
		}
	} else if (media.type === "embed" && media.src) {
		const iframe = document.createElement("iframe");

		iframe.src = media.src;
		iframe.title = media.title || "Quiz embed";
		iframe.allowFullscreen = true;
		iframe.referrerPolicy = "strict-origin-when-cross-origin";
		wrapper.appendChild(iframe);
	}

	if (!wrapper.children.length) {
		return;
	}

	container.appendChild(wrapper);
}

function renderKanuunttQuestionContent(id, question, fallback, options) {
	const element = document.getElementById(id);
	const prompt = String((question && question.prompt) || fallback || "");
	const media = question && question.media;
	const settings = options || {};
	const contentKey = getKanuunttQuestionContentKey(question, fallback);

	if (!element) {
		return;
	}

	if (element.dataset.kanuunttQuestionContentKey !== contentKey) {
		if (typeof renderRichContent === "function") {
			renderRichContent(element, {
				format: "rich",
				content: prompt,
			});
		} else {
			element.textContent = prompt;
		}

		element.querySelectorAll(".question-media-source").forEach((source) => {
			source.remove();
		});

		if (media && media.src && !prompt.includes(media.src)) {
			appendKanuunttQuestionMedia(element, media);
		}

		element.dataset.kanuunttQuestionContentKey = contentKey;
	}

	setKanuunttQuestionMediaAutoplay(element, Boolean(settings.autoplayMedia));
}

function getKanuunttPromptEmbeddedMedia(line) {
	const imageMatch = String(line || "").trim().match(/^!\[([^\]\n]*)\]\(([^)\s]+)\)$/);

	if (!imageMatch) {
		return null;
	}

	return {
		type: "image",
		src: imageMatch[2],
		alt: imageMatch[1] || "",
	};
}

function getKanuunttQuestionDisplayParts(question) {
	const prompt = String((question && question.prompt) || "");
	const lines = prompt.split(/\r?\n/);
	let embeddedMedia = null;
	const promptLines = [];

	lines.forEach((line) => {
		const media = getKanuunttPromptEmbeddedMedia(line);

		if (!embeddedMedia && media) {
			embeddedMedia = media;
			return;
		}

		promptLines.push(line);
	});

	return {
		prompt: promptLines.join("\n").trim(),
		media: (question && question.media) || embeddedMedia,
	};
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

	if (!media || !media.type || !media.src) {
		if (container.dataset.mediaKey === "empty") {
			return;
		}

		const empty = document.createElement("div");

		empty.className = "quiz-media-empty";
		empty.textContent = "Tekstspørgsmål";
		container.replaceChildren(empty);
		container.dataset.mediaKey = "empty";
		return;
	}

	const mediaKey = JSON.stringify({
		type: media.type,
		src: media.src,
		alt: media.alt || "",
		autoplay: Boolean(media.autoplay),
		loop: Boolean(media.loop),
		muted: Boolean(media.muted || media.autoplay),
		poster: media.poster || "",
		title: media.title || "",
	});

	if (container.dataset.mediaKey === mediaKey) {
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

	container.replaceChildren(wrapper);
	container.dataset.mediaKey = mediaKey;
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
		const text = document.createElement("div");

		symbol.className = "quiz-answer-symbol";
		symbol.textContent = style.symbol;
		text.className = "quiz-answer-text";
		if (typeof renderRichContent === "function") {
			renderRichContent(text, {
				format: "rich",
				content: String(answer.text || ""),
			});
		} else {
			text.textContent = answer.text;
		}
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

	renderKanuunttScoreboardElement(container, getKanuunttScoreRows(session), finalMode);
}
