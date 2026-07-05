function escapeHtmlAttribute(value) {
	return String(value || "")
		.replace(/&/g, "&amp;")
		.replace(/"/g, "&quot;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

function getYouTubeVideoId(url) {
	const value = String(url || "").trim();

	if (!value) {
		return "";
	}

	const shortMatch = value.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/i);
	const embedMatch = value.match(/youtube(?:-nocookie)?\.com\/embed\/([A-Za-z0-9_-]{6,})/i);
	const watchMatch = value.match(/[?&]v=([A-Za-z0-9_-]{6,})/i);

	return (embedMatch && embedMatch[1]) || (shortMatch && shortMatch[1]) || (watchMatch && watchMatch[1]) || "";
}

function getYouTubeStartSeconds(url) {
	const value = String(url || "");
	const startMatch = value.match(/[?&]start=(\d+)/i);
	const timeMatch = value.match(/[?&]t=(\d+)s?/i);

	return (startMatch && startMatch[1]) || (timeMatch && timeMatch[1]) || "";
}

function createYouTubeEmbedUrl(url) {
	const value = String(url || "").trim();
	const videoId = getYouTubeVideoId(url);
	const start = getYouTubeStartSeconds(url);

	return videoId
		? "https://www.youtube.com/embed/" +
		  videoId +
		  "?rel=0" +
		  (start ? "&start=" + start : "")
		: value;
}

function createYouTubeIframe(url) {
	const src = createYouTubeEmbedUrl(url);

	return (
		'<iframe src="' +
		escapeHtmlAttribute(src) +
		'" title="YouTube video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>'
	);
}

function appendUrlParam(url, name, value) {
	const separator = url.includes("?") ? "&" : "?";
	const pattern = new RegExp("([?&])" + name + "=", "i");

	return pattern.test(url) ? url : url + separator + name + "=" + value;
}

function isYouTubeEmbedUrl(url) {
	return /youtube(?:-nocookie)?\.com\/embed\//i.test(url || "");
}

function prepareYouTubeEmbedUrl(url) {
	let src = String(url || "");

	if (!isYouTubeEmbedUrl(src)) {
		return src;
	}

	src = appendUrlParam(src, "autoplay", "1");
	src = appendUrlParam(src, "enablejsapi", "1");

	return src;
}

function prepareYouTubeIframes(container) {
	container
		.querySelectorAll("iframe[src], iframe[data-src]")
		.forEach((iframe) => {
			const src =
				iframe.getAttribute("data-src") || iframe.getAttribute("src") || "";
			const allow = iframe.getAttribute("allow") || "";

			if (!isYouTubeEmbedUrl(src)) {
				return;
			}

			iframe.setAttribute("data-autoplay", "");
			iframe.setAttribute(
				"allow",
				allow.includes("autoplay")
					? allow
					: allow
						? allow + "; autoplay"
						: "autoplay"
			);
			iframe.setAttribute("data-src", prepareYouTubeEmbedUrl(src));
			iframe.removeAttribute("src");
		});
}
