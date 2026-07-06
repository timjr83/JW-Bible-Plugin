const REFRESH_INTERVAL_MS = 1500;
const DATA_NOTE_TITLE = "JW Bible EN Data";
const DATA_LABEL = "jwBibleData";
const DATA_LANGUAGE_LABEL = "jwBibleLang";
const ALIASES_NOTE_TITLE = "JW Bible Book Aliases";
const ALIASES_LABEL = "jwBibleAliases";
const DATA_LANGUAGE = "en";
const LOCALE_MAP = {
    en: "E"
};

const DEFAULT_BOOK_ALIASES = Object.freeze({});

const BOOK_NUMBERS = {
    Genesis: 1,
    Exodus: 2,
    Leviticus: 3,
    Numbers: 4,
    Deuteronomy: 5,
    Joshua: 6,
    Judges: 7,
    Ruth: 8,
    "1 Samuel": 9,
    "2 Samuel": 10,
    "1 Kings": 11,
    "2 Kings": 12,
    "1 Chronicles": 13,
    "2 Chronicles": 14,
    Ezra: 15,
    Nehemiah: 16,
    Esther: 17,
    Job: 18,
    Psalms: 19,
    Proverbs: 20,
    Ecclesiastes: 21,
    "Song of Solomon": 22,
    Isaiah: 23,
    Jeremiah: 24,
    Lamentations: 25,
    Ezekiel: 26,
    Daniel: 27,
    Hosea: 28,
    Joel: 29,
    Amos: 30,
    Obadiah: 31,
    Jonah: 32,
    Micah: 33,
    Nahum: 34,
    Habakkuk: 35,
    Zephaniah: 36,
    Haggai: 37,
    Zechariah: 38,
    Malachi: 39,
    Matthew: 40,
    Mark: 41,
    Luke: 42,
    John: 43,
    Acts: 44,
    Romans: 45,
    "1 Corinthians": 46,
    "2 Corinthians": 47,
    Galatians: 48,
    Ephesians: 49,
    Philippians: 50,
    Colossians: 51,
    "1 Thessalonians": 52,
    "2 Thessalonians": 53,
    "1 Timothy": 54,
    "2 Timothy": 55,
    Titus: 56,
    Philemon: 57,
    Hebrews: 58,
    James: 59,
    "1 Peter": 60,
    "2 Peter": 61,
    "1 John": 62,
    "2 John": 63,
    "3 John": 64,
    Jude: 65,
    Revelation: 66
};

const SINGLE_CHAPTER_BOOKS = new Set([
    "Obadiah",
    "Philemon",
    "2 John",
    "3 John",
    "Jude"
]);

class JWBibleSidebarWidget extends api.RightPanelWidget {
    constructor() {
        super();
        this.contentSized();
        this.activeNote = null;
        this.lastSignature = null;
        this.dataCache = new Map();
        this.aliasesCache = null;
        this.refreshTimer = null;
        this.stylesApplied = false;
        this.scrollListenerRegistered = false;
    }

    get widgetTitle() {
        return "Bible References";
    }

    get parentWidget() {
        return "right-pane";
    }

    get position() {
        return 40;
    }

    async doRenderBody() {
        this.ensureStyles();
        this.ensureScrollListener();

        if (!this.refreshTimer) {
            this.refreshTimer = setInterval(() => {
                void this.refreshFromCurrentContext(false);
            }, REFRESH_INTERVAL_MS);
        }

        await this.refreshFromCurrentContext(true);
    }

    async refreshWithNote(note) {
        this.activeNote = note || null;
        await this.refreshNoteContext(this.activeNote, true, true);
    }

    async entitiesReloadedEvent() {
        await this.refreshFromCurrentContext(true);
    }

