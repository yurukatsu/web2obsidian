import { useCallback } from "react";
import { useTranslation } from "react-i18next";

export type Language = "en" | "ja";

export function useLanguage() {
  const { i18n } = useTranslation();

  const currentLanguage = i18n.language as Language;

  const changeLanguage = useCallback(
    async (lang: Language) => {
      await i18n.changeLanguage(lang);
      localStorage.setItem("language", lang);

      // Also save to chrome storage for persistence
      if (typeof chrome !== "undefined" && chrome.storage) {
        chrome.storage.sync.set({ language: lang });
      }
    },
    [i18n]
  );

  const toggleLanguage = useCallback(() => {
    const newLang = currentLanguage === "en" ? "ja" : "en";
    changeLanguage(newLang);
  }, [currentLanguage, changeLanguage]);

  return {
    currentLanguage,
    changeLanguage,
    toggleLanguage,
  };
}
