import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import ja from "./locales/ja.json";

// Get stored language preference or detect from browser
const getInitialLanguage = (): string => {
  // Check if running in browser context
  if (typeof window !== "undefined") {
    // Try to get from chrome storage (async, so use localStorage as fallback)
    const stored = localStorage.getItem("language");
    if (stored) return stored;

    // Detect from browser
    const browserLang = navigator.language.split("-")[0];
    return browserLang === "ja" ? "ja" : "en";
  }
  return "en";
};

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ja: { translation: ja },
  },
  lng: getInitialLanguage(),
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
