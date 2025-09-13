import bibleEn from "./Bible_En.json";
import bibleNo from "./Bible_No.json";
import { BibleJSON, SupportedLang } from "./types";

export function getBible(lang: SupportedLang): BibleJSON {
  switch (lang) {
    case "en":
      return bibleEn as BibleJSON;
    case "no":
      return bibleNo as BibleJSON;
    default:
      return bibleEn as BibleJSON;
  }
}
