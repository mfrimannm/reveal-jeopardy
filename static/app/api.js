async function fetchJson(url, options) {
	const response = await fetch(url, options || {});

	if (!response.ok) {
		let message = response.statusText || "Request failed";

		try {
			const errorBody = await response.json();

			if (errorBody && errorBody.detail) {
				message = errorBody.detail;
			}
		} catch (error) {
			// Keep the HTTP status text when the response is not JSON.
		}

		throw new Error(message);
	}

	return response.json();
}

function setUploadManagerStatus(message) {
	const status = document.getElementById("upload-manager-status");

	if (status) {
		status.textContent = message || "";
	}
}

function getManagedUploadType(upload) {
	const contentType = String((upload && upload.contentType) || "");

	if (contentType.startsWith("image/")) {
		return "image";
	}

	if (contentType.startsWith("video/")) {
		return "video";
	}

	if (contentType.startsWith("audio/")) {
		return "audio";
	}

	return "";
}

function createManagedUploadPreview(upload) {
	const type = getManagedUploadType(upload);
	const preview = document.createElement("div");

	preview.className = "upload-manager-preview";

	if (type === "image") {
		const image = document.createElement("img");

		image.src = upload.url;
		image.alt = upload.filename;
		preview.appendChild(image);
		return preview;
	}

	if (type === "video") {
		const video = document.createElement("video");

		video.src = upload.url;
		video.muted = true;
		video.playsInline = true;
		video.preload = "metadata";
		preview.appendChild(video);
		return preview;
	}

	if (type === "audio") {
		const audio = document.createElement("audio");

		audio.src = upload.url;
		audio.controls = true;
		preview.appendChild(audio);
		return preview;
	}

	preview.textContent = "Fil";
	return preview;
}

function getActiveBuilderTarget() {
	const active = document.activeElement;
	const id = active && active.id ? active.id : "";

	if (id.includes("answer")) {
		return "answer";
	}

	return "question";
}

function insertManagedUploadInJeopardy(upload) {
	const target = getActiveBuilderTarget();
	const field = document.getElementById("builder-" + target + "-text");
	const type = getManagedUploadType(upload);

	if (!field || typeof appendTextToField !== "function") {
		setUploadManagerStatus("Åbn en Jeopardy-editor først.");
		return false;
	}

	if (type === "image") {
		appendTextToField(field, "![" + upload.filename.replace(/]/g, "\\]") + "](" + upload.url + ")");
	} else if (type === "video" || type === "audio") {
		appendTextToField(
			field,
			createBuilderMediaSnippet(type, {
				src: upload.url,
				start: type === "video" ? 0 : undefined,
				autoplay: false,
				loop: false,
				controls: true,
				muted: false,
			})
		);
	} else {
		appendTextToField(field, upload.url);
	}

	if (typeof handleBuilderFormInput === "function") {
		handleBuilderFormInput();
	}

	setUploadManagerStatus("Link indsat i Jeopardy-" + (target === "answer" ? "svaret." : "spørgsmålet."));
	return true;
}

function insertManagedUploadInKanuuntt(upload) {
	const type = getManagedUploadType(upload);
	const editor = document.getElementById("kanuuntt-maker-editor");
	const prompt = editor && editor.querySelector("[data-kanuuntt-prompt]");

	if (!prompt || typeof appendTextToField !== "function") {
		setUploadManagerStatus("Åbn KanUUNTt maker først.");
		return false;
	}

	if (type === "image") {
		appendTextToField(prompt, "![" + upload.filename.replace(/]/g, "\\]") + "](" + upload.url + ")");
	} else if (type === "video" || type === "audio") {
		appendTextToField(
			prompt,
			createKanuunttMakerMediaSnippet(type, {
				src: upload.url,
				start: type === "video" ? 0 : undefined,
				autoplay: false,
				loop: false,
				controls: true,
				muted: false,
			})
		);
	} else {
		appendTextToField(prompt, upload.url);
	}

	if (typeof handleKanuunttMakerInput === "function") {
		handleKanuunttMakerInput();
	}

	setUploadManagerStatus("Link indsat i KanUUNTt-spørgsmålet.");
	return true;
}

