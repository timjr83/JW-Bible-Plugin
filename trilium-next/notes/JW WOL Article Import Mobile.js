const SUPPORTED_IMPORT_HOSTS = new Set(["wol.jw.org", "www.jw.org", "jw.org"]);
const ARTICLE_SELECTOR = "#article";

class JWWolArticleImportMobile {
    constructor() {
        this.stylesApplied = false;
        this.isBusy = false;
        this.lastImportedUrl = "";
        this.mountTimers = [];
        this.linkHandlerInstalled = false;
        this.handleDocumentClick = (event) => {
            void this.handleSupportedArticleLinkClick(event);
        };
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

    doRender() {
        if (!this.isMobileEnvironment()) {
            this.$button = $('<button type="button" style="display:none"></button>');
            return;
        }

        this.ensureStyles();
        this.ensureLinkHandler();

        this.$button = $(`
            <button
                type="button"
                class="icon-action bx bx-import jw-wol-import-mobile-button jw-mobile-top-action-button"
                title="Import JW article into the current note"
                aria-label="Import JW article into the current note"
            ></button>
        `);

        this.$button.on("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            void this.promptAndImport();
        });
    }

    cleanup() {
        for (const timer of this.mountTimers) {
            clearTimeout(timer);
        }
        this.mountTimers = [];
        this.removeImportDialog();
        this.removeLinkImportPopover();
        this.removeLinkHandler();

        const button = this.$button && this.$button[0];
        if (button && button.parentElement) {
            button.remove();
        }
    }

    ensureStyles() {
        if (this.stylesApplied) {
            return;
        }

        const existingStyle = document.getElementById("jw-wol-import-mobile-style");
        if (existingStyle) {
            existingStyle.remove();
        }

        const style = document.createElement("style");
        style.id = "jw-wol-import-mobile-style";
        style.textContent = `
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

            .jw-wol-import-mobile-button.jw-wol-import-mobile-button-busy {
                color: #ffe18d;
                opacity: 0.8;
                cursor: progress;
            }

            .jw-wol-import-mobile-button[disabled] {
                opacity: 0.55;
                cursor: progress;
            }

            .jw-wol-import-dialog-backdrop {
                position: fixed;
                inset: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 18px;
                background: rgba(5, 8, 14, 0.56);
                z-index: 2147483400;
            }

            .jw-wol-import-dialog {
                width: min(100%, 480px);
                border: 1px solid rgba(255, 255, 255, 0.12);
                border-radius: 16px;
                background: rgba(26, 28, 34, 0.98);
                box-shadow: 0 22px 48px rgba(0, 0, 0, 0.38);
                color: #f1f1f1;
                padding: 18px;
            }

            .jw-wol-import-dialog-title {
                margin: 0 0 10px;
                font-size: 18px;
                font-weight: 700;
                color: #ffffff;
            }

            .jw-wol-import-dialog-copy {
                margin: 0 0 14px;
                font-size: 13px;
                line-height: 1.5;
                color: #d2d6dc;
            }

            .jw-wol-import-dialog-label {
                display: block;
                margin: 0 0 6px;
                font-size: 12px;
                font-weight: 600;
                color: #ffffff;
            }

            .jw-wol-import-dialog-input {
                width: 100%;
                min-height: 40px;
                margin: 0;
                padding: 9px 12px;
                border: 1px solid rgba(255, 255, 255, 0.14);
                border-radius: 10px;
                background: rgba(255, 255, 255, 0.06);
                color: #ffffff;
                font-size: 14px;
            }

            .jw-wol-import-dialog-input:focus {
                outline: 2px solid rgba(159, 209, 255, 0.4);
                outline-offset: 1px;
                border-color: rgba(159, 209, 255, 0.55);
            }

            .jw-wol-import-dialog-checkbox {
                display: flex;
                align-items: center;
                gap: 10px;
                margin: 14px 0 0;
                font-size: 13px;
                color: #f1f1f1;
                cursor: pointer;
            }

            .jw-wol-import-dialog-checkbox input {
                width: 16px;
                height: 16px;
                margin: 0;
            }

            .jw-wol-import-dialog-error {
                min-height: 18px;
                margin-top: 10px;
                font-size: 12px;
                color: #ffb4b4;
            }

            .jw-wol-import-dialog-actions {
                display: flex;
                justify-content: flex-end;
                gap: 10px;
                margin-top: 16px;
            }

            .jw-wol-import-dialog-button {
                appearance: none;
                min-height: 36px;
                padding: 8px 14px;
                border: 1px solid rgba(255, 255, 255, 0.14);
                border-radius: 999px;
                background: transparent;
                color: #f1f1f1;
                font-size: 13px;
                font-weight: 600;
                cursor: pointer;
            }

            .jw-wol-import-dialog-button:hover {
                border-color: rgba(255, 255, 255, 0.24);
            }

            .jw-wol-import-dialog-button-primary {
                background: #9fd1ff;
                border-color: transparent;
                color: #07131e;
            }

            .jw-wol-link-import-popover-backdrop {
                position: fixed;
                inset: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 18px;
                background: rgba(5, 8, 14, 0.56);
                z-index: 2147483400;
            }

            .jw-wol-link-import-popover {
                width: min(100%, 420px);
                border: 1px solid rgba(255, 255, 255, 0.12);
                border-radius: 16px;
                background: rgba(26, 28, 34, 0.98);
                box-shadow: 0 22px 48px rgba(0, 0, 0, 0.38);
                color: #f1f1f1;
                padding: 18px;
            }

            .jw-wol-link-import-popover-title {
                margin: 0 0 8px;
                font-size: 16px;
                font-weight: 700;
                color: #ffffff;
            }

            .jw-wol-link-import-popover-copy {
                margin: 0;
                font-size: 13px;
                line-height: 1.5;
                color: #d2d6dc;
                word-break: break-word;
            }

            .jw-wol-link-import-popover-actions {
                display: flex;
                justify-content: flex-end;
                gap: 10px;
                margin-top: 16px;
            }
        `;
        document.head.appendChild(style);

        this.stylesApplied = true;
    }

