const KANUUNTT_MAKER_STORAGE_KEY = "reveal-jeopardy-kanuuntt-maker-draft";
const KANUUNTT_ANSWER_IDS = ["a", "b", "c", "d"];

let kanuunttMakerDraft = null;

function createDefaultKanuunttQuestion(index) {
	return {
		prompt: "Spørgsmål " + index,
		timeLimitSeconds: 30,
		points: 1000,
		mediaType: "",
		mediaSrc: "",
		answers: [
			{ id: "a", text: "Svar A", correct: true },
			{ id: "b", text: "Svar B", correct: false },
			{ id: "c", text: "Svar C", correct: false },
			{ id: "d", text: "Svar D", correct: false },
		],
	};
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
	const media = source.media && typeof source.media === "object" ? source.media : null;

	return {
		prompt: String(source.prompt || "Spørgsmål " + (index + 1)),
		timeLimitSeconds: Math.max(5, Number(source.timeLimitSeconds || 30)),
		points: Math.max(0, Number(source.points || 1000)),
		mediaType: media ? String(media.type || "") : String(source.mediaType || ""),
		mediaSrc: media ? String(media.src || "") : String(source.mediaSrc || ""),
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

function readKanuunttMakerDraftFromForm() {
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
				mediaType: wrapper.querySelector("[data-kanuuntt-media-type]")?.value || "",
				mediaSrc: wrapper.querySelector("[data-kanuuntt-media-src]")?.value.trim() || "",
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

			if (question.mediaType && question.mediaSrc) {
				output.media = {
					type: question.mediaType,
					src: question.mediaSrc,
				};
			}

			return output;
		}),
	};
}

function renderKanuunttMakerQuestion(question, questionIndex) {
	const wrapper = document.createElement("div");
	const header = document.createElement("div");
	const title = document.createElement("h3");
	const removeButton = document.createElement("button");
	const grid = document.createElement("div");
	const promptBlock = document.createElement("div");
	const promptLabel = document.createElement("label");
	const prompt = document.createElement("textarea");
	const timeBlock = document.createElement("div");
	const timeLabel = document.createElement("label");
	const time = document.createElement("input");
	const pointsBlock = document.createElement("div");
	const pointsLabel = document.createElement("label");
	const points = document.createElement("input");
	const mediaTypeBlock = document.createElement("div");
	const mediaTypeLabel = document.createElement("label");
	const mediaType = document.createElement("select");
	const mediaSrcBlock = document.createElement("div");
	const mediaSrcLabel = document.createElement("label");
	const mediaSrc = document.createElement("input");
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
	promptLabel.textContent = "Spørgsmål";
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
	mediaTypeLabel.textContent = "Media type";
	mediaType.dataset.kanuunttMediaType = "true";
	["", "image", "video", "audio", "embed"].forEach((type) => {
		const option = document.createElement("option");

		option.value = type;
		option.textContent = type || "Ingen";
		option.selected = type === question.mediaType;
		mediaType.appendChild(option);
	});
	mediaSrcLabel.textContent = "Media src";
	mediaSrc.type = "text";
	mediaSrc.dataset.kanuunttMediaSrc = "true";
	mediaSrc.placeholder = "/uploads/billede.webp";
	mediaSrc.value = question.mediaSrc;

	answers.className = "kanuuntt-maker-answers";
	question.answers.forEach((answer, answerIndex) => {
		const answerWrapper = document.createElement("div");
		const answerLabel = document.createElement("label");
		const answerText = document.createElement("input");
		const correctLabel = document.createElement("label");
		const correct = document.createElement("input");

		answerWrapper.className = "kanuuntt-maker-answer";
		answerLabel.textContent = "Svar " + KANUUNTT_ANSWER_IDS[answerIndex].toUpperCase();
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
		answerWrapper.appendChild(answerLabel);
		answerWrapper.appendChild(answerText);
		answerWrapper.appendChild(correctLabel);
		answers.appendChild(answerWrapper);
	});

	[prompt, time, points, mediaType, mediaSrc].forEach((field) => {
		field.oninput = handleKanuunttMakerInput;
		field.onchange = handleKanuunttMakerInput;
	});
	answers.querySelectorAll("input").forEach((field) => {
		field.oninput = handleKanuunttMakerInput;
		field.onchange = handleKanuunttMakerInput;
	});

	header.appendChild(title);
	header.appendChild(removeButton);
	promptBlock.appendChild(promptLabel);
	promptBlock.appendChild(prompt);
	timeBlock.appendChild(timeLabel);
	timeBlock.appendChild(time);
	pointsBlock.appendChild(pointsLabel);
	pointsBlock.appendChild(points);
	mediaTypeBlock.appendChild(mediaTypeLabel);
	mediaTypeBlock.appendChild(mediaType);
	mediaSrcBlock.appendChild(mediaSrcLabel);
	mediaSrcBlock.appendChild(mediaSrc);
	grid.appendChild(promptBlock);
	grid.appendChild(timeBlock);
	grid.appendChild(pointsBlock);
	grid.appendChild(mediaTypeBlock);
	grid.appendChild(mediaSrcBlock);
	wrapper.appendChild(header);
	wrapper.appendChild(grid);
	wrapper.appendChild(answers);

	return wrapper;
}

function renderKanuunttMaker() {
	const title = document.getElementById("kanuuntt-maker-title");
	const id = document.getElementById("kanuuntt-maker-id");
	const teams = document.getElementById("kanuuntt-maker-teams");
	const list = document.getElementById("kanuuntt-maker-questions");
	const output = document.getElementById("kanuuntt-maker-output");

	kanuunttMakerDraft = normalizeKanuunttDraft(kanuunttMakerDraft);

	if (title) {
		title.value = kanuunttMakerDraft.title;
	}
	if (id) {
		id.value = kanuunttMakerDraft.id;
	}
	if (teams) {
		teams.value = kanuunttMakerDraft.teams.join("\n");
	}
	if (list) {
		list.replaceChildren(
			...kanuunttMakerDraft.questions.map(renderKanuunttMakerQuestion)
		);
	}
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
	persistKanuunttMakerDraft();
	updateKanuunttMakerOutput();
}

function addKanuunttQuestion() {
	kanuunttMakerDraft = readKanuunttMakerDraftFromForm();
	kanuunttMakerDraft.questions.push(
		createDefaultKanuunttQuestion(kanuunttMakerDraft.questions.length + 1)
	);
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
	persistKanuunttMakerDraft();
	renderKanuunttMaker();
}

function resetKanuunttMakerDraft() {
	if (!window.confirm("Reset KanUUNTt kladde?")) {
		return;
	}

	kanuunttMakerDraft = createDefaultKanuunttDraft();
	persistKanuunttMakerDraft();
	renderKanuunttMaker();
	setKanuunttMakerStatus("Kladde nulstillet.");
}

async function loadCurrentKanuunttGameIntoMaker() {
	const select = document.getElementById("kanuuntt-game-select");
	const key = (select && select.value) || gameKey;

	try {
		const game = await fetchJson("/api/games/" + encodeURIComponent(key));

		kanuunttMakerDraft = normalizeKanuunttDraft(game);
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
