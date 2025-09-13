// src/bibleBooks.ts

import { bibleBookMapEn, bookNumberMapEn } from "./bibleBooks_En";
import { bibleBookMapNo, bookNumberMapNo } from "./bibleBooks_No";
import { SupportedLang } from "./types";

export function bibleBookMap(lang: SupportedLang) {
  switch (lang) {
    case "en":
      return bibleBookMapEn as Record<string, string>;
    case "no":
      return bibleBookMapNo as Record<string, string>;

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

    default:
      return bookNumberMapEn as Record<string, number>;
  }
}
