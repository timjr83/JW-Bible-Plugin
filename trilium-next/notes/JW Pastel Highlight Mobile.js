const PALETTE = [
    { name: "Lemon", bg: "hsl(57,70%,81%)", fg: "hsl(0,0%,0%)" },
    { name: "Mint", bg: "hsl(150,64%,80%)", fg: "hsl(0,0%,0%)" },
    { name: "Sky", bg: "hsl(180,84%,80%)", fg: "hsl(0,0%,0%)" },
    { name: "Peach", bg: "hsl(24,100%,86%)", fg: "hsl(0,0%,0%)" },
    { name: "Lilac", bg: "hsl(275,72%,87%)", fg: "hsl(0,0%,0%)" }
];

class JWPastelHighlightMobile {
    constructor() {
        this.stylesApplied = false;
        this.launcherMountTimers = [];
        this.isOpen = false;
        this.savedSelection = null;
        this.selectionCaptureTimer = null;
        this.handleDocumentPointerDown = (event) => {
            const root = this.$widget && this.$widget[0];
            if (!this.isOpen || !root || !(event.target instanceof Node) || root.contains(event.target)) {
                return;
            }

            this.setOpen(false);
        };
        this.handleSelectionGesture = () => {
            if (this.selectionCaptureTimer) {
                clearTimeout(this.selectionCaptureTimer);
            }

            this.selectionCaptureTimer = setTimeout(() => {
                this.selectionCaptureTimer = null;
                void this.captureActiveSelection();
            }, 0);
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
            this.$widget = $('<div style="display:none"></div>');
            this.$launcherButton = $('<button type="button" style="display:none"></button>');
            return;
        }

        this.ensureStyles();
        this.ensureSelectionListeners();

        this.$widget = $(`
            <section class="jw-highlight-mobile-widget">
                <div class="jw-highlight-mobile-backdrop"></div>
                <div class="jw-highlight-mobile-panel">
                    <div class="jw-highlight-mobile-panel-header">
                        <div class="jw-highlight-mobile-panel-title">Highlights</div>
                        <button type="button" class="icon-action bx bx-x jw-highlight-mobile-close" title="Close highlights" aria-label="Close highlights"></button>
                    </div>
                    <div class="jw-highlight-mobile-panel-body"></div>
                </div>
            </section>
        `);

        this.$launcherButton = $(`
            <button
                type="button"
                class="icon-action bx bx-highlight jw-highlight-mobile-launcher-button jw-mobile-top-action-button"
                title="Highlight text"
                aria-label="Highlight text"
                aria-expanded="false"
            ></button>
        `);

        this.$body = this.$widget.find(".jw-highlight-mobile-panel-body");
        this.$backdrop = this.$widget.find(".jw-highlight-mobile-backdrop");
        this.$close = this.$widget.find(".jw-highlight-mobile-close");

        for (const color of PALETTE) {
            const $swatch = $('<button type="button" class="jw-highlight-mobile-swatch"></button>');
            $swatch.attr("title", color.name);
            $swatch.attr("aria-label", `Highlight with ${color.name}`);
            $swatch.css({
                backgroundColor: color.bg,
                color: color.fg
            });
            $swatch.text(color.name);
            $swatch.on("click", () => {
                void this.applyHighlight(color);
                this.setOpen(false);
            });
            this.$body.append($swatch);
        }

        const $clear = $('<button type="button" class="jw-highlight-mobile-clear">Clear</button>');
        $clear.attr("title", "Remove highlight");
        $clear.on("click", () => {
            void this.clearHighlight();
            this.setOpen(false);
        });
        this.$body.append($clear);

        this.$backdrop.on("click", () => {
            this.setOpen(false);
        });
        this.$close.on("click", () => {
            this.setOpen(false);
        });
        this.$launcherButton.on("click", async (event) => {
            event.preventDefault();
            event.stopPropagation();
            await this.captureActiveSelection();
            this.setOpen(!this.isOpen);
        });
    }

