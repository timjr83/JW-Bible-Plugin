import joplin from "api";
import { analyseCurrentNote } from "./noteAnalyzer";

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
        const verses = message.verses;
        console.log(`Book: ${book}, Chapter: ${chapter}, Verses: ${verses}`);

        const textToInsert = `${book} ${chapter}:${verses}`;
        await joplin.commands.execute('insertText', textToInsert);
      }
    });

    await joplin.workspace.onNoteChange(() => analyseCurrentNote(view));
    await joplin.workspace.onNoteSelectionChange(() =>
      analyseCurrentNote(view)
    );
  },
});
