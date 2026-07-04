function clampBuilderCount(value, fallback) {
	const parsedValue = Number(value);

	if (Number.isNaN(parsedValue)) {
		return fallback;
	}

	return Math.min(10, Math.max(1, Math.floor(parsedValue)));
}

function createDefaultBuilderQuestion(points) {
	return {
		points,
		questionType: "question",
		question: "",
		answerType: "answer",
		answer: "",
		hints: "",
		notes: "",
		background: "",
		backgroundColor: "",
		backgroundVideo: "",
		backgroundIframe: "",
		backgroundInteractive: false,
		backgroundVideoLoop: true,
		backgroundVideoMuted: true,
		transition: "",
		className: "",
	};
}

function createDefaultBuilderCategory(index, rowCount) {
	return {
		title: "Kategori " + index,
		questions: Array.from({ length: rowCount }, (_, questionIndex) =>
			createDefaultBuilderQuestion((questionIndex + 1) * 100)
		),
	};
}

function createDefaultBuilderDraft(categoryCount, rowCount) {
	const normalizedCategoryCount = clampBuilderCount(categoryCount, 3);
	const normalizedRowCount = clampBuilderCount(rowCount, 5);

	return {
		title: "Mit Jeopardy Spil",
		id: "mit-spil",
		teams: ["Team 1", "Team 2", "Team 3"],
		categoryCount: normalizedCategoryCount,
		rowCount: normalizedRowCount,
		boardCreated: false,
		categories: Array.from(
			{ length: normalizedCategoryCount },
			(_, categoryIndex) =>
				createDefaultBuilderCategory(categoryIndex + 1, normalizedRowCount)
		),
	};
}

function getBuilderTextValue(source, fields) {
	for (const field of fields) {
		if (typeof source[field] === "string" && source[field].trim()) {
			return source[field].trim();
		}
	}

	return "";
}

function normalizeBuilderQuestion(question, index) {
	const source = question && typeof question === "object" ? question : {};
	const questionType = source.markdown
		? "markdown"
		: source.html
		? "html"
		: source.questionType || "question";
	const answerType = source.answerMarkdown
		? "answerMarkdown"
		: source.answerHtml
		? "answerHtml"
		: source.answerType || "answer";

	return {
		points: Number(source.points) || (index + 1) * 100,
		questionType:
			questionType === "markdown" || questionType === "html"
				? questionType
				: "question",
		question: getBuilderTextValue(source, [
			"question",
			"markdown",
			"html",
		]),
		answerType:
			answerType === "answerMarkdown" || answerType === "answerHtml"
				? answerType
				: "answer",
		answer: getBuilderTextValue(source, [
			"answer",
			"answerMarkdown",
			"answerHtml",
		]),
		hints: Array.isArray(source.hints)
			? source.hints
					.map((hint) =>
						typeof hint === "object" ? hint.text || hint.html || "" : hint
					)
					.join("\n")
			: String(source.hints || ""),
		notes: String(source.notes || source.notesHtml || ""),
		background: String(source.background || ""),
		backgroundColor: String(source.backgroundColor || ""),
		backgroundVideo: String(source.backgroundVideo || ""),
		backgroundIframe: String(source.backgroundIframe || ""),
		backgroundInteractive: Boolean(source.backgroundInteractive),
		backgroundVideoLoop: source.backgroundVideoLoop !== false,
		backgroundVideoMuted: source.backgroundVideoMuted !== false,
		transition: String(source.transition || ""),
		className: String(source.className || ""),
	};
}

function normalizeBuilderCategories(categoriesSource, categoryCount, rowCount) {
	return Array.from({ length: categoryCount }, (_, categoryIndex) => {
		const sourceCategory =
			Array.isArray(categoriesSource) && categoriesSource[categoryIndex]
				? categoriesSource[categoryIndex]
				: {};
		const sourceQuestions = Array.isArray(sourceCategory.questions)
			? sourceCategory.questions
			: [];

		return {
			title: String(
				sourceCategory.title || "Kategori " + (categoryIndex + 1)
			),
			questions: Array.from({ length: rowCount }, (_, questionIndex) =>
				normalizeBuilderQuestion(
					sourceQuestions[questionIndex] ||
						createDefaultBuilderQuestion((questionIndex + 1) * 100),
					questionIndex
				)
			),
		};
	});
}