    scheduleMount(delayMs) {
        const timer = setTimeout(() => {
            this.mountTimers = this.mountTimers.filter((entry) => entry !== timer);
            this.mountIntoActionHost();
        }, delayMs);

        this.mountTimers.push(timer);
    }

    ensureLinkHandler() {
        if (this.linkHandlerInstalled || typeof document === "undefined") {
            return;
        }

        document.addEventListener("click", this.handleDocumentClick, true);
        this.linkHandlerInstalled = true;
    }

    removeLinkHandler() {
        if (!this.linkHandlerInstalled || typeof document === "undefined") {
            return;
        }

        document.removeEventListener("click", this.handleDocumentClick, true);
        this.linkHandlerInstalled = false;
    }

    mountIntoActionHost() {
        const button = this.$button && this.$button[0] instanceof Element
            ? this.$button[0]
            : null;
        if (!button) {
            return;
        }

        const host = ensureMobileTopActionHost();
        if (!host) {
            return;
        }

        button.setAttribute("data-jw-action-order", "30");

        if (button.parentElement !== host) {
            const siblings = Array.from(host.children);
            const nextSibling = siblings.find((entry) => Number(entry.getAttribute("data-jw-action-order") || "999") > 30);
            host.insertBefore(button, nextSibling || null);
        }
    }

    async getActiveNote() {
        if (typeof api.getActiveContextNote === "function") {
            try {
                return await Promise.resolve(api.getActiveContextNote());
            } catch (error) {
                console.error("JW WOL import mobile: unable to resolve active note", error);
            }
        }

        return null;
    }

    setBusy(busy) {
        this.isBusy = Boolean(busy);
        if (!this.$button || !this.$button.length) {
            return;
        }

        this.$button.prop("disabled", this.isBusy);
        this.$button.toggleClass("jw-wol-import-mobile-button-busy", this.isBusy);
        this.$button.attr(
            "title",
            this.isBusy
                ? "Importing article into the current note"
                : "Import JW article into the current note"
        );
        this.$button.attr(
            "aria-label",
            this.isBusy
                ? "Importing article into the current note"
                : "Import JW article into the current note"
        );
    }

    normalizeUrl(value) {
        const trimmed = String(value || "").trim();
        if (!trimmed) {
            return null;
        }

        let parsed;
        try {
            parsed = new URL(trimmed);
        } catch (error) {
            return null;
        }

        if (parsed.hostname === "docs.jw.org") {
            parsed.protocol = "https:";
            parsed.hostname = "www.jw.org";
        }

        if (/^\/finder\/?$/iu.test(parsed.pathname)) {
            const lank = String(parsed.searchParams.get("lank") || "").trim();
            const docId = String(parsed.searchParams.get("docid") || "").trim();
            const finderRange = String(parsed.searchParams.get("par") || "").trim();
            const numericDocIdMatch = lank.match(/^doc-(\d+)$/iu) || docId.match(/^(\d+)$/u);

            if (numericDocIdMatch) {
                const canonical = new URL(`https://wol.jw.org/en/wol/d/r1/lp-e/${numericDocIdMatch[1]}`);
                if (/^\d+(?:-\d+)?$/u.test(finderRange)) {
                    const [rawStartPid, rawEndPid] = finderRange.split("-");
                    const startPid = Number(rawStartPid);
                    const endPid = Number(rawEndPid || rawStartPid);
                    if (Number.isFinite(startPid) && Number.isFinite(endPid)) {
                        const normalizedStartPid = Math.min(startPid, endPid);
                        const normalizedEndPid = Math.max(startPid, endPid);
                        canonical.hash = normalizedStartPid === normalizedEndPid
                            ? `#h=${normalizedStartPid}`
                            : `#h=${normalizedStartPid}:0-${normalizedEndPid}:0`;
                    }
                }

                parsed = canonical;
            }
        }

        if (!/^https?:$/i.test(parsed.protocol) || !SUPPORTED_IMPORT_HOSTS.has(parsed.hostname)) {
            return null;
        }

        return parsed.toString();
    }

    resolveSupportedImportUrl(value) {
        const trimmed = String(value || "").trim();
        if (!trimmed) {
            return null;
        }

        const candidateBaseHrefs = [];
        if (typeof window !== "undefined" && window.location && window.location.href) {
            candidateBaseHrefs.push(window.location.href);
        }
        candidateBaseHrefs.push("https://www.jw.org/");
        candidateBaseHrefs.push("https://wol.jw.org/");

        for (const baseHref of candidateBaseHrefs) {
            try {
                const resolved = new URL(trimmed, baseHref);
                const normalized = this.normalizeUrl(resolved.toString());
                if (normalized) {
                    return normalized;
                }
            } catch (error) {
                // Try next base candidate.
            }
        }

        return null;
    }

    buildImportRequestFromAnchor(anchor) {
        if (!(anchor instanceof Element)) {
            return null;
        }

        if (anchor.closest(".jw-wol-import-dialog") || anchor.closest(".jw-wol-link-import-popover")) {
            return null;
        }

        if (isBibleReferenceAnchor(anchor) || isBiblePluginAnchor(anchor)) {
            return null;
        }

        const rawHref = anchor.getAttribute("href") || anchor.getAttribute("data-cke-saved-href") || "";
        if (!rawHref || /^#/.test(rawHref) || /\/library\/bible\//i.test(rawHref)) {
            return null;
        }

        const articleUrl = this.resolveSupportedImportUrl(rawHref);
        if (!articleUrl) {
            return null;
        }

        const importUrl = new URL(articleUrl);
        const highlightRange = String(anchor.getAttribute("data-highlightrange") || "").trim();
        if (highlightRange) {
            importUrl.hash = highlightRange.startsWith("#") ? highlightRange : `#${highlightRange}`;
        }

        return {
            articleUrl: importUrl.toString(),
            includeImages: false
        };
    }

