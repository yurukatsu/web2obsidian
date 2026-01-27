import enLocale from "../i18n/locales/en.json";
import jaLocale from "../i18n/locales/ja.json";

type Locale = typeof enLocale;
const locales: Record<string, Locale> = {
  en: enLocale,
  ja: jaLocale,
};

export async function getLocalizedMessage(
  key: string,
  params?: Record<string, string>
): Promise<string> {
  const { language } = await chrome.storage.sync.get(["language"]);
  const lang = language || "en";
  const locale = locales[lang] || locales.en;

  // Navigate to nested key (e.g., "toast.success")
  const keys = key.split(".");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let value: any = locale;
  for (const k of keys) {
    value = value?.[k];
  }

  let message = typeof value === "string" ? value : key;

  // Replace {{param}} placeholders
  if (params) {
    for (const [param, replacement] of Object.entries(params)) {
      message = message.replace(
        new RegExp(`\\{\\{${param}\\}\\}`, "g"),
        replacement
      );
    }
  }

  return message;
}
