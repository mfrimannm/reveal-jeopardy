const KANUUNTT_MAKER_STORAGE_KEY = "reveal-jeopardy-kanuuntt-maker-draft";
const KANUUNTT_ANSWER_IDS = ["a", "b", "c", "d"];

let kanuunttMakerDraft = null;
let kanuunttSelectedQuestionIndex = 0;

function createDefaultKanuunttQuestion(index) {
	return {
		prompt: "Spørgsmål " + index,
		timeLimitSeconds: 30,
		points: 1000,
		answers: [
			{ id: "a", text: "Svar A", correct: true },
			{ id: "b", text: "Svar B", correct: false },
			{ id: "c", text: "Svar C", correct: false },
			{ id: "d", text: "Svar D", correct: false },
		],
	};
}

function getKanuunttLegacyMediaSnippet(mediaType, mediaSrc) {
	const type = String(mediaType || "").trim();
	const src = String(mediaSrc || "").trim();

	if (!type || !src) {
		return "";
	}

	if (type === "image") {
		return "![Billede](" + src + ")";
	}

	if (type === "video" || type === "audio") {
		return createKanuunttMakerMediaSnippet(type, {
			src,
			start: type === "video" ? 0 : undefined,
			autoplay: false,
			loop: false,
			controls: true,
			muted: false,
		});
	}

	return src;
}

function getKanuunttPromptWithLegacyMedia(source, index) {
	const prompt = String(source.prompt || "Spørgsmål " + (index + 1));
	const media = source.media && typeof source.media === "object" ? source.media : null;
	const mediaType = media ? String(media.type || "") : String(source.mediaType || "");
	const mediaSrc = media ? String(media.src || "") : String(source.mediaSrc || "");
	const snippet = getKanuunttLegacyMediaSnippet(mediaType, mediaSrc);

	if (!snippet || prompt.includes(mediaSrc)) {
		return prompt;
	}

	return prompt.trim() ? prompt.trim() + "\n\n" + snippet : snippet;
}

function createDefaultKanuunttDraft() {
	return {
		title: "Mit KanUUNTt",
		id: "mit-kanuuntt",
		teams: ["Red", "Blue"],
		questions: [createDefaultKanuunttQuestion(1)],
	};
}

function normalizeKanuunttQuestion(rawQuestion, index) {
	const source = rawQuestion && typeof rawQuestion === "object" ? rawQuestion : {};
	const answers = Array.isArray(source.answers) && source.answers.length >= 2
		? source.answers.slice(0, 4)
		: createDefaultKanuunttQuestion(index + 1).answers;
	const correctAnswerId =
		answers.find((answer) => answer && answer.correct)?.id || answers[0]?.id || "a";

	return {
		prompt: getKanuunttPromptWithLegacyMedia(source, index),
		timeLimitSeconds: Math.max(5, Number(source.timeLimitSeconds || 30)),
		points: Math.max(0, Number(source.points || 1000)),
		answers: answers.map((answer, answerIndex) => ({
			id: KANUUNTT_ANSWER_IDS[answerIndex],
			text: String((answer && answer.text) || "Svar " + KANUUNTT_ANSWER_IDS[answerIndex].toUpperCase()),
			correct: (answer && answer.id) === correctAnswerId,
		})),
	};
}

function normalizeKanuunttDraft(rawDraft) {
	const source = rawDraft && typeof rawDraft === "object" ? rawDraft : {};
	const questions = Array.isArray(source.quiz_questions)
		? source.quiz_questions
		: source.questions;

	return {
		title: String(source.title || "Mit KanUUNTt"),
		id: slugifyGameId(source.id || source.title || "mit-kanuuntt"),
		teams:
			Array.isArray(source.teams) && source.teams.length
				? source.teams.map((team, index) => String(team || "Team " + (index + 1)))
				: ["Red", "Blue"],
		questions:
			Array.isArray(questions) && questions.length
				? questions.map(normalizeKanuunttQuestion)
				: [createDefaultKanuunttQuestion(1)],
	};
}

function loadKanuunttMakerDraft() {
	try {
		const saved = localStorage.getItem(KANUUNTT_MAKER_STORAGE_KEY);

		if (saved) {
			return normalizeKanuunttDraft(JSON.parse(saved));
		}
	} catch (error) {
		console.warn("Could not load KanUUNTt maker draft.", error);
	}

	return createDefaultKanuunttDraft();
}