function useManagedUpload(filename) {
	const upload = (window.managedUploads || []).find((item) => item.filename === filename);
	const questionMaker = document.getElementById("question-maker");
	const kanuunttMaker = document.getElementById("kanuuntt-maker");

	if (!upload) {
		setUploadManagerStatus("Filen findes ikke i listen.");
		return;
	}

	if (kanuunttMaker && !kanuunttMaker.hidden) {
		insertManagedUploadInKanuuntt(upload);
		return;
	}

	if (questionMaker && !questionMaker.hidden) {
		insertManagedUploadInJeopardy(upload);
		return;
	}

	copyManagedUploadLink(filename);
}

async function copyManagedUploadLink(filename) {
	const upload = (window.managedUploads || []).find((item) => item.filename === filename);

	if (!upload) {
		setUploadManagerStatus("Filen findes ikke i listen.");
		return;
	}

	try {
		await navigator.clipboard.writeText(upload.url);
		setUploadManagerStatus("Link kopieret: " + upload.url);
	} catch (error) {
		setUploadManagerStatus("Link: " + upload.url);
	}
}

function renderUploadManager(uploads) {
	const list = document.getElementById("upload-manager-list");

	if (!list) {
		return;
	}

	window.managedUploads = Array.isArray(uploads) ? uploads : [];
	list.replaceChildren();

	if (!window.managedUploads.length) {
		const row = document.createElement("tr");
		const cell = document.createElement("td");

		cell.colSpan = 3;
		cell.textContent = "Ingen uploadede filer.";
		row.appendChild(cell);
		list.appendChild(row);
		return;
	}

	window.managedUploads.forEach((upload) => {
		const row = document.createElement("tr");
		const previewCell = document.createElement("td");
		const linkCell = document.createElement("td");
		const actionCell = document.createElement("td");
		const link = document.createElement("code");
		const actions = document.createElement("div");
		const useButton = document.createElement("button");
		const copyButton = document.createElement("button");
		const deleteButton = document.createElement("button");

		previewCell.appendChild(createManagedUploadPreview(upload));
		link.textContent = upload.url;
		linkCell.appendChild(link);
		actions.className = "upload-manager-actions";
		useButton.className = "game-button secondary";
		useButton.type = "button";
		useButton.textContent = "Brug link";
		useButton.onclick = () => useManagedUpload(upload.filename);
		copyButton.className = "game-button secondary";
		copyButton.type = "button";
		copyButton.textContent = "Kopier";
		copyButton.onclick = () => copyManagedUploadLink(upload.filename);
		deleteButton.className = "game-button reset upload-manager-admin-control";
		deleteButton.type = "button";
		deleteButton.textContent = "Slet";
		deleteButton.disabled = !isAdmin();
		deleteButton.onclick = () => deleteManagedUpload(upload.filename);
		actions.appendChild(useButton);
		actions.appendChild(copyButton);
		actions.appendChild(deleteButton);
		actionCell.appendChild(actions);
		row.appendChild(previewCell);
		row.appendChild(linkCell);
		row.appendChild(actionCell);
		list.appendChild(row);
	});
}

async function refreshUploadManager() {
	try {
		renderUploadManager(await fetchJson("/api/uploads"));
	} catch (error) {
		console.warn("Could not load uploads.", error);
		setUploadManagerStatus("Uploadede filer kunne ikke hentes.");
	}
}

async function uploadManagedFile() {
	const input = document.getElementById("upload-manager-file");

	if (!isAdmin()) {
		setUploadManagerStatus("Log ind som admin for at uploade filer.");
		return;
	}

	if (!input || !input.files || !input.files[0]) {
		setUploadManagerStatus("Vælg en fil først.");
		return;
	}

	const formData = new FormData();

	formData.append("file", input.files[0]);

	try {
		await fetchJson("/api/uploads", {
			method: "POST",
			body: formData,
		});
		input.value = "";
		setUploadManagerStatus("Filen er uploadet.");
		await refreshUploadManager();
	} catch (error) {
		console.warn("Could not upload file.", error);
		setUploadManagerStatus("Filen kunne ikke uploades: " + error.message);
	}
}

