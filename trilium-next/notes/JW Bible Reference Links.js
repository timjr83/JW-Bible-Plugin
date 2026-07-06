const LINK_CLASS = "jw-bible-inline-ref";
const TOKEN_ATTR = "data-jw-bible-linkified";
const GENERATED_ATTR = "data-jw-generated-ref";
const ANCHOR_REF_ATTR = "data-jw-anchor-ref";
const MOBILE_GENERATED_ATTR = "data-jw-mobile-generated-ref";
const MOBILE_ANCHOR_REF_ATTR = "data-jw-mobile-anchor-ref";
const ALIASES_NOTE_TITLE = "JW Bible Book Aliases";
const ALIASES_LABEL = "jwBibleAliases";
const DEBUG_LINKING = false;
const ENABLE_DIAGNOSTIC_LOGGING = true;
const DIAGNOSTIC_HISTORY_LIMIT = 100;
const EDITOR_LINK_PREFIX = "jwbible:";
const EDITOR_REF_ATTR = "jwBibleRefId";

const DEFAULT_BOOK_ALIASES = Object.freeze({});
const SINGLE_CHAPTER_BOOKS = new Set([
    "Obadiah",
    "Philemon",
    "2 John",
    "3 John",
    "Jude"
]);

class JWBibleReferenceLinks extends api.NoteContextAwareWidget {
    constructor() {
        super();
        this.contentSized();
        this.currentNote = null;
        this.observer = null;
        this.stylesApplied = false;
        this.aliasesCache = null;
        this.decorateTimer = null;
        this.followUpTimers = [];
        this.isDecorating = false;
        this.isApplyingEditorLinks = false;
        this.pendingObserverDecoration = false;
        this.lastDecoratedFingerprint = null;
        this.pendingDecorationReason = null;
        this.interactionContainer = null;
        this.editorEditableElement = null;
        this.mobileEditorElement = null;
        this.isMobileEditorActive = false;
        this.boundEditor = null;
        this.boundEditorDocument = null;
        this.debugElement = null;
        this.debugTimer = null;
        this.lastActivationRefId = null;
        this.lastActivationAt = 0;
        this.handleContainerClick = (event) => {
            this.handleReferenceActivation(event);
        };
        this.handleContainerPointerDown = (event) => {
            this.handleReferencePointerDown(event);
        };
        this.handleContainerKeydown = (event) => {
            if (event.key === "Enter" || event.key === " ") {
                this.handleReferenceActivation(event);
            }
        };
        this.handleContainerInput = () => {
            if (this.isMobileRuntime() && this.isMobileEditorActive) {
                this.debugStatus("container-input-skip", "mobile-active");
                return;
            }

            if (this.isMobileRuntime() && !this.boundEditor) {
                this.debugStatus("container-input-skip", "mobile-no-editor");
                return;
            }

            this.lastDecoratedFingerprint = null;
            this.debugStatus("container-input", "schedule-120");
            this.scheduleDecoration(120, "container-input");
        };
        this.handleEditorModelChange = () => {
            if (this.isApplyingEditorLinks) {
                this.debugStatus("change-data-skip", "self");
                return;
            }

            this.debugStatus("change-data", "schedule-80");
            this.scheduleEditorDecoration(80, "change:data");
        };
        this.handleEditorInput = () => {
            this.debugStatus("editor-input", "schedule-100");
            this.scheduleEditorDecoration(100, "editor-input");
        };
        this.handleEditorBlur = () => {
            if (this.isMobileRuntime()) {
                return;
            }

            this.lastDecoratedFingerprint = null;
            this.debugStatus("editor-blur", "schedule-100");
            this.scheduleEditorDecoration(100, "editor-blur");
        };
        this.handleMobileEditorBlur = () => {
            setTimeout(() => {
                if (
                    this.mobileEditorElement &&
                    typeof document !== "undefined" &&
                    document.activeElement instanceof Element &&
                    this.mobileEditorElement.contains(document.activeElement)
                ) {
                    this.debugStatus("mobile-blur-skip", "still-focused");
                    return;
                }

                this.isMobileEditorActive = false;
                this.lastDecoratedFingerprint = null;
                this.debugStatus("mobile-blur", "schedule-160");
                this.scheduleEditorDecoration(160, "mobile-blur");
            }, 120);
        };
        this.handleMobileEditorFocus = () => {
            this.isMobileEditorActive = true;
            this.debugStatus("mobile-focus", "active");
        };
        this.handleMobileEditorInput = () => {
            this.isMobileEditorActive = true;
            this.debugStatus("mobile-input", "active");
        };
    }

    doRender() {
        this.ensureStyles();
        this.$widget = $('<div style="display:none"></div>');
        this.ensureDebugOverlay();
    }

    async refreshWithNote(note) {
        this.currentNote = note || null;
        this.lastDecoratedFingerprint = null;
        this.installObserver();
        this.diagnosticLog("refreshWithNote", {
            noteId: note && note.noteId ? note.noteId : null,
            title: note && note.title ? note.title : null
        });
        this.scheduleDecoration(0, "refreshWithNote");
    }

