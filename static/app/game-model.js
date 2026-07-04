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
