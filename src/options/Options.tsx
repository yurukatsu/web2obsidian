import { useTranslation } from "react-i18next";
import { ThemeToggle } from "@components/ThemeToggle";
import { LanguageToggle } from "@components/LanguageToggle";
import { useOptionsState, type TabId } from "./hooks/useOptionsState";
import { GeneralTab } from "./tabs/GeneralTab";
import { TemplatesTab } from "./tabs/TemplatesTab";
import { VariablesTab } from "./tabs/VariablesTab";
import { LLMTab } from "./tabs/LLMTab";

export function Options() {
  const { t } = useTranslation();
  const state = useOptionsState(t);

  const tabs: { id: TabId; label: string }[] = [
    { id: "general", label: t("options.tabs.general") },
    { id: "templates", label: t("options.tabs.templates") },
    { id: "variables", label: t("options.tabs.variables") },
    { id: "llm", label: t("options.tabs.llm") },
  ];

  const renderSaveStatus = () => {
    switch (state.saveStatus) {
      case "saving":
        return (
          <span className="text-sm text-base-content/60">
            {t("options.saving")}
          </span>
        );
      case "saved":
        return (
          <span className="text-sm text-success">{t("options.saved")}</span>
        );
      case "error":
        return (
          <span className="text-sm text-error">{t("options.saveError")}</span>
        );
      default:
        return null;
    }
  };

  const renderTabContent = () => {
    switch (state.activeTab) {
      case "general":
        return <GeneralTab state={state} t={t} />;
      case "templates":
        return <TemplatesTab state={state} t={t} />;
      case "variables":
        return <VariablesTab state={state} t={t} />;
      case "llm":
        return <LLMTab state={state} t={t} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-base-100 p-8">
      <div className="w-full">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t("options.title")}</h1>
          <div className="flex items-center gap-4">
            {renderSaveStatus()}
            <div className="flex gap-2">
              <LanguageToggle />
              <ThemeToggle />
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex gap-6">
          {/* Sidebar Tabs */}
          <div className="w-48 shrink-0">
            <ul className="menu divide-y divide-base-300 rounded-box bg-base-200 p-2">
              {tabs.map((tab) => (
                <li key={tab.id} className="py-0.5 first:pt-0 last:pb-0">
                  <button
                    className={
                      state.activeTab === tab.id
                        ? "!bg-primary font-medium !text-primary-content"
                        : "hover:bg-base-300"
                    }
                    onClick={() => state.setActiveTab(tab.id)}
                  >
                    {tab.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Content Area */}
          <div className="flex-1 rounded-2xl bg-base-200 p-6">
            {renderTabContent()}
          </div>
        </div>
      </div>
    </div>
  );
}
