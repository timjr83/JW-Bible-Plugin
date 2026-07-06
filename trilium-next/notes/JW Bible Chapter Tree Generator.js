const DATA_NOTE_TITLE = "JW Bible EN Data";
const DATA_LABEL = "jwBibleData";
const DIALOG_BACKDROP_ID = "jw-bible-chapter-tree-dialog-backdrop";
const DIALOG_STYLE_ID = "jw-bible-chapter-tree-dialog-style";

const BOOK_ORDER = [
    "Genesis",
    "Exodus",
    "Leviticus",
    "Numbers",
    "Deuteronomy",
    "Joshua",
    "Judges",
    "Ruth",
    "1 Samuel",
    "2 Samuel",
    "1 Kings",
    "2 Kings",
    "1 Chronicles",
    "2 Chronicles",
    "Ezra",
    "Nehemiah",
    "Esther",
    "Job",
    "Psalms",
    "Proverbs",
    "Ecclesiastes",
    "Song of Solomon",
    "Isaiah",
    "Jeremiah",
    "Lamentations",
    "Ezekiel",
    "Daniel",
    "Hosea",
    "Joel",
    "Amos",
    "Obadiah",
    "Jonah",
    "Micah",
    "Nahum",
    "Habakkuk",
    "Zephaniah",
    "Haggai",
    "Zechariah",
    "Malachi",
    "Matthew",
    "Mark",
    "Luke",
    "John",
    "Acts",
    "Romans",
    "1 Corinthians",
    "2 Corinthians",
    "Galatians",
    "Ephesians",
    "Philippians",
    "Colossians",
    "1 Thessalonians",
    "2 Thessalonians",
    "1 Timothy",
    "2 Timothy",
    "Titus",
    "Philemon",
    "Hebrews",
    "James",
    "1 Peter",
    "2 Peter",
    "1 John",
    "2 John",
    "3 John",
    "Jude",
    "Revelation"
];

void main();

