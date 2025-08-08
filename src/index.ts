import joplin from "api";
import { ToolbarButtonLocation } from "api/types";
import { analyseCurrentNote } from "./noteAnalyzer";
import { getVerseText } from "./utils";
import { bookNumberMap } from "./bibleBooks";
import { ContentScriptType } from "api/types";

type PanelMessage =
  | { name: "inserttext"; book: string; chapter: number; verses: string }
  | { name: "scrollPosition"; value: number };

async function setupPanel(view: string, panels: typeof joplin.views.panels) {
  await panels.setHtml(view, "Loading...");
  await panels.addScript(view, "./webview.js");
  await panels.addScript(view, "./webview.css");
}

joplin.plugins.register({
  onStart: async function () {
    const panels = joplin.views.panels;
    const view = await panels.create("JWBiblePanel");

    const contentScriptId = "jw-bible-plugin-content-id";
    joplin.contentScripts.register(
      ContentScriptType.CodeMirrorPlugin,
      contentScriptId,
      "./contentScript.js"
    );

    let lastScroll = 0;

    // Register the message handler BEFORE loading scripts
    await panels.onMessage(view, async (message: PanelMessage) => {
      if (message.name === "inserttext") {
        const { book, chapter } = message;
        const verses: number[] = message.verses
          .split(",")
          .map((v: string) => parseInt(v.trim(), 10));

        const verseTexts = getVerseText({
          book,
          chapter,
          verses,
          raw: `${book} ${chapter}:${verses}`,
          bookNumber: bookNumberMap[book],
          verseStr: message.verses,
        });

        const textToInsert =
          "*" +
          verseTexts
            .map((v) =>
              v.text.startsWith("\r\n")
                ? `\r\n${v.verse} ${v.text.slice(2)}`
                : `${v.verse} ${v.text}`
            )
            .join(" ")
            .trim() +
          "*";

        await joplin.commands.execute("insertText", textToInsert);
      } else if (message.name === "scrollPosition") {
        lastScroll = message.value;
      }
    });

    await setupPanel(view, panels);

    async function refreshPanelAndRestoreScroll() {
      await panels.postMessage(view, {
        name: "getScrollPosition",
      });

      await analyseCurrentNote(view);
      await panels.postMessage(view, {
        name: "restoreScroll",
        value: lastScroll,
      });
    }

    async function refreshPanel() {
      await analyseCurrentNote(view);
    }

    await joplin.workspace.onNoteChange(refreshPanelAndRestoreScroll);

    await joplin.workspace.onNoteSelectionChange(refreshPanel);

    await joplin.commands.register({
      name: "togglePanel",
      label: "Toggle Bible Reference Panel",
      iconName: "fas fa-book",
      execute: async () => {
        const isVisible = await panels.visible(view);
        await panels.show(view, !isVisible);
      },
    });

    await joplin.views.toolbarButtons.create(
      "togglePanel",
      "togglePanel",
      ToolbarButtonLocation.NoteToolbar
    );
  },
});
