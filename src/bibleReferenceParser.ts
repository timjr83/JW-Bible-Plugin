import { BibleReference } from "./types";
import { parseVerseRange } from "./utils";
import { bibleBookMap, bookNumberMap } from "./bibleBooks";

// Precompute a lowercase version of bibleBookMap for case-insensitive lookup (only once)
const bibleBookMapLower: Record<string, string> = Object.create(null);
for (const key in bibleBookMap) {
  bibleBookMapLower[key.toLowerCase()] = bibleBookMap[key];
}

// Improved, more efficient function
export function findBibleReferencesInText(text: string): BibleReference[] {
  const referencePattern = /\b((?:[1-3]\s*)?[a-z]+(?:\s[a-z]+)*)\.?\s*(\d+):(\d+(?:[,\-](?!\r?\n)\s?\d+)*)\b/gi;
  const matches = text.matchAll(referencePattern);
  const references: BibleReference[] = [];
  const seenKeys = new Set<string>();

  for (const match of matches) {
    // Destructure match groups for clarity
    const [raw, bookMatch, chapterStr, verseStr] = match;
    if (!bookMatch || !chapterStr || !verseStr) continue;

    // Normalize book name for lookup
    const rawBook = bookMatch.replace(/\./g, "").replace(/\s+/g, " ").trim().toLowerCase();
    const normalisedBook = bibleBookMapLower[rawBook];
    if (!normalisedBook) continue;

    const bookNumber = bookNumberMap[normalisedBook] ?? 0;
    const verseRange = parseVerseRange(verseStr);

    // Unique key for deduplication
    const uniqueKey = `${bookNumber}_${chapterStr}_${verseStr}_${verseRange.join('-')}`;
    if (seenKeys.has(uniqueKey)) continue;
    seenKeys.add(uniqueKey);

    references.push({
      raw,
      book: normalisedBook,
      bookNumber,
      chapter: parseInt(chapterStr, 10),
      verses: verseRange,
      verseStr,
      index: match.index ?? 0,
    });
  }

  return references;
}