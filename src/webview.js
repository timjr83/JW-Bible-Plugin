function handleGetScrollPosition() {
  const container = document.querySelector("#scrollContainer");
  console.log("Getting scroll position:", container.scrollTop);
  webviewApi.postMessage({
    name: "scrollPosition",
    value: container.scrollTop,
  });
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
  window.webviewApi.onMessage((env) => {
    const { name, value } = env.message;

    switch (name) {
      case "restoreScroll":
        const container = document.querySelector("#scrollContainer");
        if (container) {
          container.scrollTop = value ?? 0;
          //initializeScrollListener();
        }
        break;

      case "getScrollPosition":
        handleGetScrollPosition();
        break;

      default:
        console.warn(`Unhandled message name: ${name}`);
    }
  });
}

// Track last width to avoid duplicate events
let lastWidth = window.innerWidth;

window.addEventListener("resize", () => {
  const newWidth = window.innerWidth;
  if (newWidth !== lastWidth) {
    lastWidth = newWidth;
    console.log("Webview width changed:", newWidth);
    handleGetScrollPosition();
  }
});
