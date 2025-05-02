import joplin from "api";
import { findBibleReferencesInText } from "./bibleReferenceParser";
import { getVerseText } from "./utils";

function escapeHtml(unsafe: string) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatNumber(num: number, length: number = 2) {
    return String(num).padStart(length, '0');
  }

joplin.plugins.register({
  onStart: async function () {
    const panels = joplin.views.panels;

    const view = await panels.create("panel_1");

    await panels.setHtml(view, "Loading...");
    await panels.addScript(view, "./webview.js");
    await panels.addScript(view, "./webview.css");

    await panels.onMessage(view, (message: any) => {
      if (message.name === "scrollToHash") {
        joplin.commands.execute("scrollToHash", message.hash);
      }
    });

    async function analyseCurrentNote() {
      const note = await joplin.workspace.selectedNote();
      if (note) {
        const references = findBibleReferencesInText(note.body);

        const itemHtml = [];

        for (const ref of references) {
          const verseTexts = getVerseText(ref);
          const url = `https://www.jw.org/finder?srcid=jwlshare&wtlocale=E&prefer=lang&bible=${formatNumber(ref.bookNumber??0,2)}${formatNumber(ref.chapter,3)}${formatNumber(ref.verses[0],3)}-${formatNumber(ref.bookNumber??0,2)}${formatNumber(ref.chapter,3)}${formatNumber(ref.verses.reverse()[0],3)}&pub=nwtsty`; 
          console.log(url);
          itemHtml.push(`
            <p class="toc-item">
                <b><a target="_blank" href="${url}">${ref.book} ${ref.chapter}:${ref.verseStr}</a></b> 
            </p>
        `);

          for (const v of verseTexts) {
            itemHtml.push(`
                    <p class="toc-item">
                        <b>${v.verse}</b> ${v.text}
                    </p>
                `);
          }
        }
        await panels.setHtml(
          view,
          `
            <div class="scrollable-div container">
                ${itemHtml.join("\n")}
            </div>
        `
        );
      } else {
        await panels.setHtml(
          view,
          "Please select a note to view the table of content"
        );
      }
    }

    await joplin.workspace.onNoteChange(() => analyseCurrentNote());
    await joplin.workspace.onNoteSelectionChange(() => {
      analyseCurrentNote();
    });
  },
});
