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

function isSpaceKey(key) {
	return key === " " || key === "Space" || key === "Spacebar";
}

function isHintKey(key) {
	return String(key || "").toLowerCase() === "h";
}

function isArrowKey(key) {
	return (
		key === "ArrowLeft" ||
		key === "ArrowRight" ||
		key === "ArrowUp" ||
		key === "ArrowDown"
	);
}

function isKeyboardInputTarget(target) {
	if (!target || !target.closest) {
		return false;
	}

	return Boolean(
		target.closest(
			"input, textarea, select, [contenteditable=''], [contenteditable='true']"
		)
	);
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

function getCurrentSlide() {
	if (typeof Reveal !== "undefined" && Reveal.getCurrentSlide) {
		return Reveal.getCurrentSlide();
	}

	return document.querySelector(".reveal .slides > section.present");
}

function isInHiddenFragment(element) {
	const fragment = element.closest ? element.closest(".fragment") : null;

	return Boolean(fragment && !fragment.classList.contains("visible"));
}

function getAutoplayIframeSrc(iframe) {
	const autoplaySrc = iframe.dataset.autoplaySrc;

	if (autoplaySrc && iframe.src !== autoplaySrc) {
		return autoplaySrc;
	}

	if (!iframe.src || !/youtube\.com\/embed\//i.test(iframe.src)) {
		return "";
	}

	try {
		const url = new URL(iframe.src);

		url.searchParams.set("autoplay", "1");
		return url.toString();
	} catch (error) {
		return iframe.src + (iframe.src.includes("?") ? "&" : "?") + "autoplay=1";
	}
}

function playMediaSequence(mediaElements, startIndex) {
	const media = mediaElements[startIndex];

	if (!media) {
		return;
	}

	const playNextMedia = () => {
		playMediaSequence(mediaElements, startIndex + 1);
	};

	if (media.ended) {
		media.currentTime = 0;
	}

	media.addEventListener("ended", playNextMedia, { once: true });
	media.play().catch(() => {
		media.removeEventListener("ended", playNextMedia);
	});
}

function startCurrentSlideMedia() {
	const currentSlide = getCurrentSlide();

	if (!currentSlide) {
		return false;
	}

	const mediaElements = Array.from(currentSlide.querySelectorAll("video, audio")).filter(
		(media) => !isInHiddenFragment(media)
	);
	const activeMedia = mediaElements.find((media) => !media.paused && !media.ended);

	if (activeMedia) {
		return true;
	}

	const unfinishedMediaIndex = mediaElements.findIndex((element) => !element.ended);
	const startIndex = unfinishedMediaIndex >= 0 ? unfinishedMediaIndex : 0;

	if (mediaElements[startIndex]) {
		if (unfinishedMediaIndex < 0) {
			mediaElements.forEach((media) => {
				media.currentTime = 0;
			});
		}

		playMediaSequence(mediaElements, startIndex);
		return true;
	}

	const iframe = Array.from(currentSlide.querySelectorAll("iframe")).find(
		(element) => !isInHiddenFragment(element) && getAutoplayIframeSrc(element)
	);

	if (!iframe) {
		return false;
	}

	const autoplaySrc = getAutoplayIframeSrc(iframe);

	if (autoplaySrc && iframe.src !== autoplaySrc) {
		iframe.src = autoplaySrc;
		return true;
	}

	return false;
}

function showNextHint() {
	if (typeof Reveal !== "undefined" && Reveal.nextFragment) {
		Reveal.nextFragment();
	}
}

function syncFragmentMediaPlayback(event) {
	if (typeof syncRenderedMediaPlayback !== "function") {
		return;
	}

	const fragments = event && event.fragments ? Array.from(event.fragments) : [];

	if (!fragments.length) {
		return;
	}

	fragments.forEach((fragment) => {
		syncRenderedMediaPlayback(fragment);
	});
}

function handleQuestionKeyboardKey(event) {
	const key = getKeyboardKey(event);

	if (
		!isCurrentQuestionSlide() ||
		event.altKey ||
		event.ctrlKey ||
		event.metaKey
	) {
		return false;
	}

	if (key !== "Escape" && !isSpaceKey(key) && !isHintKey(key) && !isArrowKey(key)) {
		return false;
	}

	stopKeyboardEvent(event);

	if (key === "Escape") {
		goToHome();
		return true;
	}

	if (isSpaceKey(key)) {
		startCurrentSlideMedia();

		return true;
	}

	if (isHintKey(key)) {
		showNextHint();

		return true;
	}

	if (key === "ArrowUp") {
		allowQuestionBoardNavigation = true;
		goToBoard();
	}

	return true;
}

function handleBoardKeyboardKey(event) {
	const currentSlide = getCurrentSlide();
	const key = getKeyboardKey(event);

	if (
		!currentSlide ||
		currentSlide.id !== "board" ||
		event.altKey ||
		event.ctrlKey ||
		event.metaKey
	) {
		return false;
	}

	if (key !== "Escape" && !isSpaceKey(key) && !isHintKey(key) && !isArrowKey(key)) {
		return false;
	}

	stopKeyboardEvent(event);

	if (key === "ArrowUp" || key === "Escape") {
		goToHome();
	}

	return true;
}

function handleGameKeyboardKey(event) {
	if (isKeyboardInputTarget(event.target)) {
		return false;
	}

	return handleQuestionKeyboardKey(event) || handleBoardKeyboardKey(event);
}

function handleRevealArrowKey(keyCode, event) {
	if (handleGameKeyboardKey(event || { keyCode })) {
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

	[27, 32, 72].forEach((keyCode) => {
		Reveal.addKeyBinding(keyCode, (event) => {
			handleGameKeyboardKey(event || { keyCode });
		});
	});

	Reveal.on("slidechanged", (event) => {
		if (!event || !event.currentSlide) {
			return;
		}

		if (typeof syncRenderedMediaPlayback === "function") {
			syncRenderedMediaPlayback(document);
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

			if (typeof syncLiveSlideChange === "function") {
				syncLiveSlideChange(isQuestionId(event.currentSlide.id) ? event.currentSlide.id : null);
			} else if (typeof syncLiveCurrentQuestion === "function") {
				syncLiveCurrentQuestion(isQuestionId(event.currentSlide.id) ? event.currentSlide.id : null);
			}
		});

	Reveal.on("fragmentshown", syncFragmentMediaPlayback);

	Reveal.on("fragmenthidden", syncFragmentMediaPlayback);

	window.addEventListener("keydown", handleGameKeyboardKey, true);
}

loadGameFile().then(() => {
	initializeGameData();
	renderHome();
	initializeGameBuilder();
	renderGame();
	loadGameState();
	initializeHostControls();
	initializeGameSync();
	initializeReveal();
});
