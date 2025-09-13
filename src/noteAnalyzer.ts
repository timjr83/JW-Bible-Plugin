import joplin from "api";
import { findBibleReferencesInText } from "./bibleReferenceParser";
import { generateBibleReferencesHtml } from "./htmlGenerator";
import { SupportedLang } from "./types";

export async function analyseCurrentNote(
  view: string,
  language: SupportedLang
) {
  const note = await joplin.workspace.selectedNote();
  if (note) {
    const references = findBibleReferencesInText(note.body, language);
    const htmlContent = generateBibleReferencesHtml(references, language);
    await joplin.views.panels.setHtml(view, htmlContent);
  } else {
    await joplin.views.panels.setHtml(
      view,
      "Please select a note to view the table of content"
    );
  }
}
