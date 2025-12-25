import bibleEn from "./Bible_En.json";
import bibleNo from "./Bible_No.json";
import bibleEs from "./Bible_Es.json";
import biblePt from "./Bible_Pt.json";
import bibleDe from "./Bible_De.json";
import { BibleJSON, SupportedLang } from "./types";

export function getBible(lang: SupportedLang): BibleJSON {
  switch (lang) {
    case "en":
      return bibleEn as BibleJSON;
    case "no":
      return bibleNo as BibleJSON;
    case "es":
      return bibleEs as BibleJSON;
    case "pt":
      return biblePt as BibleJSON;
    case "de":
      return bibleDe as BibleJSON;
    default:
      return bibleEn as BibleJSON;
  }
}