    cleanup() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }

        if (super.cleanup) {
            super.cleanup();
        }
    }

    ensureScrollListener() {
        if (this.scrollListenerRegistered) {
            return;
        }

        window.addEventListener("jw-bible-scroll-to-ref", async (event) => {
            const detail = event && event.detail ? event.detail : {};
            const targetId = detail.id;
            if (!targetId) {
                return;
            }

            await this.refreshFromCurrentContext(true);

            if (this.scrollToReference(targetId)) {
                return;
            }

            if (typeof requestAnimationFrame === "function") {
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        this.scrollToReference(targetId);
                    });
                });
            } else {
                setTimeout(() => {
                    this.scrollToReference(targetId);
                }, 80);
            }
        });

        this.scrollListenerRegistered = true;
    }

    scrollToReference(targetId) {
        const element = document.getElementById(targetId);
        if (!(element instanceof HTMLElement) || typeof element.scrollIntoView !== "function") {
            return false;
        }

        element.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

        return true;
    }

    ensureStyles() {
        if (this.stylesApplied) {
            return;
        }

        this.cssBlock(`
            .jw-bible-widget {
                display: flex;
                flex-direction: column;
                gap: 14px;
                padding: 10px 8px 18px;
            }

            .jw-bible-empty {
                padding: 12px;
                border: 1px solid var(--theme-border-color);
                border-radius: 8px;
                color: var(--muted-text-color);
                background: #262626;
                font-size: 12px;
                line-height: 1.5;
            }

            .jw-bible-card {
                padding: 0;
            }

            .jw-bible-card-header {
                display: flex;
                flex-direction: column;
                align-items: stretch;
                gap: 8px;
                padding: 0 0 8px;
                background: transparent;
            }

            .jw-bible-card-heading {
                display: flex;
                align-items: center;
                min-width: 0;
            }

            .jw-bible-card-title {
                min-width: 0;
                font-weight: 700;
                font-size: 17px;
                line-height: 1.25;
                color: #ffffff;
            }

            .jw-bible-button {
                appearance: none;
                border: 0;
                border-radius: 0;
                background: transparent;
                color: #9fd1ff;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                gap: 6px;
                min-height: 0;
                padding: 0;
                text-decoration: none;
                font-size: 12px;
                font-weight: 600;
                line-height: 1;
                transition: color 120ms ease;
            }

            .jw-bible-button:hover {
                color: #c4e4ff;
                text-decoration: none;
            }

            .jw-bible-button-secondary {
                color: #c7c7c7;
            }

            .jw-bible-card-body {
                display: flex;
                flex-direction: column;
                gap: 12px;
                padding: 0;
                font-size: 14px;
                line-height: 1.72;
                color: #f1f1f1;
            }

            .jw-bible-card-footer {
                margin-top: 10px;
                padding-top: 8px;
                border-top: 1px solid rgba(255, 255, 255, 0.14);
            }

            .jw-bible-paragraph {
                margin: 0;
            }

            .jw-bible-verse-span {
                display: inline;
            }

            .jw-bible-verse-number {
                font-weight: 700;
                margin-right: 6px;
                color: #ffffff;
            }

        `);

        this.stylesApplied = true;
    }

    async refreshFromCurrentContext(force) {
        const activeNote = await this.getActiveNote();
        await this.refreshNoteContext(activeNote, force, false);
    }

    async refreshNoteContext(note, force, preferNoteContent) {
        const activeNote = note || null;
        if (!activeNote) {
            this.activeNote = null;
            this.lastSignature = null;
            this.renderEmptyState("Select a note to inspect Bible references.");
            return;
        }

        this.activeNote = activeNote;

        const text = await this.getSearchableText(activeNote, preferNoteContent);
        const signature = `${activeNote.noteId || activeNote.title || "unknown"}|${text}`;

        if (!force && signature === this.lastSignature) {
            return;
        }

        this.lastSignature = signature;

        if (!text.trim()) {
            this.renderEmptyState("This note has no text to scan yet.");
            return;
        }

        const bookAliases = await this.getBookAliases();
        const references = findBibleReferencesInText(text, bookAliases);
        await this.renderReferences(references);
    }

    async getActiveNote() {
        if (typeof api.getActiveContextNote === "function") {
            try {
                const note = await Promise.resolve(api.getActiveContextNote());
                this.activeNote = note || null;
                return this.activeNote;
            } catch (error) {
                return this.activeNote || null;
            }
        }

        return this.activeNote || null;
    }

    async getSearchableText(note, preferNoteContent) {
        let rawContent = "";

        if (note && typeof note.getContent === "function") {
            try {
                rawContent = await note.getContent();
            } catch (error) {
                console.error("JW Bible widget: unable to read note content", error);
            }
        }

        if (!rawContent && !note) {
            try {
                if (typeof api.getActiveContextTextEditor === "function") {
                    const editor = await Promise.resolve(api.getActiveContextTextEditor());
                    if (editor && typeof editor.getData === "function") {
                        rawContent = editor.getData() || "";
                    }
                }
            } catch (error) {
                console.debug("JW Bible widget: editor content unavailable", error);
            }
        }

        return normalizeSearchText(rawContent);
    }

    async renderReferences(references) {
        this.$body.empty();

        if (!references.length) {
            this.renderEmptyState("No Bible references detected in the current note.");
            return;
        }

        const bibleData = await this.getBibleData();
        if (!bibleData) {
            this.renderEmptyState(
                `Bible data note not found. Create a JSON code note titled "${DATA_NOTE_TITLE}" and add labels #${DATA_LABEL} and #${DATA_LANGUAGE_LABEL}=${DATA_LANGUAGE}.`
            );
            return;
        }

        const $container = $('<div class="jw-bible-widget"></div>');

        for (const ref of references) {
            const verseTexts = getVerseText(ref, bibleData);
            if (!verseTexts.length) {
                continue;
            }

            const title = `${ref.book} ${ref.chapter}:${ref.verseStr}`;
            const $card = $('<section class="jw-bible-card"></section>');
            const $header = $('<div class="jw-bible-card-header"></div>');
            const $heading = $('<div class="jw-bible-card-heading"></div>');
            const $title = $('<div class="jw-bible-card-title"></div>').append(
                $('<strong></strong>').text(title)
            );
            const $footer = $('<div class="jw-bible-card-footer"></div>');
            const $actions = $('<div></div>').css({
                display: "flex",
                alignItems: "center",
                columnGap: "24px",
                rowGap: "6px",
                flexWrap: "wrap"
            });
            const $open = $('<a href="#" class="jw-bible-button" title="Open in JW Library" aria-label="Open in JW Library"></a>');
            const $insert = $('<a href="#" class="jw-bible-button jw-bible-button-secondary" title="Insert into note" aria-label="Insert into note"></a>');
            const $body = $('<div class="jw-bible-card-body"></div>');
            const $openLabel = $('<span></span>').text("Open");
            const $openSymbol = $('<span aria-hidden="true"></span>').text("↗").css({
                fontSize: "11px",
                lineHeight: "1",
                marginLeft: "1px",
                opacity: "0.9"
            });
            const $insertSymbol = $('<span aria-hidden="true"></span>').text("+").css({
                fontSize: "11px",
                lineHeight: "1",
                fontWeight: "700",
                marginRight: "2px",
                opacity: "0.9"
            });
            const $insertLabel = $('<span></span>').text("Insert");

            $insert.css({
                marginLeft: "24px"
            });

            $card.attr("id", buildReferenceDomId(ref));

            $open.on("click", (event) => {
                event.preventDefault();
                window.open(buildJwUrl(ref), "_blank", "noopener,noreferrer");
            });

            $insert.on("click", async (event) => {
                event.preventDefault();
                try {
                    const editor = typeof api.getActiveContextTextEditor === "function"
                        ? await Promise.resolve(api.getActiveContextTextEditor())
                        : null;

                    if (editor && canInsertHtml(editor)) {
                        insertHtmlIntoCkEditor(editor, buildQuoteBlockHtml(ref, verseTexts));
                    } else if (typeof api.addTextToActiveContextEditor === "function") {
                        await Promise.resolve(api.addTextToActiveContextEditor(buildQuoteBlockText(ref, verseTexts)));
                    } else {
                        throw new Error("No supported editor insertion API is available in this context.");
                    }
                } catch (error) {
                    console.error("JW Bible widget: unable to insert verse text", error);
                }
            });

            appendVerseParagraphs($body, verseTexts);

            $heading.append($title);
            $open.append($openLabel, $openSymbol);
            $insert.append($insertSymbol, $insertLabel);
            $actions.append($open, $insert);
            $footer.append($actions);
            $header.append($heading);
            $card.append($header, $body, $footer);
            if ($container.children().length) {
                $container.append(
                    $('<div aria-hidden="true"></div>').css({
                        display: "block",
                        width: "100%",
                        height: "0",
                        margin: "12px 0 18px",
                        borderTop: "1px solid rgba(255,255,255,0.32)"
                    })
                );
            }
            $container.append($card);
        }

        if (!$container.children().length) {
            this.renderEmptyState("References were found, but no matching verses were loaded from the Bible data note.");
            return;
        }

        this.$body.append($container);
    }

    renderEmptyState(message) {
        this.toggleInt(true);
        this.$body.empty().append(
            $('<div class="jw-bible-empty"></div>').text(message)
        );
    }

    async getBibleData() {
        if (this.dataCache.has(DATA_LANGUAGE)) {
            return this.dataCache.get(DATA_LANGUAGE);
        }

        const dataNote = await this.findBibleDataNote();
        if (!dataNote || typeof dataNote.getJsonContent !== "function") {
            return null;
        }

        try {
            const json = await dataNote.getJsonContent();
            this.dataCache.set(DATA_LANGUAGE, json);
            return json;
        } catch (error) {
            console.error("JW Bible widget: unable to load Bible JSON data", error);
            return null;
        }
    }

    async getBookAliases() {
        if (this.aliasesCache) {
            return this.aliasesCache;
        }

        const aliasesNote = await this.findAliasesNote();
        if (!aliasesNote || typeof aliasesNote.getJsonContent !== "function") {
            this.aliasesCache = DEFAULT_BOOK_ALIASES;
            return this.aliasesCache;
        }

        try {
            const json = await aliasesNote.getJsonContent();
            this.aliasesCache = json && typeof json === "object" ? json : DEFAULT_BOOK_ALIASES;
            return this.aliasesCache;
        } catch (error) {
            console.error("JW Bible widget: unable to load alias JSON data", error);
            this.aliasesCache = DEFAULT_BOOK_ALIASES;
            return this.aliasesCache;
        }
    }

    async findAliasesNote() {
        if (typeof api.searchForNotes !== "function") {
            return null;
        }

        try {
            const matches = await Promise.resolve(api.searchForNotes(`#${ALIASES_LABEL}`));
            if (!matches || !matches.length) {
                return null;
            }

            for (const candidate of matches) {
                if (candidate.title === ALIASES_NOTE_TITLE) {
                    return candidate;
                }
            }

            return matches[0];
        } catch (error) {
            console.error("JW Bible widget: unable to search for alias note", error);
            return null;
        }
    }

    async findBibleDataNote() {
        if (typeof api.searchForNotes !== "function") {
            return null;
        }

        try {
            const matches = await Promise.resolve(api.searchForNotes(`#${DATA_LABEL}`));
            if (!matches || !matches.length) {
                return null;
            }

            for (const candidate of matches) {
                const language = typeof candidate.getLabelValue === "function"
                    ? candidate.getLabelValue(DATA_LANGUAGE_LABEL)
                    : null;
                if (language === DATA_LANGUAGE) {
                    return candidate;
                }
            }

            for (const candidate of matches) {
                if (candidate.title === DATA_NOTE_TITLE) {
                    return candidate;
                }
            }

            return matches[0];
        } catch (error) {
            console.error("JW Bible widget: unable to search for Bible data note", error);
            return null;
        }
    }
}

