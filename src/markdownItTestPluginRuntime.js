const addClickHandlers = () => {
	const postMessageLinks = document.querySelectorAll('.bible-reference');
	for (const link of postMessageLinks) {
		const contentScriptId = 'justtesting';
		link.onclick = async () => {
			const response = await webviewApi.postMessage(contentScriptId, 'justtesting');
			link.textContent = 'Got response in content script: ' + response;
		};
	}
};

document.addEventListener('joplin-noteDidUpdate', () => {
	addClickHandlers();
});