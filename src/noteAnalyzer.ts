import joplin from "api";
import { findBibleReferencesInText } from "./bibleReferenceParser";
import { generateBibleReferencesHtml } from "./htmlGenerator";

export async function analyseCurrentNote(view: string) {
  const note = await joplin.workspace.selectedNote();
  if (note) {
    const references = findBibleReferencesInText(note.body);
    const htmlContent = generateBibleReferencesHtml(references);
    await joplin.views.panels.setHtml(view, htmlContent);
  } else {
    await joplin.views.panels.setHtml(
      view,
      "Please select a note to view the table of content"
    );
  }
}
