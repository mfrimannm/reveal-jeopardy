function createRichContent(content, format) {
	return {
		format: format === "html" ? "html" : "rich",
		content: String(content || ""),
	};
}

function normalizeRichContent(value) {
	if (value && typeof value === "object") {
		return createRichContent(value.content, value.format);
	}

	return createRichContent(value || "", "rich");
}

function escapeHtml(value) {
	return String(value || "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function renderInlineRichText(value) {
	let html = escapeHtml(value);

	html = html.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_match, alt, src) => {
		return (
			'<img src="' +
			escapeHtmlAttribute(src) +
			'" alt="' +
			escapeHtmlAttribute(alt) +
			'">'
		);
	});
	html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_match, text, href) => {
		return (
			'<a href="' +
			escapeHtmlAttribute(href) +
			'" target="_blank" rel="noopener noreferrer">' +
			text +
			"</a>"
		);
	});
	html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
	html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
	html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");

	return html;
}

function parseRichTokenAttributes(value) {
	const attributes = {};
	const pattern = /([a-z]+)="([^"]*)"/gi;
	let match = pattern.exec(value || "");

	while (match) {
		attributes[match[1]] = match[2];
		match = pattern.exec(value || "");
	}

	return attributes;
}

function parseBooleanAttribute(value, fallback) {
	if (value === undefined) {
		return Boolean(fallback);
	}

	return value === "true" || value === "1" || value === "";
}

function parseRichMediaToken(line) {
	const match = String(line || "").trim().match(/^::(youtube|video|audio)\s*([\s\S]*?)::$/i);

	if (!match) {
		return null;
	}

	const attributes = parseRichTokenAttributes(match[2]);

	if (match[1].toLowerCase() === "youtube") {
		return normalizeMedia({
			type: "youtube",
			url: attributes.url,
			start: attributes.start,
			end: attributes.end,
			autoplay: parseBooleanAttribute(attributes.autoplay, false),
			loop: parseBooleanAttribute(attributes.loop, false),
			controls: parseBooleanAttribute(attributes.controls, true),
			muted: parseBooleanAttribute(attributes.muted, false),
		});
	}

	if (match[1].toLowerCase() === "video") {
		return normalizeMedia({
			type: "video",
			src: attributes.src,
			start: attributes.start,
			autoplay: parseBooleanAttribute(attributes.autoplay, false),
			loop: parseBooleanAttribute(attributes.loop, false),
			controls: parseBooleanAttribute(attributes.controls, true),
			muted: parseBooleanAttribute(attributes.muted, false),
		});
	}

	return {
		type: "audio",
		src: attributes.src || "",
		controls: parseBooleanAttribute(attributes.controls, true),
		autoplay: parseBooleanAttribute(attributes.autoplay, false),
		loop: parseBooleanAttribute(attributes.loop, false),
		muted: parseBooleanAttribute(attributes.muted, false),
	};
}

function renderMediaTokenToHtml(media) {
	const element = createMediaElement(media);
	const wrapper = document.createElement("div");

	if (!element) {
		return "";
	}

	wrapper.className = "question-media";
	wrapper.appendChild(element);
	appendMediaSourceLink(wrapper, media);

	return wrapper.outerHTML;
}

function getMediaSource(media) {
	if (!media || typeof media !== "object") {
		return "";
	}

	return media.url || media.src || "";
}

function appendMediaSourceLink(wrapper, media) {
	const source = getMediaSource(media);

	if (!source) {
		return;
	}

	const link = document.createElement("a");

	link.className = "question-media-source";
	link.href = source;
	link.target = "_blank";
	link.rel = "noopener noreferrer";
	link.textContent = source;
	wrapper.appendChild(link);
}

