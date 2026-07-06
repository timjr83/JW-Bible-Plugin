# Trilium Next scaffold

This folder contains a first-pass Trilium Next version of the JW Bible sidebar idea from the Joplin plugin.

The approach is intentionally Trilium-native:

- a `JavaScript (frontend)` code note acts as a right sidebar widget
- a `JSON` code note stores the Bible text payload
- the widget scans the current note, finds scripture references, and renders the verses in the right pane

The MVP in this folder is English-first and uses the existing `Bible_En.json` payload from this repository.

## Files

- `notes/JW Bible Book Aliases.json`
- `notes/JW Bible Sidebar Widget.js`
- `notes/JW Bible Mobile Widget.js`
- `notes/JW Bible Reference Links.js`
- `notes/JW WOL Article Import.js`
- `notes/JW WOL Article Import Mobile.js`
- `notes/JW Bible Sidebar Smoke Test.js`
- `notes/JW Bible EN Data.json`
- `notes/JW Pastel Highlight Toolbar.js`
- `notes/JW Pastel Highlight Mobile.js`

## Suggested Trilium note tree

Create a parent note such as `JW Bible`, then create these children under it:

1. `JW Bible Sidebar Widget`
   - type: `Code`
   - language: `JavaScript (frontend)`
   - labels: `#widget`
2. `JW Bible Reference Links`
   - type: `Code`
   - language: `JavaScript (frontend)`
   - labels: `#widget`
3. `JW WOL Article Import`
   - type: `Code`
   - language: `JavaScript (frontend)`
   - labels: `#widget`
4. `JW Bible Mobile Widget`
   - type: `Code`
   - language: `JavaScript (frontend)`
   - labels: `#run=mobileStartup`
5. `JW WOL Article Import Mobile`
   - type: `Code`
   - language: `JavaScript (frontend)`
   - labels: `#run=mobileStartup`
6. `JW Bible Book Aliases`
   - type: `Code`
   - language: `JSON`
   - labels: `#jwBibleAliases`
7. `JW Bible EN Data`
   - type: `Code`
   - language: `JSON`
   - labels: `#jwBibleData`, `#jwBibleLang=en`

You can keep these notes anywhere in the tree. They do not need to be children of the active note.

## Setup

1. In Trilium Next, create the `JW Bible EN Data` code note and paste in the contents of `notes/JW Bible EN Data.json`.
2. Add labels `#jwBibleData` and `#jwBibleLang=en` to that data note.
3. Create the `JW Bible Book Aliases` code note and paste in the contents of `notes/JW Bible Book Aliases.json`.
4. Add the `#jwBibleAliases` label to that note.
5. Create the `JW Bible Sidebar Widget` code note and paste in the contents of `notes/JW Bible Sidebar Widget.js`.
6. Add the `#widget` label to the widget note.
7. Create the `JW Bible Reference Links` code note and paste in the contents of `notes/JW Bible Reference Links.js`.
8. Add the `#widget` label to that note as well.
9. Create the `JW WOL Article Import` code note and paste in the contents of `notes/JW WOL Article Import.js`.
10. Add the `#widget` label to that note.
11. Create the `JW Bible Mobile Widget` code note and paste in the contents of `notes/JW Bible Mobile Widget.js`.
12. Add the `#run=mobileStartup` label to that note.
13. Create the `JW WOL Article Import Mobile` code note and paste in the contents of `notes/JW WOL Article Import Mobile.js`.
14. Add the `#run=mobileStartup` label to that note.
15. Refresh Trilium Next.
16. Open a normal text note and type a reference such as `John 3:16`, `Genesis 1:1-3`, `Jude 3`, or `Matt 3:4,5; 6:33`.
17. On desktop, open the right sidebar if it is collapsed. The widget should appear there as `Bible References`.
18. On desktop, the note header also gets an import button. It prompts for a `https://wol.jw.org/...` URL and appends the page content from the `#article` container into the current note.
19. On mobile, the Bible, highlight, and importer actions appear in a floating top action row.

## Optional Pastel Highlights

Desktop:

1. Create the `JW Pastel Highlight Toolbar` code note and paste in the contents of `notes/JW Pastel Highlight Toolbar.js`.
2. Add the `#widget` label to that note.

Mobile:

1. Create the `JW Pastel Highlight Mobile` code note and paste in the contents of `notes/JW Pastel Highlight Mobile.js`.
2. Add the `#run=mobileStartup` label to that note.

After refreshing Trilium, the desktop note header keeps the existing highlight button, and mobile gets a floating top action button that opens the pastel palette over the note.

## If nothing appears

1. Create another `Code` note named `JW Bible Sidebar Smoke Test`.
2. Set its language to `JavaScript (frontend)`.
3. Paste in `notes/JW Bible Sidebar Smoke Test.js`.
4. Add the `#widget` label.
5. Refresh Trilium Next.

If the smoke-test widget appears but `Bible References` does not, the Trilium widget system is fine and the failure is inside the Bible widget logic or data note setup.

If the smoke-test widget also does not appear, the issue is almost certainly one of:

- the note is not a frontend JavaScript code note
- the `#widget` label was not added to the script note
- the window was not refreshed after creating the widget
- the right sidebar is collapsed
- Trilium is running in a mode where custom widgets are disabled

## Current behavior

- Detects common English Bible book names and abbreviations.
- Supports standard references such as `John 3:16`, ranges such as `John 3:16-18`, comma lists such as `John 3:16,17`, and single-chapter books such as `Jude 3`.
- Supports shorthand chained references such as `Matt 3:4,5; 6:33`.
- Opens the current reference in jw.org.
- Inserts the rendered verse text into the active editor from the sidebar.
- Turns references in the note body into clickable links which scroll the right pane to the matching reference.
- Adds mobile-only floating top action buttons for Bible references, highlight, and optional WOL import via `mobileStartup` scripts, so they do not depend on the right pane or the mobile launcher bar.
- Adds optional pastel highlight actions for both desktop and mobile rich-text editing.
- Adds a desktop toolbar action that imports a `wol.jw.org` or `jw.org` article URL into the current note.
- Strips site navigation, inline audio controls, and Bible-reference hyperlinks from imported article content.
- Lets supported article links inside imported content import the linked article or section into an important callout after the current paragraph.
- Loads book aliases from a separate JSON note so custom alias edits survive script updates.
- Reloads on note switch.

## Known limits in this first pass

- English data only.
- The parser is ported from the Joplin plugin but not yet broken out into separate reusable Trilium script bundles.
- It targets text-style note content; binary notes are ignored.

## Extending it

The existing Joplin repo already contains additional Bible datasets and book maps in:

- `src/Bible_No.json`
- `src/Bible_Es.json`
- `src/Bible_Pt.json`
- `src/Bible_De.json`

The next step would be to:

1. Add more JSON data notes in Trilium.
2. Extend the widget constants for book aliases and book numbers by language.
3. Let the widget read a configured language instead of always using English.

## Reference docs

- Trilium Next code notes: <https://triliumnext.github.io/Docs/Wiki/code-notes.html>
- Trilium custom widgets: <https://docs.triliumnotes.org/user-guide/scripts/frontend-basics/custom-widget>
- Trilium right pane widgets: <https://docs.triliumnotes.org/user-guide/scripts/frontend-basics/custom-widget/right-pane-widget>