    async handleSupportedArticleLinkClick(event) {
        if (
            !event
            || event.defaultPrevented
            || this.isBusy
            || typeof document === "undefined"
        ) {
            return;
        }

        const targetNode = event.target instanceof Node ? event.target : null;
        const targetElement = targetNode instanceof Element
            ? targetNode
            : targetNode && targetNode.parentElement instanceof Element
                ? targetNode.parentElement
                : null;
        const anchor = targetElement ? targetElement.closest("a[href], a[data-cke-saved-href]") : null;
        const importRequest = this.buildImportRequestFromAnchor(anchor);
        if (!importRequest) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        this.showLinkImportPopover(anchor, importRequest);
    }

    removeImportDialog() {
        const existingDialog = document.getElementById("jw-wol-import-dialog-backdrop");
        if (existingDialog) {
            existingDialog.remove();
        }
    }

    removeLinkImportPopover() {
        const existingPopover = document.getElementById("jw-wol-link-import-popover-backdrop");
        if (existingPopover) {
            existingPopover.remove();
        }
    }

    showLinkImportPopover(anchor, importRequest) {
        if (!(anchor instanceof Element) || typeof document === "undefined" || !document.body) {
            return;
        }

        this.removeLinkImportPopover();
        this.removeImportDialog();

        const backdrop = document.createElement("div");
        backdrop.id = "jw-wol-link-import-popover-backdrop";
        backdrop.className = "jw-wol-link-import-popover-backdrop";
        backdrop.innerHTML = `
            <div class="jw-wol-link-import-popover" role="dialog" aria-modal="true" aria-labelledby="jw-wol-link-import-popover-title">
                <h3 class="jw-wol-link-import-popover-title" id="jw-wol-link-import-popover-title">Linked JW article</h3>
                <p class="jw-wol-link-import-popover-copy">Import this linked article or section into the current note, or open the link normally.</p>
                <label class="jw-wol-import-dialog-checkbox" for="jw-wol-link-import-images">
                    <input id="jw-wol-link-import-images" type="checkbox" />
                    <span>Import images</span>
                </label>
                <div class="jw-wol-link-import-popover-actions">
                    <button type="button" class="jw-wol-import-dialog-button jw-wol-link-import-open">Open</button>
                    <button type="button" class="jw-wol-import-dialog-button jw-wol-link-import-cancel">Cancel</button>
                    <button type="button" class="jw-wol-import-dialog-button jw-wol-import-dialog-button-primary jw-wol-link-import-confirm">Import</button>
                </div>
            </div>
        `;

        const cancelButton = backdrop.querySelector(".jw-wol-link-import-cancel");
        const openButton = backdrop.querySelector(".jw-wol-link-import-open");
        const importButton = backdrop.querySelector(".jw-wol-link-import-confirm");
        const imageCheckbox = backdrop.querySelector("#jw-wol-link-import-images");

        if (imageCheckbox) {
            imageCheckbox.checked = Boolean(importRequest.includeImages);
        }

        const cleanup = () => {
            backdrop.remove();
        };

        backdrop.addEventListener("click", (event) => {
            if (event.target === backdrop) {
                cleanup();
            }
        });

        cancelButton.addEventListener("click", cleanup);
        openButton.addEventListener("click", () => {
            cleanup();
            if (typeof window !== "undefined" && typeof window.open === "function") {
                window.open(importRequest.articleUrl, "_blank", "noopener,noreferrer");
            }
        });
        importButton.addEventListener("click", async () => {
            cancelButton.disabled = true;
            openButton.disabled = true;
            importButton.disabled = true;
            try {
                await this.importArticleIntoCurrentNote({
                    ...importRequest,
                    includeImages: Boolean(imageCheckbox && imageCheckbox.checked)
                });
            } finally {
                cleanup();
            }
        });

        document.body.appendChild(backdrop);
    }

    async showImportDialog() {
        if (typeof document === "undefined" || !document.body) {
            if (typeof api.showPromptDialog !== "function") {
                api.showError("This Trilium build does not support import dialogs from frontend scripts.");
                return null;
            }

            const answer = await Promise.resolve(api.showPromptDialog({
                title: "Import JW article",
                message: "Paste a `wol.jw.org` or `jw.org` article URL. The imported article will be inserted into the current note.",
                defaultValue: this.lastImportedUrl
            }));

            const articleUrl = this.normalizeUrl(answer);
            if (!articleUrl) {
                if (answer && String(answer).trim()) {
                    api.showError("Enter a valid https://wol.jw.org/... or https://www.jw.org/... article URL.");
                }
                return null;
            }

            return {
                articleUrl,
                includeImages: true
            };
        }

        this.removeImportDialog();

        return await new Promise((resolve) => {
            const backdrop = document.createElement("div");
            backdrop.id = "jw-wol-import-dialog-backdrop";
            backdrop.className = "jw-wol-import-dialog-backdrop";
            backdrop.innerHTML = `
                <div class="jw-wol-import-dialog" role="dialog" aria-modal="true" aria-labelledby="jw-wol-import-dialog-title">
                    <h2 class="jw-wol-import-dialog-title" id="jw-wol-import-dialog-title">Import JW article</h2>
                    <p class="jw-wol-import-dialog-copy">Paste a <code>wol.jw.org</code> or <code>jw.org</code> article URL. The imported article will be inserted into the current note.</p>
                    <label class="jw-wol-import-dialog-label" for="jw-wol-import-dialog-input">Article URL</label>
                    <input
                        id="jw-wol-import-dialog-input"
                        class="jw-wol-import-dialog-input"
                        type="url"
                        spellcheck="false"
                        autocomplete="off"
                        value=""
                    />
                    <label class="jw-wol-import-dialog-checkbox" for="jw-wol-import-dialog-images">
                        <input id="jw-wol-import-dialog-images" type="checkbox" checked />
                        <span>Import images</span>
                    </label>
                    <div class="jw-wol-import-dialog-error" aria-live="polite"></div>
                    <div class="jw-wol-import-dialog-actions">
                        <button type="button" class="jw-wol-import-dialog-button jw-wol-import-dialog-cancel">Cancel</button>
                        <button type="button" class="jw-wol-import-dialog-button jw-wol-import-dialog-button-primary jw-wol-import-dialog-submit">Import</button>
                    </div>
                </div>
            `;

            const dialog = backdrop.querySelector(".jw-wol-import-dialog");
            const input = backdrop.querySelector("#jw-wol-import-dialog-input");
            const imageCheckbox = backdrop.querySelector("#jw-wol-import-dialog-images");
            const error = backdrop.querySelector(".jw-wol-import-dialog-error");
            const cancelButton = backdrop.querySelector(".jw-wol-import-dialog-cancel");
            const submitButton = backdrop.querySelector(".jw-wol-import-dialog-submit");

            input.value = String(this.lastImportedUrl || "");

            let isSettled = false;

            const cleanup = (result) => {
                if (isSettled) {
                    return;
                }

                isSettled = true;
                document.removeEventListener("keydown", handleEscape, true);
                backdrop.remove();
                resolve(result);
            };

            const handleEscape = (event) => {
                if (event.key === "Escape") {
                    event.preventDefault();
                    cleanup(null);
                }
            };

            const submit = () => {
                const articleUrl = this.normalizeUrl(input.value);
                if (!articleUrl) {
                    error.textContent = "Enter a valid https://wol.jw.org/... or https://www.jw.org/... article URL.";
                    input.focus();
                    input.select();
                    return;
                }

                cleanup({
                    articleUrl,
                    includeImages: Boolean(imageCheckbox.checked)
                });
            };

            backdrop.addEventListener("click", (event) => {
                if (event.target === backdrop) {
                    cleanup(null);
                }
            });

            cancelButton.addEventListener("click", () => cleanup(null));
            submitButton.addEventListener("click", submit);
            input.addEventListener("input", () => {
                error.textContent = "";
            });
            input.addEventListener("keydown", (event) => {
                if (event.key === "Enter") {
                    event.preventDefault();
                    submit();
                }
            });
            dialog.addEventListener("keydown", (event) => {
                if (event.key === "Escape") {
                    event.preventDefault();
                    cleanup(null);
                }
            });

            document.body.appendChild(backdrop);
            document.addEventListener("keydown", handleEscape, true);

            requestAnimationFrame(() => {
                input.focus();
                input.select();
            });
        });
    }