function buildInsertText(verseTexts) {
    return buildVerseBodyText(verseTexts);
}

function buildQuoteBlockText(ref, verseTexts) {
    const reference = buildNormalizedReference(ref);
    const body = buildVerseBodyText(verseTexts);

    return `${reference}\n${body}`;
}

function buildQuoteBlockHtml(ref, verseTexts) {
    const reference = escapeHtml(buildNormalizedReference(ref));
    const body = escapeHtml(buildVerseBodyText(verseTexts));

    return `<blockquote><p><strong>${reference}</strong></p><p>${body}</p></blockquote>`;
}

function buildDisplayReference(ref) {
    return String(ref.raw || `${ref.book} ${ref.chapter}:${ref.verseStr}`)
        .replace(/[\p{White_Space}\u200B]+/gu, " ")
        .trim();
}

function buildNormalizedReference(ref) {
    if (referenceSpansMultipleChapters(ref)) {
        return `${ref.book} ${ref.chapter}:${ref.startVerse}-${ref.endChapter}:${ref.endVerse}`;
    }

    return `${ref.book} ${ref.chapter}:${ref.verseStr}`;
}

function buildReferenceDomId(ref) {
    const safeReference = buildNormalizedReference(ref)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

    return `jw-ref-${safeReference}`;
}

