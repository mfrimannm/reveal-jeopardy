function initializeGameData() {
	gameConfig = normalizeGameConfig(window.JEOPARDY_GAME);
	categories = gameConfig.categories;
	teams = gameConfig.teams;
	teamIds = teams.map((team) => team.id);
	questionIdSet = new Set();
	resetRuntimeGameState();

	document.documentElement.style.setProperty(
		"--category-count",
		Math.max(categories.length, 1)
	);
	document.documentElement.style.setProperty(
		"--question-count",
		Math.max(getQuestionRowCount(), 1)
	);
	document.documentElement.style.setProperty(
		"--team-count",
		Math.max(teamIds.length, 1)
	);
}

function resetRuntimeGameState() {
	scores = {};
	usedQuestions = [];
	questionAwards = {};

	teamIds.forEach((teamId) => {
		scores[teamId] = 0;
	});
}

function getQuestionAwards(questionId) {
	const awards = questionAwards[questionId];

	if (!awards) {
		return [];
	}

	if (Array.isArray(awards)) {
		return awards.filter(
			(award) =>
				award &&
				teamIds.includes(award.team) &&
				!Number.isNaN(Number(award.amount))
		);
	}

	if (
		awards &&
		teamIds.includes(awards.team) &&
		!Number.isNaN(Number(awards.amount))
	) {
		return [awards];
	}

	return [];
}

function addQuestionAward(questionId, team, amount, options) {
	const currentAwards = getQuestionAwards(questionId);
	const shouldAppend = Boolean(options && options.append);
	const nextAwards = shouldAppend ? currentAwards : [];

	nextAwards.push({
		team,
		amount: Number(amount),
	});

	questionAwards[questionId] = nextAwards.length === 1 ? nextAwards[0] : nextAwards;
}

function removeQuestionAward(questionId) {
	const awards = getQuestionAwards(questionId);

	if (awards.length === 0) {
		delete questionAwards[questionId];
		return;
	}

	awards.forEach((award) => {
		const amount = Number(award.amount);

		if (!Number.isNaN(amount)) {
			scores[award.team] = (scores[award.team] || 0) - amount;
			updateScore(award.team);
		}
	});

	delete questionAwards[questionId];
}

function prepareQuestionForCorrection(questionId) {
	if (!isQuestionId(questionId) || !usedQuestions.includes(questionId)) {
		return;
	}

	removeQuestionAward(questionId);
	usedQuestions = usedQuestions.filter((usedId) => usedId !== questionId);
	updateTile(questionId);
	saveGameState();
}

function markUsedAndGoBack(questionId) {
	if (questionId && !usedQuestions.includes(questionId)) {
		usedQuestions.push(questionId);
	}

	updateTile(questionId);
	saveGameState();

	if (typeof Reveal !== "undefined" && Reveal.slide) {
		goToBoard();
	} else {
		window.location.hash = "/board";
	}
}

function goBackWithoutScore(questionId) {
	const targetQuestionId =
		questionId ||
		(getCurrentQuestionSlide() && getCurrentQuestionSlide().id) ||
		"";

	if (!isQuestionId(targetQuestionId)) {
		goToBoard();
		return;
	}

	markUsedAndGoBack(targetQuestionId);
}

function changeScore(team, amount, options) {
	if (!teamIds.includes(team) || Number.isNaN(Number(amount))) {
		return;
	}

	const scoringOptions = options || {};
	const currentSlide = getCurrentQuestionSlide();
	const questionId =
		currentSlide && currentSlide.id && isQuestionId(currentSlide.id)
			? currentSlide.id
			: "";

	if (questionId) {
		if (!scoringOptions.append) {
			removeQuestionAward(questionId);
		}

		addQuestionAward(questionId, team, amount, {
			append: scoringOptions.append,
		});
	}

	scores[team] = (scores[team] || 0) + Number(amount);
	updateScore(team);

	if (typeof syncLiveScoreChange === "function") {
		syncLiveScoreChange(team, Number(amount), questionId);
	}

	if (questionId && !scoringOptions.keepOpen) {
		markUsedAndGoBack(questionId);
		return;
	}

	saveGameState();
}

function saveGameState() {
	try {
		localStorage.setItem(
			getStorageKey(),
			JSON.stringify({
				scores,
				usedQuestions,
				questionAwards,
			})
		);
		broadcastGameMessage("state-changed", {
			storageKey: getStorageKey(),
		});
	} catch (error) {
		console.warn("Could not save game state.", error);
	}
}