    async promptAndImport() {
        if (this.isBusy) {
            return;
        }

        const activeNote = await this.getActiveNote();
        if (!activeNote || !activeNote.noteId) {
            api.showError("Open a note first. The imported article is inserted into the current note.");
            return;
        }

        const importRequest = await this.showImportDialog();
        if (!importRequest) {
            return;
        }

        await this.importArticleIntoCurrentNote(importRequest);
    }

    async importArticleIntoCurrentNote(importRequest, insertionContext = null) {
        const activeNote = await this.getActiveNote();
        if (!activeNote || !activeNote.noteId) {
            api.showError("Open a note first. The imported article is inserted into the current note.");
            return;
        }

        const { articleUrl, includeImages } = importRequest;
        const requestedHighlightedRange = parseHighlightedRangeFromUrlString(articleUrl);
        const supportedImportHosts = Array.from(SUPPORTED_IMPORT_HOSTS);

        if (typeof api.runAsyncOnBackendWithManualTransactionHandling !== "function") {
            api.showError("This Trilium build does not support async backend calls from frontend scripts.");
            return;
        }

        this.setBusy(true);

        try {
            const result = await Promise.resolve(
                api.runAsyncOnBackendWithManualTransactionHandling(
                    async (url, noteId, articleSelector, includeImages, requestedHighlightedRange, supportedImportHosts) => {
                        function toAbsoluteUrl(value, baseUrl) {
                            const trimmed = String(value || "").trim();
                            if (!trimmed || /^javascript:/i.test(trimmed)) {
                                return trimmed;
                            }

                            try {
                                return new URL(trimmed, baseUrl).toString();
                            } catch (error) {
                                return trimmed;
                            }
                        }

                        function absolutizeSrcset(value, baseUrl) {
                            return String(value || "")
                                .split(",")
                                .map((entry) => {
                                    const trimmed = entry.trim();
                                    if (!trimmed) {
                                        return "";
                                    }

                                    const parts = trimmed.split(/\s+/u);
                                    const absoluteUrl = toAbsoluteUrl(parts[0], baseUrl);
                                    return [absoluteUrl].concat(parts.slice(1)).join(" ");
                                })
                                .filter(Boolean)
                                .join(", ");
                        }

                        function cleanupSelectorList(shouldIncludeImages) {
                            return [
                                "script",
                                "style",
                                "noscript",
                                "template",
                                ".gen-field",
                                "textarea",
                                "input",
                                "select",
                                "button",
                                ".videoModal",
                                ".embeddedVideo",
                                ".videoPlayerHolder",
                                ".video-js",
                                ".vjs-poster",
                                ".vjs-text-track-display",
                                ".vjs-loading-spinner",
                                ".vjs-big-play-button",
                                ".vjs-control-bar",
                                ".vjs-error-display",
                                ".vjs-modal-dialog",
                                ".vjs-menu",
                                ".vjs-gesture-icon",
                                "video",
                                "audio",
                                "iframe"
                            ].concat(shouldIncludeImages ? [] : [
                                "figure",
                                "picture",
                                "img"
                            ]);
                        }

                        function isWhitespaceOnlyText(value) {
                            return !String(value || "")
                                .replace(/\u00a0/gu, " ")
                                .replace(/\s+/gu, "");
                        }

                        function isContentfulTag(tagName) {
                            return [
                                "img",
                                "picture",
                                "video",
                                "audio",
                                "iframe",
                                "svg",
                                "canvas",
                                "table",
                                "hr",
                                "pre",
                                "code"
                            ].includes(String(tagName || "").toLowerCase());
                        }

                        function isDomNodeEmpty(node) {
                            if (!node) {
                                return true;
                            }

                            if (node.nodeType === 3) {
                                return isWhitespaceOnlyText(node.textContent || node.rawText || node.text);
                            }

                            if (node.nodeType === 8) {
                                return true;
                            }

                            if (node.nodeType !== 1) {
                                return true;
                            }

                            const tagName = String(node.rawTagName || node.tagName || "").toLowerCase();
                            if (tagName === "br") {
                                return true;
                            }

                            if (isContentfulTag(tagName)) {
                                return false;
                            }

                            const children = Array.from(node.childNodes || []);
                            if (!children.length) {
                                return isWhitespaceOnlyText(node.textContent || node.rawText || node.text);
                            }

                            return children.every((child) => isDomNodeEmpty(child));
                        }

                        function pruneTrailingEmptyDomNodes(root) {
                            if (!root || !root.childNodes) {
                                return;
                            }

                            for (const child of Array.from(root.childNodes || [])) {
                                if (child && child.nodeType === 1) {
                                    pruneTrailingEmptyDomNodes(child);
                                }
                            }

                            const children = Array.from(root.childNodes || []);
                            for (let index = children.length - 1; index >= 0; index -= 1) {
                                const child = children[index];
                                if (isDomNodeEmpty(child)) {
                                    if (typeof child.remove === "function") {
                                        child.remove();
                                    }
                                    continue;
                                }

                                break;
                            }
                        }

                        function normalizeHeadingMarkup(html) {
                            let baseHeadingLevel = null;

                            return String(html || "").replace(/<(\/?)h([1-6])\b([^>]*)>/giu, (match, slash, levelText, rest) => {
                                const isClosingTag = /^<\//u.test(match);
                                const sourceLevel = Number(levelText);

                                if (!isClosingTag && baseHeadingLevel === null) {
                                    baseHeadingLevel = sourceLevel;
                                }

                                const relativeOffset = sourceLevel - (baseHeadingLevel || sourceLevel);
                                const targetLevel = Math.max(2, Math.min(6, 2 + relativeOffset));
                                const prefix = slash ? "</" : "<";
                                const suffix = slash ? ">" : `${rest}>`;

                                return `${prefix}h${targetLevel}${suffix}`;
                            });
                        }

                        function trimTrailingEmptyBlocks(html) {
                            let normalized = String(html || "").trim();
                            const trailingEmptyBlockPattern = /(?:\s|&nbsp;|&#160;|<br\s*\/?>)*(?:<(p|div|section|article|aside|blockquote|ul|ol|li)[^>]*>(?:\s|&nbsp;|&#160;|<br\s*\/?>)*<\/\1>)(?:\s|&nbsp;|&#160;|<br\s*\/?>)*$/iu;

                            while (trailingEmptyBlockPattern.test(normalized)) {
                                normalized = normalized.replace(trailingEmptyBlockPattern, "").trimEnd();
                            }

                            return normalized;
                        }

                        function normalizeImportedArticleHtml(html) {
                            return trimTrailingEmptyBlocks(normalizeHeadingMarkup(html)).trim();
                        }

                        function normalizeHighlightedRange(range) {
                            if (!range || typeof range !== "object") {
                                return null;
                            }

                            const startPid = Number(range.startPid);
                            const endPid = Number(range.endPid);
                            if (!Number.isFinite(startPid) || !Number.isFinite(endPid)) {
                                return null;
                            }

                            return {
                                startPid: Math.min(startPid, endPid),
                                endPid: Math.max(startPid, endPid)
                            };
                        }

                        function readNodeParagraphId(node) {
                            if (!node || typeof node.getAttribute !== "function") {
                                return null;
                            }

                            const dataPid = Number(node.getAttribute("data-pid"));
                            if (Number.isFinite(dataPid)) {
                                return dataPid;
                            }

                            const elementId = String(node.getAttribute("id") || "");
                            const idMatch = elementId.match(/^p(\d+)$/iu);
                            if (!idMatch) {
                                return null;
                            }

                            const paragraphId = Number(idMatch[1]);
                            return Number.isFinite(paragraphId) ? paragraphId : null;
                        }

                        function extractHighlightedHtmlFromDom(root, highlightedRange) {
                            if (!root || !highlightedRange || typeof root.querySelectorAll !== "function") {
                                return "";
                            }

                            const matchedNodes = [];
                            const seenNodeHtml = new Set();
                            const candidateNodes = root.querySelectorAll("[data-pid], [id^='p']") || [];
                            for (const node of candidateNodes) {
                                const paragraphId = readNodeParagraphId(node);
                                if (!Number.isFinite(paragraphId)) {
                                    continue;
                                }

                                if (paragraphId < highlightedRange.startPid || paragraphId > highlightedRange.endPid) {
                                    continue;
                                }

                                const nodeHtml = typeof node.toString === "function" ? node.toString() : String(node || "");
                                if (!nodeHtml || seenNodeHtml.has(nodeHtml)) {
                                    continue;
                                }

                                seenNodeHtml.add(nodeHtml);
                                matchedNodes.push(nodeHtml);
                            }

                            return matchedNodes.join("\n").trim();
                        }

                        function readText(node) {
                            return String(
                                node && (node.textContent || node.text || node.rawText) || ""
                            ).replace(/\s+/gu, " ").trim();
                        }

                        function firstText(root, selectors) {
                            for (const selector of selectors) {
                                const node = root.querySelector(selector);
                                const value = readText(node);
                                if (value) {
                                    return value;
                                }
                            }

                            return "";
                        }

                        function regexDocumentTitle(html) {
                            const match = String(html || "").match(/<title[^>]*>([\s\S]*?)<\/title>/iu);
                            return match
                                ? match[1]
                                    .replace(/&mdash;|&#8212;|&#x2014;/giu, "\u2014")
                                    .replace(/&amp;/giu, "&")
                                    .replace(/&lt;/giu, "<")
                                    .replace(/&gt;/giu, ">")
                                    .replace(/\s+/gu, " ")
                                    .trim()
                                : "";
                        }

                        function removeNodes(root, selectors) {
                            for (const selector of selectors) {
                                const matches = root.querySelectorAll(selector) || [];
                                for (const match of matches) {
                                    if (match && typeof match.remove === "function") {
                                        match.remove();
                                    }
                                }
                            }
                        }

                        function isCheerioNodeEmpty(node) {
                            if (!node) {
                                return true;
                            }

                            if (node.type === "text") {
                                return isWhitespaceOnlyText(node.data || node.nodeValue);
                            }

                            if (node.type === "comment") {
                                return true;
                            }

                            if (node.type !== "tag") {
                                return true;
                            }

                            const tagName = String(node.name || "").toLowerCase();
                            if (tagName === "br") {
                                return true;
                            }

                            if (isContentfulTag(tagName)) {
                                return false;
                            }

                            const children = Array.isArray(node.children) ? node.children : [];
                            if (!children.length) {
                                return true;
                            }

                            return children.every((child) => isCheerioNodeEmpty(child));
                        }

                        function normalizeArticle(root, baseUrl, shouldIncludeImages) {
                            removeNodes(root, cleanupSelectorList(shouldIncludeImages));

                            for (const element of root.querySelectorAll("*") || []) {
                                if (typeof element.removeAttribute === "function") {
                                    for (const attributeName of Object.keys(element.attributes || {})) {
                                        if (/^on/i.test(attributeName)) {
                                            element.removeAttribute(attributeName);
                                        }
                                    }
                                }

                                const href = element.getAttribute && element.getAttribute("href");
                                if (href) {
                                    element.setAttribute("href", toAbsoluteUrl(href, baseUrl));
                                }

                                const src = element.getAttribute && element.getAttribute("src");
                                if (src) {
                                    element.setAttribute("src", toAbsoluteUrl(src, baseUrl));
                                }

                                const srcset = element.getAttribute && element.getAttribute("srcset");
                                if (srcset) {
                                    element.setAttribute("srcset", absolutizeSrcset(srcset, baseUrl));
                                }
                            }

                            pruneTrailingEmptyDomNodes(root);
                        }

                        function extractTitle(documentRoot, articleRoot, baseUrl, html) {
                            const articleTitle = firstText(articleRoot, [
                                "h1",
                                "header h1",
                                "h2",
                                ".title"
                            ]);
                            if (articleTitle) {
                                return articleTitle;
                            }

                            const ogTitle = documentRoot.querySelector("meta[property='og:title']");
                            const twitterTitle = documentRoot.querySelector("meta[name='twitter:title']");
                            const titleNode = documentRoot.querySelector("title");
                            const documentTitle = String(
                                (ogTitle && typeof ogTitle.getAttribute === "function" && ogTitle.getAttribute("content"))
                                || (twitterTitle && typeof twitterTitle.getAttribute === "function" && twitterTitle.getAttribute("content"))
                                || readText(titleNode)
                                || regexDocumentTitle(html)
                            ).trim();
                            if (documentTitle) {
                                return documentTitle
                                    .replace(/\s+(?:\u2014|-)\s+Watchtower ONLINE LIBRARY\s*$/u, "")
                                    .trim();
                            }

                            const parsed = new URL(baseUrl);
                            return parsed.pathname.split("/").filter(Boolean).pop() || "Imported article";
                        }

                        function importWithHtmlParser(html, baseUrl, selector) {
                            if (!api.htmlParser || typeof api.htmlParser.parse !== "function") {
                                return null;
                            }

                            const documentRoot = api.htmlParser.parse(html);
                            const articleRoot = documentRoot && typeof documentRoot.querySelector === "function"
                                ? documentRoot.querySelector(selector)
                                : null;

                            if (!articleRoot) {
                                throw new Error(`The article container ${selector} was not found.`);
                            }

                            normalizeArticle(articleRoot, baseUrl, includeImages);
                            const highlightedRange = normalizeHighlightedRange(requestedHighlightedRange);
                            const articleHtml = highlightedRange
                                ? extractHighlightedHtmlFromDom(articleRoot, highlightedRange)
                                : articleRoot.toString();

                            if (highlightedRange && !articleHtml) {
                                throw new Error(`The highlighted section ${highlightedRange.startPid}-${highlightedRange.endPid} was not found.`);
                            }

                            return {
                                title: extractTitle(documentRoot, articleRoot, baseUrl, html),
                                articleHtml: normalizeImportedArticleHtml(articleHtml),
                                highlightedRange
                            };
                        }

                        const parsedUrl = new URL(String(url || "").trim());
                        const supportedImportHostSet = new Set(
                            Array.isArray(supportedImportHosts) ? supportedImportHosts : []
                        );
                        if (!supportedImportHostSet.has(parsedUrl.hostname)) {
                            throw new Error("Only wol.jw.org and jw.org article URLs are supported.");
                        }

                        if (!noteId) {
                            throw new Error("No current note is selected.");
                        }

                        const response = await fetch(parsedUrl.toString(), {
                            headers: {
                                "accept": "text/html,application/xhtml+xml"
                            }
                        });

                        if (!response.ok) {
                            throw new Error(`The article request failed with status ${response.status}.`);
                        }

                        const html = await response.text();
                        const importedArticle = importWithHtmlParser(html, parsedUrl.toString(), articleSelector);
                        if (!importedArticle) {
                            throw new Error("No supported HTML parser is available in the backend script environment.");
                        }

                        const title = importedArticle.title;
                        const escapedUrl = api.escapeHtml(parsedUrl.toString());
                        const importedAt = api.escapeHtml(new Date().toISOString());
                        const content = `
<section data-jw-wol-import="true" data-jw-wol-url="${escapedUrl}" data-jw-wol-imported-at="${importedAt}" data-jw-wol-title="${api.escapeHtml(title)}">
${importedArticle.articleHtml}
</section>
`.trim();

                        return {
                            noteId,
                            content,
                            title,
                            highlightedRange: importedArticle.highlightedRange || null
                        };
                    },
                    [articleUrl, activeNote.noteId, ARTICLE_SELECTOR, includeImages, requestedHighlightedRange, supportedImportHosts]
                )
            );

            this.lastImportedUrl = articleUrl;

            const editor = typeof api.getActiveContextTextEditor === "function"
                ? await Promise.resolve(api.getActiveContextTextEditor())
                : null;

            if (editor && canInsertHtml(editor)) {
                if (
                    insertionContext
                    && insertionContext.mode === "after-link-paragraph"
                    && insertionContext.anchor instanceof Element
                ) {
                    insertImportedHtmlAfterAnchor(editor, insertionContext.anchor, result.content);
                } else {
                    insertHtmlIntoCkEditor(editor, result.content);
                }
            } else {
                await Promise.resolve(
                    api.runAsyncOnBackendWithManualTransactionHandling(
                        async (noteId, contentToAppend, shouldWrapInAdmonition) => {
                            const note = api.getNote(noteId);
                            if (!note || typeof note.getContent !== "function" || typeof note.setContent !== "function") {
                                throw new Error("The current note cannot be updated from the backend.");
                            }

                            if (typeof note.isHtml === "function" && !note.isHtml()) {
                                throw new Error("The current note is not a rich-text note.");
                            }

                            if (typeof note.hasStringContent === "function" && !note.hasStringContent()) {
                                throw new Error("The current note does not support text content.");
                            }

                            const existingContent = String(note.getContent() || "");
                            const separator = existingContent.trim() ? "\n" : "";
                            const nextContent = shouldWrapInAdmonition
                                ? buildImportantAdmonitionHtml(contentToAppend)
                                : contentToAppend;

                            api.transactional(() => {
                                note.setContent(existingContent + separator + nextContent);
                            });
                        },
                        [
                            activeNote.noteId,
                            result.content,
                            Boolean(insertionContext && insertionContext.mode === "after-link-paragraph")
                        ]
                    )
                );

                if (typeof api.waitUntilSynced === "function") {
                    await Promise.resolve(api.waitUntilSynced());
                }

                if (typeof api.reloadNotes === "function") {
                    await Promise.resolve(api.reloadNotes([activeNote.noteId]));
                }
            }

            const importedRange = result && result.highlightedRange;
            const importedRangeLabel = formatImportedRangeForMessage(null, importedRange);
            api.showMessage(
                importedRange
                    ? `Imported highlighted section ${importedRangeLabel} from "${result && result.title ? result.title : "article"}" into the current note.`
                    : `Imported "${result && result.title ? result.title : "article"}" into the current note.`
            );
        } catch (error) {
            console.error("JW WOL import mobile: unable to import article", error);
            api.showError(`Unable to import article: ${error && error.message ? error.message : error}`);
        } finally {
            this.setBusy(false);
        }
    }
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

function insertImportedHtmlAfterAnchor(editor, anchor, importedHtml) {
    const modelAnchorBlock = findModelBlockForDomAnchor(editor, anchor);
    if (!modelAnchorBlock) {
        insertHtmlIntoCkEditor(editor, buildImportantAdmonitionHtml(importedHtml));
        return;
    }

    const viewFragment = editor.data.processor.toView(buildImportantAdmonitionHtml(importedHtml));
    const modelFragment = editor.data.toModel(viewFragment);

    editor.model.change((writer) => {
        const insertionPosition = writer.createPositionAfter(modelAnchorBlock);
        editor.model.insertContent(modelFragment, insertionPosition);

        if (editor.editing && editor.editing.view && typeof editor.editing.view.focus === "function") {
            editor.editing.view.focus();
        }
    });
}

function buildImportantAdmonitionHtml(importedHtml) {
    return `
<aside class="admonition important">
${String(importedHtml || "").trim()}
</aside>
`.trim();
}

function findModelBlockForDomAnchor(editor, anchor) {
    if (
        !editor
        || !editor.editing
        || !editor.editing.view
        || !editor.editing.view.domConverter
        || typeof editor.editing.view.domConverter.mapDomToView !== "function"
        || !editor.editing.mapper
        || typeof editor.editing.mapper.toModelElement !== "function"
        || !(anchor instanceof Element)
    ) {
        return null;
    }

    let domBlock = anchor.closest("p, li, blockquote, h1, h2, h3, h4, h5, h6, td, th, div");
    while (domBlock instanceof Element) {
        const viewElement = editor.editing.view.domConverter.mapDomToView(domBlock);
        let currentViewElement = viewElement;
        while (currentViewElement) {
            try {
                const modelElement = editor.editing.mapper.toModelElement(currentViewElement);
                if (modelElement) {
                    return modelElement;
                }
            } catch (error) {
                // Continue walking up the view tree until a mapped model block is found.
            }

            currentViewElement = currentViewElement.parent;
        }

        domBlock = domBlock.parentElement;
    }

    return null;
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

function parseHighlightedRangeFromUrlString(urlString) {
    const normalizedUrl = String(urlString || "").trim();
    if (!normalizedUrl) {
        return null;
    }

    try {
        const parsed = new URL(normalizedUrl);
        const hash = parsed.hash || "";
        const hashWolRangeMatch = hash.match(/^#h=(\d+):\d+-(\d+):\d+$/iu);
        if (hashWolRangeMatch) {
            const startPid = Number(hashWolRangeMatch[1]);
            const endPid = Number(hashWolRangeMatch[2]);
            if (Number.isFinite(startPid) && Number.isFinite(endPid)) {
                return {
                    startPid: Math.min(startPid, endPid),
                    endPid: Math.max(startPid, endPid)
                };
            }
        }

        const hashWolSingleMatch = hash.match(/^#h=(\d+)$/iu);
        if (hashWolSingleMatch) {
            const paragraphId = Number(hashWolSingleMatch[1]);
            if (Number.isFinite(paragraphId)) {
                return {
                    startPid: paragraphId,
                    endPid: paragraphId
                };
            }
        }

        const jwOrgRangeMatch = hash.match(/^#p(\d+)-p(\d+)$/iu);
        if (jwOrgRangeMatch) {
            const startPid = Number(jwOrgRangeMatch[1]);
            const endPid = Number(jwOrgRangeMatch[2]);
            if (Number.isFinite(startPid) && Number.isFinite(endPid)) {
                return {
                    startPid: Math.min(startPid, endPid),
                    endPid: Math.max(startPid, endPid)
                };
            }
        }

        const jwOrgSingleMatch = hash.match(/^#p(\d+)$/iu);
        if (jwOrgSingleMatch) {
            const paragraphId = Number(jwOrgSingleMatch[1]);
            if (Number.isFinite(paragraphId)) {
                return {
                    startPid: paragraphId,
                    endPid: paragraphId
                };
            }
        }

        const finderParagraphMatch = parsed.search.match(/(?:^|[?&])par=(\d+)(?:\D+(\d+))?(?:$|[&#])/iu);
        if (finderParagraphMatch) {
            const startPid = Number(finderParagraphMatch[1]);
            const endPid = Number(finderParagraphMatch[2] || finderParagraphMatch[1]);
            if (Number.isFinite(startPid) && Number.isFinite(endPid)) {
                return {
                    startPid: Math.min(startPid, endPid),
                    endPid: Math.max(startPid, endPid)
                };
            }
        }
    } catch (error) {
        // Fall back to regex parsing below.
    }

    const wolRangeMatch = normalizedUrl.match(/(?:^|[#?&])h=(\d+):\d+-(\d+):\d+/iu);
    if (wolRangeMatch) {
        const startPid = Number(wolRangeMatch[1]);
        const endPid = Number(wolRangeMatch[2]);
        if (Number.isFinite(startPid) && Number.isFinite(endPid)) {
            return {
                startPid: Math.min(startPid, endPid),
                endPid: Math.max(startPid, endPid)
            };
        }
    }

    const wolSingleMatch = normalizedUrl.match(/(?:^|[#?&])h=(\d+)(?:$|[&#])/iu);
    if (wolSingleMatch) {
        const paragraphId = Number(wolSingleMatch[1]);
        if (Number.isFinite(paragraphId)) {
            return {
                startPid: paragraphId,
                endPid: paragraphId
            };
        }
    }

    const jwOrgRangeMatch = normalizedUrl.match(/#p(\d+)-p(\d+)$/iu);
    if (jwOrgRangeMatch) {
        const startPid = Number(jwOrgRangeMatch[1]);
        const endPid = Number(jwOrgRangeMatch[2]);
        if (Number.isFinite(startPid) && Number.isFinite(endPid)) {
            return {
                startPid: Math.min(startPid, endPid),
                endPid: Math.max(startPid, endPid)
            };
        }
    }

    const jwOrgSingleMatch = normalizedUrl.match(/#p(\d+)$/iu);
    if (jwOrgSingleMatch) {
        const paragraphId = Number(jwOrgSingleMatch[1]);
        if (Number.isFinite(paragraphId)) {
            return {
                startPid: paragraphId,
                endPid: paragraphId
            };
        }
    }

    const finderParagraphMatch = normalizedUrl.match(/(?:^|[?&])par=(\d+)(?:\D+(\d+))?(?:$|[&#])/iu);
    if (finderParagraphMatch) {
        const startPid = Number(finderParagraphMatch[1]);
        const endPid = Number(finderParagraphMatch[2] || finderParagraphMatch[1]);
        if (Number.isFinite(startPid) && Number.isFinite(endPid)) {
            return {
                startPid: Math.min(startPid, endPid),
                endPid: Math.max(startPid, endPid)
            };
        }
    }

    return null;
}

function formatImportedRangeForMessage(displayedParagraphRange, highlightedRange) {
    if (displayedParagraphRange && typeof displayedParagraphRange === "object") {
        const startParagraph = Number(displayedParagraphRange.startParagraph);
        const endParagraph = Number(displayedParagraphRange.endParagraph);
        if (Number.isFinite(startParagraph) && Number.isFinite(endParagraph)) {
            return startParagraph === endParagraph
                ? `¶${startParagraph}`
                : `¶${Math.min(startParagraph, endParagraph)}-${Math.max(startParagraph, endParagraph)}`;
        }
    }

    if (highlightedRange && typeof highlightedRange === "object") {
        const startPid = Number(highlightedRange.startPid);
        const endPid = Number(highlightedRange.endPid);
        if (Number.isFinite(startPid) && Number.isFinite(endPid)) {
            return startPid === endPid
                ? String(startPid)
                : `${Math.min(startPid, endPid)}-${Math.max(startPid, endPid)}`;
        }
    }

    return "selection";
}

function hrefLooksLikeBibleReference(value) {
    const normalized = String(value || "").trim();
    if (!normalized || /^#/u.test(normalized)) {
        return false;
    }

    return (
        /\/library\/bible\//iu.test(normalized)
        || /(?:[?&]bible=|[?&]pub=nwt)/iu.test(normalized)
        || /^jwbible:/iu.test(normalized)
        || /#jw-ref-/iu.test(normalized)
    );
}

function isBibleReferenceAnchor(anchor) {
    return Boolean(
        anchor instanceof Element
        && (
            anchor.classList.contains("jsBibleLink")
            || anchor.hasAttribute("data-bible")
            || anchor.hasAttribute("data-targetverses")
            || anchor.hasAttribute("data-jw-ref-id")
            || hrefLooksLikeBibleReference(anchor.getAttribute("href"))
            || hrefLooksLikeBibleReference(anchor.getAttribute("data-cke-saved-href"))
        )
    );
}

function isBiblePluginAnchor(anchor) {
    return Boolean(
        anchor instanceof Element
        && (
            anchor.closest("[data-jw-ref-popup], .jw-bible-reference-popup, .bible-reference-popup")
            || anchor.classList.contains("reference-link")
            || anchor.hasAttribute("data-reference")
            || anchor.hasAttribute("data-jw-ref-link")
            || /^#jw-ref-/iu.test(String(anchor.getAttribute("href") || ""))
        )
    );
}

async function startJWWolArticleImportMobile() {
    const globalKey = "__jwWolArticleImportMobileInstance";

    if (window[globalKey] && typeof window[globalKey].cleanup === "function") {
        window[globalKey].cleanup();
    }

    const widget = new JWWolArticleImportMobile();
    if (!widget.isMobileEnvironment()) {
        return;
    }

    widget.doRender();
    widget.mountIntoActionHost();
    widget.scheduleMount(0);
    widget.scheduleMount(150);
    widget.scheduleMount(500);
    window[globalKey] = widget;
}

void startJWWolArticleImportMobile();