function persistKanuunttMakerDraft() {
	try {
		localStorage.setItem(KANUUNTT_MAKER_STORAGE_KEY, JSON.stringify(kanuunttMakerDraft));
	} catch (error) {
		console.warn("Could not save KanUUNTt maker draft.", error);
	}
}

function clampKanuunttSelection() {
	if (!kanuunttMakerDraft || !Array.isArray(kanuunttMakerDraft.questions)) {
		kanuunttSelectedQuestionIndex = 0;
		return;
	}

	kanuunttSelectedQuestionIndex = Math.min(
		Math.max(kanuunttSelectedQuestionIndex, 0),
		Math.max(kanuunttMakerDraft.questions.length - 1, 0)
	);
}

function setKanuunttMakerStatus(message) {
	const status = document.getElementById("kanuuntt-maker-status");

	if (status) {
		status.textContent = message || "";
	}
}

function updateKanuunttAdminStatus() {
	const status = document.getElementById("kanuuntt-admin-status");
	const saveButton = document.getElementById("kanuuntt-maker-save");

	if (status) {
		status.textContent = isAdmin()
			? "Logget ind som admin. Du kan gemme KanUUNTt-spil."
			: "Log ind som admin for at gemme KanUUNTt-spil.";
	}

	if (saveButton) {
		saveButton.disabled = !isAdmin();
	}
}

function toggleKanuunttMaker(forceOpen) {
	const maker = document.getElementById("kanuuntt-maker");

	if (!maker) {
		return;
	}

	const shouldOpen = typeof forceOpen === "boolean" ? forceOpen : maker.hidden;

	maker.hidden = !shouldOpen;
	if (shouldOpen) {
		maker.scrollTop = 0;
	}
	if (typeof Reveal !== "undefined" && Reveal.layout) {
		Reveal.layout();
	}
}

function readKanuunttMakerDraftFromQuestionListLegacy() {
	const title = document.getElementById("kanuuntt-maker-title");
	const id = document.getElementById("kanuuntt-maker-id");
	const teams = document.getElementById("kanuuntt-maker-teams");
	const teamNames = (teams ? teams.value : "")
		.split(/\r?\n/)
		.map((team) => team.trim())
		.filter(Boolean);
	const questions = Array.from(document.querySelectorAll(".kanuuntt-maker-question")).map((wrapper, questionIndex) => {
		const answers = Array.from(wrapper.querySelectorAll(".kanuuntt-maker-answer")).map((answerWrapper, answerIndex) => ({
			id: KANUUNTT_ANSWER_IDS[answerIndex],
			text: answerWrapper.querySelector("[data-kanuuntt-answer-text]")?.value.trim() || "Svar " + KANUUNTT_ANSWER_IDS[answerIndex].toUpperCase(),
			correct: Boolean(answerWrapper.querySelector("[data-kanuuntt-answer-correct]")?.checked),
		}));

		if (!answers.some((answer) => answer.correct)) {
			answers[0].correct = true;
		}

		return normalizeKanuunttQuestion(
			{
				prompt: wrapper.querySelector("[data-kanuuntt-prompt]")?.value.trim() || "Spørgsmål " + (questionIndex + 1),
				timeLimitSeconds: wrapper.querySelector("[data-kanuuntt-time]")?.value || 30,
				points: wrapper.querySelector("[data-kanuuntt-points]")?.value || 1000,
				answers,
			},
			questionIndex
		);
	});

	return normalizeKanuunttDraft({
		title: title && title.value.trim() ? title.value.trim() : "Mit KanUUNTt",
		id: id && id.value.trim() ? id.value.trim() : "mit-kanuuntt",
		teams: teamNames.length ? teamNames : ["Red", "Blue"],
		questions: questions.length ? questions : [createDefaultKanuunttQuestion(1)],
	});
}

