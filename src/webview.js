document.addEventListener('click', event => {
	const target = event.target;
	if (target.classList.contains('insert-icon')) {
		const book = target.getAttribute("data-book");
		const chapter = target.getAttribute("data-chapter");
		const verses = target.getAttribute("data-verses");

		webviewApi.postMessage({
			name: 'inserttext',
			book: book,
			chapter: chapter,
			verses: verses,
		});
	}
});

