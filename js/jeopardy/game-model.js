function getStorageKey() {
	return "reveal-jeopardy-game:" + (gameConfig.id || gameKey);
}

function getSettingsStorageKey() {
	return "reveal-jeopardy-settings:" + gameKey;
}

function clampTeamCount(value) {
	const parsedValue = Number(value);

	if (Number.isNaN(parsedValue)) {
		return 3;
	}

	return Math.min(MAX_TEAM_COUNT, Math.max(MIN_TEAM_COUNT, parsedValue));
}

function readGameSettings() {
	try {
		const savedSettings = localStorage.getItem(getSettingsStorageKey());

		if (!savedSettings) {
			return {};
		}

		const parsedSettings = JSON.parse(savedSettings);

		return parsedSettings && typeof parsedSettings === "object"
			? parsedSettings
			: {};
	} catch (error) {
		console.warn("Could not load game settings.", error);
		return {};
	}
}

function getConfiguredTeamNames(baseTeamNames) {
	const fallbackNames =
		Array.isArray(baseTeamNames) && baseTeamNames.length
			? baseTeamNames
			: ["Team 1", "Team 2", "Team 3"];
	const settings = readGameSettings();
	const savedNames = Array.isArray(settings.teamNames)
		? settings.teamNames
		: [];
	const teamCount = clampTeamCount(
		settings.teamCount || savedNames.length || fallbackNames.length
	);

	return Array.from({ length: teamCount }, (_, index) => {
		const savedName = savedNames[index];
		const fallbackName = fallbackNames[index] || "Team " + (index + 1);
		const name =
			typeof savedName === "string" && savedName.trim()
				? savedName.trim()
				: fallbackName;

		return String(name || "Team " + (index + 1));
	});
}

function getTeamNamesFromForm() {
	const teamCountInput = document.getElementById("team-count");
	const teamCount = clampTeamCount(teamCountInput ? teamCountInput.value : 3);

	return Array.from({ length: teamCount }, (_, index) => {
		const input = document.getElementById("team-name-" + (index + 1));
		const value = input ? input.value.trim() : "";

		return value || "Team " + (index + 1);
	});
}

function writeGameSettings(teamNames) {
	try {
		localStorage.setItem(
			getSettingsStorageKey(),
			JSON.stringify({
				teamCount: teamNames.length,
				teamNames,
			})
		);
	} catch (error) {
		console.warn("Could not save game settings.", error);
	}
}

function normalizeGameConfig(rawGame) {
	const source = rawGame && typeof rawGame === "object" ? rawGame : {};
	const normalizedTeams =
		Array.isArray(source.teams) && source.teams.length
			? source.teams
			: ["Team 1", "Team 2", "Team 3"];
	defaultTeamNames = normalizedTeams.map((team, index) =>
		String(team || "Team " + (index + 1))
	);
	const configuredTeamNames = getConfiguredTeamNames(normalizedTeams);
	const normalizedCategories =
		Array.isArray(source.categories) && source.categories.length
			? source.categories
			: [];

	return {
		id: source.id || gameKey,
		title: source.title || "Jeopardy",
		teams: configuredTeamNames.map((team, index) => ({
			id: "team" + (index + 1),
			name: String(team || "Team " + (index + 1)),
		})),
		categories: normalizedCategories.map((category, categoryIndex) => ({
			title: String(category.title || "Category " + (categoryIndex + 1)),
			questions: normalizeQuestions(category.questions),
		})),
	};
}

function normalizeQuestions(questions) {
	const sourceQuestions = Array.isArray(questions) ? questions : [];

	return sourceQuestions.map((question, index) => {
		const fallbackPoints = (index + 1) * 100;

		return {
			...question,
			points: Number(question.points) || fallbackPoints,
			question:
				(question.question || question.html || question.markdown)
					? question.question || ""
					: "Question goes here.",
			answer:
				(question.answer || question.answerHtml || question.answerMarkdown)
					? question.answer || ""
					: "Answer goes here.",
		};
	});
}

function getQuestionRowCount() {
	return categories.reduce(
		(maxCount, category) => Math.max(maxCount, category.questions.length),
		0
	);
}

function getQuestionId(categoryIndex, points) {
	return "c" + categoryIndex + "q" + points;
}

function isQuestionId(questionId) {
	return questionIdSet.has(questionId || "");
}

function getTotalQuestionCount() {
	return categories.reduce(
		(total, category) => total + category.questions.length,
		0
	);
}

