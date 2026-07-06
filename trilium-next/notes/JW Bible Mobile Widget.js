const REFRESH_INTERVAL_MS = 1500;
const DATA_NOTE_TITLE = "JW Bible EN Data";
const DATA_LABEL = "jwBibleData";
const DATA_LANGUAGE_LABEL = "jwBibleLang";
const ALIASES_NOTE_TITLE = "JW Bible Book Aliases";
const ALIASES_LABEL = "jwBibleAliases";
const DATA_LANGUAGE = "en";
const MOBILE_SCROLL_TOP_PADDING = 48;
const LOCALE_MAP = {
    en: "E"
};

const DEFAULT_BOOK_ALIASES = Object.freeze({});
const LINK_CLASS = "jw-bible-inline-ref";
const MOBILE_TOKEN_ATTR = "data-jw-bible-mobile-linkified";
const MOBILE_GENERATED_ATTR = "data-jw-mobile-generated-ref";
const MOBILE_ANCHOR_REF_ATTR = "data-jw-mobile-anchor-ref";
const EDITOR_REF_ATTR = "jwBibleRefId";

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

class JWBibleMobileWidget {
    constructor() {
        this.activeNote = null;
        this.lastSignature = null;
        this.lastDecoratedBodyFingerprint = null;
        this.lastDecoratedBodyMode = null;
        this.dataCache = new Map();
        this.aliasesCache = null;
        this.refreshTimer = null;
        this.stylesApplied = false;
        this.scrollListenerRegistered = false;
        this.isExpanded = false;
        this.pendingScrollTargetId = null;
        this.pendingSelectedText = null;
        this.pendingScrollRetries = 0;
        this.mountTimers = [];
        this.toolbarButtonRegistered = false;
        this.noteBodyListenersRegistered = false;
        this.handleNoteBodyClick = (event) => {
            const target = this.findNoteBodyReferenceTarget(event);
            if (!target || !event) {
                return;
            }

            const refId = target.getAttribute("data-jw-ref-id");
            if (!refId) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();
            window.dispatchEvent(new CustomEvent("jw-bible-scroll-to-ref", {
                detail: {
                    id: refId,
                    text: target.textContent || ""
                }
            }));
        };
        this.handleNoteBodyKeydown = (event) => {
            if (!event || (event.key !== "Enter" && event.key !== " ")) {
                return;
            }

            this.handleNoteBodyClick(event);
        };
    }

    doRender() {
        if (!this.isMobileEnvironment()) {
            this.$widget = $('<div style="display:none"></div>');
            return;
        }

        this.ensureStyles();
        this.ensureScrollListener();
        this.ensureNoteBodyListeners();

        this.$widget = $(`
            <section class="jw-bible-mobile-widget">
                <div class="jw-bible-mobile-backdrop"></div>
                <div class="jw-bible-mobile-panel">
                    <div class="jw-bible-mobile-panel-header">
                        <div class="jw-bible-mobile-toggle-label">Bible References</div>
                        <div class="jw-bible-mobile-panel-actions">
                            <span class="jw-bible-mobile-toggle-count"></span>
                            <button type="button" class="icon-action bx bx-x jw-bible-mobile-close" title="Close Bible references" aria-label="Close Bible references"></button>
                        </div>
                    </div>
                    <div class="jw-bible-mobile-body"></div>
                </div>
            </section>
        `);

        this.$toggle = $(`
            <button type="button" class="icon-action bx bx-book-open jw-bible-mobile-launcher jw-mobile-top-action-button" aria-expanded="false" title="Bible references" aria-label="Bible references">
                <span class="jw-bible-mobile-launcher-badge"></span>
            </button>
        `);

        this.$body = this.$widget.find(".jw-bible-mobile-body");
        this.$toggleLabel = this.$widget.find(".jw-bible-mobile-toggle-label");
        this.$toggleCount = this.$widget.find(".jw-bible-mobile-toggle-count");
        this.$badge = this.$toggle.find(".jw-bible-mobile-launcher-badge");
        this.$backdrop = this.$widget.find(".jw-bible-mobile-backdrop");
        this.$close = this.$widget.find(".jw-bible-mobile-close");

        this.$toggle.on("click", () => {
            this.setExpanded(!this.isExpanded);
        });
        this.$backdrop.on("click", () => {
            this.setExpanded(false);
        });
        this.$close.on("click", () => {
            this.setExpanded(false);
        });

        if (!this.refreshTimer) {
            this.refreshTimer = setInterval(() => {
                void this.refreshFromCurrentContext(false);
            }, REFRESH_INTERVAL_MS);
        }
        this.scheduleMount(0);
        this.scheduleMount(150);
        this.scheduleMount(500);
        void this.refreshFromCurrentContext(true);
    }

