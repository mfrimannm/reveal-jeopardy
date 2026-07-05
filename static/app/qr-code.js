function renderQrCode(container, value) {
	const image = document.createElement("img");

	image.className = "live-qr-svg";
	image.alt = "QR kode til join-link";
	image.decoding = "async";
	image.src = "/api/qr-code?value=" + encodeURIComponent(value);

	container.replaceChildren(image);
}
