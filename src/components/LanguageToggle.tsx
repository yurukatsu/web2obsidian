import { useLanguage } from "@hooks/useLanguage";

export function LanguageToggle() {
  const { currentLanguage, toggleLanguage } = useLanguage();

  return (
    <button
      className="btn btn-circle btn-ghost btn-sm text-lg"
      onClick={toggleLanguage}
      title={currentLanguage === "en" ? "Switch to Japanese" : "英語に切替"}
    >
      {currentLanguage === "en" ? "🇺🇸" : "🇯🇵"}
    </button>
  );
}
