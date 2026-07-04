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
