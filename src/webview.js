function setScrollListeners() {
	const container = document.querySelectorAll("#scrollContainer");
	if( container.length > 0) {
		console.log("Setting up scroll listeners for container");
		container.forEach((el) => {
			el.addEventListener("scroll", () => {
				console.log("Scroll event detected in container");
				webviewApi.postMessage({ name: "scrollPosition", value: el.scrollTop });
			});
		});
		return true;
	}
}

// Try to set up immediately
if (!setScrollListeners()) {
	// If not found, observe DOM changes until they appear
	const scrollmo = new MutationObserver(() => {
		if (setScrollListeners()) {
			scrollmo.disconnect();
		}
	});
	scrollmo.observe(document.body, { childList: true, subtree: true });
}


document.addEventListener("click", (event) => {
	const target = event.target;
	if (target.classList.contains("insert-icon")) {
		const book = target.getAttribute("data-book");
		const chapter = target.getAttribute("data-chapter");
		const verses = target.getAttribute("data-verses");

		webviewApi.postMessage({
			name: "inserttext",
			book: book,
			chapter: chapter,
			verses: verses,
		});
	}
});

if (window.webviewApi && window.webviewApi.onMessage) {
	window.webviewApi.onMessage(env => {
		console.log("Received message from main process:", env);
		if (env.message.name === "restoreScroll") {
			const container = document.querySelector("#scrollContainer");
			if (container) {
				container.scrollTop = env.message.value || 0;
			}
		}
		if (env.message.name === "setScrollListeners") {
			setScrollListeners();
		}
	});
}
