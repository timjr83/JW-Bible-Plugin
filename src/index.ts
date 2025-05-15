import joplin from "api";
import { ToolbarButtonLocation } from "api/types";
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
        console.log("message returned");

        const book = message.book;
        const chapter = message.chapter;
        const verses = message.verses
          .split(",")
          .map((v: string) => parseInt(v.trim(), 10)); // Ensure verses is an array
        console.log(`Book: ${book}, Chapter: ${chapter}, Verses: ${verses}`);
        let textToInsert = ``;
        getVerseText({
          book,
          chapter,
          verses: verses, // Convert to array of numbers
          raw: `${book} ${chapter}:${verses}`,
          bookNumber: 0, // Replace with actual logic to determine bookNumber
          verseStr: verses,
        }).forEach((v) => {
          if (v.text.startsWith("\r\n")) {
            textToInsert += `\r\n${v.verse} ${v.text.slice(2)} `;
          } else {
            textToInsert += `${v.verse} ${v.text} `;
          }
          textToInsert = `*${textToInsert.trim()}*`;
        });

        await joplin.commands.execute("insertText", textToInsert);
      }
    });

    await joplin.workspace.onNoteChange(async () => {
      await analyseCurrentNote(view);
      const selection = await joplin.commands.execute('editor.execCommand',{
        name: 'getCursor',
        args: ['to'],
      });
      console.log('Cursor',selection);

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