    cleanup() {
        document.removeEventListener("pointerdown", this.handleDocumentPointerDown, true);
        document.removeEventListener("pointerup", this.handleSelectionGesture, true);
        document.removeEventListener("keyup", this.handleSelectionGesture, true);

        if (this.selectionCaptureTimer) {
            clearTimeout(this.selectionCaptureTimer);
            this.selectionCaptureTimer = null;
        }

        for (const timer of this.launcherMountTimers) {
            clearTimeout(timer);
        }
        this.launcherMountTimers = [];

        const root = this.$widget && this.$widget[0];
        if (root && root.parentElement === document.body) {
            root.remove();
        }

        const launcherButton = this.$launcherButton && this.$launcherButton[0];
        if (launcherButton && launcherButton.parentElement) {
            launcherButton.remove();
        }
    }

    ensureStyles() {
        if (this.stylesApplied) {
            return;
        }

        const existingStyle = document.getElementById("jw-highlight-mobile-style");
        if (existingStyle) {
            existingStyle.remove();
        }

        const style = document.createElement("style");
        style.id = "jw-highlight-mobile-style";
        style.textContent = `
            .jw-highlight-mobile-widget {
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

            .jw-highlight-mobile-backdrop {
                position: fixed;
                inset: 0;
                display: none;
                background: rgba(5, 8, 14, 0.42);
                z-index: 2147483200;
            }

            .jw-highlight-mobile-panel {
                position: fixed;
                left: 12px;
                right: 12px;
                bottom: 12px;
                display: none;
                border: 1px solid rgba(255, 255, 255, 0.12);
                border-radius: 16px;
                background: rgba(26, 28, 34, 0.98);
                box-shadow: 0 22px 48px rgba(0, 0, 0, 0.38);
                z-index: 2147483201;
                overflow: hidden;
            }

            .jw-highlight-mobile-widget.jw-highlight-mobile-open .jw-highlight-mobile-backdrop,
            .jw-highlight-mobile-widget.jw-highlight-mobile-open .jw-highlight-mobile-panel {
                display: block;
            }

            .jw-highlight-mobile-panel-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                padding: 14px 14px 12px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.08);
            }

            .jw-highlight-mobile-panel-title {
                font-size: 16px;
                font-weight: 700;
                color: #ffffff;
            }

            .jw-highlight-mobile-panel-body {
                display: grid;
                grid-template-columns: repeat(2, minmax(0, 1fr));
                gap: 10px;
                padding: 12px;
            }

            .jw-highlight-mobile-swatch,
            .jw-highlight-mobile-clear {
                appearance: none;
                border: 1px solid rgba(255, 255, 255, 0.14);
                border-radius: 999px;
                cursor: pointer;
                font-size: 13px;
                font-weight: 600;
                line-height: 1;
                min-height: 36px;
                padding: 8px 12px;
                text-align: center;
            }

            .jw-highlight-mobile-clear {
                grid-column: 1 / -1;
                background: transparent;
                color: var(--main-text-color);
            }

            .jw-highlight-mobile-launcher-button.jw-highlight-mobile-launcher-button-active {
                color: #ffe18d;
            }
        `;
        document.head.appendChild(style);

        this.stylesApplied = true;
    }

    scheduleLauncherMount(delayMs) {
        const timer = setTimeout(() => {
            this.launcherMountTimers = this.launcherMountTimers.filter((entry) => entry !== timer);
            this.mountIntoActionHost();
        }, delayMs);

        this.launcherMountTimers.push(timer);
    }

    mountIntoActionHost() {
        const button = this.$launcherButton && this.$launcherButton[0] instanceof Element
            ? this.$launcherButton[0]
            : null;
        if (!button) {
            return;
        }

        const host = ensureMobileTopActionHost();
        if (!host) {
            return;
        }

        button.setAttribute("data-jw-action-order", "20");

        if (button.parentElement !== host) {
            const siblings = Array.from(host.children);
            const nextSibling = siblings.find((entry) => Number(entry.getAttribute("data-jw-action-order") || "999") > 20);
            host.insertBefore(button, nextSibling || null);
        }
    }