async function main() {
    try {
        const bibleData = await loadBibleData();
        if (!bibleData) {
            return;
        }

        const activeNote = typeof api.getActiveContextNote === "function"
            ? await Promise.resolve(api.getActiveContextNote())
            : null;

        const selection = await showParentSelectionDialog(activeNote);
        if (!selection) {
            return;
        }

        const confirmed = await Promise.resolve(api.showConfirmDialog(
            `Create the full Bible chapter tree under "${selection.title}"?\n\n` +
            `This will create 66 book notes and chapter notes beneath them. ` +
            `Existing exact-title child notes will be reused and existing chapter notes will be left unchanged.`
        ));

        if (!confirmed) {
            return;
        }

        api.showMessage("Building Bible chapter tree...", 4000);

        const result = await Promise.resolve(api.runOnBackend((params) => {
            const {
                parentNoteId,
                bookOrder,
                bibleData
            } = params;

            const createdNoteIds = [];

            function escapeSearchLiteral(value) {
                return String(value || "")
                    .replace(/\\/g, "\\\\")
                    .replace(/'/g, "\\'");
            }

            function getDirectChildrenMap(parentId) {
                const query = `note.parents.noteId = '${escapeSearchLiteral(parentId)}'`;
                const children = api.searchForNotes(query, {}) || [];
                const map = Object.create(null);

                for (const child of children) {
                    if (child && child.title && !map[child.title]) {
                        map[child.title] = child;
                    }
                }

                return map;
            }

            function stripLeadingParagraphBreak(text) {
                const value = String(text || "");
                return value.startsWith("\r\n") ? value.slice(2) : value;
            }

            function escapeHtml(value) {
                return api.escapeHtml(String(value || ""));
            }

            function textToHtmlWithBreaks(text) {
                return String(text || "")
                    .split(/\r?\n/u)
                    .map((part) => escapeHtml(part))
                    .join("<br>");
            }

            function buildVerseHtml(verseNumber, text) {
                return `<span class="jw-bible-verse-span"><strong>${verseNumber}</strong> ${textToHtmlWithBreaks(stripLeadingParagraphBreak(text))} </span>`;
            }

            function buildChapterHtml(bookName, chapterNumber, chapterData) {
                const verseNumbers = Object.keys(chapterData || {})
                    .map((value) => Number(value))
                    .filter(Number.isFinite)
                    .sort((left, right) => left - right);

                const paragraphs = [];
                let currentParagraphParts = [];
                let previousVerse = 0;

                for (const verseNumber of verseNumbers) {
                    const rawText = String(chapterData[String(verseNumber)] || "");
                    const startsParagraph = !currentParagraphParts.length
                        || rawText.startsWith("\r\n")
                        || previousVerse + 1 !== verseNumber;

                    if (startsParagraph && currentParagraphParts.length) {
                        paragraphs.push(`<p>${currentParagraphParts.join("")}</p>`);
                        currentParagraphParts = [];
                    }

                    currentParagraphParts.push(buildVerseHtml(verseNumber, rawText));
                    previousVerse = verseNumber;
                }

                if (currentParagraphParts.length) {
                    paragraphs.push(`<p>${currentParagraphParts.join("")}</p>`);
                }

                const reflectionHeadings = [
                    "What does this tell me about Jehovah God?",
                    "How does this section of the Scriptures contribute to the Bible’s message?",
                    "How can I apply this in my life?",
                    "How can I use these verses to help others?"
                ]
                    .map((heading) => `<h2>${escapeHtml(heading)}</h2>`)
                    .join("");

                if (!paragraphs.length) {
                    return `<blockquote><p>${escapeHtml(bookName)} Chapter ${chapterNumber} has no verse text in ${escapeHtml(DATA_NOTE_TITLE)}.</p></blockquote>${reflectionHeadings}`;
                }

                return `<blockquote>${paragraphs.join("")}</blockquote>${reflectionHeadings}`;
            }

            function createOrReuseTextNote(parentId, title, content) {
                const directChildren = getDirectChildrenMap(parentId);
                const existing = directChildren[title];
                if (existing) {
                    return {
                        note: existing,
                        created: false
                    };
                }

                const result = api.createTextNote(parentId, title, content);
                createdNoteIds.push(result.note.noteId);

                return {
                    note: result.note,
                    created: true
                };
            }

            const parentNote = api.getNote(parentNoteId);
            if (!parentNote) {
                throw new Error(`Parent note ${parentNoteId} was not found.`);
            }

            let createdBookCount = 0;
            let reusedBookCount = 0;
            let createdChapterCount = 0;
            let reusedChapterCount = 0;
            const reloadNoteIds = new Set([parentNoteId]);

            api.transactional(() => {
                const parentChildren = getDirectChildrenMap(parentNoteId);

                for (let index = 0; index < bookOrder.length; index += 1) {
                    const bookName = bookOrder[index];
                    const bookData = bibleData[bookName];
                    if (!bookData || typeof bookData !== "object") {
                        continue;
                    }

                    const bookTitle = `${String(index + 1).padStart(2, "0")} ${bookName}`;
                    let bookNote = parentChildren[bookTitle] || null;

                    if (!bookNote) {
                        const createdBook = api.createTextNote(parentNoteId, bookTitle, "<p></p>");
                        bookNote = createdBook.note;
                        parentChildren[bookTitle] = bookNote;
                        createdNoteIds.push(bookNote.noteId);
                        createdBookCount += 1;
                    } else {
                        reusedBookCount += 1;
                    }

                    reloadNoteIds.add(bookNote.noteId);

                    const chapterChildren = getDirectChildrenMap(bookNote.noteId);
                    const chapterNumbers = Object.keys(bookData)
                        .map((value) => Number(value))
                        .filter(Number.isFinite)
                        .sort((left, right) => left - right);

                    for (const chapterNumber of chapterNumbers) {
                        const chapterTitle = `${bookName} Chapter ${chapterNumber}`;
                        if (chapterChildren[chapterTitle]) {
                            reusedChapterCount += 1;
                            continue;
                        }

                        const chapterHtml = buildChapterHtml(
                            bookName,
                            chapterNumber,
                            bookData[String(chapterNumber)]
                        );

                        const createdChapter = api.createTextNote(bookNote.noteId, chapterTitle, chapterHtml);
                        chapterChildren[chapterTitle] = createdChapter.note;
                        createdNoteIds.push(createdChapter.note.noteId);
                        createdChapterCount += 1;
                    }
                }
            });

            return {
                createdBookCount,
                reusedBookCount,
                createdChapterCount,
                reusedChapterCount,
                reloadNoteIds: Array.from(reloadNoteIds),
                createdNoteIds
            };
        }, [{
            parentNoteId: selection.noteId,
            bookOrder: BOOK_ORDER,
            bibleData
        }]));

        if (result && Array.isArray(result.reloadNoteIds) && result.reloadNoteIds.length && typeof api.reloadNotes === "function") {
            await Promise.resolve(api.reloadNotes(result.reloadNoteIds));
        }

        if (typeof api.activateNote === "function") {
            await Promise.resolve(api.activateNote(selection.noteId));
        }

        api.showMessage(
            `Bible chapter tree complete. ` +
            `Created ${result.createdBookCount} book notes and ${result.createdChapterCount} chapter notes. ` +
            `Reused ${result.reusedBookCount} book notes and ${result.reusedChapterCount} chapter notes.`,
            8000
        );
    } catch (error) {
        console.error("JW Bible chapter tree generator failed", error);
        api.showError(`Bible chapter tree generation failed: ${error && error.message ? error.message : error}`);
    }
}

async function loadBibleData() {
    const dataNote = await findDataNote();
    if (!dataNote || typeof dataNote.getJsonContent !== "function") {
        api.showError(
            `Bible data note not found. Create a JSON code note titled "${DATA_NOTE_TITLE}" and add label #${DATA_LABEL}.`
        );
        return null;
    }

    try {
        const json = await dataNote.getJsonContent();
        if (!json || typeof json !== "object") {
            api.showError(`"${DATA_NOTE_TITLE}" does not contain valid JSON object data.`);
            return null;
        }

        return json;
    } catch (error) {
        console.error("Unable to load Bible data JSON", error);
        api.showError(`Unable to load "${DATA_NOTE_TITLE}" JSON data.`);
        return null;
    }
}

async function findDataNote() {
    if (typeof api.searchForNotes !== "function") {
        return null;
    }

    const matches = await Promise.resolve(api.searchForNotes(`#${DATA_LABEL}`));
    if (!matches || !matches.length) {
        return null;
    }

    for (const candidate of matches) {
        if (candidate.title === DATA_NOTE_TITLE) {
            return candidate;
        }
    }

    return matches[0] || null;
}

async function showParentSelectionDialog(activeNote) {
    if (typeof document === "undefined" || !document.body) {
        api.showError("This Trilium build does not support note selection dialogs for this script.");
        return null;
    }

    ensureDialogStyles();
    removeExistingDialog();

    return await new Promise((resolve) => {
        const backdrop = document.createElement("div");
        backdrop.id = DIALOG_BACKDROP_ID;
        backdrop.className = "jw-bible-tree-dialog-backdrop";
        backdrop.innerHTML = `
            <div class="jw-bible-tree-dialog" role="dialog" aria-modal="true" aria-labelledby="jw-bible-tree-dialog-title">
                <h2 class="jw-bible-tree-dialog-title" id="jw-bible-tree-dialog-title">Create Bible chapter tree</h2>
                <p class="jw-bible-tree-dialog-copy">Select the parent note which should receive the Bible book notes. Search by note title or paste a note ID.</p>
                <label class="jw-bible-tree-dialog-label" for="jw-bible-tree-dialog-search">Parent note</label>
                <input
                    id="jw-bible-tree-dialog-search"
                    class="jw-bible-tree-dialog-input"
                    type="text"
                    spellcheck="false"
                    autocomplete="off"
                    value=""
                />
                <div class="jw-bible-tree-dialog-selected" aria-live="polite"></div>
                <div class="jw-bible-tree-dialog-results"></div>
                <div class="jw-bible-tree-dialog-error" aria-live="polite"></div>
                <div class="jw-bible-tree-dialog-actions">
                    <button type="button" class="jw-bible-tree-dialog-button jw-bible-tree-dialog-current">Use current note</button>
                    <button type="button" class="jw-bible-tree-dialog-button jw-bible-tree-dialog-cancel">Cancel</button>
                    <button type="button" class="jw-bible-tree-dialog-button jw-bible-tree-dialog-button-primary jw-bible-tree-dialog-submit" disabled>Create</button>
                </div>
            </div>
        `;

        const dialog = backdrop.querySelector(".jw-bible-tree-dialog");
        const input = backdrop.querySelector("#jw-bible-tree-dialog-search");
        const selected = backdrop.querySelector(".jw-bible-tree-dialog-selected");
        const results = backdrop.querySelector(".jw-bible-tree-dialog-results");
        const error = backdrop.querySelector(".jw-bible-tree-dialog-error");
        const useCurrentButton = backdrop.querySelector(".jw-bible-tree-dialog-current");
        const cancelButton = backdrop.querySelector(".jw-bible-tree-dialog-cancel");
        const submitButton = backdrop.querySelector(".jw-bible-tree-dialog-submit");

        let selectedNote = activeNote
            ? { noteId: activeNote.noteId, title: activeNote.title || "(untitled)" }
            : null;
        let searchTimer = null;
        let requestToken = 0;
        let settled = false;

        function cleanup(result) {
            if (settled) {
                return;
            }

            settled = true;

            if (searchTimer) {
                clearTimeout(searchTimer);
                searchTimer = null;
            }

            document.removeEventListener("keydown", handleEscape, true);
            backdrop.remove();
            resolve(result);
        }

        function renderSelected() {
            if (!selectedNote) {
                selected.textContent = "No parent note selected.";
                submitButton.disabled = true;
                return;
            }

            selected.textContent = `Selected: ${selectedNote.title} (${selectedNote.noteId})`;
            submitButton.disabled = false;
        }

        function renderResults(items) {
            results.innerHTML = "";

            if (!items.length) {
                results.innerHTML = `<div class="jw-bible-tree-dialog-empty">No matching notes found.</div>`;
                return;
            }

            const fragment = document.createDocumentFragment();

            for (const item of items) {
                const button = document.createElement("button");
                button.type = "button";
                button.className = "jw-bible-tree-dialog-result";
                if (selectedNote && selectedNote.noteId === item.noteId) {
                    button.classList.add("jw-bible-tree-dialog-result-selected");
                }

                button.innerHTML = `
                    <span class="jw-bible-tree-dialog-result-title"></span>
                    <span class="jw-bible-tree-dialog-result-id"></span>
                `;
                button.querySelector(".jw-bible-tree-dialog-result-title").textContent = item.title || "(untitled)";
                button.querySelector(".jw-bible-tree-dialog-result-id").textContent = item.noteId;
                button.addEventListener("click", () => {
                    selectedNote = {
                        noteId: item.noteId,
                        title: item.title || "(untitled)"
                    };
                    error.textContent = "";
                    renderSelected();
                    renderResults(items);
                });

                fragment.appendChild(button);
            }

            results.appendChild(fragment);
        }

        async function searchNotes(query) {
            const token = ++requestToken;
            error.textContent = "";

            const trimmed = String(query || "").trim();
            if (!trimmed) {
                renderResults(activeNote ? [{
                    noteId: activeNote.noteId,
                    title: activeNote.title || "(untitled)"
                }] : []);
                return;
            }

            try {
                const seen = new Set();
                const matches = [];

                if (/^[A-Za-z0-9_-]{8,}$/u.test(trimmed) && typeof api.getNote === "function") {
                    const exactNote = await Promise.resolve(api.getNote(trimmed));
                    if (exactNote && exactNote.noteId) {
                        seen.add(exactNote.noteId);
                        matches.push({
                            noteId: exactNote.noteId,
                            title: exactNote.title || "(untitled)"
                        });
                    }
                }

                const escapedQuery = escapeSearchLiteral(trimmed);
                const titleMatches = await Promise.resolve(
                    api.searchForNotes(`note.title *=* '${escapedQuery}' orderBy note.title limit 25`)
                );

                for (const note of titleMatches || []) {
                    if (!note || !note.noteId || seen.has(note.noteId)) {
                        continue;
                    }

                    seen.add(note.noteId);
                    matches.push({
                        noteId: note.noteId,
                        title: note.title || "(untitled)"
                    });
                }

                if (token !== requestToken) {
                    return;
                }

                renderResults(matches);
            } catch (searchError) {
                console.error("Unable to search for parent notes", searchError);
                if (token !== requestToken) {
                    return;
                }

                renderResults([]);
                error.textContent = "Unable to search notes. Try pasting a note ID or a more exact title.";
            }
        }

        function scheduleSearch() {
            if (searchTimer) {
                clearTimeout(searchTimer);
            }

            searchTimer = setTimeout(() => {
                searchTimer = null;
                void searchNotes(input.value);
            }, 150);
        }

        function handleEscape(event) {
            if (event.key === "Escape") {
                event.preventDefault();
                cleanup(null);
            }
        }

        backdrop.addEventListener("click", (event) => {
            if (event.target === backdrop) {
                cleanup(null);
            }
        });

        useCurrentButton.addEventListener("click", () => {
            if (!activeNote) {
                error.textContent = "There is no active note to use as the parent.";
                return;
            }

            selectedNote = {
                noteId: activeNote.noteId,
                title: activeNote.title || "(untitled)"
            };
            input.value = activeNote.title || "";
            renderSelected();
            renderResults([selectedNote]);
        });

        cancelButton.addEventListener("click", () => cleanup(null));
        submitButton.addEventListener("click", () => {
            if (!selectedNote) {
                error.textContent = "Select a parent note first.";
                return;
            }

            cleanup(selectedNote);
        });

        input.addEventListener("input", () => {
            error.textContent = "";
            scheduleSearch();
        });

        input.addEventListener("keydown", (event) => {
            if (event.key === "Enter" && selectedNote) {
                event.preventDefault();
                cleanup(selectedNote);
            }
        });

        document.addEventListener("keydown", handleEscape, true);
        document.body.appendChild(backdrop);
        renderSelected();
        renderResults(activeNote ? [selectedNote] : []);

        setTimeout(() => {
            input.focus();
            input.select();
        }, 0);
    });
}

function ensureDialogStyles() {
    if (document.getElementById(DIALOG_STYLE_ID)) {
        return;
    }

    const style = document.createElement("style");
    style.id = DIALOG_STYLE_ID;
    style.textContent = `
        .jw-bible-tree-dialog-backdrop {
            position: fixed;
            inset: 0;
            z-index: 2147483000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            background: rgba(5, 8, 14, 0.46);
        }

        .jw-bible-tree-dialog {
            width: min(680px, calc(100vw - 32px));
            max-height: min(80vh, 760px);
            display: flex;
            flex-direction: column;
            gap: 12px;
            padding: 18px;
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 14px;
            background: var(--main-background-color, #202226);
            box-shadow: 0 24px 48px rgba(0, 0, 0, 0.35);
            color: var(--main-text-color, #f5f5f5);
        }

        .jw-bible-tree-dialog-title {
            margin: 0;
            font-size: 20px;
            line-height: 1.2;
        }

        .jw-bible-tree-dialog-copy {
            margin: 0;
            color: var(--muted-text-color, #c7c7c7);
            line-height: 1.5;
        }

        .jw-bible-tree-dialog-label {
            font-weight: 600;
        }

        .jw-bible-tree-dialog-input {
            width: 100%;
            padding: 10px 12px;
            border: 1px solid rgba(255, 255, 255, 0.14);
            border-radius: 10px;
            background: rgba(255, 255, 255, 0.04);
            color: inherit;
        }

        .jw-bible-tree-dialog-selected {
            min-height: 20px;
            color: #9fd1ff;
            font-size: 13px;
        }

        .jw-bible-tree-dialog-results {
            min-height: 120px;
            max-height: 340px;
            overflow: auto;
            display: flex;
            flex-direction: column;
            gap: 8px;
            padding: 4px;
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 10px;
            background: rgba(255, 255, 255, 0.03);
        }

        .jw-bible-tree-dialog-result {
            width: 100%;
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            gap: 3px;
            padding: 10px 12px;
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 10px;
            background: rgba(255, 255, 255, 0.03);
            color: inherit;
            text-align: left;
            cursor: pointer;
        }

        .jw-bible-tree-dialog-result:hover,
        .jw-bible-tree-dialog-result-selected {
            border-color: rgba(159, 209, 255, 0.45);
            background: rgba(159, 209, 255, 0.10);
        }

        .jw-bible-tree-dialog-result-title {
            font-weight: 600;
        }

        .jw-bible-tree-dialog-result-id {
            font-size: 12px;
            color: var(--muted-text-color, #c7c7c7);
        }

        .jw-bible-tree-dialog-empty {
            padding: 12px;
            color: var(--muted-text-color, #c7c7c7);
            font-size: 13px;
        }

        .jw-bible-tree-dialog-error {
            min-height: 18px;
            color: #ff8b8b;
            font-size: 13px;
        }

        .jw-bible-tree-dialog-actions {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            flex-wrap: wrap;
        }

        .jw-bible-tree-dialog-button {
            padding: 9px 14px;
            border: 1px solid rgba(255, 255, 255, 0.14);
            border-radius: 10px;
            background: rgba(255, 255, 255, 0.04);
            color: inherit;
            cursor: pointer;
        }

        .jw-bible-tree-dialog-button:disabled {
            opacity: 0.55;
            cursor: default;
        }

        .jw-bible-tree-dialog-button-primary {
            border-color: rgba(159, 209, 255, 0.5);
            background: rgba(159, 209, 255, 0.16);
            color: #d7ecff;
        }
    `;

    document.head.appendChild(style);
}

function removeExistingDialog() {
    const existing = document.getElementById(DIALOG_BACKDROP_ID);
    if (existing) {
        existing.remove();
    }
}

function escapeSearchLiteral(value) {
    return String(value || "")
        .replace(/\\/g, "\\\\")
        .replace(/'/g, "\\'");
}