function normalizeBuilderDraft(draft) {
	const source = draft && typeof draft === "object" ? draft : {};
	const categoriesSource = Array.isArray(source.categories)
		? source.categories
		: [];
	const categoryCount = clampBuilderCount(
		source.categoryCount || categoriesSource.length,
		3
	);
	const maxQuestionCount = categoriesSource.reduce(
		(maxCount, category) =>
			Math.max(
				maxCount,
				Array.isArray(category.questions) ? category.questions.length : 0
			),
		0
	);
	const rowCount = clampBuilderCount(source.rowCount || maxQuestionCount, 5);

	return {
		title: String(source.title || "Mit Jeopardy Spil"),
		id: slugifyGameId(source.id || source.title || "mit-spil"),
		teams:
			Array.isArray(source.teams) && source.teams.length
				? source.teams.map((team, index) =>
						String(team || "Team " + (index + 1))
				  )
				: ["Team 1", "Team 2", "Team 3"],
		categoryCount,
		rowCount,
		boardCreated: Boolean(
			source.boardCreated ||
				(source.boardCreated === undefined &&
					categoriesSource.length &&
					!source.categoryCount)
		),
		categories: normalizeBuilderCategories(
			categoriesSource,
			categoryCount,
			rowCount
		),
	};
}

function slugifyGameId(value) {
	const slug = String(value || "")
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");

	return slug || "mit-spil";
}

function loadBuilderDraft() {
	try {
		const savedDraft = localStorage.getItem(GAME_BUILDER_STORAGE_KEY);

		if (savedDraft) {
			return normalizeBuilderDraft(JSON.parse(savedDraft));
		}
	} catch (error) {
		console.warn("Could not load builder draft.", error);
	}

	return createDefaultBuilderDraft();
}

function persistBuilderDraft(showStatus) {
	try {
		localStorage.setItem(
			GAME_BUILDER_STORAGE_KEY,
			JSON.stringify(gameBuilderDraft)
		);

		if (showStatus) {
			setBuilderStatus("Kladde gemt.");
		}
	} catch (error) {
		console.warn("Could not save builder draft.", error);
		setBuilderStatus("Kladde kunne ikke gemmes i browseren.");
	}
}

function setBuilderStatus(message) {
	const status = document.getElementById("builder-status");

	if (status) {
		status.textContent = message || "";
	}
}

function toggleQuestionMaker(forceOpen) {
	const maker = document.getElementById("question-maker");
	const toggle = document.getElementById("question-maker-toggle");

	if (!maker) {
		return;
	}

	const shouldOpen =
		typeof forceOpen === "boolean" ? forceOpen : maker.hidden;

	maker.hidden = !shouldOpen;

	if (toggle) {
		toggle.setAttribute("aria-expanded", String(shouldOpen));
	}

	if (shouldOpen) {
		maker.scrollTop = 0;
	}

	if (typeof Reveal !== "undefined" && Reveal.layout) {
		Reveal.layout();
	}
}

function initializeGameBuilder() {
	const maker = document.getElementById("question-maker");
	const title = document.getElementById("builder-title");
	const id = document.getElementById("builder-id");
	const teamsField = document.getElementById("builder-teams");
	const toggle = document.getElementById("question-maker-toggle");
	const adminPassword = document.getElementById("admin-password");

	if (!maker || !title || !id || !teamsField) {
		return;
	}

	if (maker.parentElement !== document.body) {
		document.body.appendChild(maker);
	}

	["click", "keydown", "keyup", "keypress", "wheel", "touchmove"].forEach(
		(eventName) => {
			maker.addEventListener(eventName, (event) => {
				event.stopPropagation();
			});
		}
	);

	gameBuilderDraft = loadBuilderDraft();
	renderBuilderDraft();

	title.oninput = handleBuilderFormInput;
	id.oninput = handleBuilderFormInput;
	teamsField.oninput = handleBuilderFormInput;
	[
		"builder-category-count",
		"builder-row-count",
		"builder-question-points",
		"builder-question-type",
		"builder-question-text",
		"builder-answer-type",
		"builder-answer-text",
		"builder-hints-text",
		"builder-notes-text",
		"builder-background",
		"builder-background-color",
		"builder-background-video",
		"builder-background-iframe",
		"builder-background-interactive",
		"builder-background-video-loop",
		"builder-background-video-muted",
		"builder-transition",
		"builder-class-name",
	].forEach((fieldId) => {
		const field = document.getElementById(fieldId);

		if (field) {
			field.oninput = handleBuilderFormInput;
			field.onchange = handleBuilderFormInput;
		}
	});

	if (toggle) {
		toggle.setAttribute("aria-controls", "question-maker");
		toggle.setAttribute("aria-expanded", "false");
	}

	if (adminPassword) {
		adminPassword.onkeydown = (event) => {
			if (event.key === "Enter") {
				event.preventDefault();
				loginAdmin();
			}
		};
	}

	updateAdminControls();
}

