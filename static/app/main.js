function saveSettingsAndReload(targetHash) {
	writeGameSettings(getTeamNamesFromForm());
	refreshGameFromSettings(targetHash || "/home");
}

function startConfiguredGame() {
	saveSettingsAndReload("/board");
}

function resetGameSettings() {
	try {
		localStorage.removeItem(getSettingsStorageKey());
	} catch (error) {
		console.warn("Could not reset game settings.", error);
	}

	refreshGameFromSettings("/home");
}

function getSlideIdFromHash(targetHash) {
	return String(targetHash || "/home").replace(/^#?\//, "") || "home";
}

function refreshGameFromSettings(targetHash) {
	window.location.hash = "/" + getSlideIdFromHash(targetHash);
	window.location.reload();
}

function getGameUrl(key) {
	const url = new URL(window.location.href);

	url.searchParams.set("game", key);
	url.hash = "/home";

	return url.toString();
}

function changeGame(key) {
	if (!getGameRecord(key) || key === gameKey) {
		return;
	}

	window.location.href = getGameUrl(key);
}

function getCurrentQuestionSlide() {
	if (typeof Reveal !== "undefined" && Reveal.getCurrentSlide) {
		return Reveal.getCurrentSlide();
	}

	return document.querySelector(".question-slide.present");
}

function isCurrentQuestionSlide() {
	const currentSlide = getCurrentQuestionSlide();

	return (
		currentSlide &&
		currentSlide.classList &&
		currentSlide.classList.contains("question-slide") &&
		isQuestionId(currentSlide.id)
	);
}

function getKeyboardKey(event) {
	return event.key || KEY_CODE_TO_KEY[event.keyCode] || "";
}

function stopKeyboardEvent(event) {
	if (event.preventDefault) {
		event.preventDefault();
	}

	if (event.stopPropagation) {
		event.stopPropagation();
	}

	if (event.stopImmediatePropagation) {
		event.stopImmediatePropagation();
	}
}

function handleQuestionNavigationKey(event) {
	const key = getKeyboardKey(event);

	if (
		!isCurrentQuestionSlide() ||
		event.altKey ||
		event.ctrlKey ||
		event.metaKey
	) {
		return false;
	}

	if (
		key !== "ArrowLeft" &&
		key !== "ArrowRight" &&
		key !== "ArrowUp" &&
		key !== "ArrowDown"
	) {
		return false;
	}

	stopKeyboardEvent(event);

	if (key === "ArrowLeft" || key === "ArrowUp") {
		allowQuestionBoardNavigation = true;
		goToBoard();
		return true;
	}

	if (typeof Reveal !== "undefined" && Reveal.nextFragment) {
		Reveal.nextFragment();
	}

	return true;
}

function handleQuestionArrowKeys(event) {
	handleQuestionNavigationKey(event);
}

function handleRevealArrowKey(keyCode, event) {
	if (handleQuestionNavigationKey(event || { keyCode })) {
		return;
	}

	if (typeof Reveal === "undefined") {
		return;
	}

	const config = Reveal.getConfig ? Reveal.getConfig() : {};
	const skipFragments = Boolean(event && event.altKey);
	const shiftKey = Boolean(event && event.shiftKey);
	const overviewActive =
		Reveal.overview && Reveal.overview.isActive
			? Reveal.overview.isActive()
			: false;
	const useLinearMode =
		config.navigationMode === "linear" ||
		!Reveal.hasHorizontalSlides ||
		!Reveal.hasVerticalSlides ||
		!Reveal.hasHorizontalSlides() ||
		!Reveal.hasVerticalSlides();

	if (keyCode === 37) {
		if (shiftKey && Reveal.slide) {
			Reveal.slide(0);
		} else if (!overviewActive && useLinearMode) {
			(config.rtl ? Reveal.next : Reveal.prev)({ skipFragments });
		} else if (Reveal.left) {
			Reveal.left({ skipFragments });
		}
	} else if (keyCode === 38) {
		if (shiftKey && Reveal.slide) {
			Reveal.slide(undefined, 0);
		} else if (!overviewActive && useLinearMode) {
			Reveal.prev({ skipFragments });
		} else if (Reveal.up) {
			Reveal.up({ skipFragments });
		}
	} else if (keyCode === 39) {
		if (shiftKey && Reveal.slide && Reveal.getHorizontalSlides) {
			Reveal.slide(Reveal.getHorizontalSlides().length - 1);
		} else if (!overviewActive && useLinearMode) {
			(config.rtl ? Reveal.prev : Reveal.next)({ skipFragments });
		} else if (Reveal.right) {
			Reveal.right({ skipFragments });
		}
	} else if (keyCode === 40) {
		if (shiftKey && Reveal.slide) {
			Reveal.slide(undefined, Number.MAX_VALUE);
		} else if (!overviewActive && useLinearMode) {
			Reveal.next({ skipFragments });
		} else if (Reveal.down) {
			Reveal.down({ skipFragments });
		}
	}
}

function getTopLevelSlideIndex(slideId) {
	const topLevelSlides = Array.from(
		document.querySelectorAll(".reveal .slides > section")
	);

	return topLevelSlides.findIndex((slide) => slide.id === slideId);
}

function goToSlideId(slideId) {
	const slideIndex = getTopLevelSlideIndex(slideId);

	if (typeof Reveal !== "undefined" && Reveal.slide && slideIndex >= 0) {
		Reveal.slide(slideIndex);
		return;
	}

	window.location.hash = "/" + slideId;
}

function goToHome() {
	goToSlideId("home");
}

function goToBoard() {
	goToSlideId("board");
}

function initializeReveal() {
	Reveal.initialize({
		hash: true,
		controls: false,
		markdown: {
			smartypants: true,
		},
		mathjax4: {
			tex: {
				inlineMath: [
					["$", "$"],
					["\\(", "\\)"],
				],
				displayMath: [
					["$$", "$$"],
					["\\[", "\\]"],
				],
			},
		},
		plugins: [
			RevealMarkdown,
			RevealHighlight,
			RevealNotes,
			RevealMath.MathJax4,
			RevealSearch,
			RevealZoom,
		],
	});

	[37, 38, 39, 40].forEach((keyCode) => {
		Reveal.addKeyBinding(keyCode, (event) => {
			handleRevealArrowKey(keyCode, event);
		});
	});

	Reveal.on("slidechanged", (event) => {
		if (!event || !event.currentSlide) {
			return;
		}

		const previousQuestionId = event.previousSlide ? event.previousSlide.id : "";
		const canGoBackToBoard = allowQuestionBoardNavigation;

		allowQuestionBoardNavigation = false;

		if (
			event.currentSlide.id === "board" &&
			isQuestionId(previousQuestionId) &&
			!canGoBackToBoard &&
			!usedQuestions.includes(previousQuestionId) &&
			typeof Reveal !== "undefined" &&
			Reveal.getIndices &&
			Reveal.slide
		) {
			const previousIndices = Reveal.getIndices(event.previousSlide);

			if (previousIndices) {
				Reveal.slide(previousIndices.h, previousIndices.v, previousIndices.f);
			}

			return;
		}

		const answer = event.currentSlide.querySelector(".answer.visible");

		if (answer) {
			answer.classList.remove("visible");
		}
	});

	window.addEventListener("keydown", handleQuestionArrowKeys, true);
}

loadGameFile().then(() => {
	initializeGameData();
	renderHome();
	initializeGameBuilder();
	renderGame();
	loadGameState();
	initializeGameSync();
	initializeReveal();
});