    ensureSelectionListeners() {
        document.removeEventListener("pointerup", this.handleSelectionGesture, true);
        document.removeEventListener("keyup", this.handleSelectionGesture, true);
        document.addEventListener("pointerup", this.handleSelectionGesture, true);
        document.addEventListener("keyup", this.handleSelectionGesture, true);
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

    setOpen(open) {
        this.isOpen = Boolean(open);
        const root = this.$widget && this.$widget[0];
        if (!root) {
            return;
        }

        root.classList.toggle("jw-highlight-mobile-open", this.isOpen);
        if (this.$launcherButton && this.$launcherButton.length) {
            this.$launcherButton.toggleClass("jw-highlight-mobile-launcher-button-active", this.isOpen);
            this.$launcherButton.attr("aria-expanded", this.isOpen ? "true" : "false");
        }

        if (this.isOpen) {
            document.addEventListener("pointerdown", this.handleDocumentPointerDown, true);
        } else {
            document.removeEventListener("pointerdown", this.handleDocumentPointerDown, true);
        }
    }

    async getActiveEditor() {
        if (typeof api.getActiveContextTextEditor !== "function") {
            return null;
        }

        try {
            return await Promise.resolve(api.getActiveContextTextEditor());
        } catch (error) {
            console.error("JW highlight mobile: unable to get active editor", error);
            return null;
        }
    }

    async captureActiveSelection() {
        const editor = await this.getActiveEditor();
        if (!editor || !editor.model || !editor.model.document) {
            this.savedSelection = null;
            return;
        }

        const selection = editor.model.document.selection;
        if (!selection || typeof selection.getRanges !== "function") {
            this.savedSelection = null;
            return;
        }

        const ranges = [];
        for (const range of selection.getRanges()) {
            ranges.push({
                startPath: Array.from(range.start.path || []),
                endPath: Array.from(range.end.path || [])
            });
        }

        this.savedSelection = ranges.length ? { ranges } : null;
    }

    restoreSavedSelection(editor) {
        if (
            !this.savedSelection ||
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
        if (!root) {
            return;
        }

        try {
            editor.model.change((writer) => {
                const ranges = this.savedSelection.ranges
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

                if (ranges.length) {
                    writer.setSelection(ranges);
                }
            });
        } catch (error) {
            console.error("JW highlight mobile: unable to restore selection", error);
        }
    }

    async applyHighlight(color) {
        const editor = await this.getActiveEditor();
        if (!editor) {
            return;
        }

        this.restoreSavedSelection(editor);

        try {
            if (typeof editor.execute === "function") {
                editor.execute("fontBackgroundColor", { value: color.bg });
                editor.execute("fontColor", { value: color.fg });
            }

            if (editor.editing && editor.editing.view && typeof editor.editing.view.focus === "function") {
                editor.editing.view.focus();
            }
        } catch (error) {
            console.error("JW highlight mobile: unable to apply highlight", error);
        }
    }

    async clearHighlight() {
        const editor = await this.getActiveEditor();
        if (!editor) {
            return;
        }

        this.restoreSavedSelection(editor);

        try {
            if (typeof editor.execute === "function") {
                editor.execute("fontBackgroundColor", { value: null });
                editor.execute("fontColor", { value: null });
            }

            if (editor.editing && editor.editing.view && typeof editor.editing.view.focus === "function") {
                editor.editing.view.focus();
            }
        } catch (error) {
            console.error("JW highlight mobile: unable to clear highlight", error);
        }
    }
}

async function startJWPastelHighlightMobile() {
    const globalKey = "__jwPastelHighlightMobileInstance";

    if (window[globalKey] && typeof window[globalKey].cleanup === "function") {
        window[globalKey].cleanup();
    }

    const widget = new JWPastelHighlightMobile();
    if (!widget.isMobileEnvironment()) {
        return;
    }

    widget.doRender();
    widget.mountIntoBody();
    widget.mountIntoActionHost();
    widget.scheduleLauncherMount(0);
    widget.scheduleLauncherMount(150);
    widget.scheduleLauncherMount(500);
    window[globalKey] = widget;
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

void startJWPastelHighlightMobile();