function renderBuilderDraft() {
	const draft = normalizeBuilderDraft(gameBuilderDraft);
	const title = document.getElementById("builder-title");
	const id = document.getElementById("builder-id");
	const teamsField = document.getElementById("builder-teams");
	const categoryCount = document.getElementById("builder-category-count");
	const rowCount = document.getElementById("builder-row-count");
	const setupStage = document.getElementById("builder-setup");
	const boardStage = document.getElementById("builder-board-stage");

	gameBuilderDraft = draft;
	clampBuilderSelection();

	if (!title || !id || !teamsField || !categoryCount || !rowCount) {
		return;
	}

	title.value = draft.title;
	id.value = draft.id;
	teamsField.value = draft.teams.join("\n");
	categoryCount.value = draft.categoryCount;
	rowCount.value = draft.rowCount;

	if (setupStage) {
		setupStage.hidden = draft.boardCreated;
	}

	if (boardStage) {
		boardStage.hidden = !draft.boardCreated;
	}

	renderBuilderBoard();
	renderSelectedBuilderQuestion();
	updateBuilderOutput();
}

function clampBuilderSelection() {
	if (!gameBuilderDraft) {
		builderSelectedCategoryIndex = 0;
		builderSelectedQuestionIndex = 0;
		return;
	}

	builderSelectedCategoryIndex = Math.min(
		Math.max(builderSelectedCategoryIndex, 0),
		Math.max(gameBuilderDraft.categoryCount - 1, 0)
	);
	builderSelectedQuestionIndex = Math.min(
		Math.max(builderSelectedQuestionIndex, 0),
		Math.max(gameBuilderDraft.rowCount - 1, 0)
	);
}

function renderBuilderBoard() {
	const board = document.getElementById("builder-board");

	if (!board || !gameBuilderDraft || !gameBuilderDraft.boardCreated) {
		return;
	}

	board.innerHTML = "";
	board.style.gridTemplateColumns =
		"repeat(" + gameBuilderDraft.categoryCount + ", minmax(120px, 1fr))";

	gameBuilderDraft.categories.forEach((category, categoryIndex) => {
		const categoryInput = document.createElement("input");

		categoryInput.type = "text";
		categoryInput.className = "builder-category-title";
		categoryInput.value = category.title;
		categoryInput.setAttribute(
			"aria-label",
			"Kategori " + (categoryIndex + 1)
		);
		categoryInput.oninput = () => {
			gameBuilderDraft.categories[categoryIndex].title =
				categoryInput.value || "Kategori " + (categoryIndex + 1);
			persistBuilderDraft(false);
			updateBuilderOutput();
			renderSelectedBuilderQuestionTitle();
		};
		board.appendChild(categoryInput);
	});

	for (
		let questionIndex = 0;
		questionIndex < gameBuilderDraft.rowCount;
		questionIndex += 1
	) {
		gameBuilderDraft.categories.forEach((category, categoryIndex) => {
			const question = category.questions[questionIndex];
			const tile = document.createElement("button");
			const title = document.createElement("span");
			const isActive =
				categoryIndex === builderSelectedCategoryIndex &&
				questionIndex === builderSelectedQuestionIndex;

			tile.type = "button";
			tile.className =
				"builder-tile" +
				(isActive ? " active" : "") +
				(question.question && question.answer ? " complete" : "");
			tile.textContent = question.points;
			title.textContent = question.question
				? question.question.slice(0, 36)
				: "Tomt";
			tile.setAttribute(
				"aria-label",
				category.title + " for " + question.points + " point"
			);
			tile.onclick = () =>
				selectBuilderQuestion(categoryIndex, questionIndex);
			tile.appendChild(title);
			board.appendChild(tile);
		});
	}
}

function renderSelectedBuilderQuestionTitle() {
	const heading = document.getElementById("builder-editor-title");
	const category =
		gameBuilderDraft &&
		gameBuilderDraft.categories[builderSelectedCategoryIndex];
	const question =
		category && category.questions[builderSelectedQuestionIndex];

	if (heading && category && question) {
		heading.textContent =
			category.title + " - " + question.points + " point";
	}
}

