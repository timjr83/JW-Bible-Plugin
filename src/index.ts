import joplin from "api";
import { findBibleReferencesInText } from "./bibleReferenceParser";
import { getVerseText, insertVerseText } from "./utils";

function escapeHtml(unsafe: string) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatNumber(num: number, length: number = 2) {
  return String(num).padStart(length, "0");
}

joplin.plugins.register({
  onStart: async function () {
    const panels = joplin.views.panels;

    const view = await panels.create("panel_1");

    await panels.setHtml(view, "Loading...");
    await panels.addScript(view, "./webview.js");
    await panels.addScript(view, "./webview.css");



    await panels.onMessage(view, (message: any) => {
      if (message.name === "inserttext") {
        console.log('message returned');
	insertVerseText(joplin, message);
      }
    });

    async function analyseCurrentNote() {
      const note = await joplin.workspace.selectedNote();
      if (note) {
        const references = findBibleReferencesInText(note.body);

        const itemHtml = [];

        itemHtml.push(`<table>`);

        for (const ref of references) {
          const verseTexts = getVerseText(ref);
          const url = `https://www.jw.org/finder?srcid=jwlshare&wtlocale=E&prefer=lang&bible=${formatNumber(
            ref.bookNumber ?? 0,
            2
          )}${formatNumber(ref.chapter, 3)}${formatNumber(
            ref.verses[0],
            3
          )}-${formatNumber(ref.bookNumber ?? 0, 2)}${formatNumber(
            ref.chapter,
            3
          )}${formatNumber(ref.verses.reverse()[0], 3)}&pub=nwtsty`;
          console.log(url);
          itemHtml.push(`
	    <tr><td>
            <p class="reference">
                <b><a target="_blank" href="${url}">${ref.book} ${ref.chapter}:${ref.verseStr}</a></b> <span book="${ref.book}" chapter="${ref.chapter}" verses="${ref.verses.join(',')}"   class="inserttext">  -  Insert Text </span>
            </p></td></tr>
	    <tr><td>
        `);

          var priorVerse = 0;
          for (const v of verseTexts) {
	  if (v.text.startsWith('\n')&&priorVerse+1!=v.verse&&priorVerse!=0 ) {
           itemHtml.push(`
                  <span class="versespan">\n\n<b>${v.verse}</b> ${v.text.slice(1)} </span>
                `);
                }
	   else if (v.text.startsWith('\n')&&priorVerse>0) {
           itemHtml.push(`
                  <span class="versespan">\n<b>${v.verse}</b> ${v.text.slice(1)} </span>
                `);
		}
		else if (v.text.startsWith('\n')&&priorVerse==0){
		itemHtml.push(`
                  <span class="versespan"><b>${v.verse}</b> ${v.text.slice(1)} </span>
                `);
		}
		else if (!v.text.startsWith('\n')&&priorVerse==0){
                itemHtml.push(`
                  <span class="versespan"><b>${v.verse}</b> ${v.text} </span>
                `);
                }
		else if (!v.text.startsWith('\n')&&priorVerse+1!=v.verse&&priorVerse!=0 ) {
           itemHtml.push(`
                  <span class="versespan">\n\n<b>${v.verse}</b> ${v.text} </span>
                `);
                }
		else{
		itemHtml.push(`
<span class="versespan"><b>${v.verse}</b> ${v.text} </span>
`);
}
            var priorVerse = v.verse;
          }
	  itemHtml.push(`</td></tr>`);
        }
	 itemHtml.push(`</table>`);
        await panels.setHtml(
          view,
          `
	  <table class="content-table" >
	    <tr>
	      <td class="header">NWT Bible References</td>
	    </tr>
	    <tr class="scrollable-div">
	     <td>
               ${itemHtml.join("\n")}
             </td>
	    </tr>
	  </table>
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
