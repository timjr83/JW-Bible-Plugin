// src/bibleBooks.ts

import {
  bibleBookMapEn,
  bookNumberMapEn,
  singleChapterBooksEn,
} from "./bibleBooks_En";
import {
  bibleBookMapNo,
  bookNumberMapNo,
  singleChapterBooksNo,
} from "./bibleBooks_No";
import {
  bibleBookMapEs,
  bookNumberMapEs,
  singleChapterBooksEs,
} from "./bibleBooks_Es";
import { SupportedLang } from "./types";

export function singleChapterBooks(lang: SupportedLang) {
  switch (lang) {
    case "en":
      return singleChapterBooksEn as Set<string>;
    case "no":
      return singleChapterBooksNo as Set<string>;
    case "es":
      return singleChapterBooksEs as Set<string>;
    default:
      return singleChapterBooksEn as Set<string>;
  }
}

export function bibleBookMap(lang: SupportedLang) {
  switch (lang) {
    case "en":
      return bibleBookMapEn as Record<string, string>;
    case "no":
      return bibleBookMapNo as Record<string, string>;
    case "es":
      return bibleBookMapEs as Record<string, string>;
    default:
      return bibleBookMapEn as Record<string, string>;
  }
}

export function bookNumberMap(lang: SupportedLang) {
  switch (lang) {
    case "en":
      return bookNumberMapEn as Record<string, number>;
    case "no":
      return bookNumberMapNo as Record<string, number>;
    case "es":
      return bookNumberMapEs as Record<string, number>;
    default:
      return bookNumberMapEn as Record<string, number>;
  }
}