function renderSelectedBuilderQuestion() {
	const editor = document.getElementById("builder-editor");
	const category =
		gameBuilderDraft &&
		gameBuilderDraft.categories[builderSelectedCategoryIndex];
	const question =
		category && category.questions[builderSelectedQuestionIndex];

	if (!editor) {
		return;
	}

	if (!gameBuilderDraft || !gameBuilderDraft.boardCreated || !question) {
		editor.hidden = true;
		return;
	}

	editor.hidden = false;
	renderSelectedBuilderQuestionTitle();
	setBuilderFieldValue("builder-question-points", question.points);
	setBuilderFieldValue("builder-question-type", question.questionType);
	setBuilderFieldValue("builder-question-text", question.question);
	setBuilderFieldValue("builder-answer-type", question.answerType);
	setBuilderFieldValue("builder-answer-text", question.answer);
	setBuilderFieldValue("builder-hints-text", question.hints);
	setBuilderFieldValue("builder-notes-text", question.notes);
	setBuilderFieldValue("builder-background", question.background);
	setBuilderFieldValue("builder-background-color", question.backgroundColor);
	setBuilderFieldValue("builder-background-video", question.backgroundVideo);
	setBuilderFieldValue("builder-background-iframe", question.backgroundIframe);
	setBuilderFieldValue("builder-transition", question.transition);
	setBuilderFieldValue("builder-class-name", question.className);
	setBuilderCheckedValue(
		"builder-background-interactive",
		question.backgroundInteractive
	);
	setBuilderCheckedValue(
		"builder-background-video-loop",
		question.backgroundVideoLoop
	);
	setBuilderCheckedValue(
		"builder-background-video-muted",
		question.backgroundVideoMuted
	);
}

function setBuilderFieldValue(fieldId, value) {
	const field = document.getElementById(fieldId);

	if (field) {
		field.value = value === undefined || value === null ? "" : value;
	}
}

function setBuilderCheckedValue(fieldId, value) {
	const field = document.getElementById(fieldId);

	if (field) {
		field.checked = Boolean(value);
	}
}

function buildQuestionMakerBoard() {
	gameBuilderDraft = readBuilderDraftFromForm();
	gameBuilderDraft.boardCreated = true;
	gameBuilderDraft.categories = normalizeBuilderCategories(
		gameBuilderDraft.categories,
		gameBuilderDraft.categoryCount,
		gameBuilderDraft.rowCount
	);
	builderSelectedCategoryIndex = 0;
	builderSelectedQuestionIndex = 0;
	persistBuilderDraft(false);
	renderBuilderDraft();
	setBuilderStatus("Boardet er klar. Tryk på en celle for at udfylde den.");
	toggleQuestionMaker(true);
}

function editQuestionMakerSetup() {
	gameBuilderDraft = readBuilderDraftFromForm();
	gameBuilderDraft.boardCreated = false;
	persistBuilderDraft(false);
	renderBuilderDraft();
	setBuilderStatus("Ret antal kategorier eller rækker og tryk Lav board igen.");
	toggleQuestionMaker(true);
}

function selectBuilderQuestion(categoryIndex, questionIndex) {
	saveSelectedBuilderQuestionFromForm();
	builderSelectedCategoryIndex = categoryIndex;
	builderSelectedQuestionIndex = questionIndex;
	renderBuilderBoard();
	renderSelectedBuilderQuestion();
	setBuilderStatus("");
}

function saveSelectedBuilderQuestionFromForm() {
	if (!gameBuilderDraft || !gameBuilderDraft.boardCreated) {
		return;
	}

	const category =
		gameBuilderDraft.categories[builderSelectedCategoryIndex];
	const question =
		category && category.questions[builderSelectedQuestionIndex];

	if (!question) {
		return;
	}

	question.points =
		Number(document.getElementById("builder-question-points")?.value) ||
		question.points;
	question.questionType =
		document.getElementById("builder-question-type")?.value || "question";
	question.question =
		document.getElementById("builder-question-text")?.value || "";
	question.answerType =
		document.getElementById("builder-answer-type")?.value || "answer";
	question.answer =
		document.getElementById("builder-answer-text")?.value || "";
	question.hints =
		document.getElementById("builder-hints-text")?.value || "";
	question.notes =
		document.getElementById("builder-notes-text")?.value || "";
	question.background =
		document.getElementById("builder-background")?.value.trim() || "";
	question.backgroundColor =
		document.getElementById("builder-background-color")?.value.trim() || "";
	question.backgroundVideo =
		document.getElementById("builder-background-video")?.value.trim() || "";
	question.backgroundIframe = createYouTubeEmbedUrl(
		document.getElementById("builder-background-iframe")?.value.trim() ||
			""
	);
	question.backgroundInteractive = Boolean(
		document.getElementById("builder-background-interactive")?.checked
	);
	question.backgroundVideoLoop =
		document.getElementById("builder-background-video-loop")?.checked !==
		false;
	question.backgroundVideoMuted =
		document.getElementById("builder-background-video-muted")?.checked !==
		false;
	question.transition =
		document.getElementById("builder-transition")?.value || "";
	question.className =
		document.getElementById("builder-class-name")?.value.trim() || "";
}

