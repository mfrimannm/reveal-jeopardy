function applySlideOptions(slide, question) {
	const slideAttributes = {
		...(question.slideAttributes || {}),
	};

	if (question.background) {
		slideAttributes["data-background"] = question.background;
	}

	if (question.backgroundColor) {
		slideAttributes["data-background-color"] = question.backgroundColor;
	}

	if (question.backgroundVideo) {
		slideAttributes["data-background-video"] = question.backgroundVideo;
	}

	if (question.backgroundVideo && question.backgroundVideoLoop !== false) {
		slideAttributes["data-background-video-loop"] = "";
	}

	if (question.backgroundVideo && question.backgroundVideoMuted !== false) {
		slideAttributes["data-background-video-muted"] = "";
	}

	if (question.backgroundIframe) {
		slideAttributes["data-background-iframe"] = prepareYouTubeEmbedUrl(
			question.backgroundIframe
		);
	}

	if (question.backgroundInteractive) {
		slideAttributes["data-background-interactive"] = "";
	}

	if (question.transition) {
		slideAttributes["data-transition"] = question.transition;
	}

	if (question.autoAnimate) {
		slideAttributes["data-auto-animate"] = "";
	}

	Object.entries(slideAttributes).forEach(([name, value]) => {
		slide.setAttribute(name, value === true ? "" : String(value));
	});

	if (question.className) {
		slide.classList.add(...String(question.className).split(/\s+/));
	}
}

function renderContent(container, question, kind) {
	const isAnswer = kind === "answer";
	const markdown = isAnswer ? question.answerMarkdown : question.markdown;
	const html = isAnswer ? question.answerHtml : question.html;
	const fallback = isAnswer ? question.answer : question.question;

	container.innerHTML = "";

	if (markdown) {
		const markdownElement = document.createElement("div");
		const template = document.createElement("script");

		markdownElement.setAttribute("data-markdown", "");
		markdownElement.setAttribute("data-separator", "$x");
		template.type = "text/template";
		template.textContent = markdown;
		markdownElement.appendChild(template);
		container.appendChild(markdownElement);
		return;
	}

	if (html) {
		container.innerHTML = html;
		prepareYouTubeIframes(container);
		return;
	}

	container.textContent = fallback || "";
}

function renderHints(container, question) {
	if (!Array.isArray(question.hints) || question.hints.length === 0) {
		return;
	}

	const hints = document.createElement("div");
	const hintCue = document.createElement("div");

	hints.className = "question-hints";
	hintCue.className = "hint-cue";
	hintCue.textContent = "Højre/ned giver hints. Venstre/op går til boardet.";
	hints.appendChild(hintCue);

	question.hints.forEach((hint, index) => {
		const hintElement = document.createElement("p");
		const hintConfig =
			hint && typeof hint === "object" ? hint : { text: hint };

		hintElement.className = "fragment";
		hintElement.dataset.fragmentIndex = String(index);

		if (hintConfig.html) {
			hintElement.innerHTML = hintConfig.html;
		} else {
			hintElement.textContent = hintConfig.text || "";
		}

		hints.appendChild(hintElement);
	});

	container.appendChild(hints);
}

function renderTeamFields(teamNames) {
	const teamFieldList = document.getElementById("team-field-list");
	const teamCountInput = document.getElementById("team-count");

	if (!teamFieldList || !teamCountInput) {
		return;
	}

	const teamCount = clampTeamCount(teamCountInput.value || teamNames.length);

	teamFieldList.innerHTML = "";

	Array.from({ length: teamCount }, (_, index) => {
		const wrapper = document.createElement("div");
		const label = document.createElement("label");
		const input = document.createElement("input");
		const existingName = teamNames[index] || defaultTeamNames[index];

		label.setAttribute("for", "team-name-" + (index + 1));
		label.textContent = "Team " + (index + 1) + " navn";
		input.id = "team-name-" + (index + 1);
		input.type = "text";
		input.value = existingName || "Team " + (index + 1);
		input.autocomplete = "off";

		wrapper.appendChild(label);
		wrapper.appendChild(input);
		teamFieldList.appendChild(wrapper);
	});
}