function renderRichTextToHtml(value) {
	const lines = String(value || "").split(/\r?\n/);
	const blocks = [];
	let paragraph = [];
	let list = [];

	function flushParagraph() {
		if (!paragraph.length) {
			return;
		}

		blocks.push("<p>" + paragraph.map(renderInlineRichText).join("<br>") + "</p>");
		paragraph = [];
	}

	function flushList() {
		if (!list.length) {
			return;
		}

		blocks.push(
			"<ul>" +
				list.map((item) => "<li>" + renderInlineRichText(item) + "</li>").join("") +
				"</ul>"
		);
		list = [];
	}

	lines.forEach((line) => {
		const heading = line.match(/^(#{1,3})\s+(.+)$/);
		const bullet = line.match(/^\s*[-*]\s+(.+)$/);
		const quote = line.match(/^\s*>\s+(.+)$/);
		const mediaToken = parseRichMediaToken(line);

		if (!line.trim()) {
			flushParagraph();
			flushList();
			return;
		}

		if (mediaToken) {
			flushParagraph();
			flushList();
			blocks.push(renderMediaTokenToHtml(mediaToken));
			return;
		}

		if (heading) {
			flushParagraph();
			flushList();
			blocks.push(
				"<h" +
					heading[1].length +
					">" +
					renderInlineRichText(heading[2]) +
					"</h" +
					heading[1].length +
					">"
			);
			return;
		}

		if (bullet) {
			flushParagraph();
			list.push(bullet[1]);
			return;
		}

		if (quote) {
			flushParagraph();
			flushList();
			blocks.push("<blockquote>" + renderInlineRichText(quote[1]) + "</blockquote>");
			return;
		}

		flushList();
		paragraph.push(line);
	});

	flushParagraph();
	flushList();

	return blocks.join("");
}

function renderRichContent(container, value) {
	const content = normalizeRichContent(value);

	container.innerHTML = "";

	if (content.format === "html") {
		container.innerHTML = content.content;
		prepareYouTubeIframes(container);
		return;
	}

	container.innerHTML = renderRichTextToHtml(content.content);
	prepareRenderedMedia(container);
}

function prepareRenderedMedia(container) {
	container.querySelectorAll("video[autoplay], audio[autoplay]").forEach((media) => {
		media.dataset.autoplay = "true";
		media.autoplay = false;
		media.removeAttribute("autoplay");
	});

	container.querySelectorAll("video[data-start]").forEach((video) => {
		const start = Number(video.dataset.start);

		if (!Number.isFinite(start)) {
			return;
		}

		video.addEventListener(
			"loadedmetadata",
			() => {
				video.currentTime = start;
			},
			{ once: true }
		);
	});

	syncRenderedMediaPlayback(container);
}

function renderQuestionPart(container, question, kind) {
	renderRichContent(container, question ? question[kind] : null);
}

function normalizeHints(hints) {
	if (!Array.isArray(hints)) {
		return [];
	}

	return hints
		.map((hint) =>
			hint && typeof hint === "object"
				? normalizeRichContent(hint)
				: createRichContent(hint || "", "rich")
		)
		.filter((hint) => hint.content.trim());
}

function renderQuestionHints(container, hintsSource) {
	const hints = normalizeHints(hintsSource);

	if (!hints.length) {
		return;
	}

	const hintsElement = document.createElement("div");
	const hintCue = document.createElement("div");

	hintsElement.className = "question-hints";
	hintCue.className = "hint-cue";
	hintCue.textContent = "Højre/ned giver hints. Venstre/op går til boardet.";
	hintsElement.appendChild(hintCue);

	hints.forEach((hint, index) => {
		const hintElement = document.createElement("div");

		hintElement.className = "fragment";
		hintElement.dataset.fragmentIndex = String(index);
		renderRichContent(hintElement, hint);
		hintsElement.appendChild(hintElement);
	});

	container.appendChild(hintsElement);
}

function normalizeNumberSetting(value) {
	const parsed = Number(value);

	return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : null;
}

function normalizeMedia(media) {
	if (!media || typeof media !== "object" || media.type === "none") {
		return null;
	}

	if (media.type === "youtube") {
		const url = String(media.url || "").trim();

		if (!url) {
			return null;
		}

		return {
			type: "youtube",
			url,
			start: normalizeNumberSetting(media.start),
			end: normalizeNumberSetting(media.end),
			autoplay: Boolean(media.autoplay),
			loop: Boolean(media.loop),
			controls: media.controls !== false,
			muted: Boolean(media.muted),
		};
	}

	if (media.type === "video") {
		const src = String(media.src || media.url || "").trim();

		if (!src) {
			return null;
		}

		return {
			type: "video",
			src,
			start: normalizeNumberSetting(media.start),
			autoplay: Boolean(media.autoplay),
			loop: Boolean(media.loop),
			controls: media.controls !== false,
			muted: Boolean(media.muted),
		};
	}

	return null;
}

function createYouTubeEmbedUrlFromMedia(media) {
	const normalized = normalizeMedia(media);
	const videoId = normalized && normalized.type === "youtube" ? getYouTubeVideoId(normalized.url) : "";
	const baseUrl = videoId ? "https://www.youtube.com/embed/" + videoId : String(media.url || "");
	const params = new URLSearchParams();

	params.set("rel", "0");

	if (normalized.start !== null) {
		params.set("start", String(normalized.start));
	}

	if (normalized.end !== null) {
		params.set("end", String(normalized.end));
	}

	if (normalized.autoplay) {
		params.set("autoplay", "1");
	}

	if (normalized.loop && videoId) {
		params.set("loop", "1");
		params.set("playlist", videoId);
	}

	params.set("controls", normalized.controls ? "1" : "0");

	if (normalized.muted) {
		params.set("mute", "1");
	}

	return baseUrl + (baseUrl.includes("?") ? "&" : "?") + params.toString();
}

function createMediaElement(media) {
	if (media && media.type === "audio" && media.src) {
		const audio = document.createElement("audio");

		audio.src = media.src;
		audio.controls = media.controls !== false;
		audio.loop = Boolean(media.loop);
		audio.muted = Boolean(media.muted);

		if (media.autoplay) {
			audio.dataset.autoplay = "true";
		}

		return audio;
	}

	const normalized = normalizeMedia(media);

	if (!normalized) {
		return null;
	}

	if (normalized.type === "youtube") {
		const iframe = document.createElement("iframe");
		const passiveMedia = {
			...normalized,
			autoplay: false,
		};

		iframe.src = createYouTubeEmbedUrlFromMedia(passiveMedia);
		iframe.title = "YouTube video";
		iframe.allow =
			"accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
		iframe.allowFullscreen = true;

		if (normalized.autoplay) {
			iframe.dataset.autoplay = "true";
			iframe.dataset.baseSrc = iframe.src;
			iframe.dataset.autoplaySrc = createYouTubeEmbedUrlFromMedia(normalized);
		}

		return iframe;
	}

	if (normalized.type === "video") {
		const video = document.createElement("video");

		video.src = normalized.src;
		video.controls = normalized.controls;
		video.loop = normalized.loop;
		video.muted = normalized.muted;
		video.playsInline = true;

		if (normalized.autoplay) {
			video.dataset.autoplay = "true";
		}

		if (normalized.start !== null) {
			video.dataset.start = String(normalized.start);
			video.addEventListener(
				"loadedmetadata",
				() => {
					if (Number.isFinite(normalized.start)) {
						video.currentTime = normalized.start;
					}
				},
				{ once: true }
			);
		}

		return video;
	}

	return null;
}

function renderQuestionMedia(container, media) {
	const element = createMediaElement(media);

	if (!element) {
		return;
	}

	const wrapper = document.createElement("div");

	wrapper.className = "question-media";
	wrapper.appendChild(element);
	appendMediaSourceLink(wrapper, media);
	container.appendChild(wrapper);
	syncRenderedMediaPlayback(wrapper);
}

function isElementInCurrentRevealSlide(element) {
	const slide = element.closest(".reveal .slides > section");

	if (!slide) {
		return null;
	}

	if (typeof Reveal === "undefined" || !Reveal.getCurrentSlide) {
		return slide.classList.contains("present");
	}

	return Reveal.getCurrentSlide() === slide;
}

function isElementVisiblyOnScreen(element) {
	const revealState = isElementInCurrentRevealSlide(element);

	if (revealState !== null) {
		return revealState;
	}

	if (!element.isConnected || element.closest("[hidden]")) {
		return false;
	}

	const rect = element.getBoundingClientRect();
	const width = window.innerWidth || document.documentElement.clientWidth;
	const height = window.innerHeight || document.documentElement.clientHeight;

	return (
		rect.width > 0 &&
		rect.height > 0 &&
		rect.bottom > 0 &&
		rect.right > 0 &&
		rect.top < height &&
		rect.left < width
	);
}

function syncRenderedMediaPlayback(root) {
	const scope = root || document;

	scope.querySelectorAll("video, audio").forEach((media) => {
		const shouldPlay = media.dataset.autoplay === "true" && isElementVisiblyOnScreen(media);

		if (!shouldPlay) {
			media.pause();
			return;
		}

		if (media.paused) {
			media.play().catch(() => {});
		}
	});

	scope.querySelectorAll("iframe[data-autoplay='true'][data-autoplay-src]").forEach((iframe) => {
		const shouldPlay = isElementVisiblyOnScreen(iframe);
		const targetSrc = shouldPlay ? iframe.dataset.autoplaySrc : iframe.dataset.baseSrc;

		if (targetSrc && iframe.src !== targetSrc) {
			iframe.src = targetSrc;
		}
	});
}

globalThis.syncRenderedMediaPlayback = syncRenderedMediaPlayback;