    async entitiesReloadedEvent() {
        this.diagnosticLog("entitiesReloadedEvent", {
            noteId: this.currentNote && this.currentNote.noteId ? this.currentNote.noteId : null,
            title: this.currentNote && this.currentNote.title ? this.currentNote.title : null
        });
        this.scheduleDecoration(0, "entitiesReloadedEvent");
    }

    static get parentWidget() {
        return "note-detail-pane";
    }

    get position() {
        return 5;
    }

    cleanup() {
        if (this.decorateTimer) {
            clearTimeout(this.decorateTimer);
            this.decorateTimer = null;
        }

        for (const timer of this.followUpTimers) {
            clearTimeout(timer);
        }
        this.followUpTimers = [];

        if (this.debugTimer) {
            clearTimeout(this.debugTimer);
            this.debugTimer = null;
        }

        if (this.debugElement && this.debugElement.parentElement) {
            this.debugElement.parentElement.removeChild(this.debugElement);
        }
        this.debugElement = null;

        this.removeInteractionHandlers();
        this.removeMobileEditorHandlers();
        this.removeEditorHandlers();

        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }

        if (super.cleanup) {
            super.cleanup();
        }
    }

    ensureStyles() {
        if (this.stylesApplied) {
            return;
        }

        this.cssBlock(`
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

            a[href*="#jw-ref-"],
            a[data-cke-saved-href*="#jw-ref-"],
            a[href^="${EDITOR_LINK_PREFIX}"],
            a[data-cke-saved-href^="${EDITOR_LINK_PREFIX}"] {
                color: #9fd1ff;
                cursor: pointer;
                text-decoration: underline;
                text-decoration-thickness: 1px;
                text-underline-offset: 2px;
            }

            a[href*="#jw-ref-"]:hover,
            a[data-cke-saved-href*="#jw-ref-"]:hover,
            a[href^="${EDITOR_LINK_PREFIX}"]:hover,
            a[data-cke-saved-href^="${EDITOR_LINK_PREFIX}"]:hover {
                color: #c4e4ff;
            }

            .jw-bible-debug-status {
                position: fixed;
                left: 10px;
                right: 10px;
                bottom: calc(env(safe-area-inset-bottom, 0px) + 10px);
                z-index: 2147483647;
                padding: 8px 10px;
                border-radius: 10px;
                background: rgba(5, 8, 14, 0.88);
                color: #d7ecff;
                font-size: 12px;
                line-height: 1.35;
                box-shadow: 0 10px 28px rgba(0, 0, 0, 0.35);
                pointer-events: none;
                white-space: pre-wrap;
                opacity: 0;
                transition: opacity 120ms ease;
            }

            .jw-bible-debug-status.jw-bible-debug-visible {
                opacity: 1;
            }
        `);

        this.stylesApplied = true;
    }

    ensureDebugOverlay() {
        if (!DEBUG_LINKING || typeof document === "undefined" || this.debugElement) {
            return;
        }

        const element = document.createElement("div");
        element.className = "jw-bible-debug-status";
        document.body.appendChild(element);
        this.debugElement = element;
    }

    debugStatus(label, detail = "") {
        if (!DEBUG_LINKING) {
            return;
        }

        const message = [label, detail].filter(Boolean).join(" | ");
        const timestamp = new Date().toLocaleTimeString();

        if (typeof window !== "undefined") {
            const history = Array.isArray(window.__jwBibleDebugLog) ? window.__jwBibleDebugLog : [];
            history.push({ timestamp, label, detail });
            window.__jwBibleDebugLog = history.slice(-25);
        }

        console.info(`JW Bible debug ${timestamp}: ${message}`);

        this.ensureDebugOverlay();
        if (!this.debugElement) {
            return;
        }

        this.debugElement.textContent = `${timestamp}  ${message}`;
        this.debugElement.classList.add("jw-bible-debug-visible");

        if (this.debugTimer) {
            clearTimeout(this.debugTimer);
        }

        this.debugTimer = setTimeout(() => {
            if (this.debugElement) {
                this.debugElement.classList.remove("jw-bible-debug-visible");
            }
            this.debugTimer = null;
        }, 2500);
    }

    diagnosticLog(label, detail = {}) {
        if (!ENABLE_DIAGNOSTIC_LOGGING) {
            return;
        }

        const timestamp = new Date().toISOString();
        const entry = {
            timestamp,
            label,
            ...detail
        };

        if (typeof window !== "undefined") {
            const history = Array.isArray(window.__jwBibleDiagnosticLog)
                ? window.__jwBibleDiagnosticLog
                : [];
            history.push(entry);
            window.__jwBibleDiagnosticLog = history.slice(-DIAGNOSTIC_HISTORY_LIMIT);
        }

        console.info("JW Bible diagnostic", entry);
    }

    installObserver() {
        const container = this.findNoteContentElement();
        if (!container) {
            return;
        }

        this.installInteractionHandlers(this.getInteractionRoot(container));

        if (this.observer) {
            this.observer.disconnect();
        }

        this.observer = new MutationObserver(() => {
            if (this.isMobileRuntime() && this.isMobileEditorActive) {
                this.debugStatus("observer-skip", "mobile-active");
                return;
            }

            if (this.isDecorating) {
                this.pendingObserverDecoration = true;
                return;
            }

            this.scheduleDecoration(50, "mutationObserver");
        });

        this.observer.observe(container, {
            childList: true,
            subtree: true,
            characterData: true
        });
    }

    installInteractionHandlers(container) {
        if (!(container instanceof Element)) {
            return;
        }

        if (this.interactionContainer === container) {
            return;
        }

        this.removeInteractionHandlers();
        container.addEventListener("pointerdown", this.handleContainerPointerDown, true);
        container.addEventListener("click", this.handleContainerClick, true);
        container.addEventListener("keydown", this.handleContainerKeydown, true);
        container.addEventListener("input", this.handleContainerInput, true);
        this.interactionContainer = container;
    }

    removeInteractionHandlers() {
        if (!this.interactionContainer) {
            return;
        }

        this.interactionContainer.removeEventListener("pointerdown", this.handleContainerPointerDown, true);
        this.interactionContainer.removeEventListener("click", this.handleContainerClick, true);
        this.interactionContainer.removeEventListener("keydown", this.handleContainerKeydown, true);
        this.interactionContainer.removeEventListener("input", this.handleContainerInput, true);
        this.interactionContainer = null;
    }

    installMobileEditorHandlers(editor) {
        const editable = this.getEditorEditableElement(editor);
        if (!editable) {
            return;
        }

        if (this.mobileEditorElement !== editable) {
            this.removeMobileEditorHandlers();
            this.mobileEditorElement = editable;
        }

        editable.removeEventListener("blur", this.handleMobileEditorBlur, true);
        editable.removeEventListener("focusout", this.handleMobileEditorBlur, true);
        editable.removeEventListener("focus", this.handleMobileEditorFocus, true);
        editable.removeEventListener("focusin", this.handleMobileEditorFocus, true);
        editable.removeEventListener("input", this.handleMobileEditorInput, true);
        editable.addEventListener("blur", this.handleMobileEditorBlur, true);
        editable.addEventListener("focusout", this.handleMobileEditorBlur, true);
        editable.addEventListener("focus", this.handleMobileEditorFocus, true);
        editable.addEventListener("focusin", this.handleMobileEditorFocus, true);
        editable.addEventListener("input", this.handleMobileEditorInput, true);
        this.isMobileEditorActive = this.isEditorFocused(editor);
    }

    removeMobileEditorHandlers() {
        if (!this.mobileEditorElement) {
            return;
        }

        this.mobileEditorElement.removeEventListener("blur", this.handleMobileEditorBlur, true);
        this.mobileEditorElement.removeEventListener("focusout", this.handleMobileEditorBlur, true);
        this.mobileEditorElement.removeEventListener("focus", this.handleMobileEditorFocus, true);
        this.mobileEditorElement.removeEventListener("focusin", this.handleMobileEditorFocus, true);
        this.mobileEditorElement.removeEventListener("input", this.handleMobileEditorInput, true);
        this.mobileEditorElement = null;
        this.isMobileEditorActive = false;
    }

    installEditorHandlers(editor) {
        const modelDocument = editor
            && editor.model
            && editor.model.document
            && typeof editor.model.document.on === "function"
            ? editor.model.document
            : null;

        const editable = this.getEditorEditableElement(editor);
        if (this.boundEditor === editor && this.boundEditorDocument === modelDocument && this.editorEditableElement === editable) {
            return;
        }

        this.removeEditorHandlers();

        this.ensureEditorReferenceSupport(editor);

        if (editable) {
            editable.addEventListener("input", this.handleEditorInput, true);
            editable.addEventListener("blur", this.handleEditorBlur, true);
            editable.addEventListener("focusout", this.handleEditorBlur, true);
            this.editorEditableElement = editable;
        }

        if (modelDocument) {
            modelDocument.on("change:data", this.handleEditorModelChange);
            this.boundEditorDocument = modelDocument;
        }

        this.boundEditor = editor || null;
    }

    ensureEditorReferenceSupport(editor) {
        if (!editor || editor.__jwBibleReferenceSupportInstalled) {
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

        editor.__jwBibleReferenceSupportInstalled = true;
    }

    removeEditorHandlers() {
        if (this.boundEditorDocument && typeof this.boundEditorDocument.off === "function") {
            this.boundEditorDocument.off("change:data", this.handleEditorModelChange);
        }

        if (this.editorEditableElement) {
            this.editorEditableElement.removeEventListener("input", this.handleEditorInput, true);
            this.editorEditableElement.removeEventListener("blur", this.handleEditorBlur, true);
            this.editorEditableElement.removeEventListener("focusout", this.handleEditorBlur, true);
        }

        this.boundEditor = null;
        this.boundEditorDocument = null;
        this.editorEditableElement = null;
    }

    scheduleDecoration(delayMs, reason = "unspecified") {
        if (this.decorateTimer) {
            clearTimeout(this.decorateTimer);
        }

        this.pendingDecorationReason = reason;

        this.decorateTimer = setTimeout(() => {
            this.decorateTimer = null;
            void this.decorateCurrentNote();
        }, delayMs);
    }

    scheduleEditorDecoration(delayMs, reason = "editor-update") {
        this.lastDecoratedFingerprint = null;
        this.scheduleDecoration(delayMs, reason);
    }

    scheduleFollowUpDecoration(delayMs) {
        const timer = setTimeout(() => {
            this.followUpTimers = this.followUpTimers.filter((candidate) => candidate !== timer);
            this.lastDecoratedFingerprint = null;
            void this.decorateCurrentNote();
        }, delayMs);

        this.followUpTimers.push(timer);
    }

    async decorateCurrentNote() {
        const decorationReason = this.pendingDecorationReason || "unspecified";
        this.pendingDecorationReason = null;
        const container = this.findNoteContentElement();
        if (!container) {
            this.installObserver();
            this.removeEditorHandlers();
            this.removeMobileEditorHandlers();
            this.debugStatus("decorate-skip", "no-container");
            this.diagnosticLog("decorate-skip", {
                reason: decorationReason,
                cause: "no-container",
                noteId: this.currentNote && this.currentNote.noteId ? this.currentNote.noteId : null
            });
            return;
        }

        this.installObserver();

        const editor = await this.getEditorForContainer(container);
        if (editor) {
            this.installEditorHandlers(editor);
            this.installMobileEditorHandlers(editor);
        } else {
            this.removeEditorHandlers();
            this.removeMobileEditorHandlers();
        }

        const bookAliases = await this.getBookAliases();

        if (editor) {
            this.isDecorating = true;
            this.pendingObserverDecoration = false;

            try {
                this.debugStatus("decorate", "editor-branch");
                this.diagnosticLog("decorate", {
                    reason: decorationReason,
                    branch: "editor",
                    noteId: this.currentNote && this.currentNote.noteId ? this.currentNote.noteId : null
                });
                this.decorateEditorTextNodes(editor, bookAliases);
                container.setAttribute(TOKEN_ATTR, "true");
                this.lastDecoratedFingerprint = null;
            } finally {
                this.isDecorating = false;
                if (this.pendingObserverDecoration) {
                    this.pendingObserverDecoration = false;
                    this.scheduleDecoration(120, "pendingObserverDecoration");
                }
            }

            return;
        }

        const allowInitialMobileDomFallback =
            this.isMobileRuntime()
            && !editor;

        if (this.isEditableContainerFocused(container) && !allowInitialMobileDomFallback) {
            this.debugStatus("decorate-skip", this.isMobileRuntime() ? "mobile-dom-editor-active" : "dom-editor-active");
            this.diagnosticLog("decorate-skip", {
                reason: decorationReason,
                cause: this.isMobileRuntime() ? "mobile-dom-editor-active" : "dom-editor-active",
                noteId: this.currentNote && this.currentNote.noteId ? this.currentNote.noteId : null
            });
            return;
        }

        const fingerprint = this.buildDecorationFingerprint(container);
        if (fingerprint && fingerprint === this.lastDecoratedFingerprint) {
            this.debugStatus("decorate-skip", "fingerprint");
            this.diagnosticLog("decorate-skip", {
                reason: decorationReason,
                cause: "fingerprint",
                noteId: this.currentNote && this.currentNote.noteId ? this.currentNote.noteId : null
            });
            return;
        }

        this.isDecorating = true;
        this.pendingObserverDecoration = false;

        try {
            this.debugStatus("decorate", "dom-branch");
            this.diagnosticLog("decorate", {
                reason: decorationReason,
                branch: "dom",
                noteId: this.currentNote && this.currentNote.noteId ? this.currentNote.noteId : null
            });
            this.stripPreviousDecorations(container);
            this.decorateAnchorNodes(container, bookAliases);
            this.decorateInlineGroups(container, bookAliases);
            this.decorateTextNodes(container, bookAliases);
            this.decorateContinuationTextNodes(container, bookAliases);
            container.setAttribute(TOKEN_ATTR, "true");
            this.lastDecoratedFingerprint = this.buildDecorationFingerprint(container);
        } finally {
            this.isDecorating = false;
            if (this.pendingObserverDecoration) {
                this.pendingObserverDecoration = false;
                this.scheduleDecoration(120, "pendingObserverDecoration");
            }
        }
    }

    buildDecorationFingerprint(container) {
        const noteId = this.currentNote && this.currentNote.noteId ? this.currentNote.noteId : "unknown";
        const text = (container.textContent || "").replace(/\s+/g, " ").trim();
        const bibleAnchorCount = container.querySelectorAll(
            `a[href*="#jw-ref-"], a[data-cke-saved-href*="#jw-ref-"], a[href^="${EDITOR_LINK_PREFIX}"], a[data-cke-saved-href^="${EDITOR_LINK_PREFIX}"], [data-jw-ref-id]`
        ).length;
        const decoratedAnchorCount = container.querySelectorAll(`.${LINK_CLASS}`).length;
        return `${noteId}|${text}|${bibleAnchorCount}|${decoratedAnchorCount}`;
    }

    handleReferencePointerDown(event) {
        const target = this.findReferenceTarget(event);
        if (!target || !event) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
    }

    handleReferenceActivation(event) {
        const target = this.findReferenceTarget(event);
        if (!target || !event) {
            return;
        }

        const refId = this.getReferenceIdFromElement(target);
        if (!refId) {
            return;
        }

        const now = typeof Date !== "undefined" ? Date.now() : 0;
        if (
            this.lastActivationRefId === refId &&
            this.lastActivationAt &&
            now - this.lastActivationAt < 400
        ) {
            event.preventDefault();
            event.stopPropagation();
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        this.lastActivationRefId = refId;
        this.lastActivationAt = now;

        const detail = {
            id: refId,
            text: target.textContent || ""
        };

        this.dispatchReferenceScroll(detail);

        if (!this.isMobileRuntime()) {
            setTimeout(() => {
                this.dispatchReferenceScroll(detail);
            }, 120);

            setTimeout(() => {
                this.dispatchReferenceScroll(detail);
            }, 320);
        }
    }

    dispatchReferenceScroll(detail) {
        window.dispatchEvent(new CustomEvent("jw-bible-scroll-to-ref", {
            detail
        }));
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
        const scopedRoots = [];
        const widgetElement = this.$widget && this.$widget[0] instanceof Element ? this.$widget[0] : null;
        const activeElement = typeof document !== "undefined" && document.activeElement instanceof Element
            ? document.activeElement
            : null;
        const candidates = [];

        if (widgetElement) {
            const splitRoot = widgetElement.closest(".note-split");
            const detailRoot = widgetElement.closest(".note-detail-pane")
                || widgetElement.closest(".note-detail");

            if (splitRoot) {
                scopedRoots.push(splitRoot);
            }

            if (detailRoot && !scopedRoots.includes(detailRoot)) {
                scopedRoots.push(detailRoot);
            }

            if (widgetElement.parentElement && !scopedRoots.includes(widgetElement.parentElement)) {
                scopedRoots.push(widgetElement.parentElement);
            }
        }

        for (const root of scopedRoots) {
            for (const selector of selectors) {
                for (const found of root.querySelectorAll(selector)) {
                    if (found instanceof Element && !candidates.includes(found)) {
                        candidates.push(found);
                    }
                }
            }
        }

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

    getInteractionRoot(container) {
        if (!(container instanceof Element)) {
            return null;
        }

        return container.closest(".note-split")
            || container.closest(".note-detail-pane")
            || container.closest(".note-detail")
            || container.parentElement
            || container;
    }

    async getEditorForContainer(container) {
        const activeEditor = await this.getActiveEditorForContainer(container);
        if (activeEditor) {
            return activeEditor;
        }

        if (this.boundEditor && this.isEditorBoundToContainer(this.boundEditor, container)) {
            return this.boundEditor;
        }

        return null;
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

            if (!editable) {
                return editor;
            }

            if (container === editable || container.contains(editable) || editable.contains(container)) {
                return editor;
            }
        } catch (error) {
            console.error("JW Bible reference links: unable to get active editor", error);
        }

        return null;
    }

    isEditorBoundToContainer(editor, container) {
        if (!editor || !(container instanceof Element)) {
            return false;
        }

        const editable = this.getEditorEditableElement(editor) || this.editorEditableElement;
        if (!(editable instanceof Element)) {
            return false;
        }

        return container === editable || container.contains(editable) || editable.contains(container);
    }

    getEditorEditableElement(editor) {
        return editor
            && editor.ui
            && typeof editor.ui.getEditableElement === "function"
            ? editor.ui.getEditableElement()
            : null;
    }

    isMobileRuntime() {
        if (typeof window === "undefined") {
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

    isEditorFocused(editor) {
        if (!editor || typeof document === "undefined") {
            return false;
        }

        const editable = this.getEditorEditableElement(editor);
        const activeElement = document.activeElement;

        if (!editable || !activeElement) {
            return false;
        }

        return activeElement === editable || editable.contains(activeElement);
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

        this.diagnosticLog("restoreEditorViewState", {
            noteId: this.currentNote && this.currentNote.noteId ? this.currentNote.noteId : null,
            hadFocus: Boolean(viewState.hadFocus),
            scrollables: Array.isArray(viewState.scrollables) ? viewState.scrollables.length : 0,
            windowX: viewState.windowX,
            windowY: viewState.windowY,
            mobile: this.isMobileRuntime()
        });

        const editable = this.getEditorEditableElement(editor) || viewState.editable;
        const shouldRefocus = viewState.hadFocus && !this.isMobileRuntime();

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
                if (this.isMobileRuntime()) {
                    requestAnimationFrame(apply);
                }
            });
        } else {
            setTimeout(apply, 0);
            setTimeout(apply, 32);
            if (this.isMobileRuntime()) {
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

    findReferenceTarget(event) {
        if (!event) {
            return null;
        }

        const selector = `.${LINK_CLASS}, [data-jw-ref-id], a[href*="#jw-ref-"], a[data-cke-saved-href*="#jw-ref-"], a[href^="${EDITOR_LINK_PREFIX}"], a[data-cke-saved-href^="${EDITOR_LINK_PREFIX}"]`;
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

    getReferenceIdFromElement(element) {
        if (!element) {
            return null;
        }

        const dataRefId = element.getAttribute("data-jw-ref-id");
        if (dataRefId) {
            return dataRefId;
        }

        const hrefCandidates = [
            element.getAttribute("href") || "",
            element.getAttribute("data-cke-saved-href") || ""
        ];

        for (const href of hrefCandidates) {
            const match = href.match(/(?:#|jwbible:)(jw-ref-[a-z0-9-]+)/i);
            if (match) {
                return match[1];
            }
        }

        return null;
    }

    stripPreviousDecorations(container) {
        const existing = container.querySelectorAll(
            `.${LINK_CLASS}, [${ANCHOR_REF_ATTR}], a[href*="#jw-ref-"], a[data-cke-saved-href*="#jw-ref-"], a[href^="${EDITOR_LINK_PREFIX}"], a[data-cke-saved-href^="${EDITOR_LINK_PREFIX}"], [data-jw-ref-id]`
        );
        for (const node of existing) {
            if (
                node.getAttribute &&
                (
                    node.getAttribute(MOBILE_GENERATED_ATTR) === "true"
                    || node.getAttribute(MOBILE_ANCHOR_REF_ATTR) === "true"
                )
            ) {
                continue;
            }

            if (node.tagName === "A") {
                const isGenerated = node.getAttribute(GENERATED_ATTR) === "true";
                if (isGenerated || isBibleReferenceAnchor(node)) {
                    unwrapElementPreservingChildren(node);
                    continue;
                }

                node.classList.remove(LINK_CLASS);
                node.removeAttribute("role");
                node.removeAttribute("tabindex");
                node.removeAttribute("data-jw-ref-id");
                node.removeAttribute(GENERATED_ATTR);
                node.removeAttribute(ANCHOR_REF_ATTR);

                continue;
            }

            if (node.getAttribute && node.getAttribute(ANCHOR_REF_ATTR) === "true") {
                unwrapElementPreservingChildren(node);
                continue;
            }

            const parent = node.parentNode;
            if (!parent) {
                continue;
            }

            parent.replaceChild(document.createTextNode(node.textContent || ""), node);
            parent.normalize();
        }

        container.removeAttribute(TOKEN_ATTR);
    }

    decorateAnchorNodes(container, bookAliases) {
        this.decorateAnchorGroups(container, bookAliases);

        const anchors = Array.from(container.querySelectorAll("a"))
            .filter((anchor) => !anchor.classList.contains(LINK_CLASS));

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

            this.decorateAnchorElement(anchor, references[0]);
        }
    }

    decorateAnchorGroups(container, bookAliases) {
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
                    }

                    if (reference) {
                        this.decorateAnchorElement(childNode, reference);
                    }
                }

                offset += text.length;
            }
        }
    }

    decorateAnchorElement(anchor, reference) {
        const target = convertAnchorToReferenceElement(anchor);
        target.classList.add(LINK_CLASS);
        target.setAttribute("role", "link");
        target.setAttribute("tabindex", "0");
        target.setAttribute("data-jw-ref-id", buildReferenceDomId(reference));
        target.removeAttribute("data-cke-saved-href");
        target.removeAttribute("href");
    }

    decorateInlineGroups(container, bookAliases) {
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
                        wrapInlineElementWithReference(child, reference);
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

    decorateTextNodes(container, bookAliases) {
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
            this.decorateTextNode(textNode, bookAliases);
        }
    }

    decorateTextNode(textNode, bookAliases) {
        const text = textNode.nodeValue || "";
        const references = findBibleReferencesInText(text, bookAliases);
        if (!references.length) {
            return;
        }

        const fragment = this.buildReferenceFragment(text, references);
        textNode.parentNode.replaceChild(fragment, textNode);
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
            this.decorateContinuationTextNode(textNode, bookAliases);
        }
    }

    decorateContinuationTextNode(textNode, bookAliases) {
        if (!textNode.parentNode) {
            return;
        }

        const text = textNode.nodeValue || "";
        const explicitContinuation = text.trim().startsWith(";");
        const implicitContinuation = !explicitContinuation
            && startsWithImplicitContinuationReference(text)
            && hasPreviousContinuationMarker(textNode);

        if (!explicitContinuation && !implicitContinuation) {
            return;
        }

        const baseReference = findPreviousSiblingReference(textNode, bookAliases);
        if (!baseReference || !baseReference.book) {
            return;
        }

        const sequence = collectContinuationTextSequence(textNode);
        if (!sequence.text) {
            return;
        }

        const prefix = implicitContinuation ? "; " : "";
        const references = findContinuationReferencesInText(prefix + sequence.text, baseReference.book)
            .map((reference) => ({
                ...reference,
                index: Math.max(0, (reference.index || 0) - prefix.length)
            }));
        if (!references.length) {
            return;
        }

        applyReferenceToTextSegments(sequence.segments, references);
    }

    decorateEditorTextNodes(editor, bookAliases) {
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
            this.debugStatus("editor-links", "noop");
            return;
        }

        rangesToRemove.sort(compareEditorMatchesDescending);
        rangesToAdd.sort(compareEditorMatchesDescending);
        const viewState = this.captureEditorViewState(editor);

        this.isApplyingEditorLinks = true;
        try {
            this.debugStatus("editor-links", `apply remove:${rangesToRemove.length} add:${rangesToAdd.length}`);
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
        } finally {
            this.isApplyingEditorLinks = false;
        }

        this.restoreEditorViewState(editor, viewState);
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
            console.error("JW Bible reference links: unable to load alias JSON data", error);
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
            console.error("JW Bible reference links: unable to search for alias note", error);
            return null;
        }
    }

    buildReferenceFragment(text, references) {
        const fragment = document.createDocumentFragment();
        let cursor = 0;

        for (const ref of references) {
            const start = ref.index || 0;
            const end = start + ref.raw.length;

            if (start > cursor) {
                fragment.appendChild(document.createTextNode(text.slice(cursor, start)));
            }

            fragment.appendChild(createGeneratedReferenceAnchor(ref.raw, ref));
            cursor = end;
        }

        if (cursor < text.length) {
            fragment.appendChild(document.createTextNode(text.slice(cursor)));
        }

        return fragment;
    }
}

