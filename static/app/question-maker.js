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
		question: createRichContent("", "rich"),
		answer: createRichContent("", "rich"),
		hints: "",
		notes: "",
		media: null,
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
	const questionContent = normalizeRichContent(source.question || "");
	const answerContent = normalizeRichContent(source.answer || "");
	const media = normalizeMedia(source.media);

	return {
		points: Number(source.points) || (index + 1) * 100,
		question: questionContent,
		answer: answerContent,
		hints: Array.isArray(source.hints)
			? source.hints
					.map((hint) =>
						typeof hint === "object" ? hint.content || "" : hint
					)
					.join("\n")
			: String(source.hints || ""),
		notes: String(source.notes || source.notesHtml || ""),
		media,
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
		"builder-question-text",
		"builder-question-html",
		"builder-answer-text",
		"builder-answer-html",
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

	["question", "answer"].forEach((target) => {
		const preview = document.getElementById("builder-" + target + "-preview");

		if (preview) {
			preview.onclick = () => toggleBuilderCodeEditor(target);
			preview.onkeydown = (event) => {
				if (event.key === "Enter" || event.key === " ") {
					event.preventDefault();
					toggleBuilderCodeEditor(target);
				}
			};
		}
	});

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
				(hasBuilderQuestionContent(question) && hasBuilderAnswerContent(question) ? " complete" : "");
			tile.textContent = question.points;
			title.textContent = getBuilderContentSummary(question.question)
				? getBuilderContentSummary(question.question).slice(0, 36)
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

function getBuilderContentSummary(content) {
	return normalizeRichContent(content).content.trim();
}

function hasBuilderQuestionContent(question) {
	return Boolean(getBuilderContentSummary(question && question.question));
}

function hasBuilderAnswerContent(question) {
	return Boolean(getBuilderContentSummary(question && question.answer));
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
	setBuilderContentEditorValue("question", question.question);
	setBuilderContentEditorValue("answer", question.answer);
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
	setBuilderCodeMode("question", false);
	setBuilderCodeMode("answer", false);
	renderBuilderPreview();
}

function setBuilderContentEditorValue(target, content) {
	const normalized = normalizeRichContent(content);
	const elements = getBuilderEditorElements(target);

	setBuilderFieldValue("builder-" + target + "-text", normalized.content);
	setBuilderFieldValue(
		"builder-" + target + "-html",
		normalized.format === "html" ? normalized.content : ""
	);

	if (elements.wrapper) {
		elements.wrapper.dataset.contentFormat = normalized.format;
	}
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
	question.question = readBuilderRichContent("question");
	question.answer = readBuilderRichContent("answer");
	question.hints =
		document.getElementById("builder-hints-text")?.value || "";
	question.notes =
		document.getElementById("builder-notes-text")?.value || "";
	question.media = null;
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

function readBuilderRichContent(target) {
	const text = document.getElementById("builder-" + target + "-text")?.value || "";
	const html = document.getElementById("builder-" + target + "-html")?.value || "";
	const elements = getBuilderEditorElements(target);
	const format =
		(elements.wrapper && elements.wrapper.dataset.contentFormat === "html") ||
		(!text.trim() && html.trim())
			? "html"
			: "rich";
	const content = text || html;

	return createRichContent(content, format);
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
	questionText.value = getBuilderContentSummary(question.question);

	answerLabel.setAttribute("for", idBase + "-answer");
	answerLabel.textContent = "Svar";
	answerText.id = idBase + "-answer";
	answerText.className = "builder-answer-text";
	answerText.value = getBuilderContentSummary(question.answer);

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
	renderBuilderPreview();
	updateBuilderOutput();
}

function getBuilderEditorElements(target) {
	return {
		wrapper: document.querySelector('[data-builder-editor="' + target + '"]'),
		textarea: document.getElementById("builder-" + target + "-text"),
		preview: document.getElementById("builder-" + target + "-preview"),
		toggle: document.getElementById("builder-" + target + "-code-toggle"),
	};
}

function setBuilderCodeMode(target, enabled) {
	const elements = getBuilderEditorElements(target);
	const isEnabled = Boolean(enabled);

	if (!elements.wrapper || !elements.textarea || !elements.preview) {
		return;
	}

	elements.wrapper.dataset.codeMode = isEnabled ? "true" : "false";
	elements.textarea.hidden = !isEnabled;
	elements.preview.hidden = isEnabled;

	if (elements.toggle) {
		elements.toggle.textContent = isEnabled ? "Vis preview" : "Vis kode";
		elements.toggle.setAttribute("aria-pressed", String(isEnabled));
	}
}

function toggleBuilderCodeEditor(target) {
	const elements = getBuilderEditorElements(target);
	const isCodeMode =
		elements.wrapper && elements.wrapper.dataset.codeMode === "true";

	setBuilderCodeMode(target, !isCodeMode);

	const nextElements = getBuilderEditorElements(target);
	const focusTarget = !isCodeMode ? nextElements.textarea : nextElements.preview;

	if (focusTarget) {
		focusTarget.focus();
	}
}

globalThis.toggleBuilderCodeEditor = toggleBuilderCodeEditor;

function renderBuilderPreview() {
	const questionPreview = document.getElementById("builder-question-preview");
	const answerPreview = document.getElementById("builder-answer-preview");
	const category =
		gameBuilderDraft &&
		gameBuilderDraft.categories[builderSelectedCategoryIndex];
	const question =
		category && category.questions[builderSelectedQuestionIndex];

	if (!questionPreview || !answerPreview || !question) {
		return;
	}

	questionPreview.innerHTML = "";
	answerPreview.innerHTML = "";
	renderQuestionPart(questionPreview, question, "question");
	renderQuestionMedia(questionPreview, question.media);
	renderQuestionHints(questionPreview, question.hints);
	renderQuestionPart(answerPreview, question, "answer");
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
					question: normalizeRichContent(question.question),
					answer: normalizeRichContent(question.answer),
				};

				if (hints.length) {
					outputQuestion.hints = hints.map((hint) =>
						createRichContent(hint, "rich")
					);
				}

				if (question.media) {
					outputQuestion.media = normalizeMedia(question.media);
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
	return {
		text: document.getElementById("builder-" + target + "-text"),
		html: document.getElementById("builder-" + target + "-html"),
	};
}

function appendTextToField(field, text) {
	const currentValue = field.value.trimEnd();

	field.value = currentValue ? currentValue + "\n\n" + text : text;
	field.dispatchEvent(new Event("input", { bubbles: true }));
}

function createBuilderMediaSnippet(type, attributes) {
	const pairs = Object.entries(attributes)
		.filter(([, value]) => value !== undefined && value !== null)
		.map(([name, value]) => name + '="' + String(value).replace(/"/g, "&quot;") + '"');

	return "::" + type + " " + pairs.join(" ") + "::";
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

		snippet = createBuilderMediaSnippet("youtube", {
			url,
			start: 0,
			end: "",
			autoplay: false,
			loop: false,
			controls: true,
			muted: false,
		});
	}

	if (snippetType === "video") {
		const src = window.prompt("Sti til lokal video", "examples/assets/video.mp4");

		if (!src) {
			return;
		}

		snippet = createBuilderMediaSnippet("video", {
			src,
			start: 0,
			autoplay: false,
			loop: false,
			controls: true,
			muted: false,
		});
	}

	if (snippetType === "audio") {
		const src = window.prompt("Sti til lydklip", "examples/assets/beeping.wav");

		if (!src) {
			return;
		}

		snippet = createBuilderMediaSnippet("audio", {
			src,
			autoplay: false,
			loop: false,
			controls: true,
			muted: false,
		});
	}

	if (snippetType === "image") {
		const src = window.prompt("Billed-URL eller lokal sti", "/uploads/billede.webp");

		if (!src) {
			return;
		}

		const alt = window.prompt("Billedtekst", "Billede") || "Billede";

		snippet = "![" + alt.replace(/]/g, "\\]") + "](" + src + ")";
	}

	if (snippetType === "math") {
		const formula = window.prompt("LaTeX formel", "\\frac{a}{b}");

		if (!formula) {
			return;
		}

		snippet = "$$" + formula + "$$";
	}

	if (snippet) {
		appendTextToField(fields.text, snippet);
		handleBuilderFormInput();
		setBuilderStatus("Indholdet er indsat i " + (target === "answer" ? "svaret." : "spørgsmålet."));
	}
}

async function legacyDirectImageUploadRemoved(target) {
	setBuilderStatus("Upload filer fra den fælles uploadfil-menu.");
	return;

	const contentTarget = target === "answer" ? "answer" : "question";
	const input = document.getElementById(
		contentTarget === "answer"
			? "removed-answer-image-upload"
			: "removed-question-image-upload"
	);
	const contentText = document.getElementById("builder-" + contentTarget + "-text");

	if (!isAdmin()) {
		setBuilderStatus("Log ind som admin for at uploade billeder.");
		return;
	}

	if (!input || !input.files || !input.files[0] || !contentText) {
		setBuilderStatus("Vælg et billede først.");
		return;
	}

	const formData = new FormData();
	const file = input.files[0];

	formData.append("file", file);

	try {
		const uploaded = await fetchJson("/api/direct-builder-upload-removed", {
			method: "POST",
			body: formData,
		});
		const alt = escapeHtmlAttribute(file.name.replace(/\.[^.]+$/, ""));

		appendTextToField(contentText, "![" + alt + "](" + uploaded.url + ")");

		input.value = "";
		handleBuilderFormInput();
		setBuilderStatus(
			"Billedet er uploadet og indsat i " +
				(contentTarget === "answer" ? "svaret." : "spørgsmålet.")
		);
	} catch (error) {
		console.warn("Could not upload image.", error);
		setBuilderStatus("Billedet kunne ikke uploades: " + error.message);
	}
}

async function legacyDirectVideoUploadRemoved(target) {
	setBuilderStatus("Upload filer fra den fælles uploadfil-menu.");
	return;

	const contentTarget = target === "answer" ? "answer" : "question";
	const input = document.getElementById(
		contentTarget === "answer"
			? "removed-answer-video-upload"
			: "removed-question-video-upload"
	);
	const contentText = document.getElementById("builder-" + contentTarget + "-text");

	if (!isAdmin()) {
		setBuilderStatus("Log ind som admin for at uploade videoer.");
		return;
	}

	if (!input || !input.files || !input.files[0] || !contentText) {
		setBuilderStatus("Vælg en video først.");
		return;
	}

	const formData = new FormData();

	formData.append("file", input.files[0]);

	try {
		const uploaded = await fetchJson("/api/direct-builder-upload-removed", {
			method: "POST",
			body: formData,
		});

		appendTextToField(
			contentText,
			createBuilderMediaSnippet("video", {
				src: uploaded.url,
				start: 0,
				autoplay: false,
				loop: false,
				controls: true,
				muted: false,
			})
		);
		input.value = "";
		handleBuilderFormInput();
		setBuilderStatus(
			"Videoen er uploadet og indsat i " +
				(contentTarget === "answer" ? "svaret." : "spørgsmålet.")
		);
	} catch (error) {
		console.warn("Could not upload video.", error);
		setBuilderStatus("Videoen kunne ikke uploades: " + error.message);
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