function renderBuilderCategory(category, categoryIndex) {
	const wrapper = document.createElement("div");
	const header = document.createElement("div");
	const label = document.createElement("label");
	const title = document.createElement("input");
	const removeButton = document.createElement("button");
	const questionList = document.createElement("div");
	const addButton = document.createElement("button");

	wrapper.className = "builder-category";
	wrapper.dataset.categoryIndex = String(categoryIndex);
	header.className = "builder-category-header";
	label.setAttribute("for", "builder-category-" + categoryIndex);
	label.textContent = "Kategori " + (categoryIndex + 1);
	title.id = "builder-category-" + categoryIndex;
	title.type = "text";
	title.className = "builder-category-title";
	title.value = category.title;
	removeButton.className = "game-button reset builder-small-button";
	removeButton.type = "button";
	removeButton.textContent = "Fjern";
	removeButton.onclick = () => removeBuilderCategory(categoryIndex);
	removeButton.disabled = gameBuilderDraft.categories.length <= 1;
	questionList.className = "builder-question-list";

	category.questions.forEach((question, questionIndex) => {
		questionList.appendChild(
			renderBuilderQuestion(question, categoryIndex, questionIndex)
		);
	});

	addButton.className = "game-button secondary builder-small-button";
	addButton.type = "button";
	addButton.textContent = "Nyt spørgsmål";
	addButton.onclick = () => addBuilderQuestion(categoryIndex);

	header.appendChild(label);
	header.appendChild(removeButton);
	wrapper.appendChild(header);
	wrapper.appendChild(title);
	wrapper.appendChild(questionList);
	wrapper.appendChild(addButton);

	return wrapper;
}

function renderBuilderQuestion(question, categoryIndex, questionIndex) {
	const wrapper = document.createElement("div");
	const header = document.createElement("div");
	const label = document.createElement("label");
	const removeButton = document.createElement("button");
	const pointsLabel = document.createElement("label");
	const points = document.createElement("input");
	const questionLabel = document.createElement("label");
	const questionText = document.createElement("textarea");
	const answerLabel = document.createElement("label");
	const answerText = document.createElement("textarea");
	const hintsLabel = document.createElement("label");
	const hintsText = document.createElement("textarea");
	const idBase =
		"builder-c" + categoryIndex + "-q" + questionIndex;

	wrapper.className = "builder-question";
	wrapper.dataset.questionIndex = String(questionIndex);
	header.className = "builder-question-header";
	label.textContent = "Spørgsmål " + (questionIndex + 1);
	removeButton.className = "game-button reset builder-small-button";
	removeButton.type = "button";
	removeButton.textContent = "Fjern";
	removeButton.onclick = () =>
		removeBuilderQuestion(categoryIndex, questionIndex);
	removeButton.disabled =
		gameBuilderDraft.categories[categoryIndex].questions.length <= 1;

	pointsLabel.setAttribute("for", idBase + "-points");
	pointsLabel.textContent = "Point";
	points.id = idBase + "-points";
	points.type = "number";
	points.min = "0";
	points.step = "100";
	points.className = "builder-question-points";
	points.value = question.points;

	questionLabel.setAttribute("for", idBase + "-question");
	questionLabel.textContent = "Spørgsmål";
	questionText.id = idBase + "-question";
	questionText.className = "builder-question-text";
	questionText.value = question.question;

	answerLabel.setAttribute("for", idBase + "-answer");
	answerLabel.textContent = "Svar";
	answerText.id = idBase + "-answer";
	answerText.className = "builder-answer-text";
	answerText.value = question.answer;

	hintsLabel.setAttribute("for", idBase + "-hints");
	hintsLabel.textContent = "Hints, en per linje";
	hintsText.id = idBase + "-hints";
	hintsText.className = "builder-hints-text";
	hintsText.value = question.hints;

	header.appendChild(label);
	header.appendChild(removeButton);
	wrapper.appendChild(header);
	wrapper.appendChild(pointsLabel);
	wrapper.appendChild(points);
	wrapper.appendChild(questionLabel);
	wrapper.appendChild(questionText);
	wrapper.appendChild(answerLabel);
	wrapper.appendChild(answerText);
	wrapper.appendChild(hintsLabel);
	wrapper.appendChild(hintsText);

	return wrapper;
}

