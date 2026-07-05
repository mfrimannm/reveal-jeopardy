function getLiveSessionUrl(path) {
	return "/api/sessions" + path;
}

function getLiveWebSocketUrl(sessionId) {
	const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";

	return (
		protocol +
		"//" +
		window.location.host +
		"/ws/sessions/" +
		encodeURIComponent(sessionId)
	);
}

async function liveSessionRequest(path, options) {
	return fetchJson(getLiveSessionUrl(path), {
		...(options || {}),
		headers: {
			"Content-Type": "application/json",
			...((options && options.headers) || {}),
		},
	});
}

function getLiveHostHeaders(hostToken) {
	return hostToken
		? {
				"X-Live-Host-Token": hostToken,
			}
		: {};
}

function createLiveSession(gameId) {
	return liveSessionRequest("", {
		method: "POST",
		body: JSON.stringify({
			game_id: gameId,
			mode: "jeopardy",
		}),
	});
}

function fetchLiveSession(sessionId) {
	return liveSessionRequest("/" + encodeURIComponent(sessionId));
}

function joinLiveSession(sessionId, name, teamId) {
	return liveSessionRequest("/" + encodeURIComponent(sessionId) + "/join", {
		method: "POST",
		body: JSON.stringify({
			name,
			team_id: teamId,
		}),
	});
}

function setLiveCurrentQuestion(sessionId, questionId, hostToken) {
	return liveSessionRequest(
		"/" + encodeURIComponent(sessionId) + "/current-question",
		{
			method: "POST",
			headers: getLiveHostHeaders(hostToken),
			body: JSON.stringify({
				question_id: questionId || null,
			}),
		}
	);
}

function changeLiveScore(sessionId, teamId, delta, questionId, hostToken) {
	return liveSessionRequest("/" + encodeURIComponent(sessionId) + "/score", {
		method: "POST",
		headers: getLiveHostHeaders(hostToken),
		body: JSON.stringify({
			team_id: teamId,
			delta,
			question_id: questionId || null,
		}),
	});
}

function resetLiveSession(sessionId, hostToken) {
	return liveSessionRequest("/" + encodeURIComponent(sessionId) + "/reset", {
		method: "POST",
		headers: getLiveHostHeaders(hostToken),
	});
}

function stopLiveSession(sessionId, hostToken) {
	return liveSessionRequest("/" + encodeURIComponent(sessionId), {
		method: "DELETE",
		headers: getLiveHostHeaders(hostToken),
	});
}

function buzzLiveSession(sessionId, playerId) {
	return liveSessionRequest("/" + encodeURIComponent(sessionId) + "/buzz", {
		method: "POST",
		body: JSON.stringify({
			player_id: playerId,
		}),
	});
}

function clearLiveBuzzers(sessionId, hostToken) {
	return liveSessionRequest(
		"/" + encodeURIComponent(sessionId) + "/clear-buzzers",
		{
			method: "POST",
			headers: getLiveHostHeaders(hostToken),
		}
	);
}

function lockLiveBuzzers(sessionId, hostToken) {
	return liveSessionRequest(
		"/" + encodeURIComponent(sessionId) + "/lock-buzzers",
		{
			method: "POST",
			headers: getLiveHostHeaders(hostToken),
		}
	);
}

function unlockLiveBuzzers(sessionId, hostToken) {
	return liveSessionRequest(
		"/" + encodeURIComponent(sessionId) + "/unlock-buzzers",
		{
			method: "POST",
			headers: getLiveHostHeaders(hostToken),
		}
	);
}

function connectLiveSessionSocket(sessionId, handlers) {
	const socket = new WebSocket(getLiveWebSocketUrl(sessionId));

	socket.onopen = () => {
		if (handlers && handlers.open) {
			handlers.open();
		}
	};

	socket.onmessage = (event) => {
		let message = null;

		try {
			message = JSON.parse(event.data);
		} catch (error) {
			return;
		}

		if (handlers && handlers.message) {
			handlers.message(message);
		}
	};

	socket.onerror = () => {
		if (handlers && handlers.error) {
			handlers.error("Live connection failed.");
		}
	};

	socket.onclose = () => {
		if (handlers && handlers.close) {
			handlers.close();
		}
	};

	return socket;
}