function readKanuunttMakerDraftFromForm() {
	const title = document.getElementById("kanuuntt-maker-title");
	const id = document.getElementById("kanuuntt-maker-id");
	const teams = document.getElementById("kanuuntt-maker-teams");
	const sourceQuestions =
		kanuunttMakerDraft && Array.isArray(kanuunttMakerDraft.questions)
			? kanuunttMakerDraft.questions
			: [];
	const teamNames = (teams ? teams.value : "")
		.split(/\r?\n/)
		.map((team) => team.trim())
		.filter(Boolean);

	saveSelectedKanuunttQuestionFromForm();

	return normalizeKanuunttDraft({
		title: title && title.value.trim() ? title.value.trim() : "Mit KanUUNTt",
		id: id && id.value.trim() ? id.value.trim() : "mit-kanuuntt",
		teams: teamNames.length ? teamNames : ["Red", "Blue"],
		questions: sourceQuestions.length
			? sourceQuestions
			: [createDefaultKanuunttQuestion(1)],
	});
}

function buildKanuunttGameFromDraft(draft) {
	const normalized = normalizeKanuunttDraft(draft);

	return {
		id: slugifyGameId(normalized.id || normalized.title),
		title: normalized.title,
		teams: normalized.teams,
		categories: [
			{
				title: "KanUUNTt",
				questions: [
					{
						points: 100,
						question: {
							format: "rich",
							content: "KanUUNTt-spil bruger quiz_questions.",
						},
						answer: {
							format: "rich",
							content: "Start spillet som live quiz.",
						},
					},
				],
			},
		],
		quiz_questions: normalized.questions.map((question) => {
			const output = {
				type: "multiple-choice",
				prompt: question.prompt,
				answers: question.answers.map((answer) => ({
					id: answer.id,
					text: answer.text,
					correct: Boolean(answer.correct),
				})),
				timeLimitSeconds: Number(question.timeLimitSeconds || 30),
				points: Number(question.points || 0),
			};

			return output;
		}),
	};
}

function renderKanuunttMakerRichPreview(container, value) {
	if (!container) {
		return;
	}

	if (typeof renderRichContent === "function") {
		renderRichContent(container, {
			format: "rich",
			content: String(value || ""),
		});
		return;
	}

	container.textContent = String(value || "");
}