function handleBuilderFormInput() {
	gameBuilderDraft = readBuilderDraftFromForm();
	clampBuilderSelection();
	persistBuilderDraft(false);
	renderBuilderBoard();
	renderSelectedBuilderQuestionTitle();
	updateBuilderOutput();
}

function readBuilderDraftFromForm() {
	const title = document.getElementById("builder-title");
	const id = document.getElementById("builder-id");
	const teamsField = document.getElementById("builder-teams");
	const categoryCount = document.getElementById("builder-category-count");
	const rowCount = document.getElementById("builder-row-count");
	const teamNames = (teamsField ? teamsField.value : "")
		.split(/\r?\n/)
		.map((team) => team.trim())
		.filter(Boolean);
	const sourceDraft = gameBuilderDraft || createDefaultBuilderDraft();

	saveSelectedBuilderQuestionFromForm();

	return normalizeBuilderDraft({
		title: title && title.value.trim() ? title.value.trim() : "Mit Jeopardy Spil",
		id: id && id.value.trim() ? id.value.trim() : "mit-spil",
		teams: teamNames.length ? teamNames : ["Team 1", "Team 2", "Team 3"],
		categoryCount: clampBuilderCount(categoryCount ? categoryCount.value : 3, 3),
		rowCount: clampBuilderCount(rowCount ? rowCount.value : 5, 5),
		boardCreated: sourceDraft.boardCreated,
		categories: sourceDraft.categories,
	});
}

function addBuilderCategory() {
	gameBuilderDraft = readBuilderDraftFromForm();
	gameBuilderDraft.categories.push(
		createDefaultBuilderCategory(
			gameBuilderDraft.categories.length + 1,
			gameBuilderDraft.rowCount
		)
	);
	persistBuilderDraft(false);
	renderBuilderDraft();
	toggleQuestionMaker(true);
}

function removeBuilderCategory(categoryIndex) {
	gameBuilderDraft = readBuilderDraftFromForm();

	if (gameBuilderDraft.categories.length <= 1) {
		return;
	}

	gameBuilderDraft.categories.splice(categoryIndex, 1);
	persistBuilderDraft(false);
	renderBuilderDraft();
	toggleQuestionMaker(true);
}

function addBuilderQuestion(categoryIndex) {
	gameBuilderDraft = readBuilderDraftFromForm();
	const category = gameBuilderDraft.categories[categoryIndex];

	if (!category) {
		return;
	}

	category.questions.push(
		createDefaultBuilderQuestion((category.questions.length + 1) * 100)
	);
	persistBuilderDraft(false);
	renderBuilderDraft();
	toggleQuestionMaker(true);
}

function removeBuilderQuestion(categoryIndex, questionIndex) {
	gameBuilderDraft = readBuilderDraftFromForm();
	const category = gameBuilderDraft.categories[categoryIndex];

	if (!category || category.questions.length <= 1) {
		return;
	}

	category.questions.splice(questionIndex, 1);
	persistBuilderDraft(false);
	renderBuilderDraft();
	toggleQuestionMaker(true);
}

function saveBuilderDraft() {
	gameBuilderDraft = readBuilderDraftFromForm();
	persistBuilderDraft(true);
	renderBuilderBoard();
	updateBuilderOutput();
}

function resetBuilderDraft() {
	if (!window.confirm("Reset question maker kladde?")) {
		return;
	}

	gameBuilderDraft = createDefaultBuilderDraft();
	builderSelectedCategoryIndex = 0;
	builderSelectedQuestionIndex = 0;
	persistBuilderDraft(false);
	renderBuilderDraft();
	setBuilderStatus("Kladde nulstillet.");
	toggleQuestionMaker(true);
}

function getQuestionBuilderValue(question, fields) {
	for (const field of fields) {
		if (typeof question[field] === "string" && question[field].trim()) {
			return question[field].trim();
		}
	}

	return "";
}

