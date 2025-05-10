import { BibleReference } from "./types";
import { parseVerseRange } from "./utils";
import { bibleBookMap, bookNumberMap } from "./bibleBooks";

const referencePattern = /\b((?:[1-3]\s)?[A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\s(\d+):(\d+(?:[,\-](?!\r?\n)\s?\d+)*)\b/g;

export function findBibleReferencesInText(text: string): BibleReference[] {
  const matches = [...text.matchAll(referencePattern)];
  const references: BibleReference[] = [];
  const seenKeys = new Set();

  for (const match of matches) {
    const rawBook = match[1];
    const chapterStr = match[2];
    const verseStr = match[3];
    const normalisedBook = bibleBookMap[rawBook];
    if (!normalisedBook) continue;
    const bookNumber: number = bookNumberMap[normalisedBook] ?? 0;
    const verseRange = parseVerseRange(verseStr);

    // Create a unique key combining the relevant properties. You can customize
    // this key string according to what makes an entry duplicate for your case.
    const uniqueKey = 
    `${bookNumber}_${chapterStr}_${verseStr}_${verseRange.join('-')}`;

    // Check if the key has already been encountered
    if (!seenKeys.has(uniqueKey)) {
      seenKeys.add(uniqueKey); // Mark this combination as seen
      references.push({
        raw: match[0],
        book: normalisedBook,
        bookNumber: bookNumber,
        chapter: parseInt(chapterStr),
        verses: verseRange,
        verseStr: verseStr,
        index: match.index ?? 0,
      });
    }
  }

  return references;
}