function renderHome() {
	const gameSelect = document.getElementById("game-select");
	const gameList = document.getElementById("game-list");
	const gameMeta = document.getElementById("game-meta");
	const teamCountInput = document.getElementById("team-count");

	if (!gameSelect || !gameList || !gameMeta || !teamCountInput) {
		return;
	}

	gameSelect.innerHTML = "";
	gameList.innerHTML = "";
	gameMeta.innerHTML = "";

	availableGames.forEach((game) => {
		const option = document.createElement("option");
		const link = document.createElement("a");
		const title = document.createElement("strong");
		const meta = document.createElement("span");

		option.value = game.id;
		option.textContent = game.title + " - " + game.id;
		option.selected = game.id === gameKey;
		gameSelect.appendChild(option);

		link.className = "game-card" + (game.id === gameKey ? " active" : "");
		link.href = getGameUrl(game.id);
		title.textContent = game.title;
		meta.textContent = game.id;
		link.appendChild(title);
		link.appendChild(meta);
		gameList.appendChild(link);
	});

	gameSelect.value = gameKey;
	gameSelect.onchange = () => changeGame(gameSelect.value);

	const currentFile = document.createElement("div");
	const categoryCount = document.createElement("div");
	const questionCount = document.createElement("div");
	const categoryNames = document.createElement("div");

	currentFile.textContent = "Valgt game: " + gameKey;
	categoryCount.textContent = "Kategorier: " + categories.length;
	questionCount.textContent = "Spørgsmål: " + getTotalQuestionCount();
	categoryNames.textContent =
		"Kategorier: " +
		categories.map((category) => category.title).join(", ");
	gameMeta.appendChild(currentFile);
	gameMeta.appendChild(categoryCount);
	gameMeta.appendChild(questionCount);
	gameMeta.appendChild(categoryNames);

	teamCountInput.value = teams.length || defaultTeamNames.length || 3;
	teamCountInput.onchange = () => {
		renderTeamFields(getTeamNamesFromForm());
	};
	teamCountInput.oninput = () => {
		renderTeamFields(getTeamNamesFromForm());
	};

	renderTeamFields(teams.map((team) => team.name));
}

function renderGame() {
	const title = document.getElementById("game-title");
	const gameName = document.getElementById("game-name");
	const scoreboard = document.getElementById("scoreboard");
	const categoryRow = document.getElementById("category-row");
	const board = document.getElementById("jeopardy-board");
	const slides = document.getElementById("slides");

	if (!scoreboard || !categoryRow || !board || !slides) {
		return;
	}

	if (title) {
		title.textContent = gameConfig.title;
	}

	if (gameName) {
		gameName.textContent = "Game: " + gameKey;
	}

	scoreboard.innerHTML = "";
	categoryRow.innerHTML = "";
	board.innerHTML = "";

	slides.querySelectorAll(".question-slide").forEach((slide) => {
		slide.remove();
	});

	teams.forEach((team) => {
		const scoreCard = document.createElement("div");
		const teamName = document.createElement("strong");
		const score = document.createElement("span");

		scoreCard.className = "score-card";
		teamName.textContent = team.name;
		score.id = "score-" + team.id;
		score.textContent = "0";
		scoreCard.appendChild(teamName);
		scoreCard.appendChild(score);
		scoreboard.appendChild(scoreCard);
	});

	categories.forEach((category) => {
		const categoryCell = document.createElement("div");

		categoryCell.className = "category";
		categoryCell.textContent = category.title;
		categoryRow.appendChild(categoryCell);
	});

	for (let questionIndex = 0; questionIndex < getQuestionRowCount(); questionIndex += 1) {
		categories.forEach((category, categoryIndex) => {
			const question = category.questions[questionIndex];

			if (!question) {
				const emptyTile = document.createElement("div");

				emptyTile.className = "points used";
				board.appendChild(emptyTile);
				return;
			}

			const displayCategoryIndex = categoryIndex + 1;
			const questionId = getQuestionId(displayCategoryIndex, question.points);
			const tile = document.createElement("div");
			const link = document.createElement("a");

			questionIdSet.add(questionId);
			tile.className = "points";
			tile.id = "tile-" + questionId;
			tile.dataset.category = category.title;
			tile.dataset.points = question.points;
			link.href = "#/" + questionId;
			link.textContent = question.points;
			link.setAttribute(
				"aria-label",
				category.title + " for " + question.points + " points"
			);
			link.addEventListener("click", () => {
				prepareQuestionForCorrection(questionId);
			});

			tile.appendChild(link);
			board.appendChild(tile);
		});
	}

	categories.forEach((category, categoryIndex) => {
		category.questions.forEach((question) => {
			const displayCategoryIndex = categoryIndex + 1;
			const questionId = getQuestionId(displayCategoryIndex, question.points);
			const slide = document.createElement("section");
			const heading = document.createElement("h2");
			const questionLayout = document.createElement("div");
			const questionMain = document.createElement("div");
			const questionSidebar = document.createElement("div");
			const pointBadge = document.createElement("div");
			const questionText = document.createElement("div");
			const answer = document.createElement("div");
			const questionActions = document.createElement("div");
			const showAnswerButton = document.createElement("button");
			const scoreControls = document.createElement("div");

			slide.id = questionId;
			slide.className = "question-slide";
			slide.dataset.points = question.points;
			slide.dataset.category = category.title;
			applySlideOptions(slide, question);
			heading.textContent = category.title;
			questionLayout.className = "question-layout";
			questionMain.className = "question-main";
			questionSidebar.className = "question-sidebar";
			pointBadge.className = "question-points";
			pointBadge.textContent = question.points;
			questionText.className = "question-text";
			answer.className = "answer";
			renderContent(questionText, question, "question");
			renderHints(questionText, question);
			renderContent(answer, question, "answer");
			questionActions.className = "question-actions";
			showAnswerButton.className = "game-button primary";
			showAnswerButton.type = "button";
			showAnswerButton.textContent = "Show answer";
			showAnswerButton.onclick = showAnswer;
			scoreControls.className = "score-controls";
			scoreControls.setAttribute("aria-label", "Score controls");

			questionActions.appendChild(showAnswerButton);
			teams.forEach((team) => {
				const row = document.createElement("div");
				const label = document.createElement("strong");
				const correctButton = document.createElement("button");
				const wrongButton = document.createElement("button");

				row.className = "team-score-row";
				label.textContent = team.name;
				correctButton.className = "game-button correct";
				correctButton.type = "button";
				correctButton.textContent = "+";
				correctButton.setAttribute(
					"aria-label",
					team.name + " correct, plus " + question.points
				);
				correctButton.onclick = () => changeScore(team.id, question.points);
				wrongButton.className = "game-button wrong";
				wrongButton.type = "button";
				wrongButton.textContent = "-";
				wrongButton.setAttribute(
					"aria-label",
					team.name + " wrong, minus " + question.points
				);
				wrongButton.onclick = () => changeScore(team.id, -question.points);

				row.appendChild(label);
				row.appendChild(correctButton);
				row.appendChild(wrongButton);
				scoreControls.appendChild(row);
			});

			slide.appendChild(heading);
			questionMain.appendChild(questionText);
			questionMain.appendChild(questionActions);
			questionMain.appendChild(answer);
			questionSidebar.appendChild(pointBadge);
			questionSidebar.appendChild(scoreControls);
			questionLayout.appendChild(questionMain);
			questionLayout.appendChild(questionSidebar);
			slide.appendChild(questionLayout);

			if (question.notes || question.notesHtml) {
				const notes = document.createElement("aside");

				notes.className = "notes";
				if (question.notesHtml) {
					notes.innerHTML = question.notesHtml;
				} else {
					notes.textContent = question.notes;
				}
				slide.appendChild(notes);
			}

			slides.appendChild(slide);
		});
	});
}

