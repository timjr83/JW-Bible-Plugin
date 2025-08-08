import { BibleReference } from "./types";
import { parseVerseRange } from "./utils";
import { bibleBookMap, bookNumberMap } from "./bibleBooks";

// ---- helpers
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const normalizeBookKey = (s: string) =>
  s.replace(/\./g, "").replace(/\s+/g, " ").trim().toLowerCase();

// ---- precomputed data
const BOOK_LOOKUP: Record<string, string> = Object.create(null);
for (const key in bibleBookMap) {
  BOOK_LOOKUP[normalizeBookKey(key)] = bibleBookMap[key];
}

const SINGLE_CHAPTER_BOOKS = new Set([
  "Obadiah", "Philemon", "2 John", "3 John", "Jude"
]);

const BOOK_KEYS = Object.keys(bibleBookMap)
  .map(escapeRegExp)
  .sort((a, b) => b.length - a.length);
const BOOK_ALT = BOOK_KEYS.join("|");

// -- for single-chapter matching only
const SINGLE_BOOK_KEYS = Array.from(SINGLE_CHAPTER_BOOKS).map(escapeRegExp).sort((a, b) => b.length - a.length);
const SINGLE_BOOK_ALT = SINGLE_BOOK_KEYS.join("|");

// ---- regexes
const RE_SPACE = /[\p{White_Space}\u200B]+/gu;

const RE_REFERENCE = new RegExp(
  `(?<!\\w)(?<book>(?:[1-3]\\s*)?(?:${BOOK_ALT}))\\.?[\\s\\u00A0]+(?<chapter>\\d+)[\\s\\u00A0]*:[\\s\\u00A0]*(?<verse>\\d+(?:[\\s\\u00A0]*[,–-][\\s\\u00A0]*\\d+)*)\\b`,
  "giu"
);

const RE_SINGLE_CHAPTER = new RegExp(
  `(?<!\\w)(?<book>${SINGLE_BOOK_ALT})\\.?[\\s\\u00A0]+(?<verse>\\d+(?:[\\s\\u00A0]*[,–-][\\s\\u00A0]*\\d+)*)\\b`,
  "giu"
);

// ---- main parser
export function findBibleReferencesInText(text: string): BibleReference[] {
  if (!text || text.indexOf(":") === -1 && !RE_SINGLE_CHAPTER.test(text)) return [];

  const cleanText = text.replace(RE_SPACE, " ");

  const references: BibleReference[] = [];
  const seen = new Set<string>();

  // --- Standard "Book Chapter:Verse" matches
  for (const m of cleanText.matchAll(RE_REFERENCE)) {
    const groups = m.groups as { book?: string; chapter?: string; verse?: string } | undefined;
    if (!groups) continue;

    const { book: bookMatch, chapter: chapterStr, verse: verseStr } = groups;
    if (!bookMatch || !chapterStr || !verseStr) continue;

    const normalisedBook = BOOK_LOOKUP[normalizeBookKey(bookMatch)];
    if (!normalisedBook) continue;

    const bookNumber = bookNumberMap[normalisedBook] ?? 0;
    const isSingleChapter = SINGLE_CHAPTER_BOOKS.has(normalisedBook);
    const actualChapter = isSingleChapter ? 1 : Number(chapterStr);
    const verses = parseVerseRange(verseStr);

    const uniqueKey = `${bookNumber}|${actualChapter}|${verses.join(",")}`;
    if (seen.has(uniqueKey)) continue;
    seen.add(uniqueKey);

    references.push({
      raw: m[0],
      book: normalisedBook,
      bookNumber,
      chapter: actualChapter,
      verses,
      verseStr,
      index: m.index ?? 0,
    });
  }

  // --- Additional "Book Verse" matches for single-chapter books
  for (const m of cleanText.matchAll(RE_SINGLE_CHAPTER)) {
    const groups = m.groups as { book?: string; verse?: string } | undefined;
    if (!groups) continue;

    const { book: bookMatch, verse: verseStr } = groups;
    if (!bookMatch || !verseStr) continue;

    const normalisedBook = BOOK_LOOKUP[normalizeBookKey(bookMatch)];
    if (!normalisedBook || !SINGLE_CHAPTER_BOOKS.has(normalisedBook)) continue;

    const bookNumber = bookNumberMap[normalisedBook] ?? 0;
    const verses = parseVerseRange(verseStr);

    const uniqueKey = `${bookNumber}|1|${verses.join(",")}`;
    if (seen.has(uniqueKey)) continue;
    seen.add(uniqueKey);

    references.push({
      raw: m[0],
      book: normalisedBook,
      bookNumber,
      chapter: 1,
      verses,
      verseStr,
      index: m.index ?? 0,
    });
  }

  // --- Sort results by order in original text
  references.sort((a, b) => a.index - b.index);

  return references;
}
