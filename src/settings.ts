import joplin from "api";
import { SettingItemType } from "api/types";
import { SupportedLang } from "./types";

const LANG_KEY = "jwBiblePlugin.language";

export async function registerSettings() {
  await joplin.settings.registerSection("jwBiblePlugin", {
    label: "JW Bible Plugin", // 👈 section title in settings UI
    iconName: "fas fa-book",
  });

  await joplin.settings.registerSettings({
    [LANG_KEY]: {
      value: "en",
      type: SettingItemType.String, // or just 2
      section: "jwBiblePlugin",
      public: true,
      label: "Bible language",
      description: "Select the language for verse detection",
      isEnum: true, // 👈 this makes it a dropdown
      options: {
        en: "English",
        no: "Norwegian",
        es: "Spanish",
        pt: "Portuguese",
        de: "German",
      },
    },
  });
}

export async function getSelectedLanguage(): Promise<SupportedLang> {
  return await joplin.settings.value(LANG_KEY);
}