function canInsertHtml(editor) {
    return Boolean(
        editor &&
        editor.model &&
        editor.data &&
        editor.data.processor &&
        typeof editor.data.processor.toView === "function" &&
        typeof editor.data.toModel === "function"
    );
}

function insertHtmlIntoCkEditor(editor, html) {
    const viewFragment = editor.data.processor.toView(html);
    const modelFragment = editor.data.toModel(viewFragment);

    editor.model.change((writer) => {
        editor.model.insertContent(modelFragment, editor.model.document.selection);
        if (editor.editing && editor.editing.view && typeof editor.editing.view.focus === "function") {
            editor.editing.view.focus();
        }
    });
}

function cleanVerseText(text) {
    return String(text || "")
        .replace(/\r?\n+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function referenceSpansMultipleChapters(ref) {
    return Number(ref && ref.endChapter || ref && ref.chapter || 0) !== Number(ref && ref.chapter || 0);
}

function shouldShowChapterInVerseBody(verseTexts, index) {
    const current = verseTexts[index];
    if (!current) {
        return false;
    }

    const currentChapter = Number(current.chapter || 0);
    const previousChapter = index > 0
        ? Number(verseTexts[index - 1].chapter || 0)
        : null;
    const hasMultipleChapters = verseTexts.some((entry) => Number(entry.chapter || 0) !== currentChapter);

    return Boolean(hasMultipleChapters && (index === 0 || previousChapter !== currentChapter));
}

function buildVerseBodyText(verseTexts) {
    return verseTexts
        .map((verse, index) => {
            const label = shouldShowChapterInVerseBody(verseTexts, index)
                ? `${verse.chapter}:${verse.verse}`
                : `${verse.verse}`;
            return `${label} ${cleanVerseText(verse.text)}`;
        })
        .join(" ")
        .trim();
}

function appendVerseParagraphs($container, verseTexts) {
    let previousVerse = 0;
    let previousChapter = 0;
    let $paragraph = null;

    for (let index = 0; index < verseTexts.length; index += 1) {
        const verse = verseTexts[index];
        const rawText = String(verse.text || "");
        const currentChapter = Number(verse.chapter || 0);
        const startsParagraph = !$paragraph
            || rawText.startsWith("\r\n")
            || (previousChapter !== 0 && (
                previousChapter !== currentChapter
                || previousVerse + 1 !== verse.verse
            ));

        if (startsParagraph) {
            $paragraph = $('<p class="jw-bible-paragraph"></p>');
            $container.append($paragraph);
        }

        $paragraph.append(buildVerseSpan(verse, shouldShowChapterInVerseBody(verseTexts, index)));
        previousChapter = currentChapter;
        previousVerse = verse.verse;
    }
}

function buildVerseSpan(verse, includeChapter = false) {
    const $span = $('<span class="jw-bible-verse-span"></span>');
    const numberText = includeChapter
        ? `${verse.chapter}:${verse.verse}`
        : String(verse.verse);
    const $number = $('<span class="jw-bible-verse-number"></span>').text(numberText);
    const displayText = stripLeadingParagraphBreak(verse.text);

    $span.append($number);
    appendTextWithBreaks($span, " " + displayText);
    $span.append(document.createTextNode(" "));

    return $span;
}

function stripLeadingParagraphBreak(text) {
    const value = String(text || "");
    return value.startsWith("\r\n") ? value.slice(2) : value;
}

function appendTextWithBreaks($element, text) {
    const parts = String(text || "").split(/\r?\n/);

    for (let i = 0; i < parts.length; i += 1) {
        if (i > 0) {
            $element.append($("<br/>"));
        }

        $element.append(document.createTextNode(parts[i]));
    }
}

function escapeHtml(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function normalizeSearchText(rawContent) {
    if (!rawContent) {
        return "";
    }

    let text = String(rawContent);
    const htmlText = extractStructuredTextFromHtml(text);

    if (htmlText && htmlText.trim()) {
        text = htmlText;
    }

    return text
        .replace(/\u00A0/g, " ")
        .replace(/\*\*/g, "")
        .replace(/__/g, "")
        .replace(/\*/g, "")
        .replace(/_/g, "")
        .replace(/`/g, "")
        .replace(/\[([^\]]+)\]/g, "$1")
        .replace(/[\p{White_Space}\u200B]+/gu, " ")
        .trim();
}

function extractStructuredTextFromHtml(html) {
    const doc = new DOMParser().parseFromString(String(html || ""), "text/html");
    if (!doc || !doc.body) {
        return "";
    }

    const parts = [];
    const blockTags = new Set([
        "P",
        "DIV",
        "BLOCKQUOTE",
        "LI",
        "UL",
        "OL",
        "H1",
        "H2",
        "H3",
        "H4",
        "H5",
        "H6",
        "TABLE",
        "TR"
    ]);

    function pushBoundary() {
        if (!parts.length || parts[parts.length - 1] !== "\n") {
            parts.push("\n");
        }
    }

    function walk(node) {
        if (!node) {
            return;
        }

        if (node.nodeType === 3) {
            parts.push(node.textContent || "");
            return;
        }

        if (node.nodeType !== 1) {
            return;
        }

        if (node.tagName === "BR") {
            pushBoundary();
            return;
        }

        const isBlock = blockTags.has(node.tagName);
        if (isBlock) {
            pushBoundary();
        }

        for (const child of node.childNodes) {
            walk(child);
        }

        if (isBlock) {
            pushBoundary();
        }
    }

    walk(doc.body);
    return parts.join("");
}

function normalizeBookKey(value) {
    return String(value)
        .replace(/\./g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
}

function buildBookPattern(bookAliases) {
    const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const bookKeys = Object.keys(bookAliases)
        .sort((a, b) => b.length - a.length)
        .map((key) => escapeRegExp(key).replace(/\s+/g, "[\\s\\u00A0]*"));
    const hasNumberedBooks = Object.keys(bookAliases).some((key) => /^[1-3]\s*\S/.test(key));
    const bookAlternatives = bookKeys.join("|");

    return hasNumberedBooks
        ? `(?<book>${bookAlternatives})`
        : `(?<book>(?:[1-3][\\s\\u00A0]*)?(?:${bookAlternatives}))`;
}

function buildReferenceRegex(bookAliases) {
    const bookPattern = buildBookPattern(bookAliases);
    const versePattern = buildVersePattern();

    return new RegExp(
        `(?<!\\w)${bookPattern}\\.?[\\s\\u00A0]+(?<chapter>\\d+)[\\s\\u00A0]*:[\\s\\u00A0]*(?<verse>${versePattern})(?!\\d)`,
        "giu"
    );
}

function buildReferenceChainRegex(bookAliases) {
    const bookPattern = buildBookPattern(bookAliases);
    const versePattern = buildVersePattern();

    return new RegExp(
        `(?<!\\w)${bookPattern}\\.?[\\s\\u00A0]+(?<chapter>\\d+)[\\s\\u00A0]*:[\\s\\u00A0]*(?<verse>${versePattern})(?<continuations>(?:[\\s\\u00A0]*;[\\s\\u00A0]*\\d+[\\s\\u00A0]*:[\\s\\u00A0]*${versePattern})+)`,
        "giu"
    );
}

function buildVersePattern() {
    const simpleVersePattern = `\\d+(?:[\\s\\u00A0]*[,\\u2013-][\\s\\u00A0]*\\d+)*`;
    const crossChapterPattern = `\\d+[\\s\\u00A0]*[\\u2013-][\\s\\u00A0]*\\d+[\\s\\u00A0]*:[\\s\\u00A0]*\\d+`;
    return `(?:${crossChapterPattern}|${simpleVersePattern})`;
}

function buildSingleChapterRegex(singleChapterBooks) {
    const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const bookAlternatives = Array.from(singleChapterBooks)
        .map(escapeRegExp)
        .sort((a, b) => b.length - a.length)
        .join("|");

    return new RegExp(
        `(?<!\\w)(?<book>${bookAlternatives})\\.?[\\s\\u00A0]+(?<verse>\\d+(?:[\\s\\u00A0]*[,\\u2013-][\\s\\u00A0]*\\d+)*)(?!\\d)`,
        "giu"
    );
}

function parseVerseRange(verseStr) {
    const result = [];
    const parts = String(verseStr || "").split(",");

    for (const part of parts) {
        const values = part
            .trim()
            .split(/[\u2013-]/)
            .map((value) => parseInt(value.trim(), 10))
            .filter(Number.isFinite);

        if (values.length === 1) {
            result.push(values[0]);
        } else if (values.length === 2) {
            const start = Math.min(values[0], values[1]);
            const end = Math.max(values[0], values[1]);
            for (let verse = start; verse <= end; verse += 1) {
                result.push(verse);
            }
        }
    }

    return result;
}

function parseVerseSpecification(chapter, verseStr) {
    const normalizedVerseStr = String(verseStr || "")
        .replace(/[\s\u00A0]+/gu, " ")
        .trim();

    const crossChapterMatch = normalizedVerseStr.match(/^(?<startVerse>\d+)\s*[\u2013-]\s*(?<endChapter>\d+)\s*:\s*(?<endVerse>\d+)$/u);
    if (crossChapterMatch && crossChapterMatch.groups) {
        const startVerse = Number(crossChapterMatch.groups.startVerse);
        const endChapter = Number(crossChapterMatch.groups.endChapter);
        const endVerse = Number(crossChapterMatch.groups.endVerse);

        if (Number.isFinite(startVerse) && Number.isFinite(endChapter) && Number.isFinite(endVerse)) {
            return {
                verseStr: normalizedVerseStr,
                verses: [startVerse],
                startVerse,
                endChapter,
                endVerse
            };
        }
    }

    const verses = parseVerseRange(normalizedVerseStr);
    if (!verses.length) {
        return null;
    }

    return {
        verseStr: normalizedVerseStr,
        verses,
        startVerse: verses[0],
        endChapter: Number(chapter),
        endVerse: verses[verses.length - 1]
    };
}

function findBibleReferencesInText(text, bookAliases) {
    if (!text) {
        return [];
    }

    const parserContext = buildParserContext(bookAliases || DEFAULT_BOOK_ALIASES);
    const references = [];
    const seen = new Set();

    parserContext.referenceRegex.lastIndex = 0;
    parserContext.referenceChainRegex.lastIndex = 0;
    parserContext.singleChapterRegex.lastIndex = 0;

    if (text.indexOf(":") === -1 && !parserContext.singleChapterRegex.test(text)) {
        parserContext.singleChapterRegex.lastIndex = 0;
        return [];
    }

    parserContext.referenceRegex.lastIndex = 0;
    parserContext.referenceChainRegex.lastIndex = 0;
    parserContext.singleChapterRegex.lastIndex = 0;

    for (const match of text.matchAll(parserContext.referenceChainRegex)) {
        const groups = match.groups || {};
        const matchedBook = groups.book;
        const chapterStr = groups.chapter;
        const verseStr = groups.verse;
        const continuationStr = groups.continuations || "";

        if (!matchedBook || !chapterStr || !verseStr) {
            continue;
        }

        const book = parserContext.bookLookup[normalizeBookKey(matchedBook)];
        if (!book) {
            continue;
        }

        const chapter = Number(chapterStr);
        const initialMatchedText = continuationStr
            ? match[0].slice(0, match[0].length - continuationStr.length)
            : match[0];

        addReferenceMatch({
            references,
            seen,
            raw: initialMatchedText,
            book,
            chapter,
            verseStr,
            index: match.index || 0
        });

        const continuationRegex = new RegExp(`;[\\s\\u00A0]*(?<chapter>\\d+)[\\s\\u00A0]*:[\\s\\u00A0]*(?<verse>${buildVersePattern()})`, "gu");
        for (const continuation of continuationStr.matchAll(continuationRegex)) {
            const continuationGroups = continuation.groups || {};
            const continuedChapterStr = continuationGroups.chapter;
            const continuedVerseStr = continuationGroups.verse;

            if (!continuedChapterStr || !continuedVerseStr) {
                continue;
            }

            const continuationText = continuation[0] || "";
            const contentOffset = continuationText.search(/\d/u);
            if (contentOffset < 0) {
                continue;
            }

            addReferenceMatch({
                references,
                seen,
                raw: continuationText.slice(contentOffset),
                book,
                chapter: Number(continuedChapterStr),
                verseStr: continuedVerseStr,
                index: (match.index || 0) + initialMatchedText.length + continuation.index + contentOffset
            });
        }
    }

    for (const match of text.matchAll(parserContext.referenceRegex)) {
        const groups = match.groups || {};
        const matchedBook = groups.book;
        const chapterStr = groups.chapter;
        const verseStr = groups.verse;

        if (!matchedBook || !chapterStr || !verseStr) {
            continue;
        }

        const book = parserContext.bookLookup[normalizeBookKey(matchedBook)];
        if (!book) {
            continue;
        }

        const chapter = parserContext.singleChapterBooks.has(book) ? 1 : Number(chapterStr);
        addReferenceMatch({
            references,
            seen,
            raw: match[0],
            book,
            chapter,
            verseStr,
            index: match.index || 0
        });
    }

    for (const match of text.matchAll(parserContext.singleChapterRegex)) {
        const groups = match.groups || {};
        const matchedBook = groups.book;
        const verseStr = groups.verse;

        if (!matchedBook || !verseStr) {
            continue;
        }

        const book = parserContext.bookLookup[normalizeBookKey(matchedBook)];
        if (!book || !parserContext.singleChapterBooks.has(book)) {
            continue;
        }

        addReferenceMatch({
            references,
            seen,
            raw: match[0],
            book,
            chapter: 1,
            verseStr,
            index: match.index || 0
        });
    }

    references.sort((left, right) => left.index - right.index);
    return references;
}

function buildParserContext(bookAliases) {
    const aliases = bookAliases || DEFAULT_BOOK_ALIASES;
    const bookLookup = Object.create(null);

    for (const alias of Object.keys(aliases)) {
        bookLookup[normalizeBookKey(alias)] = aliases[alias];
    }

    return {
        bookLookup,
        referenceRegex: buildReferenceRegex(aliases),
        referenceChainRegex: buildReferenceChainRegex(aliases),
        singleChapterRegex: buildSingleChapterRegex(SINGLE_CHAPTER_BOOKS),
        singleChapterBooks: SINGLE_CHAPTER_BOOKS
    };
}

function addReferenceMatch({ references, seen, raw, book, chapter, verseStr, index }) {
    const parsedVerseSpec = parseVerseSpecification(chapter, verseStr);
    const bookNumber = BOOK_NUMBERS[book] || 0;
    if (!parsedVerseSpec) {
        return;
    }

    const uniqueKey = `${bookNumber}|${chapter}|${parsedVerseSpec.startVerse}|${parsedVerseSpec.endChapter}|${parsedVerseSpec.endVerse}|${parsedVerseSpec.verses.join(",")}`;

    if (seen.has(uniqueKey)) {
        return;
    }

    seen.add(uniqueKey);
    references.push({
        raw,
        book,
        bookNumber,
        chapter,
        verses: parsedVerseSpec.verses,
        verseStr: parsedVerseSpec.verseStr,
        startVerse: parsedVerseSpec.startVerse,
        endChapter: parsedVerseSpec.endChapter,
        endVerse: parsedVerseSpec.endVerse,
        index
    });
}

function getVerseText(ref, bibleData) {
    const bookData = bibleData && bibleData[ref.book];
    if (!bookData) {
        return [];
    }

    if (referenceSpansMultipleChapters(ref)) {
        const verseTexts = [];
        for (let chapterNumber = ref.chapter; chapterNumber <= ref.endChapter; chapterNumber += 1) {
            const chapterData = bookData[String(chapterNumber)];
            if (!chapterData) {
                continue;
            }

            const verseNumbers = Object.keys(chapterData)
                .map((value) => Number(value))
                .filter(Number.isFinite)
                .sort((left, right) => left - right);

            if (!verseNumbers.length) {
                continue;
            }

            const startVerse = chapterNumber === ref.chapter
                ? ref.startVerse
                : verseNumbers[0];
            const endVerse = chapterNumber === ref.endChapter
                ? ref.endVerse
                : verseNumbers[verseNumbers.length - 1];

            for (const verseNumber of verseNumbers) {
                if (verseNumber < startVerse || verseNumber > endVerse) {
                    continue;
                }

                const text = chapterData[String(verseNumber)];
                if (text !== undefined) {
                    verseTexts.push({
                        chapter: chapterNumber,
                        verse: verseNumber,
                        text
                    });
                }
            }
        }

        return verseTexts;
    }

    const chapterData = bookData[String(ref.chapter)];
    if (!chapterData) {
        return [];
    }

    return ref.verses
        .map((verseNumber) => ({
            chapter: ref.chapter,
            verse: verseNumber,
            text: chapterData[String(verseNumber)]
        }))
        .filter((entry) => entry.text !== undefined);
}

function buildJwUrl(ref) {
    const firstVerse = ref.startVerse || ref.verses[0];
    const endChapter = ref.endChapter || ref.chapter;
    const lastVerse = ref.endVerse || ref.verses[ref.verses.length - 1];
    const locale = LOCALE_MAP[DATA_LANGUAGE] || "E";

    return `https://www.jw.org/finder?srcid=jwlshare&wtlocale=${locale}&prefer=lang&bible=${formatNumber(ref.bookNumber, 2)}${formatNumber(ref.chapter, 3)}${formatNumber(firstVerse, 3)}-${formatNumber(ref.bookNumber, 2)}${formatNumber(endChapter, 3)}${formatNumber(lastVerse, 3)}&pub=nwtsty`;
}

function formatNumber(value, length) {
    return String(value).padStart(length || 2, "0");
}

module.exports = new JWBibleSidebarWidget();
