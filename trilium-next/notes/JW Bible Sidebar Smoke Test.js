class JWBibleSidebarSmokeTest extends api.RightPanelWidget {
    constructor() {
        super();
        this.contentSized();
    }

    get widgetTitle() {
        return "Bible Smoke Test";
    }

    get parentWidget() {
        return "right-pane";
    }

    get position() {
        return 5;
    }

    doRenderBody() {
        this.$body.empty().append(
            $("<div>")
                .css({
                    padding: "12px",
                    border: "1px solid var(--theme-border-color)",
                    borderRadius: "8px",
                    background: "var(--launcher-pane-background-color)"
                })
                .text("If you can see this, Trilium custom right-pane widgets are loading correctly.")
        );
    }

    async refreshWithNote() {
        this.toggleInt(true);
        this.doRenderBody();
    }
}

module.exports = new JWBibleSidebarSmokeTest();