function loadGameState() {
	try {
		const savedState = localStorage.getItem(getStorageKey());

		if (!savedState) {
			resetRuntimeGameState();
			clearVisibleAnswers();
			updateScoreboard();
			updateUsedTiles();
			return;
		}

		const parsedState = JSON.parse(savedState);

		if (parsedState && typeof parsedState === "object") {
			if (parsedState.scores && typeof parsedState.scores === "object") {
				teamIds.forEach((teamId) => {
					scores[teamId] = Number(parsedState.scores[teamId]) || 0;
				});
			}

			if (Array.isArray(parsedState.usedQuestions)) {
				usedQuestions = parsedState.usedQuestions.filter((questionId) =>
					isQuestionId(questionId)
				);
			}

			if (
				parsedState.questionAwards &&
				typeof parsedState.questionAwards === "object"
			) {
				questionAwards = {};

				Object.entries(parsedState.questionAwards).forEach(
					([questionId, award]) => {
						if (
							isQuestionId(questionId) &&
							award &&
							teamIds.includes(award.team) &&
							!Number.isNaN(Number(award.amount))
						) {
							addQuestionAward(questionId, award.team, Number(award.amount), {
								append: true,
							});
						} else if (Array.isArray(award)) {
							award.forEach((entry) => {
								if (
									entry &&
									teamIds.includes(entry.team) &&
									!Number.isNaN(Number(entry.amount))
								) {
									addQuestionAward(
										questionId,
										entry.team,
										Number(entry.amount),
										{ append: true }
									);
								}
							});
						}
					}
				);
			}
		}
	} catch (error) {
		console.warn("Could not load game state.", error);
	}

	updateScoreboard();
	updateUsedTiles();
}

function resetGame() {
	if (
		!window.confirm(
			"Reset game? Scores and used questions will be cleared."
		)
	) {
		return;
	}

	resetRuntimeGameState();

	try {
		localStorage.removeItem(getStorageKey());
		broadcastGameMessage("state-changed", {
			storageKey: getStorageKey(),
		});
	} catch (error) {
		console.warn("Could not clear game state.", error);
	}

	updateUsedTiles();
	clearVisibleAnswers();

	updateScoreboard();

	if (typeof syncLiveReset === "function") {
		syncLiveReset();
	}

	if (typeof Reveal !== "undefined" && Reveal.slide) {
		goToBoard();
	} else {
		window.location.hash = "/board";
	}
}

function isSameOriginGameMessage(event) {
	return (
		window.location.protocol === "file:" ||
		!event.origin ||
		event.origin === window.location.origin
	);
}

function parseGameMessage(data) {
	if (typeof data !== "string" || data.charAt(0) !== "{") {
		return null;
	}

	try {
		return JSON.parse(data);
	} catch (error) {
		return null;
	}
}

function getGameMessageTargets() {
	const targets = new Set();

	if (window.parent && window.parent !== window) {
		targets.add(window.parent);
	}

	if (window.opener) {
		targets.add(window.opener);
	}

	if (
		window.top &&
		window.top !== window &&
		window.top.opener
	) {
		targets.add(window.top.opener);
	}

	return targets;
}

function broadcastGameMessage(type, payload) {
	const message = JSON.stringify({
		namespace: "reveal-jeopardy",
		type,
		...(payload || {}),
	});

	getGameMessageTargets().forEach((target) => {
		try {
			target.postMessage(message, "*");
		} catch (error) {
			// Ignore closed or cross-origin windows.
		}
	});
}

function handleGameMessage(event) {
	if (!isSameOriginGameMessage(event)) {
		return;
	}

	const data = parseGameMessage(event.data);

	if (!data || data.namespace !== "reveal-jeopardy") {
		return;
	}

	if (data.type === "state-changed" && data.storageKey === getStorageKey()) {
		loadGameState();
	}

	if (data.type === "answer-shown") {
		revealAnswerForQuestion(data.questionId);
	}
}

function handleStorageChange(event) {
	if (event.key === getStorageKey()) {
		loadGameState();
	}
}

function initializeGameSync() {
	window.addEventListener("message", handleGameMessage);
	window.addEventListener("storage", handleStorageChange);
}