module.exports = JWBibleReferenceLinks;

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

        const initialMatchedText = continuationStr
            ? match[0].slice(0, match[0].length - continuationStr.length)
            : match[0];

        addReferenceMatch({
            references,
            seen,
            raw: initialMatchedText,
            book,
            chapter: Number(chapterStr),
            verseStr,
            index: match.index || 0
        });

        const continuationRegex = new RegExp(`;[\\s\\u00A0]*(?<chapter>\\d+)[\\s\\u00A0]*:[\\s\\u00A0]*(?<verse>${buildVersePattern()})`, "gu");
        for (const continuation of continuationStr.matchAll(continuationRegex)) {
            const continuationGroups = continuation.groups || {};
            if (!continuationGroups.chapter || !continuationGroups.verse) {
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
                chapter: Number(continuationGroups.chapter),
                verseStr: continuationGroups.verse,
                index: (match.index || 0) + initialMatchedText.length + continuation.index + contentOffset
            });
        }
    }

    for (const match of text.matchAll(parserContext.referenceRegex)) {
        const groups = match.groups || {};
        if (!groups.book || !groups.chapter || !groups.verse) {
            continue;
        }

        const book = parserContext.bookLookup[normalizeBookKey(groups.book)];
        if (!book) {
            continue;
        }

        const chapter = parserContext.singleChapterBooks.has(book) ? 1 : Number(groups.chapter);
        addReferenceMatch({
            references,
            seen,
            raw: match[0],
            book,
            chapter,
            verseStr: groups.verse,
            index: match.index || 0
        });
    }

    for (const match of text.matchAll(parserContext.singleChapterRegex)) {
        const groups = match.groups || {};
        if (!groups.book || !groups.verse) {
            continue;
        }

        const book = parserContext.bookLookup[normalizeBookKey(groups.book)];
        if (!book || !parserContext.singleChapterBooks.has(book)) {
            continue;
        }

        addReferenceMatch({
            references,
            seen,
            raw: match[0],
            book,
            chapter: 1,
            verseStr: groups.verse,
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
    if (!parsedVerseSpec) {
        return;
    }

    const uniqueKey = `${book}|${chapter}|${parsedVerseSpec.startVerse}|${parsedVerseSpec.endChapter}|${parsedVerseSpec.endVerse}|${parsedVerseSpec.verses.join(",")}`;

    if (seen.has(uniqueKey)) {
        return;
    }

    seen.add(uniqueKey);
    references.push({
        raw,
        book,
        chapter,
        verseStr: parsedVerseSpec.verseStr,
        verses: parsedVerseSpec.verses,
        startVerse: parsedVerseSpec.startVerse,
        endChapter: parsedVerseSpec.endChapter,
        endVerse: parsedVerseSpec.endVerse,
        index
    });
}

function buildReferenceDomId(ref) {
    const normalizedReference = Number(ref.endChapter || ref.chapter) !== Number(ref.chapter)
        ? `${ref.book} ${ref.chapter}:${ref.startVerse}-${ref.endChapter}:${ref.endVerse}`
        : `${ref.book} ${ref.chapter}:${ref.verseStr}`;
    const safeReference = normalizedReference
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

    return `jw-ref-${safeReference}`;
}

function isBibleReferenceAnchor(anchor) {
    if (!(anchor instanceof Element) || anchor.tagName !== "A") {
        return false;
    }

    if (anchor.hasAttribute("data-jw-ref-id")) {
        return true;
    }

    const hrefCandidates = [
        anchor.getAttribute("href") || "",
        anchor.getAttribute("data-cke-saved-href") || ""
    ];

    return hrefCandidates.some((href) => /(?:#jw-ref-|jwbible:jw-ref-)/i.test(href));
}

function createGeneratedReferenceAnchor(text, reference) {
    const element = document.createElement("span");
    element.className = LINK_CLASS;
    element.setAttribute("role", "link");
    element.setAttribute("tabindex", "0");
    element.setAttribute("data-jw-ref-id", buildReferenceDomId(reference));
    element.setAttribute(GENERATED_ATTR, "true");
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
    replacement.setAttribute(ANCHOR_REF_ATTR, "true");

    while (element.firstChild) {
        replacement.appendChild(element.firstChild);
    }

    if (element.parentNode) {
        element.parentNode.replaceChild(replacement, element);
    }

    return replacement;
}

function wrapInlineElementWithReference(element, reference) {
    if (!(element instanceof Element) || element.tagName === "A") {
        return element;
    }

    if (element.parentElement && element.parentElement.getAttribute(ANCHOR_REF_ATTR) === "true") {
        return element.parentElement;
    }

    const wrapper = document.createElement("span");
    wrapper.setAttribute(ANCHOR_REF_ATTR, "true");
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

        segments.push({
            node: current,
            start: combinedText.length,
            end: combinedText.length + current.nodeValue.length
        });
        combinedText += current.nodeValue;

        if (combinedText.length >= 64) {
            break;
        }
    }

    return {
        text: combinedText,
        segments
    };
}

function applyReferenceToTextSegments(segments, references) {
    const referenceList = (Array.isArray(references) ? references : [references])
        .filter(Boolean)
        .sort((left, right) => (left.index || 0) - (right.index || 0));

    if (!segments || !segments.length || !referenceList.length) {
        return;
    }

    for (const segment of segments) {
        const node = segment.node;
        if (!node || !node.parentNode) {
            continue;
        }

        const overlappingReferences = referenceList
            .map((reference) => {
                const start = reference.index || 0;
                const end = start + reference.raw.length;
                const overlapStart = Math.max(start, segment.start);
                const overlapEnd = Math.min(end, segment.end);

                if (overlapEnd <= overlapStart) {
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

        const nodeText = node.nodeValue || "";
        const fragment = document.createDocumentFragment();
        let cursor = 0;

        for (const overlap of overlappingReferences) {
            if (overlap.localStart > cursor) {
                fragment.appendChild(document.createTextNode(nodeText.slice(cursor, overlap.localStart)));
            }

            fragment.appendChild(
                createGeneratedReferenceAnchor(
                    nodeText.slice(overlap.localStart, overlap.localEnd),
                    overlap.reference
                )
            );
            cursor = overlap.localEnd;
        }

        if (cursor < nodeText.length) {
            fragment.appendChild(document.createTextNode(nodeText.slice(cursor)));
        }

        node.parentNode.replaceChild(fragment, node);
    }
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

function areSameEditorLinkRange(left, right) {
    return compareEditorPathArrays(left && left.startPath, right && right.startPath) === 0
        && compareEditorPathArrays(left && left.endPath, right && right.endPath) === 0
        && String(left && left.href || "") === String(right && right.href || "");
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

function findPreviousSiblingReference(textNode, bookAliases) {
    let current = textNode;

    while (current) {
        let sibling = current.previousSibling;

        while (sibling) {
            const text = sibling.textContent || "";
            if (text.trim()) {
                const references = findBibleReferencesInText(text, bookAliases);
                if (references.length) {
                    return references[references.length - 1];
                }
            }

            sibling = sibling.previousSibling;
        }

        current = current.parentNode;
        if (!(current instanceof Node)) {
            break;
        }
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
        if (!(current instanceof Node)) {
            break;
        }
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

function isBibleReferenceHref(value) {
    return typeof value === "string" && /(?:#jw-ref-|jwbible:jw-ref-)/i.test(value);
}
