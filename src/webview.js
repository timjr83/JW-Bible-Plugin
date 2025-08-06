initializeScrollListener();

function setScrollListener() {
	console.log("Setting up scroll listener");
	const container = document.querySelector("#scrollContainer");
	if (container) {
		// Remove any existing scroll listener to prevent duplicates
		container.removeEventListener("scroll", handleScroll);
		container.addEventListener("scroll", handleScroll);
		return true;
	}
	return false;
}

function handleScroll(event) {
	const target = event.target;
	console.log("Scroll event detected:", target.scrollTop);
	webviewApi.postMessage({ name: "scrollPosition", value: target.scrollTop });
}

// Try to set up immediately
function initializeScrollListener() {
	console.log("Initializing scroll listener");
	if (!setScrollListener()) {
		// If not found, observe DOM changes until they appear
		const mo = new MutationObserver(() => {
			if (setScrollListener()) {
				mo.disconnect();
			}
		});
		mo.observe(document.body, { childList: true, subtree: true });
	}
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

if (window.webviewApi?.onMessage) {
	window.webviewApi.onMessage(env => {
		console.log("Received message from main process:", env);

		const { name, value } = env.message;

		switch (name) {
			case "restoreScroll":
				const container = document.querySelector("#scrollContainer");
				if (container) {
					container.scrollTop = value ?? 0;
				}
				break;

			case "setScrollListener":
				console.log("Setting up scroll listener");
				initializeScrollListener();
				break;

			default:
				console.warn(`Unhandled message name: ${name}`);
		}
	});
}
