const PALETTE = [
    { name: "Lemon", bg: "hsl(57,70%,81%)", fg: "hsl(0,0%,0%)" },
    { name: "Mint", bg: "hsl(150,64%,80%)", fg: "hsl(0,0%,0%)" },
    { name: "Sky", bg: "hsl(180,84%,80%)", fg: "hsl(0,0%,0%)" },
    { name: "Peach", bg: "hsl(24,100%,86%)", fg: "hsl(0,0%,0%)" },
    { name: "Lilac", bg: "hsl(275,72%,87%)", fg: "hsl(0,0%,0%)" }
];

class JWPastelHighlightToolbar extends api.NoteContextAwareWidget {
    constructor() {
        super();
        this.contentSized();
        this.stylesApplied = false;
        this.currentHost = null;
        this.isOpen = false;
        this.mountTimers = [];
        this.handleDocumentPointerDown = (event) => {
            const root = this.$widget && this.$widget[0];
            if (!this.isOpen || !root || !(event.target instanceof Node) || root.contains(event.target)) {
                return;
            }

            this.setOpen(false);
        };
    }

    static get parentWidget() {
        return "note-detail-pane";
    }

    get position() {
        return 4;
    }

    doRender() {
        this.ensureStyles();
        this.$widget = $('<div class="jw-highlight-toolbar-widget"></div>');

        const $button = $(`
            <button type="button" class="icon-action bx bx-highlight jw-highlight-toolbar-button" title="Highlight text" aria-label="Highlight text" aria-expanded="false"></button>
        `);
        $button.on("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.setOpen(!this.isOpen);
        });

        const $popover = $('<div class="jw-highlight-toolbar-popover"></div>');

        for (const color of PALETTE) {
            const $swatch = $('<button type="button" class="jw-highlight-swatch"></button>');
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
            $popover.append($swatch);
        }

        const $clear = $('<button type="button" class="jw-highlight-clear">Clear</button>');
        $clear.attr("title", "Remove highlight");
        $clear.on("click", () => {
            void this.clearHighlight();
            this.setOpen(false);
        });
        $popover.append($clear);

        this.$widget.append($button, $popover);
    }

    async refreshWithNote(note) {
        const visible = Boolean(note);
        this.toggleInt(visible);

        if (!visible) {
            this.setOpen(false);
            return;
        }

        this.scheduleMount(0);
        this.scheduleMount(150);
        this.scheduleMount(500);
    }

    cleanup() {
        document.removeEventListener("pointerdown", this.handleDocumentPointerDown, true);
        for (const timer of this.mountTimers) {
            clearTimeout(timer);
        }
        this.mountTimers = [];

        if (super.cleanup) {
            super.cleanup();
        }
    }

    ensureStyles() {
        if (this.stylesApplied) {
            return;
        }

        this.cssBlock(`
            .jw-highlight-toolbar-widget {
                position: relative;
                display: inline-flex;
                align-items: center;
                contain: none;
            }

            .jw-highlight-toolbar-button {
                position: relative;
            }

            .jw-highlight-toolbar-button.jw-highlight-toolbar-button-active {
                color: #ffe18d;
            }

            .jw-highlight-toolbar-popover {
                position: absolute;
                top: calc(100% + 8px);
                right: 0;
                z-index: 40;
                display: none;
                min-width: 190px;
                padding: 10px;
                border: 1px solid rgba(255, 255, 255, 0.12);
                border-radius: 12px;
                background: rgba(26, 28, 34, 0.96);
                box-shadow: 0 12px 30px rgba(0, 0, 0, 0.28);
                backdrop-filter: blur(8px);
            }

            .jw-highlight-toolbar-widget.jw-highlight-toolbar-open .jw-highlight-toolbar-popover {
                display: grid;
                grid-template-columns: repeat(2, minmax(0, 1fr));
                gap: 8px;
            }

            .jw-highlight-swatch,
            .jw-highlight-clear {
                appearance: none;
                border: 1px solid rgba(255, 255, 255, 0.14);
                border-radius: 999px;
                cursor: pointer;
                font-size: 12px;
                font-weight: 600;
                line-height: 1;
                min-height: 30px;
                padding: 7px 10px;
                text-align: center;
            }

            .jw-highlight-clear {
                grid-column: 1 / -1;
                background: transparent;
                color: var(--main-text-color);
            }
        `);

        this.stylesApplied = true;
    }

    scheduleMount(delayMs) {
        const timer = setTimeout(() => {
            this.mountTimers = this.mountTimers.filter((entry) => entry !== timer);
            this.mountIntoToolbar();
        }, delayMs);

        this.mountTimers.push(timer);
    }

    mountIntoToolbar() {
        const root = this.$widget && this.$widget[0] instanceof Element ? this.$widget[0] : null;
        if (!root) {
            return;
        }

        const splitRoot = root.closest(".note-split");
        if (!splitRoot) {
            return;
        }

        const host = splitRoot.querySelector(".note-actions-custom")
            || splitRoot.querySelector(".ribbon-button-container")
            || splitRoot.querySelector(".title-actions")
            || splitRoot.querySelector(".note-split-title");

        if (!host) {
            return;
        }

        if (this.currentHost !== host || root.parentElement !== host) {
            host.appendChild(root);
        }

        this.currentHost = host;
    }

    setOpen(open) {
        this.isOpen = Boolean(open);
        const root = this.$widget && this.$widget[0];
        if (!root) {
            return;
        }

        root.classList.toggle("jw-highlight-toolbar-open", this.isOpen);

        const button = root.querySelector(".jw-highlight-toolbar-button");
        if (button) {
            button.classList.toggle("jw-highlight-toolbar-button-active", this.isOpen);
            button.setAttribute("aria-expanded", this.isOpen ? "true" : "false");
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
            console.error("JW highlight toolbar: unable to get active editor", error);
            return null;
        }
    }

    async applyHighlight(color) {
        const editor = await this.getActiveEditor();
        if (!editor) {
            return;
        }

        try {
            if (typeof editor.execute === "function") {
                editor.execute("fontBackgroundColor", { value: color.bg });
                editor.execute("fontColor", { value: color.fg });
            }

            if (editor.editing && editor.editing.view && typeof editor.editing.view.focus === "function") {
                editor.editing.view.focus();
            }
        } catch (error) {
            console.error("JW highlight toolbar: unable to apply highlight", error);
        }
    }

    async clearHighlight() {
        const editor = await this.getActiveEditor();
        if (!editor) {
            return;
        }

        try {
            if (typeof editor.execute === "function") {
                editor.execute("fontBackgroundColor", { value: null });
                editor.execute("fontColor", { value: null });
            }

            if (editor.editing && editor.editing.view && typeof editor.editing.view.focus === "function") {
                editor.editing.view.focus();
            }
        } catch (error) {
            console.error("JW highlight toolbar: unable to clear highlight", error);
        }
    }
}

module.exports = JWPastelHighlightToolbar;