async function deleteManagedUpload(filename) {
	if (!isAdmin()) {
		setUploadManagerStatus("Log ind som admin for at slette filer.");
		return;
	}

	try {
		await fetchJson("/api/uploads/" + encodeURIComponent(filename), {
			method: "DELETE",
		});
		setUploadManagerStatus("Filen er slettet.");
		await refreshUploadManager();
	} catch (error) {
		console.warn("Could not delete upload.", error);
		setUploadManagerStatus("Filen kunne ikke slettes: " + error.message);
	}
}

async function refreshAdminState() {
	try {
		adminState = await fetchJson("/api/me");
	} catch (error) {
		adminState = { authenticated: false };
	}

	updateAdminControls();
}

function isAdmin() {
	return Boolean(adminState && adminState.authenticated);
}

function getGameRecord(key) {
	return availableGames.find((game) => game.id === key) || null;
}

function getRequestedGameKey() {
	const params = new URLSearchParams(window.location.search);
	const requestedGame = params.get("game") || DEFAULT_GAME_KEY;
	const firstGame = availableGames[0] && availableGames[0].id;

	if (getGameRecord(requestedGame)) {
		return requestedGame;
	}

	if (getGameRecord(DEFAULT_GAME_KEY)) {
		return DEFAULT_GAME_KEY;
	}

	return firstGame || DEFAULT_GAME_KEY;
}

async function loadGameFile() {
	await refreshAdminState();

	try {
		availableGames = await fetchJson("/api/games");
	} catch (error) {
		console.warn("Could not load game list.", error);
		availableGames = [];
	}

	gameKey = getRequestedGameKey();

	try {
		window.JEOPARDY_GAME = await fetchJson(
			"/api/games/" + encodeURIComponent(gameKey) + "?mode=jeopardy"
		);
		gameKey = window.JEOPARDY_GAME.id || gameKey;
	} catch (error) {
		console.warn("Could not load game.", error);
		window.JEOPARDY_GAME = {
			id: gameKey,
			title: "Jeopardy",
			teams: ["Team 1", "Team 2", "Team 3"],
			categories: [
				{
					title: "Ingen spil",
					questions: [
						{
							points: 100,
							question: {
								format: "rich",
								content: "Der kunne ikke hentes et spil fra serveren.",
							},
							answer: {
								format: "rich",
								content: "Tjek at FastAPI-serveren kører.",
							},
						},
					],
				},
			],
		};
	}
}

function updateAdminControls() {
	const status = document.getElementById("admin-status");
	const password = document.getElementById("admin-password");
	const loginButton = document.getElementById("admin-login-button");
	const logoutButton = document.getElementById("admin-logout-button");
	const saveButton = document.getElementById("builder-save-game-button");

	if (status) {
		status.textContent = isAdmin()
			? "Logget ind som admin. Du kan gemme spil og uploade media."
			: "Log ind som admin for at gemme spil og uploade media.";
	}

	if (password) {
		password.hidden = isAdmin();
		password.disabled = isAdmin();
	}

	if (loginButton) {
		loginButton.hidden = isAdmin();
	}

	if (logoutButton) {
		logoutButton.hidden = !isAdmin();
	}

	if (saveButton) {
		saveButton.disabled = !isAdmin();
	}

	document.querySelectorAll(".upload-manager-admin-control").forEach((uploadButton) => {
		uploadButton.disabled = !isAdmin();
	});

	renderUploadManager(window.managedUploads || []);

	if (typeof renderHostLiveSession === "function") {
		renderHostLiveSession();
	}

	if (typeof updateKanuunttAdminStatus === "function") {
		updateKanuunttAdminStatus();
	}
}

async function loginAdmin() {
	const password = document.getElementById("admin-password");

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
		setBuilderStatus("Admin login OK.");
	} catch (error) {
		console.warn("Could not log in.", error);
		setBuilderStatus("Admin login fejlede.");
	}
}

async function logoutAdmin() {
	try {
		await fetchJson("/api/logout", { method: "POST" });
	} catch (error) {
		console.warn("Could not log out.", error);
	}

	await refreshAdminState();
	setBuilderStatus("Logget ud.");
}
