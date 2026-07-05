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
		const source = question && typeof question === "object" ? question : {};
		const hasQuestion = Object.prototype.hasOwnProperty.call(source, "question");
		const hasAnswer = Object.prototype.hasOwnProperty.call(source, "answer");

		return {
			...source,
			points: Number(source.points) || fallbackPoints,
			question: normalizeRichContent(
				hasQuestion
					? source.question
					: createRichContent("Question goes here.", "rich")
			),
			answer: normalizeRichContent(
				hasAnswer ? source.answer : createRichContent("Answer goes here.", "rich")
			),
			hints: normalizeHints(source.hints),
			media: normalizeMedia(source.media),
		};
	});
}

function isQuestionBlank(question) {
	return (
		Boolean(question) &&
		isRichContentBlank(question.question) &&
		isRichContentBlank(question.answer)
	);
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
		(total, category) =>
			total + category.questions.filter((question) => !isQuestionBlank(question)).length,
		0
	);
}