function updateScoreboard() {
	teamIds.forEach((teamId) => {
		const scoreElement = document.getElementById("score-" + teamId);

		if (scoreElement) {
			scoreElement.textContent = scores[teamId] || 0;
		}
	});
}

function setTileAvailable(questionId) {
	const tile = document.getElementById("tile-" + questionId);

	if (!tile) {
		return;
	}

	const link = tile.querySelector("a");

	tile.classList.remove("used");
	tile.removeAttribute("aria-disabled");

	if (link) {
		link.textContent = tile.dataset.points || "";
		link.removeAttribute("tabindex");
		link.setAttribute(
			"aria-label",
			(tile.dataset.category || "Question") +
				" for " +
				(tile.dataset.points || "") +
				" points"
		);
	}
}

function setTileUsed(questionId) {
	const tile = document.getElementById("tile-" + questionId);

	if (!tile) {
		return;
	}

	const link = tile.querySelector("a");

	tile.classList.add("used");

	if (link) {
		link.textContent = "Taget";
		link.removeAttribute("tabindex");
		link.setAttribute("aria-label", "Taget sporgsmaal. Klik for at rette.");
	}
}

function updateUsedTiles() {
	document.querySelectorAll(".points").forEach((tile) => {
		if (tile.id && tile.id.startsWith("tile-")) {
			setTileAvailable(tile.id.replace("tile-", ""));
		}
	});

	usedQuestions.forEach((questionId) => {
		setTileUsed(questionId);
	});
}

function showAnswer() {
	const currentSlide = getCurrentQuestionSlide();

	if (!currentSlide) {
		return;
	}

	revealAnswerForQuestion(currentSlide.id);
	broadcastGameMessage("answer-shown", {
		questionId: currentSlide.id,
	});
}

function revealAnswerForQuestion(questionId) {
	const slide = document.getElementById(questionId);

	if (!slide || !isQuestionId(questionId)) {
		return;
	}

	const answer = slide.querySelector(".answer");

	if (!answer) {
		return;
	}

	answer.classList.add("visible");

	if (
		typeof Reveal !== "undefined" &&
		Reveal.layout &&
		getCurrentQuestionSlide() === slide
	) {
		Reveal.layout();
	}
}

function clearVisibleAnswers() {
	document.querySelectorAll(".answer.visible").forEach((answer) => {
		answer.classList.remove("visible");
	});
}

