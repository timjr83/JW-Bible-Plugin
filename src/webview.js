document.addEventListener('click', event => {
	const element = event.target;
	if (element.className === 'inserttext') {
		webviewApi.postMessage({
			name: 'inserttext',
		    book: element.book,
		    chapter: element.chapter,
		    verses: element.verses,
		});
	}
})

