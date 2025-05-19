import joplin from "api";
import { ToolbarButtonLocation, ContentScriptType } from "api/types";
import { analyseCurrentNote } from "./noteAnalyzer";
import { getVerseText } from "./utils";


joplin.plugins.register({
  onStart: async function () {
    const panels = joplin.views.panels;
    const view = await panels.create("panel_1");

    await panels.setHtml(view, "Loading...");
    await panels.addScript(view, "./webview.js");
    await panels.addScript(view, "./webview.css");

    await panels.onMessage(view, async (message: any) => {
      if (message.name === "inserttext") {
        const book = message.book;
        const chapter = message.chapter;
        const verses = message.verses
          .split(",")
          .map((v: string) => parseInt(v.trim(), 10)); // Ensure verses is an array

        // Build the text to insert using map and join for better performance
        const verseTexts = getVerseText({
          book,
          chapter,
          verses,
          raw: `${book} ${chapter}:${verses}`,
          bookNumber: 0, // Replace with actual logic to determine bookNumber
          verseStr: verses,
        });

        const textToInsert = '*' + verseTexts.map(v => {
          if (v.text.startsWith("\r\n")) {
            return `\r\n${v.verse} ${v.text.slice(2)}`;
          } else {
            return `${v.verse} ${v.text}`;
          }
        }).join(' ').trim() + '*';

        await joplin.commands.execute("insertText", textToInsert);
      }
    });

    await joplin.workspace.onNoteChange(async () => {
      await analyseCurrentNote(view);
      const selection = await joplin.commands.execute('contentScripts.execCommand', 'get-cursor-text', []);
      console.log("Cursor", selection);
    });

    await joplin.workspace.onNoteSelectionChange(async () => {
      await analyseCurrentNote(view);
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
