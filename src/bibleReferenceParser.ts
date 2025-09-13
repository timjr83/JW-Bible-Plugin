import { BibleReference, SupportedLang } from "./types";
import { parseVerseRange } from "./utils";
import { bibleBookMap, bookNumberMap } from "./bibleBooks";

const normalizeBookKey = (s: string) =>
  s.replace(/\./g, "").replace(/\s+/g, " ").trim().toLowerCase();

const SINGLE_CHAPTER_BOOKS = new Set([
  "Obadiah",
  "Philemon",
  "2 John",
  "3 John",
  "Jude",
]);

const RE_SPACE = /[\p{White_Space}\u200B]+/gu;

export function findBibleReferencesInText(
  text: string,
  language: SupportedLang
): BibleReference[] {
  if (!text) return [];

  // Get the correct maps for the chosen language
  const bbMap = bibleBookMap(language);
  const bbnMap = bookNumberMap(language);

  // Build lookup for normalisation
  const BOOK_LOOKUP: Record<string, string> = Object.create(null);
  for (const key in bbMap) {
    BOOK_LOOKUP[normalizeBookKey(key)] = bbMap[key];
  }

  const RE_REFERENCE = buildReferenceRegex(bbMap);
  const RE_SINGLE_CHAPTER = buildSingleChapterRegex(SINGLE_CHAPTER_BOOKS);

  // Early exit if no possible match
  if (text.indexOf(":") === -1 && !RE_SINGLE_CHAPTER.test(text)) return [];

  const cleanText = cleanForBibleRefs(text);
  const references: BibleReference[] = [];
  const seen = new Set<string>();

  // --- Standard "Book Chapter:Verse" matches
  for (const m of cleanText.matchAll(RE_REFERENCE)) {
    console.log("match", m);
    const {
      book: bookMatch,
      chapter: chapterStr,
      verse: verseStr,
    } = m.groups || {};
    if (!bookMatch || !chapterStr || !verseStr) continue;

    const normalisedBook = BOOK_LOOKUP[normalizeBookKey(bookMatch)];
    if (!normalisedBook) continue;

    const bookNumber = bbnMap[normalisedBook] ?? 0;
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

  // --- Single-chapter matches
  for (const m of cleanText.matchAll(RE_SINGLE_CHAPTER)) {
    const { book: bookMatch, verse: verseStr } = m.groups || {};
    if (!bookMatch || !verseStr) continue;

    const normalisedBook = BOOK_LOOKUP[normalizeBookKey(bookMatch)];
    if (!normalisedBook || !SINGLE_CHAPTER_BOOKS.has(normalisedBook)) continue;

    const bookNumber = bbnMap[normalisedBook] ?? 0;
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

  references.sort((a, b) => a.index - b.index);
  return references;
}

function buildReferenceRegex(bbMap: Record<string, string>) {
  const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // Build BOOK_ALT from the keys in the map
  const bookKeys = Object.keys(bbMap).sort((a, b) => b.length - a.length);

  // Detect if the keys already contain numbered books like "1 Ti" or "2 Mos"
  const hasNumberedBooks = bookKeys.some((k) => /^[1-3]\s*\S/.test(k));

  const BOOK_ALT = bookKeys.map(escapeRegExp).join("|");

  // Only add the optional number prefix if the map doesn't already have numbered books
  const bookPattern = hasNumberedBooks
    ? `(?<book>${BOOK_ALT})`
    : `(?<book>(?:[1-3]\\s*)?(?:${BOOK_ALT}))`;

  const RE_REFERENCE = new RegExp(
    `(?<!\\w)${bookPattern}\\.?[\\s\\u00A0]+(?<chapter>\\d+)[\\s\\u00A0]*:[\\s\\u00A0]*(?<verse>\\d+(?:[\\s\\u00A0]*[,–-][\\s\\u00A0]*\\d+)*)\\b`,
    "giu"
  );

  return RE_REFERENCE;
}

function buildSingleChapterRegex(singleChapterBooks: Set<string>) {
  const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const SINGLE_BOOK_ALT = Array.from(singleChapterBooks)
    .map(escapeRegExp)
    .sort((a, b) => b.length - a.length)
    .join("|");

  return new RegExp(
    `(?<!\\w)(?<book>${SINGLE_BOOK_ALT})\\.?[\\s\\u00A0]+(?<verse>\\d+(?:[\\s\\u00A0]*[,–-][\\s\\u00A0]*\\d+)*)\\b`,
    "giu"
  );
}

function cleanForBibleRefs(text: string): string {
  const RE_SPACE = /[\p{White_Space}\u200B]+/gu;

  return (
    text
      // Remove bold/italic markers (greedy so it works across segments)
      .replace(/\*\*/g, "")
      .replace(/__/g, "")
      .replace(/\*/g, "")
      .replace(/_/g, "")
      // Remove inline code markers
      .replace(/`/g, "")
      // Remove square brackets but keep content
      .replace(/\[([^\]]+)\]/g, "$1")
      // Normalise whitespace (including non-breaking spaces)
      .replace(RE_SPACE, " ")
      .trim()
  );
}