function createKanuunttMakerMediaSnippet(type, attributes) {
	const pairs = Object.entries(attributes)
		.filter(([, value]) => value !== undefined && value !== null)
		.map(([name, value]) => name + '="' + String(value).replace(/"/g, "&quot;") + '"');

	return "::" + type + " " + pairs.join(" ") + "::";
}

function appendKanuunttTextToField(field, text) {
	const currentValue = field.value.trimEnd();

	field.value = currentValue ? currentValue + "\n\n" + text : text;
	field.dispatchEvent(new Event("input", { bubbles: true }));
}

function insertKanuunttMakerSnippet(editorName, snippetType) {
	const field = document.querySelector(
		'[data-kanuuntt-live-editor="' + editorName + '"] [data-kanuuntt-live-field]'
	);
	let snippet = "";

	if (!field) {
		return;
	}

	if (snippetType === "youtube") {
		const url = window.prompt("YouTube-link eller embed-link");

		if (!url) {
			return;
		}

		snippet = createKanuunttMakerMediaSnippet("youtube", {
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

		snippet = createKanuunttMakerMediaSnippet("video", {
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

		snippet = createKanuunttMakerMediaSnippet("audio", {
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
		appendKanuunttTextToField(field, snippet);
		handleKanuunttMakerInput();
		setKanuunttMakerStatus("Media er indsat.");
	}
}

globalThis.insertKanuunttMakerSnippet = insertKanuunttMakerSnippet;

function setKanuunttMakerCodeMode(wrapper, enabled) {
	const field = wrapper && wrapper.querySelector("[data-kanuuntt-live-field]");
	const preview = wrapper && wrapper.querySelector("[data-kanuuntt-live-preview]");
	const toggle = wrapper && wrapper.querySelector("[data-kanuuntt-code-toggle]");
	const isEnabled = Boolean(enabled);

	if (!wrapper || !field || !preview) {
		return;
	}

	wrapper.dataset.codeMode = isEnabled ? "true" : "false";
	field.hidden = !isEnabled;
	preview.hidden = isEnabled;

	if (toggle) {
		toggle.textContent = isEnabled ? "Vis preview" : "Vis kode";
		toggle.setAttribute("aria-pressed", String(isEnabled));
	}
}

function toggleKanuunttMakerCodeEditor(wrapper) {
	const isCodeMode = wrapper && wrapper.dataset.codeMode === "true";

	setKanuunttMakerCodeMode(wrapper, !isCodeMode);

	const focusTarget = wrapper && wrapper.querySelector(
		!isCodeMode ? "[data-kanuuntt-live-field]" : "[data-kanuuntt-live-preview]"
	);

	if (focusTarget) {
		focusTarget.focus();
	}
}

function createKanuunttMakerLiveEditor(options) {
	const wrapper = document.createElement("div");
	const row = document.createElement("div");
	const label = document.createElement("label");
	const toggle = document.createElement("button");
	const helperRow = document.createElement("div");
	const preview = document.createElement("div");
	const field = options.field;

	wrapper.className = "kanuuntt-live-editor builder-live-editor";
	wrapper.dataset.kanuunttLiveEditor = options.name;
	row.className = "builder-editor-row";
	label.textContent = options.label;
	toggle.className = "game-button secondary builder-code-toggle";
	toggle.type = "button";
	toggle.dataset.kanuunttCodeToggle = "true";
	toggle.textContent = "Vis kode";
	toggle.onclick = () => toggleKanuunttMakerCodeEditor(wrapper);
	helperRow.className = "builder-helper-row kanuuntt-helper-row";
	[
		["youtube", "YouTube"],
		["video", "Video"],
		["audio", "Lyd"],
		["image", "Billede"],
		["math", "Math"],
	].forEach(([type, text]) => {
		const button = document.createElement("button");

		button.className = "game-button secondary";
		button.type = "button";
		button.textContent = text;
		button.onclick = () => insertKanuunttMakerSnippet(options.name, type);
		helperRow.appendChild(button);
	});
	preview.className =
		"builder-inline-preview builder-preview-content kanuuntt-inline-preview";
	preview.dataset.kanuunttLivePreview = "true";
	preview.tabIndex = 0;
	preview.setAttribute("role", "textbox");
	preview.setAttribute("aria-label", options.label + " preview");
	preview.onclick = () => toggleKanuunttMakerCodeEditor(wrapper);
	preview.onkeydown = (event) => {
		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			toggleKanuunttMakerCodeEditor(wrapper);
		}
	};
	field.dataset.kanuunttLiveField = "true";

	row.appendChild(label);
	row.appendChild(toggle);
	wrapper.appendChild(row);
	wrapper.appendChild(helperRow);
	wrapper.appendChild(preview);
	wrapper.appendChild(field);
	setKanuunttMakerCodeMode(wrapper, false);

	return wrapper;
}

function renderKanuunttMakerLivePreviews(scope) {
	const editor = scope || document.getElementById("kanuuntt-maker-editor");

	if (!editor) {
		return;
	}

	editor.querySelectorAll("[data-kanuuntt-live-editor]").forEach((wrapper) => {
		const field = wrapper.querySelector("[data-kanuuntt-live-field]");
		const preview = wrapper.querySelector("[data-kanuuntt-live-preview]");

		renderKanuunttMakerRichPreview(preview, field ? field.value : "");
	});
}

function renderKanuunttMakerQuestion(question, questionIndex) {
	const wrapper = document.createElement("div");
	const header = document.createElement("div");
	const title = document.createElement("h3");
	const removeButton = document.createElement("button");
	const grid = document.createElement("div");
	const promptBlock = document.createElement("div");
	const prompt = document.createElement("textarea");
	const timeBlock = document.createElement("div");
	const timeLabel = document.createElement("label");
	const time = document.createElement("input");
	const pointsBlock = document.createElement("div");
	const pointsLabel = document.createElement("label");
	const points = document.createElement("input");
	const answers = document.createElement("div");

	wrapper.className = "kanuuntt-maker-question";
	header.className = "kanuuntt-maker-question-header";
	title.textContent = "Spørgsmål " + (questionIndex + 1);
	removeButton.className = "game-button reset";
	removeButton.type = "button";
	removeButton.textContent = "Fjern";
	removeButton.disabled = kanuunttMakerDraft.questions.length <= 1;
	removeButton.onclick = () => removeKanuunttQuestion(questionIndex);

	grid.className = "builder-grid";
	prompt.dataset.kanuunttPrompt = "true";
	prompt.value = question.prompt;
	timeLabel.textContent = "Tid i sekunder";
	time.type = "number";
	time.min = "5";
	time.step = "1";
	time.dataset.kanuunttTime = "true";
	time.value = question.timeLimitSeconds;
	pointsLabel.textContent = "Point";
	points.type = "number";
	points.min = "0";
	points.step = "100";
	points.dataset.kanuunttPoints = "true";
	points.value = question.points;
	answers.className = "kanuuntt-maker-answers";
	question.answers.forEach((answer, answerIndex) => {
		const answerWrapper = document.createElement("div");
		const answerText = document.createElement("input");
		const correctLabel = document.createElement("label");
		const correct = document.createElement("input");

		answerWrapper.className = "kanuuntt-maker-answer";
		answerText.type = "text";
		answerText.dataset.kanuunttAnswerText = "true";
		answerText.value = answer.text;
		correct.type = "radio";
		correct.name = "kanuuntt-correct-" + questionIndex;
		correct.dataset.kanuunttAnswerCorrect = "true";
		correct.checked = Boolean(answer.correct);
		correctLabel.className = "builder-checkbox";
		correctLabel.appendChild(correct);
		correctLabel.appendChild(document.createTextNode(" Korrekt"));
		answerWrapper.appendChild(
			createKanuunttMakerLiveEditor({
				name: "answer-" + KANUUNTT_ANSWER_IDS[answerIndex],
				label: "Svar " + KANUUNTT_ANSWER_IDS[answerIndex].toUpperCase(),
				field: answerText,
			})
		);
		answerWrapper.appendChild(correctLabel);
		answers.appendChild(answerWrapper);
	});

	[prompt, time, points].forEach((field) => {
		field.oninput = handleKanuunttMakerInput;
		field.onchange = handleKanuunttMakerInput;
	});
	answers.querySelectorAll("input").forEach((field) => {
		field.oninput = handleKanuunttMakerInput;
		field.onchange = handleKanuunttMakerInput;
	});

	header.appendChild(title);
	header.appendChild(removeButton);
	promptBlock.appendChild(
		createKanuunttMakerLiveEditor({
			name: "prompt",
			label: "Spørgsmål",
			field: prompt,
		})
	);
	timeBlock.appendChild(timeLabel);
	timeBlock.appendChild(time);
	pointsBlock.appendChild(pointsLabel);
	pointsBlock.appendChild(points);
	grid.appendChild(promptBlock);
	grid.appendChild(timeBlock);
	grid.appendChild(pointsBlock);
	wrapper.appendChild(header);
	wrapper.appendChild(grid);
	wrapper.appendChild(answers);
	renderKanuunttMakerLivePreviews(wrapper);

	return wrapper;
}

function getKanuunttQuestionSummary(question) {
	const prompt = String((question && question.prompt) || "").trim();

	return prompt || "Tomt";
}

function renderKanuunttMakerQuestionTile(question, questionIndex) {
	const tile = document.createElement("button");
	const number = document.createElement("strong");
	const title = document.createElement("span");
	const isActive = questionIndex === kanuunttSelectedQuestionIndex;
	const hasPrompt = Boolean(String(question.prompt || "").trim());
	const hasAnswers = question.answers.some((answer) =>
		Boolean(String(answer.text || "").trim())
	);

	tile.type = "button";
	tile.className =
		"kanuuntt-maker-tile" +
		(isActive ? " active" : "") +
		(hasPrompt && hasAnswers ? " complete" : "");
	tile.setAttribute("aria-label", "Rediger spørgsmål " + (questionIndex + 1));
	tile.setAttribute("aria-pressed", String(isActive));
	tile.onclick = () => selectKanuunttQuestion(questionIndex);
	number.textContent = String(questionIndex + 1);
	title.textContent = getKanuunttQuestionSummary(question).slice(0, 28);
	tile.appendChild(number);
	tile.appendChild(title);

	return tile;
}

function renderKanuunttMakerQuestionNav() {
	const nav = document.getElementById("kanuuntt-maker-question-nav");

	if (!nav || !kanuunttMakerDraft) {
		return;
	}

	nav.replaceChildren(
		...kanuunttMakerDraft.questions.map(renderKanuunttMakerQuestionTile)
	);
}

function renderSelectedKanuunttQuestion() {
	const editor = document.getElementById("kanuuntt-maker-editor");
	const question =
		kanuunttMakerDraft &&
		kanuunttMakerDraft.questions[kanuunttSelectedQuestionIndex];

	if (!editor) {
		return;
	}

	if (!question) {
		editor.hidden = true;
		editor.replaceChildren();
		return;
	}

	editor.hidden = false;
	editor.replaceChildren(
		renderKanuunttMakerQuestion(question, kanuunttSelectedQuestionIndex)
	);
	renderKanuunttMakerLivePreviews(editor);
}

function renderKanuunttMaker() {
	const title = document.getElementById("kanuuntt-maker-title");
	const id = document.getElementById("kanuuntt-maker-id");
	const teams = document.getElementById("kanuuntt-maker-teams");
	const output = document.getElementById("kanuuntt-maker-output");

	kanuunttMakerDraft = normalizeKanuunttDraft(kanuunttMakerDraft);
	clampKanuunttSelection();

	if (title) {
		title.value = kanuunttMakerDraft.title;
	}
	if (id) {
		id.value = kanuunttMakerDraft.id;
	}
	if (teams) {
		teams.value = kanuunttMakerDraft.teams.join("\n");
	}
	renderKanuunttMakerQuestionNav();
	renderSelectedKanuunttQuestion();
	if (output) {
		output.value = JSON.stringify(buildKanuunttGameFromDraft(kanuunttMakerDraft), null, "\t") + "\n";
	}

	updateKanuunttAdminStatus();
}

function updateKanuunttMakerOutput() {
	const output = document.getElementById("kanuuntt-maker-output");

	if (output) {
		output.value = JSON.stringify(buildKanuunttGameFromDraft(kanuunttMakerDraft), null, "\t") + "\n";
	}
}

function handleKanuunttMakerInput() {
	kanuunttMakerDraft = readKanuunttMakerDraftFromForm();
	clampKanuunttSelection();
	persistKanuunttMakerDraft();
	renderKanuunttMakerQuestionNav();
	updateKanuunttMakerOutput();
	renderKanuunttMakerLivePreviews();
}

function saveSelectedKanuunttQuestionFromForm() {
	if (!kanuunttMakerDraft || !Array.isArray(kanuunttMakerDraft.questions)) {
		return;
	}

	const question = kanuunttMakerDraft.questions[kanuunttSelectedQuestionIndex];
	const editor = document.getElementById("kanuuntt-maker-editor");

	if (!question || !editor || editor.hidden) {
		return;
	}

	const answers = Array.from(editor.querySelectorAll(".kanuuntt-maker-answer")).map((answerWrapper, answerIndex) => ({
		id: KANUUNTT_ANSWER_IDS[answerIndex],
		text: answerWrapper.querySelector("[data-kanuuntt-answer-text]")?.value.trim() || "Svar " + KANUUNTT_ANSWER_IDS[answerIndex].toUpperCase(),
		correct: Boolean(answerWrapper.querySelector("[data-kanuuntt-answer-correct]")?.checked),
	}));

	if (!answers.some((answer) => answer.correct)) {
		answers[0].correct = true;
	}

	kanuunttMakerDraft.questions[kanuunttSelectedQuestionIndex] =
		normalizeKanuunttQuestion(
			{
				prompt: editor.querySelector("[data-kanuuntt-prompt]")?.value.trim() || "Spørgsmål " + (kanuunttSelectedQuestionIndex + 1),
				timeLimitSeconds: editor.querySelector("[data-kanuuntt-time]")?.value || 30,
				points: editor.querySelector("[data-kanuuntt-points]")?.value || 1000,
				answers,
			},
			kanuunttSelectedQuestionIndex
		);
}

function selectKanuunttQuestion(questionIndex) {
	kanuunttMakerDraft = readKanuunttMakerDraftFromForm();
	kanuunttSelectedQuestionIndex = questionIndex;
	clampKanuunttSelection();
	persistKanuunttMakerDraft();
	renderKanuunttMakerQuestionNav();
	renderSelectedKanuunttQuestion();
	setKanuunttMakerStatus("");
}

function addKanuunttQuestion() {
	kanuunttMakerDraft = readKanuunttMakerDraftFromForm();
	kanuunttMakerDraft.questions.push(
		createDefaultKanuunttQuestion(kanuunttMakerDraft.questions.length + 1)
	);
	kanuunttSelectedQuestionIndex = kanuunttMakerDraft.questions.length - 1;
	persistKanuunttMakerDraft();
	renderKanuunttMaker();
	toggleKanuunttMaker(true);
}

function removeKanuunttQuestion(questionIndex) {
	kanuunttMakerDraft = readKanuunttMakerDraftFromForm();

	if (kanuunttMakerDraft.questions.length <= 1) {
		return;
	}

	kanuunttMakerDraft.questions.splice(questionIndex, 1);
	if (kanuunttSelectedQuestionIndex >= kanuunttMakerDraft.questions.length) {
		kanuunttSelectedQuestionIndex = kanuunttMakerDraft.questions.length - 1;
	}
	clampKanuunttSelection();
	persistKanuunttMakerDraft();
	renderKanuunttMaker();
}

function resetKanuunttMakerDraft() {
	if (!window.confirm("Reset KanUUNTt kladde?")) {
		return;
	}

	kanuunttMakerDraft = createDefaultKanuunttDraft();
	kanuunttSelectedQuestionIndex = 0;
	persistKanuunttMakerDraft();
	renderKanuunttMaker();
	setKanuunttMakerStatus("Kladde nulstillet.");
}

async function loadCurrentKanuunttGameIntoMaker() {
	const select = document.getElementById("kanuuntt-game-select");
	const key = (select && select.value) || gameKey;

	try {
		const game = await fetchJson("/api/games/" + encodeURIComponent(key) + "?mode=quiz");

		kanuunttMakerDraft = normalizeKanuunttDraft(game);
		kanuunttSelectedQuestionIndex = 0;
		persistKanuunttMakerDraft();
		renderKanuunttMaker();
		setKanuunttMakerStatus("Valgt KanUUNTt er hentet ind i maker.");
		toggleKanuunttMaker(true);
	} catch (error) {
		console.warn("Could not load KanUUNTt game.", error);
		setKanuunttMakerStatus("Kunne ikke hente KanUUNTt: " + error.message);
	}
}

async function saveKanuunttMakerFile() {
	kanuunttMakerDraft = readKanuunttMakerDraftFromForm();
	persistKanuunttMakerDraft();

	const game = buildKanuunttGameFromDraft(kanuunttMakerDraft);

	try {
		if (!isAdmin()) {
			setKanuunttMakerStatus("Log ind som admin for at gemme KanUUNTt.");
			return;
		}

		await fetchJson("/api/games/" + encodeURIComponent(game.id), {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(game),
		});

		availableGames = await fetchJson("/api/games");
		renderHome();
		setKanuunttMakerStatus("KanUUNTt er gemt paa serveren.");
	} catch (error) {
		console.warn("Could not save KanUUNTt game.", error);
		setKanuunttMakerStatus("KanUUNTt kunne ikke gemmes: " + error.message);
	}

	renderKanuunttMaker();
}

async function loginKanuunttAdmin() {
	const password = document.getElementById("kanuuntt-admin-password");

	try {
		await fetchJson("/api/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ password: password ? password.value : "" }),
		});
		if (password) {
			password.value = "";
		}
		await refreshAdminState();
		updateKanuunttAdminStatus();
		setKanuunttMakerStatus("Admin login OK.");
	} catch (error) {
		console.warn("Could not log in for KanUUNTt maker.", error);
		setKanuunttMakerStatus("Admin login fejlede.");
	}
}

function initializeKanuunttMaker() {
	const maker = document.getElementById("kanuuntt-maker");
	const title = document.getElementById("kanuuntt-maker-title");
	const id = document.getElementById("kanuuntt-maker-id");
	const teams = document.getElementById("kanuuntt-maker-teams");
	const adminPassword = document.getElementById("kanuuntt-admin-password");

	if (!maker || !title || !id || !teams) {
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

	kanuunttMakerDraft = loadKanuunttMakerDraft();
	title.oninput = handleKanuunttMakerInput;
	id.oninput = handleKanuunttMakerInput;
	teams.oninput = handleKanuunttMakerInput;

	if (adminPassword) {
		adminPassword.onkeydown = (event) => {
			if (event.key === "Enter") {
				event.preventDefault();
				loginKanuunttAdmin();
			}
		};
	}

	renderKanuunttMaker();
}
