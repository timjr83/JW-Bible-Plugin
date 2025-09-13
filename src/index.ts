import joplin from "api";
import { ToolbarButtonLocation, ContentScriptType } from "api/types";
import { analyseCurrentNote } from "./noteAnalyzer";
import { getVerseText } from "./utils";
import { bookNumberMap } from "./bibleBooks";
import { registerSettings, getSelectedLanguage } from "./settings";
import { SupportedLang } from "./types";

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
    // 1. Register settings
    await registerSettings();
    console.log("loading plugin,");

    const panels = joplin.views.panels;
    const view = await panels.create("JWBiblePanel");

    const contentScriptId = "jw-bible-plugin-content-id";
    joplin.contentScripts.register(
      ContentScriptType.CodeMirrorPlugin,
      contentScriptId,
      "./contentScript.js"
    );

    let lastScroll = 0;

    // 2. Handle panel messages
    await panels.onMessage(view, async (message: PanelMessage) => {
      if (message.name === "inserttext") {
        const { book, chapter } = message;
        const verses: number[] = message.verses
          .split(",")
          .map((v: string) => parseInt(v.trim(), 10));

        // Get language from settings
        const language: SupportedLang = await getSelectedLanguage();
        console.log("language: " + language);
        const bnMap = bookNumberMap(language);
        console.log("Bookmap", bnMap);

        const verseTexts = getVerseText(
          {
            book,
            chapter,
            verses,
            raw: `${book} ${chapter}:${verses}`,
            bookNumber: bnMap[book],
            verseStr: message.verses,
          },
          language
        );

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
      await panels.postMessage(view, { name: "getScrollPosition" });
      const language: SupportedLang = await getSelectedLanguage();
      await analyseCurrentNote(view, language);
      await panels.postMessage(view, {
        name: "restoreScroll",
        value: lastScroll,
      });
    }

    async function refreshPanel() {
      const language: SupportedLang = await getSelectedLanguage();
      await analyseCurrentNote(view, language);
    }

    await joplin.workspace.onNoteChange(refreshPanelAndRestoreScroll);
    await joplin.workspace.onNoteSelectionChange(refreshPanel);

    await joplin.settings.onChange(async (event) => {
      if (event.keys.includes("jwBiblePlugin.language")) {
        const lang = await getSelectedLanguage();
        console.log("Language changed to:", lang);

        // Re-run your parsing logic here
        await analyseCurrentNote(view, lang);
      }
    });

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