function loadCurrentGameIntoBuilder() {
	gameBuilderDraft = normalizeBuilderDraft({
		title: gameConfig.title,
		id: gameConfig.id,
		teams: teams.map((team) => team.name),
		categoryCount: categories.length,
		rowCount: getQuestionRowCount(),
		boardCreated: true,
		categories: categories.map((category) => ({
			title: category.title,
			questions: category.questions.map((question) => ({
				points: question.points,
				...question,
			})),
		})),
	});
	builderSelectedCategoryIndex = 0;
	builderSelectedQuestionIndex = 0;
	persistBuilderDraft(false);
	renderBuilderDraft();
	setBuilderStatus("Valgt game er hentet ind i question maker.");
	toggleQuestionMaker(true);
}

function buildGameFromBuilderDraft(draft) {
	const normalizedDraft = normalizeBuilderDraft(draft);

	return {
		id: slugifyGameId(normalizedDraft.id || normalizedDraft.title),
		title: normalizedDraft.title,
		teams: normalizedDraft.teams,
		categories: normalizedDraft.categories.map((category) => ({
			title: category.title,
			questions: category.questions.map((question, index) => {
				const hints = String(question.hints || "")
					.split(/\r?\n/)
					.map((hint) => hint.trim())
					.filter(Boolean);
				const outputQuestion = {
					points: Number(question.points) || (index + 1) * 100,
				};
				const questionField = question.questionType || "question";
				const answerField = question.answerType || "answer";

				outputQuestion[questionField] = question.question;
				outputQuestion[answerField] = question.answer;

				if (hints.length) {
					outputQuestion.hints = hints;
				}

				if (question.notes) {
					outputQuestion.notes = question.notes;
				}

				if (question.background) {
					outputQuestion.background = question.background;
				}

				if (question.backgroundColor) {
					outputQuestion.backgroundColor = question.backgroundColor;
				}

				if (question.backgroundVideo) {
					outputQuestion.backgroundVideo = question.backgroundVideo;
					outputQuestion.backgroundVideoLoop =
						question.backgroundVideoLoop !== false;
					outputQuestion.backgroundVideoMuted =
						question.backgroundVideoMuted !== false;
				}

				if (question.backgroundIframe) {
					outputQuestion.backgroundIframe = question.backgroundIframe;
				}

				if (question.backgroundInteractive) {
					outputQuestion.backgroundInteractive = true;
				}

				if (question.transition) {
					outputQuestion.transition = question.transition;
				}

				if (question.className) {
					outputQuestion.className = question.className;
				}

				return outputQuestion;
			}),
		})),
	};
}

function serializeBuilderGame(draft) {
	return JSON.stringify(buildGameFromBuilderDraft(draft), null, "\t") + "\n";
}

function getBuilderGameId() {
	return slugifyGameId(gameBuilderDraft.id || gameBuilderDraft.title);
}

function updateBuilderOutput() {
	const output = document.getElementById("builder-output");

	if (output && gameBuilderDraft) {
		output.value = serializeBuilderGame(gameBuilderDraft);
	}
}

async function saveBuilderFile() {
	gameBuilderDraft = readBuilderDraftFromForm();
	persistBuilderDraft(false);

	const game = buildGameFromBuilderDraft(gameBuilderDraft);

	try {
		if (!isAdmin()) {
			setBuilderStatus("Log ind som admin for at gemme spil.");
			return;
		}

		await fetchJson("/api/games/" + encodeURIComponent(game.id), {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(game),
		});

		availableGames = await fetchJson("/api/games");
		setBuilderStatus("Spillet er gemt på serveren.");

		if (game.id !== gameKey) {
			window.location.href = getGameUrl(game.id);
			return;
		}

		window.JEOPARDY_GAME = await fetchJson(
			"/api/games/" + encodeURIComponent(game.id)
		);
		initializeGameData();
		renderHome();
		renderGame();
		loadGameState();
	} catch (error) {
		console.warn("Could not save game.", error);
		setBuilderStatus("Spillet kunne ikke gemmes: " + error.message);
	}

	updateBuilderOutput();
}

function getBuilderContentFields(target) {
	const isAnswer = target === "answer";

	return {
		type: document.getElementById(
			isAnswer ? "builder-answer-type" : "builder-question-type"
		),
		text: document.getElementById(
			isAnswer ? "builder-answer-text" : "builder-question-text"
		),
		htmlType: isAnswer ? "answerHtml" : "html",
		markdownType: isAnswer ? "answerMarkdown" : "markdown",
	};
}