    cleanup() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }

        for (const timer of this.mountTimers) {
            clearTimeout(timer);
        }
        this.mountTimers = [];

        const root = this.$widget && this.$widget[0];
        if (root && root.parentElement === document.body) {
            root.remove();
        }

        const toggle = this.$toggle && this.$toggle[0];
        if (toggle && toggle.parentElement) {
            toggle.remove();
        }

        if (this.noteBodyListenersRegistered) {
            document.removeEventListener("click", this.handleNoteBodyClick, true);
            document.removeEventListener("keydown", this.handleNoteBodyKeydown, true);
            this.noteBodyListenersRegistered = false;
        }
    }

    ensureScrollListener() {
        if (this.scrollListenerRegistered) {
            return;
        }

        window.addEventListener("jw-bible-scroll-to-ref", async (event) => {
            if (!this.isMobileEnvironment()) {
                return;
            }

            const detail = event && event.detail ? event.detail : {};
            const targetId = detail.id;
            if (!targetId) {
                return;
            }

            this.pendingScrollTargetId = buildMobileReferenceDomIdFromBase(targetId);
            this.pendingSelectedText = normalizeReferenceSelectionText(detail.text || "");
            this.pendingScrollRetries = 0;
            await this.refreshFromCurrentContext(true, true);
            await this.openPanelAndScrollToPendingReference();
        });

        this.scrollListenerRegistered = true;
    }

    ensureNoteBodyListeners() {
        if (this.noteBodyListenersRegistered) {
            return;
        }

        document.addEventListener("click", this.handleNoteBodyClick, true);
        document.addEventListener("keydown", this.handleNoteBodyKeydown, true);
        this.noteBodyListenersRegistered = true;
    }

    isMobileEnvironment() {
        if (typeof window === "undefined" || typeof document === "undefined") {
            return false;
        }

        const userAgent = typeof navigator !== "undefined" ? String(navigator.userAgent || "") : "";
        const mobileUserAgent = /Android|iPhone|iPad|iPod|Mobile|Silk|Kindle|Opera Mini|IEMobile/u.test(userAgent);
        const coarsePointer = typeof window.matchMedia === "function"
            ? window.matchMedia("(pointer: coarse)").matches
            : false;
        const narrowViewport = typeof window.matchMedia === "function"
            ? window.matchMedia("(max-width: 900px)").matches
            : false;

        return mobileUserAgent || (coarsePointer && narrowViewport);
    }

    ensureStyles() {
        if (this.stylesApplied) {
            return;
        }

        const existingStyle = document.getElementById("jw-bible-mobile-widget-style");
        if (existingStyle) {
            existingStyle.remove();
        }

        const style = document.createElement("style");
        style.id = "jw-bible-mobile-widget-style";
        style.textContent = `
            .jw-bible-mobile-widget {
                position: static;
                display: block;
                contain: none;
            }

            .jw-mobile-top-action-host {
                position: fixed;
                top: calc(env(safe-area-inset-top, 0px) + 16px);
                right: calc(env(safe-area-inset-right, 0px) + 72px);
                z-index: 2147483000;
                display: flex;
                align-items: center;
                gap: 10px;
                pointer-events: none;
            }

            .jw-mobile-top-action-host > * {
                pointer-events: auto;
            }

            .jw-mobile-top-action-button {
                position: relative;
                width: 48px;
                height: 48px;
                border-radius: 999px;
                background: rgba(26, 28, 34, 0.96);
                box-shadow: 0 12px 28px rgba(0, 0, 0, 0.35);
                color: #9fd1ff;
                border: 1px solid rgba(255, 255, 255, 0.12);
            }

            .jw-bible-mobile-launcher.jw-bible-mobile-launcher-active {
                color: #ffe18d;
            }

            .jw-bible-mobile-launcher-badge {
                position: absolute;
                top: -4px;
                right: -4px;
                min-width: 18px;
                height: 18px;
                padding: 0 5px;
                border-radius: 999px;
                background: #9fd1ff;
                color: #07131e;
                font-size: 10px;
                font-weight: 700;
                line-height: 18px;
                text-align: center;
            }

            .${LINK_CLASS} {
                color: #9fd1ff;
                cursor: pointer;
                display: inline;
                text-decoration: underline;
                text-decoration-thickness: 1px;
                text-underline-offset: 2px;
            }

            .${LINK_CLASS}:hover {
                color: #c4e4ff;
            }

            .jw-bible-mobile-toggle-label {
                font-size: 16px;
                font-weight: 700;
                color: #ffffff;
            }

            .jw-bible-mobile-toggle-count {
                font-size: 12px;
                color: #9fd1ff;
            }

            .jw-bible-mobile-backdrop {
                position: fixed;
                inset: 0;
                display: none;
                background: rgba(5, 8, 14, 0.4);
                z-index: 2147483001;
            }

            .jw-bible-mobile-panel {
                position: fixed;
                left: 12px;
                right: 12px;
                top: 12px;
                bottom: 12px;
                display: none;
                border: 1px solid rgba(255, 255, 255, 0.12);
                border-radius: 16px;
                background: rgba(26, 28, 34, 0.98);
                box-shadow: 0 22px 48px rgba(0, 0, 0, 0.38);
                overflow: hidden;
                z-index: 2147483002;
            }

            .jw-bible-mobile-panel-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                padding: 14px 14px 12px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.08);
            }

            .jw-bible-mobile-panel-actions {
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .jw-bible-mobile-body {
                display: block;
                height: calc(100% - 56px);
                overflow: auto;
            }

            .jw-bible-mobile-widget.jw-bible-mobile-expanded .jw-bible-mobile-backdrop,
            .jw-bible-mobile-widget.jw-bible-mobile-expanded .jw-bible-mobile-panel {
                display: block;
            }

            .jw-bible-mobile-content {
                display: flex;
                flex-direction: column;
                gap: 14px;
                padding: 10px 8px 18px;
            }

            .jw-bible-mobile-empty {
                padding: 12px;
                border: 1px solid var(--theme-border-color);
                border-radius: 8px;
                color: var(--muted-text-color);
                background: #262626;
                font-size: 12px;
                line-height: 1.5;
            }

            .jw-bible-mobile-card {
                padding: 0;
            }

            .jw-bible-mobile-card.jw-bible-mobile-card-active {
                padding: 10px;
                border: 1px solid rgba(159, 209, 255, 0.45);
                border-radius: 12px;
                background: rgba(159, 209, 255, 0.08);
            }

            .jw-bible-mobile-card-header {
                display: flex;
                flex-direction: column;
                align-items: stretch;
                gap: 8px;
                padding: 0 0 8px;
                background: transparent;
            }

            .jw-bible-mobile-card-heading {
                display: flex;
                align-items: center;
                min-width: 0;
            }

            .jw-bible-mobile-card-title {
                min-width: 0;
                font-weight: 700;
                font-size: 17px;
                line-height: 1.25;
                color: #ffffff;
            }

            .jw-bible-mobile-button {
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

            .jw-bible-mobile-button:hover {
                color: #c4e4ff;
                text-decoration: none;
            }

            .jw-bible-mobile-button-secondary {
                color: #c7c7c7;
            }

            .jw-bible-mobile-card-body {
                display: flex;
                flex-direction: column;
                gap: 12px;
                padding: 0;
                font-size: 14px;
                line-height: 1.72;
                color: #f1f1f1;
            }

            .jw-bible-mobile-card-footer {
                margin-top: 10px;
                padding-top: 8px;
                border-top: 1px solid rgba(255, 255, 255, 0.14);
            }

            .jw-bible-mobile-paragraph {
                margin: 0;
            }

            .jw-bible-mobile-verse-span {
                display: inline;
            }

            .jw-bible-mobile-verse-number {
                font-weight: 700;
                margin-right: 6px;
                color: #ffffff;
            }

        `;
        document.head.appendChild(style);

        this.stylesApplied = true;
    }

    scheduleMount(delayMs) {
        const timer = setTimeout(() => {
            this.mountTimers = this.mountTimers.filter((entry) => entry !== timer);
            this.mountIntoBody();
            this.mountToggleIntoActionHost();
        }, delayMs);

        this.mountTimers.push(timer);
    }

    mountIntoBody() {
        const root = this.$widget && this.$widget[0] instanceof Element ? this.$widget[0] : null;
        if (!root || !document.body) {
            return;
        }

        if (root.parentElement !== document.body) {
            document.body.appendChild(root);
        }
    }

    mountToggleIntoActionHost() {
        const toggle = this.$toggle && this.$toggle[0] instanceof Element ? this.$toggle[0] : null;
        if (!toggle) {
            return;
        }

        const host = ensureMobileTopActionHost();
        if (!host) {
            return;
        }

        toggle.setAttribute("data-jw-action-order", "10");

        if (toggle.parentElement !== host) {
            const siblings = Array.from(host.children);
            const nextSibling = siblings.find((entry) => Number(entry.getAttribute("data-jw-action-order") || "999") > 10);
            host.insertBefore(toggle, nextSibling || null);
        }
    }

    setExpanded(expanded) {
        if (!this.isMobileEnvironment()) {
            return;
        }

        this.isExpanded = Boolean(expanded);

        if (!this.$widget) {
            return;
        }

        this.$widget.toggleClass("jw-bible-mobile-expanded", this.isExpanded);
        if (this.$toggle) {
            this.$toggle.attr("aria-expanded", this.isExpanded ? "true" : "false");
            this.$toggle.toggleClass("jw-bible-mobile-launcher-active", this.isExpanded);
        }

    }

    async refreshFromCurrentContext(force, preferNoteContent = false) {
        if (!this.isMobileEnvironment()) {
            return;
        }

        const activeNote = await this.getActiveNote();
        await this.refreshNoteContext(activeNote, force, preferNoteContent);
        await this.decorateNoteBodyReferences();
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

    findNoteContentElement() {
        const selectors = [
            ".note-detail-editable-text-editor.ck-content",
            ".note-detail-editable-text .ck-content",
            ".rendered-note",
            ".note-detail-readonly-text",
            ".note-detail-printable.visible",
            ".note-detail-content",
            ".note-detail-editable-text"
        ];

        const candidates = [];
        const activeElement = typeof document !== "undefined" && document.activeElement instanceof Element
            ? document.activeElement
            : null;

        for (const selector of selectors) {
            for (const found of document.querySelectorAll(selector)) {
                if (found instanceof Element && !candidates.includes(found)) {
                    candidates.push(found);
                }
            }
        }

        if (!candidates.length) {
            return null;
        }

        const visibleCandidates = candidates.filter((candidate) => isElementVisible(candidate));
        const prioritizedCandidates = visibleCandidates.length ? visibleCandidates : candidates;

        if (activeElement) {
            const activeMatch = prioritizedCandidates.find((candidate) =>
                candidate === activeElement
                || candidate.contains(activeElement)
                || activeElement.contains(candidate)
            );
            if (activeMatch) {
                return activeMatch;
            }
        }

        const editableMatch = prioritizedCandidates.find((candidate) =>
            candidate.matches(".note-detail-editable-text-editor.ck-content, .ck-content[contenteditable='true']")
        );
        if (editableMatch) {
            return editableMatch;
        }

        return prioritizedCandidates[0];
    }

    isEditableContainerFocused(container) {
        if (!(container instanceof Element) || typeof document === "undefined") {
            return false;
        }

        const activeElement = document.activeElement;
        if (!(activeElement instanceof Element)) {
            return false;
        }

        if (container === activeElement || container.contains(activeElement)) {
            return true;
        }

        const editable = container.matches(".note-detail-editable-text-editor.ck-content, .ck-content[contenteditable='true']")
            ? container
            : container.querySelector(".note-detail-editable-text-editor.ck-content, .ck-content[contenteditable='true']");

        if (!(editable instanceof Element)) {
            return false;
        }

        return editable === activeElement || editable.contains(activeElement);
    }

    async decorateNoteBodyReferences() {
        if (!this.isMobileEnvironment()) {
            return;
        }

        const container = this.findNoteContentElement();
        if (!(container instanceof Element)) {
            return;
        }

        const aliases = this.aliasesCache || await this.getBookAliases();
        const editor = await this.getActiveEditorForContainer(container);
        const noteKey = this.activeNote
            ? String(this.activeNote.noteId || this.activeNote.title || "unknown")
            : "unknown";
        const fingerprint = `${noteKey}|${(container.textContent || "").replace(/\s+/g, " ").trim()}`;

        if (editor) {
            if (this.isEditorFocused(editor)) {
                return;
            }

            if (container.querySelector(`[${MOBILE_GENERATED_ATTR}], [${MOBILE_ANCHOR_REF_ATTR}]`)) {
                this.stripPreviousNoteBodyDecorations(container);
            }

            this.ensureEditorReferenceSupport(editor);
            this.decorateEditorReferenceRanges(editor, aliases);
            container.setAttribute(MOBILE_TOKEN_ATTR, "true");
            this.lastDecoratedBodyFingerprint = fingerprint;
            this.lastDecoratedBodyMode = "editor";
            return;
        }

        const alreadyDecorated = container.hasAttribute(MOBILE_TOKEN_ATTR);
        const allowInitialFocusedDecoration = !container.hasAttribute(MOBILE_TOKEN_ATTR);
        if (this.isEditableContainerFocused(container) && !allowInitialFocusedDecoration) {
            return;
        }

        if (alreadyDecorated && this.lastDecoratedBodyMode === "dom" && fingerprint === this.lastDecoratedBodyFingerprint) {
            return;
        }

        this.stripPreviousNoteBodyDecorations(container);

        this.decorateNoteBodyAnchors(container, aliases);
        this.decorateNoteBodyInlineGroups(container, aliases);
        this.decorateNoteBodyTextNodes(container, aliases);
        this.decorateContinuationTextNodes(container, aliases);
        container.setAttribute(MOBILE_TOKEN_ATTR, "true");
        this.lastDecoratedBodyFingerprint = fingerprint;
        this.lastDecoratedBodyMode = "dom";
    }

    stripPreviousNoteBodyDecorations(container) {
        const existing = container.querySelectorAll(`[${MOBILE_ANCHOR_REF_ATTR}], [${MOBILE_GENERATED_ATTR}]`);
        for (const node of existing) {
            if (node.getAttribute && node.getAttribute(MOBILE_GENERATED_ATTR) === "true") {
                const parent = node.parentNode;
                if (parent) {
                    parent.replaceChild(document.createTextNode(node.textContent || ""), node);
                    parent.normalize();
                }
                continue;
            }

            if (node.getAttribute && node.getAttribute(MOBILE_ANCHOR_REF_ATTR) === "true") {
                unwrapElementPreservingChildren(node);
            }
        }

        container.removeAttribute(MOBILE_TOKEN_ATTR);
    }

    decorateNoteBodyAnchors(container, bookAliases) {
        this.decorateNoteBodyAnchorGroups(container, bookAliases);

        const anchors = Array.from(container.querySelectorAll("a"));
        for (const anchor of anchors) {
            const text = anchor.textContent || "";
            const references = findBibleReferencesInText(text, bookAliases);
            if (!references.length) {
                continue;
            }

            if (!anchorContainsOnlyReferenceText(text, references)) {
                unwrapElementPreservingChildren(anchor);
                continue;
            }

            const target = convertAnchorToReferenceElement(anchor);
            target.classList.add(LINK_CLASS);
            target.setAttribute("role", "link");
            target.setAttribute("tabindex", "0");
            target.setAttribute("data-jw-ref-id", buildReferenceDomId(references[0]));
        }
    }

    decorateNoteBodyInlineGroups(container, bookAliases) {
        const parents = new Set();

        for (const element of container.querySelectorAll("strong, em, span, b, i, u, small, sub, sup, q, s, mark")) {
            if (element.parentElement) {
                parents.add(element.parentElement);
            }
        }

        for (const parent of parents) {
            if (parent.closest(`a, .${LINK_CLASS}, script, style, code, pre`)) {
                continue;
            }

            const snapshot = Array.from(parent.childNodes);
            const directInlineElements = snapshot.filter((child) => (
                child.nodeType === Node.ELEMENT_NODE
                && child.tagName !== "A"
                && isInlineReferenceScopeElement(child)
            ));

            if (directInlineElements.length < 2) {
                continue;
            }

            const parentText = parent.textContent || "";
            const references = findBibleReferencesInText(parentText, bookAliases);
            if (!references.length) {
                continue;
            }

            const textSegments = [];
            let offset = 0;

            for (const child of snapshot) {
                const text = child.textContent || "";
                const start = offset;
                const end = start + text.length;

                const reference = references.find((candidate) => {
                    const candidateStart = candidate.index || 0;
                    const candidateEnd = candidateStart + candidate.raw.length;
                    return start < candidateEnd && end > candidateStart;
                });

                if (reference) {
                    if (child.nodeType === Node.ELEMENT_NODE && child.tagName !== "A" && isInlineReferenceScopeElement(child)) {
                        wrapInlineElementWithReference(child, reference, MOBILE_ANCHOR_REF_ATTR);
                    } else if (child.nodeType === Node.TEXT_NODE && text.trim()) {
                        textSegments.push({
                            node: child,
                            start,
                            end
                        });
                    }
                }

                offset = end;
            }

            if (textSegments.length) {
                applyReferenceToTextSegments(textSegments, references);
            }
        }
    }

    decorateNoteBodyAnchorGroups(container, bookAliases) {
        const parents = new Set();

        for (const anchor of container.querySelectorAll("a")) {
            if (anchor.parentElement) {
                parents.add(anchor.parentElement);
            }
        }

        for (const parent of parents) {
            const directAnchors = Array.from(parent.children)
                .filter((child) => child.tagName === "A");

            if (directAnchors.length < 2) {
                continue;
            }

            const parentText = parent.textContent || "";
            const references = findBibleReferencesInText(parentText, bookAliases);
            if (!references.length) {
                continue;
            }

            let nextReferenceIndex = 0;
            let offset = 0;
            for (const childNode of parent.childNodes) {
                const text = childNode.textContent || "";

                if (childNode.nodeType === Node.ELEMENT_NODE && childNode.tagName === "A") {
                    let referenceIndex = findMatchingReferenceIndexForAnchorText(
                        text,
                        references,
                        nextReferenceIndex
                    );

                    if (referenceIndex < 0) {
                        referenceIndex = references.findIndex((candidate, candidateIndex) => {
                            if (candidateIndex < nextReferenceIndex) {
                                return false;
                            }

                            const start = candidate.index || 0;
                            const end = start + candidate.raw.length;
                            return offset < end && offset + text.length > start;
                        });
                    }

                    const reference = referenceIndex >= 0
                        ? references[referenceIndex]
                        : null;

                    if (reference) {
                        nextReferenceIndex = referenceIndex + 1;
                        const target = convertAnchorToReferenceElement(childNode);
                        target.classList.add(LINK_CLASS);
                        target.setAttribute("role", "link");
                        target.setAttribute("tabindex", "0");
                        target.setAttribute("data-jw-ref-id", buildReferenceDomId(reference));
                    }
                }

                offset += text.length;
            }
        }
    }

    decorateNoteBodyTextNodes(container, bookAliases) {
        const walker = document.createTreeWalker(
            container,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: (node) => {
                    if (!node.nodeValue || !node.nodeValue.trim()) {
                        return NodeFilter.FILTER_REJECT;
                    }

                    const parent = node.parentElement;
                    if (!parent) {
                        return NodeFilter.FILTER_REJECT;
                    }

                    if (parent.closest(`a, .${LINK_CLASS}, script, style, code, pre`)) {
                        return NodeFilter.FILTER_REJECT;
                    }

                    return NodeFilter.FILTER_ACCEPT;
                }
            }
        );

        const textNodes = [];
        let current;
        while ((current = walker.nextNode())) {
            textNodes.push(current);
        }

        for (const textNode of textNodes) {
            const text = textNode.nodeValue || "";
            const references = findBibleReferencesInText(text, bookAliases);
            if (!references.length) {
                continue;
            }

            textNode.parentNode.replaceChild(buildMobileReferenceFragment(text, references), textNode);
        }
    }

    decorateContinuationTextNodes(container, bookAliases) {
        const walker = document.createTreeWalker(
            container,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: (node) => {
                    if (!node.nodeValue || !node.nodeValue.length) {
                        return NodeFilter.FILTER_REJECT;
                    }

                    const parent = node.parentElement;
                    if (!parent) {
                        return NodeFilter.FILTER_REJECT;
                    }

                    if (parent.closest(`a, .${LINK_CLASS}, script, style, code, pre`)) {
                        return NodeFilter.FILTER_REJECT;
                    }

                    const value = node.nodeValue || "";
                    const explicitContinuation = value.includes(";");
                    const implicitContinuation = startsWithImplicitContinuationReference(value);

                    if (!explicitContinuation && !implicitContinuation) {
                        return NodeFilter.FILTER_REJECT;
                    }

                    return NodeFilter.FILTER_ACCEPT;
                }
            }
        );

        const textNodes = [];
        let current;
        while ((current = walker.nextNode())) {
            textNodes.push(current);
        }

        for (const textNode of textNodes) {
            const text = textNode.nodeValue || "";
            const explicitContinuation = text.trim().startsWith(";");
            const implicitContinuation = !explicitContinuation
                && startsWithImplicitContinuationReference(text)
                && hasPreviousContinuationMarker(textNode);

            if (!explicitContinuation && !implicitContinuation) {
                continue;
            }

            const baseReference = findPreviousSiblingReference(textNode, bookAliases);
            if (!baseReference || !baseReference.book) {
                continue;
            }

            const sequence = collectContinuationTextSequence(textNode);
            if (!sequence.text) {
                continue;
            }

            const prefix = implicitContinuation ? "; " : "";
            const references = findContinuationReferencesInText(prefix + sequence.text, baseReference.book)
                .map((reference) => ({
                    ...reference,
                    index: Math.max(0, (reference.index || 0) - prefix.length)
                }));
            if (!references.length) {
                continue;
            }

            applyReferenceToTextSegments(sequence.segments, references);
        }
    }

    async getActiveEditorForContainer(container) {
        if (!container || typeof api.getActiveContextTextEditor !== "function") {
            return null;
        }

        try {
            const editor = await Promise.resolve(api.getActiveContextTextEditor());
            if (!editor) {
                return null;
            }

            const editable = this.getEditorEditableElement(editor);
            if (!(editable instanceof Element)) {
                return container.matches(".note-detail-editable-text-editor.ck-content, .ck-content[contenteditable='true']")
                    ? editor
                    : null;
            }

            if (container === editable || container.contains(editable) || editable.contains(container)) {
                return editor;
            }
        } catch (error) {
            console.debug("JW Bible widget: unable to get active editor for note body decoration", error);
        }

        return null;
    }

    getEditorEditableElement(editor) {
        return editor
            && editor.ui
            && typeof editor.ui.getEditableElement === "function"
            ? editor.ui.getEditableElement()
            : null;
    }

    isEditorFocused(editor) {
        if (!editor || typeof document === "undefined") {
            return false;
        }

        const editable = this.getEditorEditableElement(editor);
        const activeElement = document.activeElement;

        if (!(editable instanceof Element) || !(activeElement instanceof Element)) {
            return false;
        }

        return activeElement === editable || editable.contains(activeElement);
    }

    ensureEditorReferenceSupport(editor) {
        if (!editor || editor.__jwBibleMobileReferenceSupportInstalled) {
            return;
        }

        const schema = editor.model && editor.model.schema;
        if (schema && typeof schema.extend === "function") {
            try {
                schema.extend("$text", {
                    allowAttributes: [EDITOR_REF_ATTR]
                });
            } catch (error) {
                // Schema can already be extended for this editor instance.
            }
        }

        const conversion = editor.conversion;
        if (conversion && typeof conversion.for === "function") {
            const editingViewFactory = (value, { writer }) => {
                if (!value) {
                    return null;
                }

                return writer.createAttributeElement("span", {
                    class: LINK_CLASS,
                    "data-jw-ref-id": value
                }, {
                    priority: 7
                });
            };

            try {
                conversion.for("editingDowncast").attributeToElement({
                    model: EDITOR_REF_ATTR,
                    view: editingViewFactory
                });
            } catch (error) {
                // Converter can already be registered for this editor instance.
            }
        }

        editor.__jwBibleMobileReferenceSupportInstalled = true;
    }

    decorateEditorReferenceRanges(editor, bookAliases) {
        if (
            !editor ||
            !editor.model ||
            typeof editor.model.change !== "function" ||
            typeof editor.model.createPositionFromPath !== "function" ||
            typeof editor.model.createRange !== "function"
        ) {
            return;
        }

        const root = editor.model.document && typeof editor.model.document.getRoot === "function"
            ? editor.model.document.getRoot()
            : null;
        if (!root || typeof root.getChildren !== "function") {
            return;
        }

        const matches = [];
        collectEditorTextMatches(root, bookAliases, matches);
        const existingBibleRefRanges = [];
        collectExistingBibleEditorRefRanges(root, existingBibleRefRanges);
        const legacyBibleLinkRanges = [];
        collectExistingBibleEditorLinkRanges(root, legacyBibleLinkRanges);

        const desiredBibleLinkRanges = matches.map((match) => ({
            ...match,
            refId: buildReferenceDomId(match.reference)
        }));
        const selectionState = captureEditorSelectionState(editor);
        const rangesToRemove = existingBibleRefRanges
            .filter((rangeInfo) => (
                !desiredBibleLinkRanges.some((desiredRange) => areSameEditorRefRange(rangeInfo, desiredRange))
            ))
            .concat(legacyBibleLinkRanges);
        const rangesToAdd = desiredBibleLinkRanges.filter((desiredRange) => (
            !existingBibleRefRanges.some((rangeInfo) => areSameEditorRefRange(rangeInfo, desiredRange))
        ));

        if (!rangesToRemove.length && !rangesToAdd.length) {
            return;
        }

        rangesToRemove.sort(compareEditorMatchesDescending);
        rangesToAdd.sort(compareEditorMatchesDescending);
        const viewState = this.captureEditorViewState(editor);

        editor.model.change((writer) => {
            for (const rangeInfo of rangesToRemove) {
                const start = editor.model.createPositionFromPath(root, rangeInfo.startPath);
                const end = editor.model.createPositionFromPath(root, rangeInfo.endPath);
                const range = editor.model.createRange(start, end);
                writer.removeAttribute(EDITOR_REF_ATTR, range);
                writer.removeAttribute("linkHref", range);
            }

            for (const rangeInfo of rangesToAdd) {
                const start = editor.model.createPositionFromPath(root, rangeInfo.startPath);
                const end = editor.model.createPositionFromPath(root, rangeInfo.endPath);
                const range = editor.model.createRange(start, end);
                writer.removeAttribute(EDITOR_REF_ATTR, range);
                writer.removeAttribute("linkHref", range);
                writer.setAttribute(EDITOR_REF_ATTR, rangeInfo.refId, range);
            }

            restoreEditorSelectionState(editor, writer, selectionState);
        });

        this.restoreEditorViewState(editor, viewState);
    }

    captureEditorViewState(editor) {
        if (typeof window === "undefined" || typeof document === "undefined") {
            return null;
        }

        const editable = this.getEditorEditableElement(editor);
        if (!(editable instanceof HTMLElement)) {
            return null;
        }

        const scrollables = [];
        let current = editable.parentElement;

        while (current) {
            if (current instanceof HTMLElement && this.isScrollableElement(current)) {
                scrollables.push({
                    element: current,
                    top: current.scrollTop,
                    left: current.scrollLeft
                });
            }

            current = current.parentElement;
        }

        return {
            editable,
            hadFocus: this.isEditorFocused(editor),
            windowX: window.scrollX || window.pageXOffset || 0,
            windowY: window.scrollY || window.pageYOffset || 0,
            scrollables
        };
    }

    restoreEditorViewState(editor, viewState) {
        if (!viewState || typeof window === "undefined") {
            return;
        }

        const editable = this.getEditorEditableElement(editor) || viewState.editable;
        const shouldRefocus = viewState.hadFocus && !this.isMobileEnvironment();

        const apply = () => {
            if (shouldRefocus && editable instanceof HTMLElement && typeof editable.focus === "function") {
                try {
                    editable.focus({ preventScroll: true });
                } catch (error) {
                    try {
                        editable.focus();
                    } catch (focusError) {
                        // Ignore focus failures; scroll restore still helps.
                    }
                }
            }

            for (const item of viewState.scrollables || []) {
                if (!item || !(item.element instanceof HTMLElement) || !item.element.isConnected) {
                    continue;
                }

                item.element.scrollTop = item.top;
                item.element.scrollLeft = item.left;
            }

            if (typeof window.scrollTo === "function") {
                window.scrollTo(viewState.windowX, viewState.windowY);
            }
        };

        apply();

        if (typeof requestAnimationFrame === "function") {
            requestAnimationFrame(() => {
                apply();
                requestAnimationFrame(apply);
                if (this.isMobileEnvironment()) {
                    requestAnimationFrame(apply);
                }
            });
        } else {
            setTimeout(apply, 0);
            setTimeout(apply, 32);
            if (this.isMobileEnvironment()) {
                setTimeout(apply, 96);
            }
        }
    }

    isScrollableElement(element) {
        if (!(element instanceof HTMLElement) || typeof window === "undefined" || typeof window.getComputedStyle !== "function") {
            return false;
        }

        const style = window.getComputedStyle(element);
        const overflow = `${style.overflow} ${style.overflowX} ${style.overflowY}`;
        const canScroll = /(auto|scroll|overlay)/i.test(overflow);

        return canScroll && (
            element.scrollHeight > element.clientHeight + 1
            || element.scrollWidth > element.clientWidth + 1
        );
    }

    findNoteBodyReferenceTarget(event) {
        if (!event) {
            return null;
        }

        const selector = `.${LINK_CLASS}[data-jw-ref-id], [data-jw-ref-id]`;
        const path = typeof event.composedPath === "function" ? event.composedPath() : [];

        for (const entry of path) {
            if (!(entry instanceof Element)) {
                continue;
            }

            if (entry.matches(selector)) {
                return entry;
            }

            const closest = entry.closest(selector);
            if (closest) {
                return closest;
            }
        }

        const target = event.target instanceof Element
            ? event.target
            : event.target && event.target.parentElement instanceof Element
                ? event.target.parentElement
                : null;

        return target ? target.closest(selector) : null;
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

        if (preferNoteContent) {
            try {
                if (typeof api.getActiveContextTextEditor === "function") {
                    const editor = await Promise.resolve(api.getActiveContextTextEditor());
                    if (editor && typeof editor.getData === "function") {
                        rawContent = editor.getData() || "";
                    }
                }
            } catch (error) {
                console.debug("JW Bible widget: preferred editor content unavailable", error);
            }
        }

        if (!rawContent && note && typeof note.getContent === "function") {
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
        this.$toggleLabel.text("Bible References");
        this.$toggleCount.text(`${references.length} found`);
        this.$badge.text(String(references.length));

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

        const $container = $('<div class="jw-bible-mobile-content"></div>');
        const selectedTargetId = this.pendingScrollTargetId;
        const selectedText = this.pendingSelectedText;
        for (const ref of references) {
            const verseTexts = getVerseText(ref, bibleData);
            if (!verseTexts.length) {
                continue;
            }

            const title = `${ref.book} ${ref.chapter}:${ref.verseStr}`;
            const $card = $('<section class="jw-bible-mobile-card"></section>');
            const $header = $('<div class="jw-bible-mobile-card-header"></div>');
            const $heading = $('<div class="jw-bible-mobile-card-heading"></div>');
            const $title = $('<div class="jw-bible-mobile-card-title"></div>').append(
                $('<strong></strong>').text(title)
            );
            const $footer = $('<div class="jw-bible-mobile-card-footer"></div>');
            const $actions = $('<div></div>').css({
                display: "flex",
                alignItems: "center",
                columnGap: "24px",
                rowGap: "6px",
                flexWrap: "wrap"
            });
            const $open = $('<a href="#" class="jw-bible-mobile-button" title="Open in JW Library" aria-label="Open in JW Library"></a>');
            const $insert = $('<a href="#" class="jw-bible-mobile-button jw-bible-mobile-button-secondary" title="Insert into note" aria-label="Insert into note"></a>');
            const $body = $('<div class="jw-bible-mobile-card-body"></div>');
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

            const cardId = buildMobileReferenceDomId(ref);
            const isSelected = isSelectedReference(ref, selectedTargetId, selectedText);
            $card.attr("id", cardId);
            $card.toggleClass("jw-bible-mobile-card-active", Boolean(isSelected));

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
        this.$toggleLabel.text("Bible References");
        this.$toggleCount.text("");
        this.$badge.text("");
        this.$body.empty().append(
            $('<div class="jw-bible-mobile-empty"></div>').text(message)
        );
    }

    scrollToPendingReference() {
        if (!this.pendingScrollTargetId || !this.isExpanded) {
            return;
        }

        const scrollContainer = this.$body && this.$body[0] instanceof HTMLElement
            ? this.$body[0]
            : null;
        const element = this.findSelectedPanelCard()
            || document.getElementById(this.pendingScrollTargetId);

        if (!element || !scrollContainer || element.offsetParent === null || scrollContainer.clientHeight === 0) {
            if (this.pendingScrollRetries < 5) {
                this.pendingScrollRetries += 1;
                this.schedulePendingScroll(140);
            }
            return;
        }

        const containerRect = typeof scrollContainer.getBoundingClientRect === "function"
            ? scrollContainer.getBoundingClientRect()
            : null;
        const elementRect = typeof element.getBoundingClientRect === "function"
            ? element.getBoundingClientRect()
            : null;
        const targetTop = containerRect && elementRect
            ? Math.max(0, scrollContainer.scrollTop + (elementRect.top - containerRect.top) - MOBILE_SCROLL_TOP_PADDING)
            : Math.max(0, (element.offsetTop || 0) - MOBILE_SCROLL_TOP_PADDING);

        scrollContainer.scrollTop = targetTop;

        if (Math.abs(scrollContainer.scrollTop - targetTop) > 4) {
            setTimeout(() => {
                if (this.$body && this.$body[0] === scrollContainer) {
                    scrollContainer.scrollTop = targetTop;
                }
            }, 80);

            setTimeout(() => {
                if (this.$body && this.$body[0] === scrollContainer) {
                    scrollContainer.scrollTop = targetTop;
                }
            }, 220);

            if (this.pendingScrollRetries < 8) {
                this.pendingScrollRetries += 1;
                this.schedulePendingScroll(160);
                return;
            }
        }

        this.pendingScrollTargetId = null;
        this.pendingScrollRetries = 0;
    }

    async openPanelAndScrollToPendingReference() {
        this.setExpanded(true);

        for (let attempt = 0; attempt < 6; attempt += 1) {
            await waitForNextFrame();

            const scrollContainer = this.$body && this.$body[0] instanceof HTMLElement
                ? this.$body[0]
                : null;

            if (scrollContainer && scrollContainer.clientHeight > 0) {
                this.scrollToPendingReference();
                if (!this.pendingScrollTargetId) {
                    return;
                }
            }

            await waitForDelay(80);
        }
    }

    findSelectedPanelCard() {
        const body = this.$body && this.$body[0] instanceof HTMLElement
            ? this.$body[0]
            : null;
        if (!body) {
            return null;
        }

        return body.querySelector(".jw-bible-mobile-card-active");
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

function buildMobileReferenceDomId(ref) {
    return buildMobileReferenceDomIdFromBase(buildReferenceDomId(ref));
}

function buildMobileReferenceDomIdFromBase(baseId) {
    return `jw-mobile-${baseId}`;
}

function collectEditorTextMatches(element, bookAliases, matches) {
    if (!element || typeof element.getChildren !== "function") {
        return;
    }

    let runParent = null;
    let runParentPath = null;
    let runStartOffset = null;
    let runExpectedOffset = null;
    let runText = "";

    const flushRun = () => {
        if (!runParentPath || !runText.trim()) {
            runParent = null;
            runParentPath = null;
            runStartOffset = null;
            runExpectedOffset = null;
            runText = "";
            return;
        }

        const references = findBibleReferencesInText(runText, bookAliases);
        for (const reference of references) {
            matches.push({
                reference,
                startPath: runParentPath.concat(runStartOffset + reference.index),
                endPath: runParentPath.concat(runStartOffset + reference.index + reference.raw.length)
            });
        }

        runParent = null;
        runParentPath = null;
        runStartOffset = null;
        runExpectedOffset = null;
        runText = "";
    };

    for (const child of element.getChildren()) {
        if (child && typeof child.data === "string" && child.data.length) {
            const parent = child.parent;
            const parentPath = parent && typeof parent.getPath === "function" ? parent.getPath() : null;
            const startOffset = Number.isFinite(child.startOffset) ? child.startOffset : null;
            if (!parentPath || startOffset === null) {
                flushRun();
                continue;
            }

            const shouldStartNewRun =
                !runParentPath ||
                runParent !== parent ||
                runExpectedOffset === null ||
                runExpectedOffset !== startOffset;

            if (shouldStartNewRun) {
                flushRun();
                runParent = parent;
                runParentPath = parentPath;
                runStartOffset = startOffset;
                runExpectedOffset = startOffset;
            }

            runText += child.data;
            runExpectedOffset = startOffset + child.data.length;
            continue;
        }

        flushRun();

        if (child && typeof child.getChildren === "function") {
            collectEditorTextMatches(child, bookAliases, matches);
        }
    }

    flushRun();
}

function collectExistingBibleEditorLinkRanges(element, ranges) {
    if (!element || typeof element.getChildren !== "function") {
        return;
    }

    let runParent = null;
    let runParentPath = null;
    let runHref = null;
    let runStartOffset = null;
    let runExpectedOffset = null;

    const flushRun = () => {
        if (!runParentPath || !runHref || runStartOffset === null || runExpectedOffset === null) {
            runParent = null;
            runParentPath = null;
            runHref = null;
            runStartOffset = null;
            runExpectedOffset = null;
            return;
        }

        ranges.push({
            href: runHref,
            startPath: runParentPath.concat(runStartOffset),
            endPath: runParentPath.concat(runExpectedOffset)
        });

        runParent = null;
        runParentPath = null;
        runHref = null;
        runStartOffset = null;
        runExpectedOffset = null;
    };

    for (const child of element.getChildren()) {
        if (child && typeof child.data === "string" && child.data.length) {
            const linkHref = typeof child.getAttribute === "function" ? child.getAttribute("linkHref") : null;
            if (isBibleReferenceHref(linkHref)) {
                const parent = child.parent;
                const parentPath = parent && typeof parent.getPath === "function" ? parent.getPath() : null;
                const startOffset = Number.isFinite(child.startOffset) ? child.startOffset : null;
                if (!parentPath || startOffset === null) {
                    flushRun();
                    continue;
                }

                const shouldStartNewRun =
                    !runParentPath ||
                    runParent !== parent ||
                    runHref !== linkHref ||
                    runExpectedOffset === null ||
                    runExpectedOffset !== startOffset;

                if (shouldStartNewRun) {
                    flushRun();
                    runParent = parent;
                    runParentPath = parentPath;
                    runHref = linkHref;
                    runStartOffset = startOffset;
                    runExpectedOffset = startOffset;
                }

                runExpectedOffset = startOffset + child.data.length;
                continue;
            }

            flushRun();
            continue;
        }

        flushRun();

        if (child && typeof child.getChildren === "function") {
            collectExistingBibleEditorLinkRanges(child, ranges);
        }
    }

    flushRun();
}

function collectExistingBibleEditorRefRanges(element, ranges) {
    if (!element || typeof element.getChildren !== "function") {
        return;
    }

    let runParent = null;
    let runParentPath = null;
    let runRefId = null;
    let runStartOffset = null;
    let runExpectedOffset = null;

    const flushRun = () => {
        if (!runParentPath || !runRefId || runStartOffset === null || runExpectedOffset === null) {
            runParent = null;
            runParentPath = null;
            runRefId = null;
            runStartOffset = null;
            runExpectedOffset = null;
            return;
        }

        ranges.push({
            refId: runRefId,
            startPath: runParentPath.concat(runStartOffset),
            endPath: runParentPath.concat(runExpectedOffset)
        });

        runParent = null;
        runParentPath = null;
        runRefId = null;
        runStartOffset = null;
        runExpectedOffset = null;
    };

    for (const child of element.getChildren()) {
        if (child && typeof child.data === "string" && child.data.length) {
            const refId = typeof child.getAttribute === "function" ? child.getAttribute(EDITOR_REF_ATTR) : null;
            if (refId) {
                const parent = child.parent;
                const parentPath = parent && typeof parent.getPath === "function" ? parent.getPath() : null;
                const startOffset = Number.isFinite(child.startOffset) ? child.startOffset : null;
                if (!parentPath || startOffset === null) {
                    flushRun();
                    continue;
                }

                const shouldStartNewRun =
                    !runParentPath ||
                    runParent !== parent ||
                    runRefId !== refId ||
                    runExpectedOffset === null ||
                    runExpectedOffset !== startOffset;

                if (shouldStartNewRun) {
                    flushRun();
                    runParent = parent;
                    runParentPath = parentPath;
                    runRefId = refId;
                    runStartOffset = startOffset;
                    runExpectedOffset = startOffset;
                }

                runExpectedOffset = startOffset + child.data.length;
                continue;
            }

            flushRun();
            continue;
        }

        flushRun();

        if (child && typeof child.getChildren === "function") {
            collectExistingBibleEditorRefRanges(child, ranges);
        }
    }

    flushRun();
}

function captureEditorSelectionState(editor) {
    const selection = editor
        && editor.model
        && editor.model.document
        ? editor.model.document.selection
        : null;

    if (!selection || typeof selection.getRanges !== "function") {
        return null;
    }

    const ranges = [];
    for (const range of selection.getRanges()) {
        ranges.push({
            startPath: Array.from(range.start.path || []),
            endPath: Array.from(range.end.path || [])
        });
    }

    if (!ranges.length) {
        return null;
    }

    return {
        ranges,
        isBackward: Boolean(selection.isBackward)
    };
}

function restoreEditorSelectionState(editor, writer, selectionState) {
    if (
        !selectionState ||
        !selectionState.ranges ||
        !selectionState.ranges.length ||
        !editor ||
        !editor.model ||
        typeof editor.model.createPositionFromPath !== "function" ||
        typeof editor.model.createRange !== "function" ||
        !writer ||
        typeof writer.setSelection !== "function"
    ) {
        return;
    }

    const root = editor.model.document && typeof editor.model.document.getRoot === "function"
        ? editor.model.document.getRoot()
        : null;
    if (!root) {
        return;
    }

    const ranges = selectionState.ranges
        .map((rangeInfo) => {
            try {
                const start = editor.model.createPositionFromPath(root, rangeInfo.startPath);
                const end = editor.model.createPositionFromPath(root, rangeInfo.endPath);
                return editor.model.createRange(start, end);
            } catch (error) {
                return null;
            }
        })
        .filter(Boolean);

    if (!ranges.length) {
        return;
    }

    writer.setSelection(ranges, {
        backward: Boolean(selectionState.isBackward)
    });
}

function compareEditorMatchesDescending(left, right) {
    const leftPath = left.startPath || [];
    const rightPath = right.startPath || [];
    const length = Math.max(leftPath.length, rightPath.length);

    for (let index = 0; index < length; index += 1) {
        const leftValue = leftPath[index] ?? -1;
        const rightValue = rightPath[index] ?? -1;
        if (leftValue !== rightValue) {
            return rightValue - leftValue;
        }
    }

    return 0;
}

function areSameEditorRefRange(left, right) {
    return compareEditorPathArrays(left && left.startPath, right && right.startPath) === 0
        && compareEditorPathArrays(left && left.endPath, right && right.endPath) === 0
        && String(left && left.refId || "") === String(right && right.refId || "");
}

function compareEditorPathArrays(left, right) {
    const leftPath = Array.isArray(left) ? left : [];
    const rightPath = Array.isArray(right) ? right : [];
    const length = Math.max(leftPath.length, rightPath.length);

    for (let index = 0; index < length; index += 1) {
        const leftValue = leftPath[index] ?? -1;
        const rightValue = rightPath[index] ?? -1;
        if (leftValue !== rightValue) {
            return leftValue - rightValue;
        }
    }

    return 0;
}

function isBibleReferenceHref(value) {
    return typeof value === "string" && /(?:#jw-ref-|jwbible:jw-ref-)/i.test(value);
}

function waitForDelay(delayMs) {
    return new Promise((resolve) => {
        setTimeout(resolve, delayMs);
    });
}

function waitForNextFrame() {
    return new Promise((resolve) => {
        if (typeof requestAnimationFrame === "function") {
            requestAnimationFrame(() => {
                resolve();
            });
            return;
        }

        setTimeout(resolve, 0);
    });
}

function findContinuationScope(textNode) {
    let current = textNode && textNode.parentElement ? textNode.parentElement : null;
    if (!current) {
        return null;
    }

    while (current.parentElement && isInlineReferenceScopeElement(current)) {
        current = current.parentElement;
    }

    return current;
}

function isInlineReferenceScopeElement(element) {
    if (!(element instanceof Element)) {
        return false;
    }

    return new Set([
        "A",
        "ABBR",
        "B",
        "CITE",
        "CODE",
        "DEL",
        "EM",
        "I",
        "INS",
        "KBD",
        "MARK",
        "Q",
        "S",
        "SMALL",
        "SPAN",
        "STRONG",
        "SUB",
        "SUP",
        "U"
    ]).has(element.tagName);
}

function collectContinuationTextSequence(textNode) {
    const scope = findContinuationScope(textNode);
    if (!scope) {
        return { text: "", segments: [] };
    }

    const walker = document.createTreeWalker(
        scope,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: (node) => {
                if (!node.nodeValue || !node.nodeValue.length) {
                    return NodeFilter.FILTER_REJECT;
                }

                const parent = node.parentElement;
                if (!parent || parent.closest(`a, script, style, code, pre`)) {
                    return NodeFilter.FILTER_REJECT;
                }

                return NodeFilter.FILTER_ACCEPT;
            }
        }
    );

    const segments = [];
    let combinedText = "";
    let collecting = false;
    let current;

    while ((current = walker.nextNode())) {
        if (!collecting) {
            if (current !== textNode) {
                continue;
            }

            collecting = true;
        }

        const value = current.nodeValue || "";
        segments.push({
            node: current,
            start: combinedText.length,
            end: combinedText.length + value.length
        });
        combinedText += value;
    }

    return {
        text: combinedText,
        segments
    };
}

function findPreviousSiblingReference(textNode, bookAliases) {
    let current = textNode;

    while (current) {
        let sibling = current.previousSibling;
        while (sibling) {
            const text = sibling.textContent || "";
            const references = findBibleReferencesInText(text, bookAliases);
            if (references.length) {
                return references[references.length - 1];
            }

            sibling = sibling.previousSibling;
        }

        current = current.parentNode;
    }

    return null;
}

function hasPreviousContinuationMarker(textNode) {
    let current = textNode;

    while (current) {
        let sibling = current.previousSibling;
        while (sibling) {
            const text = sibling.textContent || "";
            if (text.trim()) {
                return /;[\s\u00A0]*$/u.test(text);
            }

            sibling = sibling.previousSibling;
        }

        current = current.parentNode;
    }

    return false;
}

function startsWithImplicitContinuationReference(text) {
    return /^\s*\d+[\s\u00A0]*:[\s\u00A0]*\d/u.test(String(text || ""));
}

function findContinuationReferencesInText(text, baseBook) {
    if (!text || !baseBook) {
        return [];
    }

    const references = [];
    const continuationRegex = new RegExp(`;[\\s\\u00A0]*(?<chapter>\\d+)[\\s\\u00A0]*:[\\s\\u00A0]*(?<verse>${buildVersePattern()})`, "gu");

    for (const match of text.matchAll(continuationRegex)) {
        const groups = match.groups || {};
        const chapterStr = groups.chapter;
        const verseStr = groups.verse;
        const continuationText = match[0] || "";
        const contentOffset = continuationText.search(/\d/u);

        if (!chapterStr || !verseStr || contentOffset < 0) {
            continue;
        }

        const parsedVerseSpec = parseVerseSpecification(Number(chapterStr), verseStr);
        if (!parsedVerseSpec) {
            continue;
        }

        references.push({
            raw: continuationText.slice(contentOffset),
            book: baseBook,
            chapter: Number(chapterStr),
            verseStr: parsedVerseSpec.verseStr,
            verses: parsedVerseSpec.verses,
            startVerse: parsedVerseSpec.startVerse,
            endChapter: parsedVerseSpec.endChapter,
            endVerse: parsedVerseSpec.endVerse,
            index: (match.index || 0) + contentOffset
        });
    }

    return references;
}

function applyReferenceToTextSegments(segments, references) {
    const referenceList = (Array.isArray(references) ? references : [references])
        .filter(Boolean)
        .sort((left, right) => (left.index || 0) - (right.index || 0));

    if (!segments.length || !referenceList.length) {
        return;
    }

    for (const segment of segments) {
        if (!(segment.node instanceof Text) || !segment.node.parentNode) {
            continue;
        }

        const overlappingReferences = referenceList
            .map((reference) => {
                const startIndex = reference.index || 0;
                const endIndex = startIndex + reference.raw.length;
                const overlapStart = Math.max(startIndex, segment.start);
                const overlapEnd = Math.min(endIndex, segment.end);

                if (overlapStart >= overlapEnd) {
                    return null;
                }

                return {
                    reference,
                    localStart: overlapStart - segment.start,
                    localEnd: overlapEnd - segment.start
                };
            })
            .filter(Boolean);

        if (!overlappingReferences.length) {
            continue;
        }

        const value = segment.node.nodeValue || "";
        const fragment = document.createDocumentFragment();
        let cursor = 0;

        for (const overlap of overlappingReferences) {
            if (overlap.localStart > cursor) {
                fragment.appendChild(document.createTextNode(value.slice(cursor, overlap.localStart)));
            }

            fragment.appendChild(
                createGeneratedReferenceElement(
                    value.slice(overlap.localStart, overlap.localEnd),
                    overlap.reference
                )
            );
            cursor = overlap.localEnd;
        }

        if (cursor < value.length) {
            fragment.appendChild(document.createTextNode(value.slice(cursor)));
        }

        segment.node.parentNode.replaceChild(fragment, segment.node);
    }
}

function normalizeReferenceSelectionText(value) {
    return String(value || "")
        .replace(/[\p{White_Space}\u200B]+/gu, " ")
        .trim()
        .toLowerCase();
}

function isSelectedReference(ref, selectedTargetId, selectedText) {
    if (selectedTargetId && buildMobileReferenceDomId(ref) === selectedTargetId) {
        return true;
    }

    if (!selectedText) {
        return false;
    }

    const rawText = normalizeReferenceSelectionText(ref.raw || "");
    const displayText = normalizeReferenceSelectionText(buildDisplayReference(ref));
    const normalizedReference = normalizeReferenceSelectionText(buildNormalizedReference(ref));

    return rawText === selectedText
        || displayText === selectedText
        || normalizedReference === selectedText
        || displayText.endsWith(selectedText);
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
            $paragraph = $('<p class="jw-bible-mobile-paragraph"></p>');
            $container.append($paragraph);
        }

        $paragraph.append(buildVerseSpan(verse, shouldShowChapterInVerseBody(verseTexts, index)));
        previousChapter = currentChapter;
        previousVerse = verse.verse;
    }
}

function buildVerseSpan(verse, includeChapter = false) {
    const $span = $('<span class="jw-bible-mobile-verse-span"></span>');
    const numberText = includeChapter
        ? `${verse.chapter}:${verse.verse}`
        : String(verse.verse);
    const $number = $('<span class="jw-bible-mobile-verse-number"></span>').text(numberText);
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

function buildMobileReferenceFragment(text, references) {
    const fragment = document.createDocumentFragment();
    let cursor = 0;

    for (const ref of references) {
        const start = ref.index || 0;
        const end = start + ref.raw.length;

        if (start > cursor) {
            fragment.appendChild(document.createTextNode(text.slice(cursor, start)));
        }

        fragment.appendChild(createGeneratedReferenceElement(ref.raw, ref));
        cursor = end;
    }

    if (cursor < text.length) {
        fragment.appendChild(document.createTextNode(text.slice(cursor)));
    }

    return fragment;
}

function createGeneratedReferenceElement(text, reference) {
    const element = document.createElement("span");
    element.className = LINK_CLASS;
    element.setAttribute("role", "link");
    element.setAttribute("tabindex", "0");
    element.setAttribute("data-jw-ref-id", buildReferenceDomId(reference));
    element.setAttribute(MOBILE_GENERATED_ATTR, "true");
    element.textContent = text;
    return element;
}

function unwrapElementPreservingChildren(element) {
    if (!(element instanceof Element)) {
        return;
    }

    const parent = element.parentNode;
    if (!parent) {
        return;
    }

    const fragment = document.createDocumentFragment();
    while (element.firstChild) {
        fragment.appendChild(element.firstChild);
    }

    parent.replaceChild(fragment, element);
    if (typeof parent.normalize === "function") {
        parent.normalize();
    }
}

function convertAnchorToReferenceElement(element) {
    if (!(element instanceof Element) || element.tagName !== "A") {
        return element;
    }

    const replacement = document.createElement("span");
    replacement.setAttribute(MOBILE_ANCHOR_REF_ATTR, "true");

    while (element.firstChild) {
        replacement.appendChild(element.firstChild);
    }

    if (element.parentNode) {
        element.parentNode.replaceChild(replacement, element);
    }

    return replacement;
}

function wrapInlineElementWithReference(element, reference, anchorAttrName) {
    if (!(element instanceof Element) || element.tagName === "A") {
        return element;
    }

    if (element.parentElement && element.parentElement.getAttribute(anchorAttrName) === "true") {
        return element.parentElement;
    }

    const wrapper = document.createElement("span");
    wrapper.setAttribute(anchorAttrName, "true");
    wrapper.classList.add(LINK_CLASS);
    wrapper.setAttribute("role", "link");
    wrapper.setAttribute("tabindex", "0");
    wrapper.setAttribute("data-jw-ref-id", buildReferenceDomId(reference));

    if (element.parentNode) {
        element.parentNode.replaceChild(wrapper, element);
        wrapper.appendChild(element);
    }

    return wrapper;
}

function anchorContainsOnlyReferenceText(text, references) {
    if (!text || !references || references.length !== 1) {
        return false;
    }

    return normalizeAnchorComparableText(text) === normalizeAnchorComparableText(references[0].raw);
}

function normalizeReferenceComparableText(value) {
    return String(value || "")
        .replace(/[\s\u00A0]+/g, " ")
        .replace(/[().[\]{}]+/g, "")
        .trim()
        .toLowerCase();
}

function normalizeAnchorComparableText(value) {
    return normalizeReferenceComparableText(
        String(value || "")
            .replace(/^[\s\u00A0;]+/gu, "")
            .replace(/[\s\u00A0;]+$/gu, "")
    );
}

function findMatchingReferenceIndexForAnchorText(text, references, startIndex = 0) {
    const normalizedText = normalizeAnchorComparableText(text);
    if (!normalizedText || !Array.isArray(references)) {
        return -1;
    }

    for (let index = Math.max(0, startIndex); index < references.length; index += 1) {
        if (normalizeAnchorComparableText(references[index].raw) === normalizedText) {
            return index;
        }
    }

    return -1;
}

function isElementVisible(element) {
    if (!(element instanceof Element) || !element.isConnected) {
        return false;
    }

    if (element.closest(".hidden-ext, [hidden], [aria-hidden='true']")) {
        return false;
    }

    const style = typeof window !== "undefined" && typeof window.getComputedStyle === "function"
        ? window.getComputedStyle(element)
        : null;

    if (style && (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse")) {
        return false;
    }

    const rect = typeof element.getBoundingClientRect === "function"
        ? element.getBoundingClientRect()
        : null;

    return Boolean(rect && rect.width > 0 && rect.height > 0);
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

function ensureMobileTopActionHost() {
    if (typeof document === "undefined") {
        return null;
    }

    let host = document.getElementById("jw-mobile-top-action-host");
    if (host) {
        return host;
    }

    host = document.createElement("div");
    host.id = "jw-mobile-top-action-host";
    host.className = "jw-mobile-top-action-host";

    if (document.body) {
        document.body.appendChild(host);
    }

    return host;
}

async function startJWBibleMobileWidget() {
    const globalKey = "__jwBibleMobileWidgetInstance";

    if (window[globalKey] && typeof window[globalKey].cleanup === "function") {
        window[globalKey].cleanup();
    }

    const widget = new JWBibleMobileWidget();
    widget.doRender();
    widget.mountIntoBody();
    widget.mountToggleIntoActionHost();
    await widget.refreshFromCurrentContext(true);
    window[globalKey] = widget;
}

void startJWBibleMobileWidget();