function setBuilderContentType(target, type) {
	const fields = getBuilderContentFields(target);

	if (fields.type) {
		fields.type.value = type;
		fields.type.dispatchEvent(new Event("change", { bubbles: true }));
	}
}

function appendTextToField(field, text) {
	const currentValue = field.value.trimEnd();

	field.value = currentValue ? currentValue + "\n\n" + text : text;
	field.dispatchEvent(new Event("input", { bubbles: true }));
}

function insertBuilderSnippet(target, snippetType) {
	const fields = getBuilderContentFields(target);
	let snippet = "";

	if (!fields.text) {
		return;
	}

	if (snippetType === "youtube") {
		const url = window.prompt("YouTube-link eller embed-link");

		if (!url) {
			return;
		}

		setBuilderContentType(target, fields.htmlType);
		snippet = createYouTubeIframe(url);
	}

	if (snippetType === "video") {
		const src = window.prompt("Sti til lokal video", "examples/assets/video.mp4");

		if (!src) {
			return;
		}

		setBuilderContentType(target, fields.htmlType);
		snippet =
			'<video src="' +
			escapeHtmlAttribute(src) +
			'" controls data-autoplay></video>';
	}

	if (snippetType === "audio") {
		const src = window.prompt("Sti til lydklip", "examples/assets/beeping.wav");

		if (!src) {
			return;
		}

		setBuilderContentType(target, fields.htmlType);
		snippet =
			'<audio src="' + escapeHtmlAttribute(src) + '" controls></audio>';
	}

	if (snippetType === "image") {
		const src = window.prompt("Billed-URL eller lokal sti", "/uploads/billede.webp");

		if (!src) {
			return;
		}

		const alt = window.prompt("Billedtekst", "Billede") || "Billede";

		if (fields.type && fields.type.value === fields.markdownType) {
			snippet = "![" + alt.replace(/]/g, "\\]") + "](" + src + ")";
		} else {
			setBuilderContentType(target, fields.htmlType);
			snippet =
				'<img src="' +
				escapeHtmlAttribute(src) +
				'" alt="' +
				escapeHtmlAttribute(alt) +
				'">';
		}
	}

	if (snippetType === "math") {
		const formula = window.prompt("LaTeX formel", "\\frac{a}{b}");

		if (!formula) {
			return;
		}

		setBuilderContentType(target, fields.htmlType);
		snippet = "<p>$$" + formula + "$$</p>";
	}

	if (snippet) {
		appendTextToField(fields.text, snippet);
		handleBuilderFormInput();
		setBuilderStatus("Indholdet er indsat.");
	}
}

async function uploadBuilderImage() {
	const input = document.getElementById("builder-image-upload");
	const questionType = document.getElementById("builder-question-type");
	const questionText = document.getElementById("builder-question-text");

	if (!isAdmin()) {
		setBuilderStatus("Log ind som admin for at uploade billeder.");
		return;
	}

	if (!input || !input.files || !input.files[0] || !questionText) {
		setBuilderStatus("Vælg et billede først.");
		return;
	}

	const formData = new FormData();
	const file = input.files[0];

	formData.append("file", file);

	try {
		const uploaded = await fetchJson("/api/uploads", {
			method: "POST",
			body: formData,
		});
		const alt = escapeHtmlAttribute(file.name.replace(/\.[^.]+$/, ""));

		if (questionType && questionType.value === "markdown") {
			appendTextToField(questionText, "![" + alt + "](" + uploaded.url + ")");
		} else {
			if (questionType) {
				questionType.value = "html";
			}

			appendTextToField(
				questionText,
				'<img src="' + escapeHtmlAttribute(uploaded.url) + '" alt="' + alt + '">'
			);
		}

		input.value = "";
		handleBuilderFormInput();
		setBuilderStatus("Billedet er uploadet og indsat i spørgsmålet.");
	} catch (error) {
		console.warn("Could not upload image.", error);
		setBuilderStatus("Billedet kunne ikke uploades: " + error.message);
	}
}

async function copyBuilderRegistration() {
	gameBuilderDraft = readBuilderDraftFromForm();
	persistBuilderDraft(false);

	const key = getBuilderGameId();
	const registration = key + ".json";

	try {
		await navigator.clipboard.writeText(registration);
		setBuilderStatus("JSON-filnavn kopieret: " + registration.trim());
	} catch (error) {
		console.warn("Could not copy game registration.", error);
		setBuilderStatus(registration.trim());
	}
}

