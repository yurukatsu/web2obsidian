import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ThemeToggle } from "@components/ThemeToggle";
import { LanguageToggle } from "@components/LanguageToggle";
import {
  Template,
  TemplateSet,
  TemplateSettings,
  TemplateProperty,
  PropertyInputType,
  PROPERTY_INPUT_TYPES,
  createDefaultTemplateSettings,
  createNewTemplateSet,
  LegacyTemplateSettings,
  LegacyTemplateSettingsV2,
  migrateTemplateSettings,
  migrateTemplateSettingsV2,
} from "../types/template";
import {
  LLMSettings,
  LLMProviderType,
  LLM_PROVIDERS,
  IN_DEVELOPMENT_PROVIDERS,
  createDefaultLLMSettings,
  getAvailableModels,
} from "../types/llm";
import {
  ObsidianApiSettings,
  createDefaultObsidianApiSettings,
  testObsidianConnection,
  OBSIDIAN_API_HTTPS_PORT,
  OBSIDIAN_API_HTTP_PORT,
} from "../services/obsidian-api";

interface CustomVariable {
  name: string;
  value: string;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";
type TabId = "general" | "templates" | "variables" | "llm";

export function Options() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabId>("general");
  const [vaultName, setVaultName] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [browseSupported, setBrowseSupported] = useState(true);
  const [customVariables, setCustomVariables] = useState<CustomVariable[]>([]);
  const [newVarName, setNewVarName] = useState("");
  const [newVarValue, setNewVarValue] = useState("");
  const [varNameError, setVarNameError] = useState<string | null>(null);
  const [templateSettings, setTemplateSettings] = useState<TemplateSettings>(
    createDefaultTemplateSettings()
  );
  const [selectedSetId, setSelectedSetId] = useState<string>("default");
  const [selectedTemplateType, setSelectedTemplateType] = useState<
    "web" | "youtube"
  >("web");
  const [llmSettings, setLlmSettings] = useState<LLMSettings>(
    createDefaultLLMSettings()
  );
  const [viewingProvider, setViewingProvider] =
    useState<LLMProviderType>("openai");
  const [obsidianApiSettings, setObsidianApiSettings] =
    useState<ObsidianApiSettings>(createDefaultObsidianApiSettings());
  const [apiTestStatus, setApiTestStatus] = useState<
    "idle" | "testing" | "success" | "error"
  >("idle");
  const [apiTestError, setApiTestError] = useState<string>("");
  const [recordingShortcut, setRecordingShortcut] = useState<string | null>(
    null
  ); // Which set's shortcut is being recorded
  const [newPropKey, setNewPropKey] = useState("");
  const [newPropValue, setNewPropValue] = useState("");
  const [newPropType, setNewPropType] = useState<PropertyInputType>("text");
  const [newCustomModel, setNewCustomModel] = useState("");
  const [listItemInputs, setListItemInputs] = useState<Record<string, string>>(
    {}
  );
  const isInitialized = useRef(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        // Load small settings from sync storage
        const syncResult = await chrome.storage.sync.get([
          "vaultName",
          "customVariables",
          "llmSettings",
          "obsidianApiSettings",
        ]);

        setVaultName(syncResult.vaultName || "");
        setCustomVariables(syncResult.customVariables || []);

        if (syncResult.llmSettings) {
          // Merge with defaults to ensure all fields exist (for backwards compatibility)
          const defaults = createDefaultLLMSettings();
          const stored = syncResult.llmSettings;
          const openaiModels = stored.openai?.models || defaults.openai.models;
          const azureModels =
            stored.azureOpenai?.models || defaults.azureOpenai.models;
          const claudeModels = stored.claude?.models || defaults.claude.models;
          const geminiModels = stored.gemini?.models || defaults.gemini.models;
          const ollamaModels = stored.ollama?.models || defaults.ollama.models;

          setLlmSettings({
            ...defaults,
            ...stored,
            openai: {
              ...defaults.openai,
              ...(stored.openai || {}),
              models: openaiModels,
              defaultModel: stored.openai?.defaultModel || openaiModels[0],
            },
            azureOpenai: {
              ...defaults.azureOpenai,
              ...(stored.azureOpenai || {}),
              models: azureModels,
              defaultModel: stored.azureOpenai?.defaultModel || azureModels[0],
            },
            claude: {
              ...defaults.claude,
              ...(stored.claude || {}),
              models: claudeModels,
              defaultModel: stored.claude?.defaultModel || claudeModels[0],
            },
            gemini: {
              ...defaults.gemini,
              ...(stored.gemini || {}),
              models: geminiModels,
              defaultModel: stored.gemini?.defaultModel || geminiModels[0],
            },
            ollama: {
              ...defaults.ollama,
              ...(stored.ollama || {}),
              models: ollamaModels,
              defaultModel: stored.ollama?.defaultModel || ollamaModels[0],
            },
          });
          // Set viewing provider to the default provider
          setViewingProvider(stored.provider || defaults.provider);
        }

        if (syncResult.obsidianApiSettings) {
          const defaults = createDefaultObsidianApiSettings();
          setObsidianApiSettings({
            ...defaults,
            ...syncResult.obsidianApiSettings,
          });
        }

        // Load templateSettings from local storage (large data)
        const localResult = await chrome.storage.local.get([
          "templateSettings",
        ]);
        let templateData = localResult.templateSettings;

        // Migration: check if templateSettings exists in sync storage (old location)
        if (!templateData) {
          const syncTemplateResult = await chrome.storage.sync.get([
            "templateSettings",
          ]);
          if (syncTemplateResult.templateSettings) {
            console.log(
              "[Web2Obsidian] Migrating templateSettings from sync to local storage"
            );
            templateData = syncTemplateResult.templateSettings;
            // Save to local storage and remove from sync storage
            await chrome.storage.local.set({ templateSettings: templateData });
            await chrome.storage.sync.remove(["templateSettings"]);
          }
        }

        if (templateData) {
          // Check format: new (sets + defaultSetId), V2 (defaultSet + customSets), or legacy (templates array)
          const stored = templateData;
          if (stored.sets && stored.defaultSetId) {
            // New format (v3)
            setTemplateSettings(stored);
          } else if (stored.defaultSet) {
            // V2 format - migrate
            const migrated = migrateTemplateSettingsV2(
              stored as LegacyTemplateSettingsV2
            );
            setTemplateSettings(migrated);
          } else if (stored.templates) {
            // Legacy format (v1) - migrate
            const migrated = migrateTemplateSettings(
              stored as LegacyTemplateSettings
            );
            setTemplateSettings(migrated);
          } else {
            // Unknown format, use defaults
            setTemplateSettings(createDefaultTemplateSettings());
          }
        }

        setTimeout(() => {
          isInitialized.current = true;
        }, 0);
      } catch (error) {
        console.error("Failed to load settings:", error);
        setSaveStatus("error");
      }
    };

    loadSettings();
    setBrowseSupported("showDirectoryPicker" in window);
  }, []);

  // Save to sync storage (for small settings)
  const saveToSyncStorage = useCallback((data: Record<string, unknown>) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      setSaveStatus("saving");
      console.log("[Web2Obsidian] Saving to sync storage:", Object.keys(data));
      chrome.storage.sync.set(data, () => {
        if (chrome.runtime.lastError) {
          console.error("Failed to save:", chrome.runtime.lastError);
          setSaveStatus("error");
          return;
        }
        console.log("[Web2Obsidian] Save successful");
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      });
    }, 500);
  }, []);

  // Save to local storage (for large settings like templateSettings)
  const saveToLocalStorage = useCallback((data: Record<string, unknown>) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      setSaveStatus("saving");
      console.log("[Web2Obsidian] Saving to local storage:", Object.keys(data));
      if (data.templateSettings) {
        const ts = data.templateSettings as TemplateSettings;
        console.log("[Web2Obsidian] Template sets being saved:", {
          sets: ts.sets?.map((s) => s.name),
          defaultSetId: ts.defaultSetId,
        });
      }
      chrome.storage.local.set(data, () => {
        if (chrome.runtime.lastError) {
          console.error("Failed to save:", chrome.runtime.lastError);
          setSaveStatus("error");
          return;
        }
        console.log("[Web2Obsidian] Save successful");
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      });
    }, 500);
  }, []);

  // Watch for changes and auto-save
  useEffect(() => {
    if (!isInitialized.current) return;
    saveToSyncStorage({ vaultName });
  }, [vaultName, saveToSyncStorage]);

  useEffect(() => {
    if (!isInitialized.current) return;
    saveToSyncStorage({ customVariables });
  }, [customVariables, saveToSyncStorage]);

  useEffect(() => {
    if (!isInitialized.current) return;
    // Save templateSettings to local storage (large data, no quota issues)
    saveToLocalStorage({ templateSettings });
  }, [templateSettings, saveToLocalStorage]);

  useEffect(() => {
    if (!isInitialized.current) return;
    saveToSyncStorage({ llmSettings });
  }, [llmSettings, saveToSyncStorage]);

  useEffect(() => {
    if (!isInitialized.current) return;
    saveToSyncStorage({ obsidianApiSettings });
  }, [obsidianApiSettings, saveToSyncStorage]);

  // Built-in variables
  const webVariables = [
    "title",
    "url",
    "domain",
    "description",
    "author",
    "published",
    "date",
    "time",
    "datetime",
    "year",
    "month",
    "day",
    "selection",
    "content",
  ];

  const youtubeVariables = [
    "title",
    "url",
    "channel",
    "videoId",
    "duration",
    "published",
    "transcript",
    "date",
    "time",
    "datetime",
    "year",
    "month",
    "day",
  ];

  const allBuiltInVariables = [
    ...new Set([...webVariables, ...youtubeVariables]),
  ];

  // Get all template sets
  const getAllSets = (): TemplateSet[] => {
    return templateSettings.sets;
  };

  // Get selected template set
  const getSelectedSet = (): TemplateSet | null => {
    return templateSettings.sets.find((s) => s.id === selectedSetId) || null;
  };

  // Get selected template from set
  const getSelectedTemplate = (): Template | null => {
    const set = getSelectedSet();
    if (!set) return null;
    return selectedTemplateType === "web"
      ? set.webTemplate
      : set.youtubeTemplate;
  };

  // Handle shortcut key recording for a template set
  const handleSetShortcutKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    setId: string
  ) => {
    e.preventDefault();
    e.stopPropagation();

    // Ignore if only modifier keys
    if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) {
      return;
    }

    // Generate key combination string
    const parts: string[] = [];
    if (e.ctrlKey || e.metaKey) parts.push("Ctrl");
    if (e.shiftKey) parts.push("Shift");
    if (e.altKey) parts.push("Alt");

    // Normalize key name
    let key = e.key;
    if (key.length === 1) {
      key = key.toUpperCase();
    } else if (key === " ") {
      key = "Space";
    } else if (key === "Escape") {
      // Cancel recording on Escape
      setRecordingShortcut(null);
      return;
    }
    parts.push(key);

    const shortcutKey = parts.join("+");

    // Update the set's shortcut
    updateTemplateSet(setId, { shortcutKey });
    setRecordingShortcut(null);
  };

  // Clear a template set's shortcut key
  const clearSetShortcutKey = (setId: string) => {
    updateTemplateSet(setId, { shortcutKey: null });
  };

  // Update a template set
  const updateTemplateSet = (setId: string, updates: Partial<TemplateSet>) => {
    setTemplateSettings({
      ...templateSettings,
      sets: templateSettings.sets.map((s) =>
        s.id === setId ? { ...s, ...updates } : s
      ),
    });
  };

  // Add a new template set
  const handleAddSet = () => {
    const newSet = createNewTemplateSet(`Set ${templateSettings.sets.length}`);
    setTemplateSettings({
      ...templateSettings,
      sets: [...templateSettings.sets, newSet],
    });
    setSelectedSetId(newSet.id);
  };

  // Delete a template set
  const handleDeleteSet = (setId: string) => {
    // Cannot delete the default set or the last remaining set
    if (setId === templateSettings.defaultSetId) {
      alert(t("options.templates.cannotDeleteDefault"));
      return;
    }
    if (templateSettings.sets.length <= 1) {
      return;
    }
    if (!confirm(t("options.templates.confirmDeleteSet"))) {
      return;
    }
    const newSets = templateSettings.sets.filter((s) => s.id !== setId);
    setTemplateSettings({
      ...templateSettings,
      sets: newSets,
    });
    // Select the default set after deletion
    setSelectedSetId(templateSettings.defaultSetId);
  };

  // Set a template set as the default
  const handleSetAsDefault = (setId: string) => {
    setTemplateSettings({
      ...templateSettings,
      defaultSetId: setId,
    });
  };

  // Update a template within a set
  const updateTemplateInSet = (
    setId: string,
    templateType: "web" | "youtube",
    updates: Partial<Template>
  ) => {
    const templateKey =
      templateType === "web" ? "webTemplate" : "youtubeTemplate";
    setTemplateSettings({
      ...templateSettings,
      sets: templateSettings.sets.map((s) =>
        s.id === setId
          ? { ...s, [templateKey]: { ...s[templateKey], ...updates } }
          : s
      ),
    });
  };

  // Validate variable name
  const validateVarName = (name: string): string | null => {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
      return t("options.variables.customNameInvalid");
    }
    const allVarNames = [
      ...allBuiltInVariables,
      ...customVariables.map((v) => v.name),
    ];
    if (allVarNames.includes(name)) {
      return t("options.variables.customNameError");
    }
    return null;
  };

  // Custom variable handlers
  const handleAddVariable = () => {
    const trimmedName = newVarName.trim();
    const trimmedValue = newVarValue.trim();

    if (!trimmedName) return;

    const error = validateVarName(trimmedName);
    if (error) {
      setVarNameError(error);
      return;
    }

    setCustomVariables([
      ...customVariables,
      { name: trimmedName, value: trimmedValue },
    ]);
    setNewVarName("");
    setNewVarValue("");
    setVarNameError(null);
  };

  const handleDeleteVariable = (name: string) => {
    setCustomVariables(customVariables.filter((v) => v.name !== name));
  };

  const handleUpdateVariableValue = (name: string, value: string) => {
    setCustomVariables(
      customVariables.map((v) => (v.name === name ? { ...v, value } : v))
    );
  };

  // Vault handlers
  const handleBrowseVault = async () => {
    try {
      const dirHandle = await window.showDirectoryPicker({
        mode: "read",
      });
      setVaultName(dirHandle.name);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        console.error("Failed to select directory:", err);
      }
    }
  };

  const handleTestConnection = () => {
    if (!vaultName) {
      return;
    }
    const uri = `obsidian://open?vault=${encodeURIComponent(vaultName)}`;
    location.href = uri;
  };

  // Property handlers for templates in sets
  const handleAddProperty = () => {
    const key = newPropKey.trim();
    const value = newPropValue.trim();
    if (!key) return;

    const template = getSelectedTemplate();
    if (!template) return;

    const newProperty: TemplateProperty = {
      key,
      value,
      inputType: newPropType,
    };
    updateTemplateInSet(selectedSetId, selectedTemplateType, {
      properties: [...template.properties, newProperty],
    });
    setNewPropKey("");
    setNewPropValue("");
    setNewPropType("text");
  };

  const handleDeleteProperty = (propertyKey: string) => {
    const template = getSelectedTemplate();
    if (!template) return;

    // Prevent deleting required properties
    const prop = template.properties.find((p) => p.key === propertyKey);
    if (prop?.required) return;

    updateTemplateInSet(selectedSetId, selectedTemplateType, {
      properties: template.properties.filter((p) => p.key !== propertyKey),
    });
  };

  const handleUpdateProperty = (propertyKey: string, newValue: string) => {
    const template = getSelectedTemplate();
    if (!template) return;

    updateTemplateInSet(selectedSetId, selectedTemplateType, {
      properties: template.properties.map((p) =>
        p.key === propertyKey ? { ...p, value: newValue } : p
      ),
    });
  };

  const handleUpdatePropertyType = (
    propertyKey: string,
    newType: PropertyInputType
  ) => {
    const template = getSelectedTemplate();
    if (!template) return;

    updateTemplateInSet(selectedSetId, selectedTemplateType, {
      properties: template.properties.map((p) =>
        p.key === propertyKey ? { ...p, inputType: newType } : p
      ),
    });
  };

  const handleMoveProperty = (
    propertyIndex: number,
    direction: "up" | "down"
  ) => {
    const template = getSelectedTemplate();
    if (!template) return;

    const newIndex = direction === "up" ? propertyIndex - 1 : propertyIndex + 1;
    if (newIndex < 0 || newIndex >= template.properties.length) return;

    const newProperties = [...template.properties];
    const [movedProperty] = newProperties.splice(propertyIndex, 1);
    newProperties.splice(newIndex, 0, movedProperty);

    updateTemplateInSet(selectedSetId, selectedTemplateType, {
      properties: newProperties,
    });
  };

  // Helper functions for list/tags property values
  const parseListValue = (value: string): string[] => {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [value];
    } catch {
      // If not JSON, treat as single value or empty
      return value ? [value] : [];
    }
  };

  const serializeListValue = (items: string[]): string => {
    return JSON.stringify(items);
  };

  const handleAddListItem = (propertyKey: string) => {
    const template = getSelectedTemplate();
    if (!template) return;

    const inputKey = `${selectedSetId}-${selectedTemplateType}-${propertyKey}`;
    const newItem = listItemInputs[inputKey]?.trim();
    if (!newItem) return;

    const prop = template.properties.find((p) => p.key === propertyKey);
    if (!prop) return;

    const currentItems = parseListValue(prop.value);
    const newValue = serializeListValue([...currentItems, newItem]);
    handleUpdateProperty(propertyKey, newValue);
    setListItemInputs((prev) => ({ ...prev, [inputKey]: "" }));
  };

  const handleRemoveListItem = (propertyKey: string, index: number) => {
    const template = getSelectedTemplate();
    if (!template) return;

    const prop = template.properties.find((p) => p.key === propertyKey);
    if (!prop) return;

    const currentItems = parseListValue(prop.value);
    const newItems = currentItems.filter((_, i) => i !== index);
    handleUpdateProperty(propertyKey, serializeListValue(newItems));
  };

  const renderSaveStatus = () => {
    switch (saveStatus) {
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

  const tabs: { id: TabId; label: string }[] = [
    { id: "general", label: t("options.tabs.general") },
    { id: "templates", label: t("options.tabs.templates") },
    { id: "variables", label: t("options.tabs.variables") },
    { id: "llm", label: t("options.tabs.llm") },
  ];

  // Export all settings to JSON file
  const handleExportSettings = () => {
    chrome.storage.sync.get(null, (data) => {
      const exportData = {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        settings: data,
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `web2obsidian-settings-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  };

  // Import settings from JSON file
  const handleImportSettings = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const importData = JSON.parse(text);

        // Validate import data structure
        if (!importData.settings || typeof importData.settings !== "object") {
          alert(t("options.importExport.invalidFile"));
          return;
        }

        // Confirm import
        if (!confirm(t("options.importExport.confirmImport"))) {
          return;
        }

        // Import settings
        chrome.storage.sync.set(importData.settings, () => {
          if (chrome.runtime.lastError) {
            console.error(
              "Failed to import settings:",
              chrome.runtime.lastError
            );
            alert(t("options.importExport.importError"));
            return;
          }
          // Reload the page to apply imported settings
          window.location.reload();
        });
      } catch (error) {
        console.error("Failed to parse import file:", error);
        alert(t("options.importExport.invalidFile"));
      }
    };
    input.click();
  };

  const handleTestObsidianApi = async () => {
    setApiTestStatus("testing");
    setApiTestError("");

    const result = await testObsidianConnection(obsidianApiSettings);

    if (result.success) {
      setApiTestStatus("success");
      setTimeout(() => setApiTestStatus("idle"), 3000);
    } else {
      setApiTestStatus("error");
      setApiTestError(result.error || "Connection failed");
    }
  };

  const renderGeneralTab = () => (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Vault Settings */}
      <div className="rounded-xl bg-base-300 p-4">
        <h3 className="mb-4 text-lg font-medium">
          {t("options.general.vault")}
        </h3>

        <div className="form-control mb-4">
          <label className="label">
            <span className="label-text font-medium">
              {t("options.general.vaultName")}
            </span>
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              className="input input-bordered flex-1"
              placeholder={t("options.general.vaultNamePlaceholder")}
              value={vaultName}
              onChange={(e) => setVaultName(e.target.value)}
            />
            {browseSupported && (
              <button
                type="button"
                className="btn btn-outline"
                onClick={handleBrowseVault}
              >
                {t("options.general.browse")}
              </button>
            )}
          </div>
          <label className="label">
            <span className="label-text-alt text-base-content/60">
              {t("options.general.vaultNameHint")}
            </span>
          </label>
        </div>

        <div>
          <button
            className="btn btn-outline"
            onClick={handleTestConnection}
            disabled={!vaultName}
          >
            {t("options.general.testConnection")}
          </button>
        </div>
      </div>

      {/* Obsidian Local REST API */}
      <div className="rounded-xl bg-base-300 p-4">
        <h3 className="mb-4 text-lg font-medium">
          {t("options.obsidianApi.title")}
        </h3>

        <div className="flex flex-col gap-4">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">
                {t("options.obsidianApi.apiKey")}
              </span>
            </label>
            <input
              type="password"
              className="input input-bordered"
              placeholder={t("options.obsidianApi.apiKeyPlaceholder")}
              value={obsidianApiSettings.apiKey}
              onChange={(e) =>
                setObsidianApiSettings({
                  ...obsidianApiSettings,
                  apiKey: e.target.value,
                })
              }
            />
            <label className="label">
              <span className="label-text-alt text-base-content/60">
                {t("options.obsidianApi.apiKeyHint")}
              </span>
            </label>
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">
                {t("options.obsidianApi.port")}
              </span>
            </label>
            <input
              type="number"
              className="input input-bordered w-32"
              value={obsidianApiSettings.port}
              onChange={(e) => {
                const defaultPort = obsidianApiSettings.insecureMode
                  ? OBSIDIAN_API_HTTP_PORT
                  : OBSIDIAN_API_HTTPS_PORT;
                setObsidianApiSettings({
                  ...obsidianApiSettings,
                  port: parseInt(e.target.value) || defaultPort,
                });
              }}
            />
            <label className="label">
              <span className="label-text-alt text-base-content/60">
                {obsidianApiSettings.insecureMode
                  ? `Default: ${OBSIDIAN_API_HTTP_PORT} (HTTP)`
                  : `Default: ${OBSIDIAN_API_HTTPS_PORT} (HTTPS)`}
              </span>
            </label>
          </div>

          <div className="form-control">
            <label className="label cursor-pointer justify-start gap-4">
              <input
                type="checkbox"
                className="checkbox checkbox-sm"
                checked={obsidianApiSettings.insecureMode}
                onChange={(e) => {
                  const insecureMode = e.target.checked;
                  // Auto-switch port when changing protocol
                  const currentPort = obsidianApiSettings.port;
                  const isDefaultPort =
                    currentPort === OBSIDIAN_API_HTTPS_PORT ||
                    currentPort === OBSIDIAN_API_HTTP_PORT;
                  const newPort = isDefaultPort
                    ? insecureMode
                      ? OBSIDIAN_API_HTTP_PORT
                      : OBSIDIAN_API_HTTPS_PORT
                    : currentPort;
                  setObsidianApiSettings({
                    ...obsidianApiSettings,
                    insecureMode,
                    port: newPort,
                  });
                }}
              />
              <span className="label-text">
                {t("options.obsidianApi.insecureMode")}
              </span>
            </label>
          </div>

          <div className="flex items-center gap-2">
            <button
              className={`btn btn-outline btn-sm ${apiTestStatus === "testing" ? "loading" : ""}`}
              onClick={handleTestObsidianApi}
              disabled={
                !obsidianApiSettings.apiKey || apiTestStatus === "testing"
              }
            >
              {t("options.obsidianApi.testConnection")}
            </button>
            {apiTestStatus === "success" && (
              <span className="text-sm text-success">
                {t("options.obsidianApi.connectionSuccess")}
              </span>
            )}
            {apiTestStatus === "error" && (
              <span className="text-sm text-error">{apiTestError}</span>
            )}
          </div>
        </div>
      </div>

      {/* Import/Export Settings */}
      <div className="rounded-xl bg-base-300 p-4">
        <h3 className="mb-4 text-lg font-medium">
          {t("options.importExport.title")}
        </h3>
        <p className="mb-4 text-sm text-base-content/60">
          {t("options.importExport.description")}
        </p>
        <div className="flex gap-2">
          <button
            className="btn btn-outline btn-sm"
            onClick={handleExportSettings}
          >
            {t("options.importExport.export")}
          </button>
          <button
            className="btn btn-outline btn-sm"
            onClick={handleImportSettings}
          >
            {t("options.importExport.import")}
          </button>
        </div>
      </div>
    </div>
  );

  const renderTemplatesTab = () => {
    const selectedSet = getSelectedSet();
    const selectedTemplate = getSelectedTemplate();

    return (
      <div className="flex h-full gap-6">
        {/* Template Sets Sidebar */}
        <div className="w-56 shrink-0">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-sm font-medium">
              {t("options.templates.sets")}
            </h4>
            <button
              className="btn btn-square btn-ghost btn-xs"
              onClick={handleAddSet}
              title={t("options.templates.addSet")}
            >
              +
            </button>
          </div>
          <ul className="menu menu-sm divide-y divide-base-200 rounded-lg bg-base-300 p-1">
            {getAllSets().map((set) => {
              const isSelected = selectedSetId === set.id;
              const isDefault = set.id === templateSettings.defaultSetId;
              return (
                <li key={set.id} className="py-0.5 first:pt-0 last:pb-0">
                  <div
                    className={`flex items-center justify-between gap-1 ${
                      isSelected
                        ? "!bg-primary font-medium !text-primary-content"
                        : "hover:bg-base-300"
                    }`}
                  >
                    <button
                      className="flex-1 break-words text-left"
                      onClick={() => setSelectedSetId(set.id)}
                    >
                      <div className="flex flex-col">
                        <span>{set.name}</span>
                        {set.shortcutKey && (
                          <span
                            className={`text-xs ${isSelected ? "text-primary-content/70" : "text-base-content/50"}`}
                          >
                            {set.shortcutKey}
                          </span>
                        )}
                      </div>
                    </button>
                    {isDefault && (
                      <span
                        className={`badge badge-xs shrink-0 ${isSelected ? "badge-ghost" : "badge-primary"}`}
                      >
                        {t("options.llm.default")}
                      </span>
                    )}
                    {!isDefault && templateSettings.sets.length > 1 && (
                      <button
                        className={`btn btn-square btn-ghost btn-xs shrink-0 ${
                          isSelected
                            ? "text-primary-content/70 hover:text-primary-content"
                            : "text-error"
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSet(set.id);
                        }}
                        title={t("common.delete")}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-3.5 w-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Template Set Editor */}
        <div className="flex-1 overflow-auto rounded-xl bg-base-300 p-4">
          {selectedSet ? (
            <div className="flex flex-col gap-4">
              {/* Set Header */}
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">{selectedSet.name}</h3>
                {selectedSetId !== templateSettings.defaultSetId &&
                  templateSettings.sets.length > 1 && (
                    <button
                      className="btn btn-square btn-ghost btn-sm text-error"
                      onClick={() => handleDeleteSet(selectedSetId)}
                      title={t("common.delete")}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  )}
              </div>

              {/* Set Name & Shortcut */}
              <div className="grid grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">
                      {t("options.templates.setName")}
                    </span>
                  </label>
                  <input
                    type="text"
                    className="input input-bordered"
                    value={selectedSet.name}
                    onChange={(e) =>
                      updateTemplateSet(selectedSetId, { name: e.target.value })
                    }
                  />
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">
                      {t("options.templates.shortcut")}
                    </span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className={`input input-bordered flex-1 ${recordingShortcut === selectedSetId ? "input-primary" : ""}`}
                      placeholder={
                        recordingShortcut === selectedSetId
                          ? t("options.shortcuts.pressKey")
                          : t("options.shortcuts.clickToSet")
                      }
                      value={
                        recordingShortcut === selectedSetId
                          ? ""
                          : selectedSet.shortcutKey || ""
                      }
                      readOnly
                      onFocus={() => setRecordingShortcut(selectedSetId)}
                      onBlur={() => setRecordingShortcut(null)}
                      onKeyDown={(e) =>
                        handleSetShortcutKeyDown(e, selectedSetId)
                      }
                    />
                    {selectedSet.shortcutKey && (
                      <button
                        className="btn btn-square btn-ghost"
                        onClick={() => clearSetShortcutKey(selectedSetId)}
                        title={t("common.delete")}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Set as Default */}
              <div className="form-control">
                <label className="label cursor-pointer justify-start gap-3">
                  <input
                    type="checkbox"
                    className="checkbox-primary checkbox checkbox-sm"
                    checked={selectedSetId === templateSettings.defaultSetId}
                    onChange={(e) => {
                      if (e.target.checked) {
                        handleSetAsDefault(selectedSetId);
                      }
                    }}
                    disabled={selectedSetId === templateSettings.defaultSetId}
                  />
                  <span className="label-text">
                    {t("options.llm.setAsDefault")}
                  </span>
                </label>
              </div>

              {/* Template Type Tabs */}
              <div className="tabs-boxed tabs w-fit bg-base-100">
                <button
                  className={`tab ${selectedTemplateType === "web" ? "tab-active" : ""}`}
                  onClick={() => setSelectedTemplateType("web")}
                >
                  {t("options.templates.web")}
                </button>
                <button
                  className={`tab ${selectedTemplateType === "youtube" ? "tab-active" : ""}`}
                  onClick={() => setSelectedTemplateType("youtube")}
                >
                  {t("options.templates.youtube")}
                </button>
              </div>

              {/* Template Editor */}
              {selectedTemplate && (
                <div className="flex flex-col gap-4 pt-2">
                  {/* Folder */}
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text font-medium">
                        {t("options.templates.folder")}
                      </span>
                    </label>
                    <input
                      type="text"
                      className="input input-bordered"
                      placeholder={t("options.templates.folderPlaceholder")}
                      value={selectedTemplate.folder}
                      onChange={(e) =>
                        updateTemplateInSet(
                          selectedSetId,
                          selectedTemplateType,
                          { folder: e.target.value }
                        )
                      }
                    />
                    <label className="label">
                      <span className="label-text-alt text-base-content/60">
                        {t("options.templates.folderHint")}
                      </span>
                    </label>
                  </div>

                  {/* Filename */}
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text font-medium">
                        {t("options.templates.filename")}
                      </span>
                    </label>
                    <input
                      type="text"
                      className="input input-bordered"
                      placeholder={t("options.templates.filenamePlaceholder")}
                      value={selectedTemplate.filename}
                      onChange={(e) =>
                        updateTemplateInSet(
                          selectedSetId,
                          selectedTemplateType,
                          { filename: e.target.value }
                        )
                      }
                    />
                    <label className="label">
                      <span className="label-text-alt text-base-content/60">
                        {t("options.templates.filenameHint")}
                      </span>
                    </label>
                  </div>

                  {/* Properties */}
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text font-medium">
                        {t("options.templates.properties")}
                      </span>
                    </label>
                    <div className="mb-2 flex flex-col gap-2">
                      {selectedTemplate.properties.map((prop, propIndex) => (
                        <div key={prop.key} className="flex items-start gap-2">
                          <div className="flex shrink-0 flex-col self-start">
                            <button
                              type="button"
                              className="btn btn-square btn-ghost btn-xs"
                              onClick={() =>
                                handleMoveProperty(propIndex, "up")
                              }
                              disabled={propIndex === 0}
                              title={t("options.templates.moveUp")}
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-3 w-3"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M5 15l7-7 7 7"
                                />
                              </svg>
                            </button>
                            <button
                              type="button"
                              className="btn btn-square btn-ghost btn-xs"
                              onClick={() =>
                                handleMoveProperty(propIndex, "down")
                              }
                              disabled={
                                propIndex ===
                                selectedTemplate.properties.length - 1
                              }
                              title={t("options.templates.moveDown")}
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-3 w-3"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 9l-7 7-7-7"
                                />
                              </svg>
                            </button>
                          </div>
                          <code className="mt-1 min-w-24 shrink-0 rounded bg-base-100 px-2 py-1 text-sm text-primary">
                            {prop.key}
                          </code>
                          <select
                            className="select select-bordered select-sm w-28 shrink-0 self-start"
                            value={prop.inputType || "text"}
                            onChange={(e) =>
                              handleUpdatePropertyType(
                                prop.key,
                                e.target.value as PropertyInputType
                              )
                            }
                          >
                            {PROPERTY_INPUT_TYPES.map((type) => (
                              <option key={type} value={type}>
                                {t(`options.templates.propertyTypes.${type}`)}
                              </option>
                            ))}
                          </select>

                          {prop.inputType === "list" ||
                          prop.inputType === "tags" ? (
                            <div className="flex flex-1 flex-col gap-1">
                              <div className="flex flex-wrap gap-1">
                                {parseListValue(prop.value).map((item, idx) => (
                                  <span
                                    key={idx}
                                    className={`badge ${prop.inputType === "tags" ? "badge-secondary" : "badge-outline"} gap-1`}
                                  >
                                    {prop.inputType === "tags" && "#"}
                                    {item}
                                    <button
                                      type="button"
                                      className="hover:text-error"
                                      onClick={() =>
                                        handleRemoveListItem(prop.key, idx)
                                      }
                                    >
                                      ×
                                    </button>
                                  </span>
                                ))}
                              </div>
                              <div className="flex gap-1">
                                <input
                                  type="text"
                                  className="input input-xs input-bordered flex-1"
                                  placeholder={t("options.templates.addItem")}
                                  value={
                                    listItemInputs[
                                      `${selectedSetId}-${selectedTemplateType}-${prop.key}`
                                    ] || ""
                                  }
                                  onChange={(e) =>
                                    setListItemInputs((prev) => ({
                                      ...prev,
                                      [`${selectedSetId}-${selectedTemplateType}-${prop.key}`]:
                                        e.target.value,
                                    }))
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      handleAddListItem(prop.key);
                                    }
                                  }}
                                />
                                <button
                                  type="button"
                                  className="btn btn-square btn-ghost btn-xs"
                                  onClick={() => handleAddListItem(prop.key)}
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          ) : prop.inputType === "checkbox" ? (
                            <label className="flex flex-1 cursor-pointer items-center gap-2">
                              <input
                                type="checkbox"
                                className="checkbox-primary checkbox checkbox-sm"
                                checked={prop.value === "true"}
                                onChange={(e) =>
                                  handleUpdateProperty(
                                    prop.key,
                                    e.target.checked ? "true" : "false"
                                  )
                                }
                              />
                              <span className="text-sm text-base-content/60">
                                {prop.value === "true" ? "true" : "false"}
                              </span>
                            </label>
                          ) : (
                            <input
                              type={
                                prop.inputType === "number" ? "number" : "text"
                              }
                              className="input input-sm input-bordered flex-1"
                              value={prop.value}
                              onChange={(e) =>
                                handleUpdateProperty(prop.key, e.target.value)
                              }
                            />
                          )}

                          {prop.required ? (
                            <div
                              className="btn btn-square btn-ghost btn-sm shrink-0 cursor-not-allowed self-start text-base-content/40"
                              title={t("options.templates.requiredProperty")}
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-4 w-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                                />
                              </svg>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-square btn-ghost btn-sm shrink-0 self-start text-error"
                              onClick={() => handleDeleteProperty(prop.key)}
                              title={t("common.delete")}
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-4 w-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        className="input input-sm input-bordered w-28"
                        placeholder={t("options.templates.propertyKey")}
                        value={newPropKey}
                        onChange={(e) => setNewPropKey(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleAddProperty();
                        }}
                      />
                      <select
                        className="select select-bordered select-sm w-28 shrink-0"
                        value={newPropType}
                        onChange={(e) =>
                          setNewPropType(e.target.value as PropertyInputType)
                        }
                      >
                        {PROPERTY_INPUT_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {t(`options.templates.propertyTypes.${type}`)}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        className="input input-sm input-bordered flex-1"
                        placeholder={t("options.templates.propertyValue")}
                        value={newPropValue}
                        onChange={(e) => setNewPropValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleAddProperty();
                        }}
                      />
                      <button
                        type="button"
                        className="btn btn-square btn-primary btn-sm"
                        onClick={handleAddProperty}
                        disabled={!newPropKey.trim()}
                      >
                        +
                      </button>
                    </div>
                    <label className="label">
                      <span className="label-text-alt text-base-content/60">
                        {t("options.templates.propertiesHint")}
                      </span>
                    </label>
                  </div>

                  {/* Content */}
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text font-medium">
                        {t("options.templates.content")}
                      </span>
                    </label>
                    <textarea
                      className="textarea textarea-bordered h-32"
                      placeholder={t("options.templates.contentPlaceholder")}
                      value={selectedTemplate.content}
                      onChange={(e) =>
                        updateTemplateInSet(
                          selectedSetId,
                          selectedTemplateType,
                          { content: e.target.value }
                        )
                      }
                    />
                    <label className="label">
                      <span className="label-text-alt text-base-content/60">
                        {t("options.templates.contentHint")}
                      </span>
                    </label>
                  </div>

                  {/* LLM Settings */}
                  <div className="divider">{t("options.templates.llm")}</div>

                  <div className="form-control">
                    <label className="label cursor-pointer justify-start gap-4">
                      <input
                        type="checkbox"
                        className="toggle toggle-primary"
                        checked={selectedTemplate.useLLM}
                        onChange={(e) =>
                          updateTemplateInSet(
                            selectedSetId,
                            selectedTemplateType,
                            { useLLM: e.target.checked }
                          )
                        }
                      />
                      <span className="label-text font-medium">
                        {t("options.templates.useLLM")}
                      </span>
                    </label>
                    <label className="label pt-0">
                      <span className="label-text-alt text-base-content/60">
                        {t("options.templates.useLLMHint")}
                      </span>
                    </label>
                  </div>

                  {selectedTemplate.useLLM && (
                    <div className="ml-4 flex flex-col gap-4 border-l-2 border-base-100 pl-4">
                      <div className="form-control">
                        <label className="label">
                          <span className="label-text font-medium">
                            {t("options.templates.llmProviderOverride")}
                          </span>
                        </label>
                        <select
                          className="select select-bordered"
                          value={selectedTemplate.llmProvider || ""}
                          onChange={(e) => {
                            const newProvider = e.target.value || undefined;
                            updateTemplateInSet(
                              selectedSetId,
                              selectedTemplateType,
                              { llmProvider: newProvider, llmModel: undefined }
                            );
                          }}
                        >
                          <option value="">
                            {t("options.templates.useDefaultProvider")}
                          </option>
                          {LLM_PROVIDERS.map((provider) => (
                            <option key={provider} value={provider}>
                              {t(`options.llm.providers.${provider}`)}
                            </option>
                          ))}
                        </select>
                        <label className="label">
                          <span className="label-text-alt text-base-content/60">
                            {t("options.templates.llmProviderOverrideHint", {
                              provider: t(
                                `options.llm.providers.${llmSettings.provider}`
                              ),
                            })}
                          </span>
                        </label>
                      </div>

                      <div className="form-control">
                        <label className="label">
                          <span className="label-text font-medium">
                            {t("options.templates.llmModelOverride")}
                          </span>
                        </label>
                        <select
                          className="select select-bordered"
                          value={selectedTemplate.llmModel || ""}
                          onChange={(e) =>
                            updateTemplateInSet(
                              selectedSetId,
                              selectedTemplateType,
                              { llmModel: e.target.value || undefined }
                            )
                          }
                        >
                          <option value="">
                            {t("options.templates.useDefaultModel")}
                          </option>
                          <optgroup label={t("options.llm.availableModels")}>
                            {getAvailableModels(
                              (selectedTemplate.llmProvider as LLMProviderType) ||
                                llmSettings.provider,
                              llmSettings
                            ).map((model) => (
                              <option key={model} value={model}>
                                {model}
                              </option>
                            ))}
                          </optgroup>
                        </select>
                        <label className="label">
                          <span className="label-text-alt text-base-content/60">
                            {t("options.templates.llmModelOverrideHint", {
                              provider: t(
                                `options.llm.providers.${selectedTemplate.llmProvider || llmSettings.provider}`
                              ),
                            })}
                          </span>
                        </label>
                      </div>

                      <div className="form-control">
                        <label className="label cursor-pointer justify-start gap-4">
                          <input
                            type="checkbox"
                            className="checkbox-primary checkbox checkbox-sm"
                            checked={selectedTemplate.llmGenerateContent}
                            onChange={(e) =>
                              updateTemplateInSet(
                                selectedSetId,
                                selectedTemplateType,
                                { llmGenerateContent: e.target.checked }
                              )
                            }
                          />
                          <span className="label-text font-medium">
                            {t("options.templates.llmGenerateContent")}
                          </span>
                        </label>
                        <label className="label pt-0">
                          <span className="label-text-alt text-base-content/60">
                            {t("options.templates.llmGenerateContentHint")}
                          </span>
                        </label>
                      </div>

                      {selectedTemplate.llmGenerateContent && (
                        <div className="form-control">
                          <label className="label">
                            <span className="label-text font-medium">
                              {t("options.templates.llmPrompt")}
                            </span>
                          </label>
                          <textarea
                            className="textarea textarea-bordered h-32 font-mono text-sm"
                            placeholder={t(
                              "options.templates.llmPromptPlaceholder"
                            )}
                            value={selectedTemplate.llmPrompt}
                            onChange={(e) =>
                              updateTemplateInSet(
                                selectedSetId,
                                selectedTemplateType,
                                { llmPrompt: e.target.value }
                              )
                            }
                          />
                          <label className="label">
                            <span className="label-text-alt text-base-content/60">
                              {t("options.templates.llmPromptHint")}
                            </span>
                          </label>
                        </div>
                      )}

                      <div className="form-control">
                        <label className="label cursor-pointer justify-start gap-4">
                          <input
                            type="checkbox"
                            className="checkbox-primary checkbox checkbox-sm"
                            checked={selectedTemplate.llmGenerateTags}
                            onChange={(e) =>
                              updateTemplateInSet(
                                selectedSetId,
                                selectedTemplateType,
                                { llmGenerateTags: e.target.checked }
                              )
                            }
                          />
                          <span className="label-text font-medium">
                            {t("options.templates.llmGenerateTags")}
                          </span>
                        </label>
                        <label className="label pt-0">
                          <span className="label-text-alt text-base-content/60">
                            {t("options.templates.llmGenerateTagsHint")}
                          </span>
                        </label>
                      </div>

                      {selectedTemplate.llmGenerateTags && (
                        <div className="form-control">
                          <label className="label">
                            <span className="label-text font-medium">
                              {t("options.templates.llmTagsPrompt")}
                            </span>
                          </label>
                          <textarea
                            className="textarea textarea-bordered h-32 font-mono text-sm"
                            placeholder={t(
                              "options.templates.llmTagsPromptPlaceholder"
                            )}
                            value={selectedTemplate.llmTagsPrompt}
                            onChange={(e) =>
                              updateTemplateInSet(
                                selectedSetId,
                                selectedTemplateType,
                                { llmTagsPrompt: e.target.value }
                              )
                            }
                          />
                          <label className="label">
                            <span className="label-text-alt text-base-content/60">
                              {t("options.templates.llmTagsPromptHint")}
                            </span>
                          </label>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-base-content/60">
              {t("options.templates.selectSet")}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderVariablesTab = () => (
    <div className="flex flex-col gap-6">
      {/* Usage Guide - Full Width on Top */}
      <div className="rounded-xl bg-base-300 p-4">
        <h3 className="mb-3 text-lg font-medium">
          {t("options.variables.usage")}
        </h3>
        <p className="mb-4 text-sm text-base-content/80">
          {t("options.variables.description")}
        </p>
        <div className="rounded-lg bg-base-100 p-3">
          <div className="mb-1 text-xs font-medium text-base-content/60">
            {t("options.variables.example")}
          </div>
          <code className="text-sm">{t("options.variables.exampleUsage")}</code>
        </div>
      </div>

      {/* Variables Grid - 3 Columns */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {/* Web Variables */}
        <div className="rounded-xl bg-base-300 p-4">
          <h3 className="mb-3 text-lg font-medium">
            {t("options.variables.builtInWeb")}
            <span className="ml-2 text-sm font-normal text-base-content/60">
              ({webVariables.length})
            </span>
          </h3>
          <div className="flex flex-col gap-2">
            {webVariables.map((varName) => (
              <div key={varName} className="flex items-center gap-3">
                <code className="min-w-24 shrink-0 break-all rounded bg-base-100 px-2 py-1 text-sm text-primary">
                  {`{{${varName}}}`}
                </code>
                <span className="text-sm text-base-content/70">
                  {t(`options.variables.vars.${varName}.description`)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* YouTube Variables */}
        <div className="rounded-xl bg-base-300 p-4">
          <h3 className="mb-3 text-lg font-medium">
            {t("options.variables.builtInYouTube")}
            <span className="ml-2 text-sm font-normal text-base-content/60">
              ({youtubeVariables.length})
            </span>
          </h3>
          <div className="flex flex-col gap-2">
            {youtubeVariables.map((varName) => (
              <div key={varName} className="flex items-center gap-3">
                <code className="min-w-24 shrink-0 break-all rounded bg-base-100 px-2 py-1 text-sm text-primary">
                  {`{{${varName}}}`}
                </code>
                <span className="text-sm text-base-content/70">
                  {t(`options.variables.vars.${varName}.description`)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Custom Variables */}
        <div className="overflow-hidden rounded-xl bg-base-300 p-4">
          <h3 className="mb-3 text-lg font-medium">
            {t("options.variables.custom")}
            {customVariables.length > 0 && (
              <span className="ml-2 text-sm font-normal text-base-content/60">
                ({customVariables.length})
              </span>
            )}
          </h3>

          {customVariables.length > 0 ? (
            <div className="mb-4 flex flex-col gap-3">
              {customVariables.map((variable) => (
                <div key={variable.name} className="flex flex-col gap-1">
                  <div className="flex items-start justify-between gap-2">
                    <code className="break-all rounded bg-base-100 px-2 py-1 text-sm text-secondary">
                      {`{{${variable.name}}}`}
                    </code>
                    <button
                      type="button"
                      className="btn btn-square btn-ghost btn-xs shrink-0 text-error"
                      onClick={() => handleDeleteVariable(variable.name)}
                      title={t("options.variables.customDelete")}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-3.5 w-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                  <input
                    type="text"
                    className="input input-sm input-bordered w-full"
                    value={variable.value}
                    onChange={(e) =>
                      handleUpdateVariableValue(variable.name, e.target.value)
                    }
                    placeholder={t("options.variables.customValuePlaceholder")}
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="mb-4 text-sm text-base-content/60">
              {t("options.variables.customEmpty")}
            </p>
          )}

          <div className="flex flex-col gap-2">
            <input
              type="text"
              className={`input input-sm input-bordered w-full ${varNameError ? "input-error" : ""}`}
              placeholder={t("options.variables.customNamePlaceholder")}
              value={newVarName}
              onChange={(e) => {
                setNewVarName(e.target.value);
                setVarNameError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleAddVariable();
                }
              }}
            />
            <div className="flex items-center gap-2">
              <input
                type="text"
                className="input input-sm input-bordered min-w-0 flex-1"
                placeholder={t("options.variables.customValuePlaceholder")}
                value={newVarValue}
                onChange={(e) => setNewVarValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleAddVariable();
                  }
                }}
              />
              <button
                type="button"
                className="btn btn-square btn-primary btn-sm shrink-0"
                onClick={handleAddVariable}
                disabled={!newVarName.trim()}
                title={t("options.variables.customAdd")}
              >
                +
              </button>
            </div>
            {varNameError && (
              <p className="text-xs text-error">{varNameError}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const handleAddModel = (
    provider: "openai" | "azure-openai" | "claude" | "gemini" | "ollama"
  ) => {
    const model = newCustomModel.trim();
    if (!model) return;

    const allModels = getAvailableModels(provider, llmSettings);
    if (allModels.includes(model)) {
      setNewCustomModel("");
      return;
    }

    switch (provider) {
      case "openai":
        setLlmSettings({
          ...llmSettings,
          openai: {
            ...llmSettings.openai,
            models: [...llmSettings.openai.models, model],
          },
        });
        break;
      case "azure-openai":
        setLlmSettings({
          ...llmSettings,
          azureOpenai: {
            ...llmSettings.azureOpenai,
            models: [...llmSettings.azureOpenai.models, model],
          },
        });
        break;
      case "claude":
        setLlmSettings({
          ...llmSettings,
          claude: {
            ...llmSettings.claude,
            models: [...llmSettings.claude.models, model],
          },
        });
        break;
      case "gemini":
        setLlmSettings({
          ...llmSettings,
          gemini: {
            ...llmSettings.gemini,
            models: [...llmSettings.gemini.models, model],
          },
        });
        break;
      case "ollama":
        setLlmSettings({
          ...llmSettings,
          ollama: {
            ...llmSettings.ollama,
            models: [...llmSettings.ollama.models, model],
          },
        });
        break;
    }
    setNewCustomModel("");
  };

  const handleRemoveModel = (
    provider: "openai" | "azure-openai" | "claude" | "gemini" | "ollama",
    model: string
  ) => {
    switch (provider) {
      case "openai":
        setLlmSettings({
          ...llmSettings,
          openai: {
            ...llmSettings.openai,
            models: llmSettings.openai.models.filter(
              (m: string) => m !== model
            ),
          },
        });
        break;
      case "azure-openai":
        setLlmSettings({
          ...llmSettings,
          azureOpenai: {
            ...llmSettings.azureOpenai,
            models: llmSettings.azureOpenai.models.filter(
              (m: string) => m !== model
            ),
          },
        });
        break;
      case "claude":
        setLlmSettings({
          ...llmSettings,
          claude: {
            ...llmSettings.claude,
            models: llmSettings.claude.models.filter(
              (m: string) => m !== model
            ),
          },
        });
        break;
      case "gemini":
        setLlmSettings({
          ...llmSettings,
          gemini: {
            ...llmSettings.gemini,
            models: llmSettings.gemini.models.filter(
              (m: string) => m !== model
            ),
          },
        });
        break;
      case "ollama":
        setLlmSettings({
          ...llmSettings,
          ollama: {
            ...llmSettings.ollama,
            models: llmSettings.ollama.models.filter(
              (m: string) => m !== model
            ),
          },
        });
        break;
    }
  };

  const handleSetDefaultModel = (
    provider: "openai" | "azure-openai" | "claude" | "gemini" | "ollama",
    model: string | undefined
  ) => {
    switch (provider) {
      case "openai":
        setLlmSettings({
          ...llmSettings,
          openai: { ...llmSettings.openai, defaultModel: model },
        });
        break;
      case "azure-openai":
        setLlmSettings({
          ...llmSettings,
          azureOpenai: { ...llmSettings.azureOpenai, defaultModel: model },
        });
        break;
      case "claude":
        setLlmSettings({
          ...llmSettings,
          claude: { ...llmSettings.claude, defaultModel: model },
        });
        break;
      case "gemini":
        setLlmSettings({
          ...llmSettings,
          gemini: { ...llmSettings.gemini, defaultModel: model },
        });
        break;
      case "ollama":
        setLlmSettings({
          ...llmSettings,
          ollama: { ...llmSettings.ollama, defaultModel: model },
        });
        break;
    }
  };

  const getProviderDefaultModel = (
    provider: "openai" | "azure-openai" | "claude" | "gemini" | "ollama"
  ): string | undefined => {
    switch (provider) {
      case "openai":
        return llmSettings.openai.defaultModel;
      case "azure-openai":
        return llmSettings.azureOpenai.defaultModel;
      case "claude":
        return llmSettings.claude.defaultModel;
      case "gemini":
        return llmSettings.gemini.defaultModel;
      case "ollama":
        return llmSettings.ollama.defaultModel;
      default:
        return undefined;
    }
  };

  const renderModelList = (
    provider: "openai" | "azure-openai" | "claude" | "gemini" | "ollama",
    models: string[]
  ) => {
    const safeModels = models || [];
    const currentDefaultModel = getProviderDefaultModel(provider);
    return (
      <>
        {/* Available Models */}
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">
              {t("options.llm.availableModels")}
            </span>
          </label>
          <div className="mb-2 flex flex-wrap gap-1">
            {safeModels.map((model) => (
              <span key={model} className="badge badge-secondary gap-1">
                {model}
                <button
                  type="button"
                  className="hover:text-error"
                  onClick={() => handleRemoveModel(provider, model)}
                >
                  ×
                </button>
              </span>
            ))}
            {safeModels.length === 0 && (
              <span className="text-sm text-base-content/60">
                {t("options.templates.empty")}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              className="input input-sm input-bordered flex-1"
              placeholder={t("options.llm.addModelPlaceholder")}
              value={newCustomModel}
              onChange={(e) => setNewCustomModel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddModel(provider);
                }
              }}
            />
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => handleAddModel(provider)}
              disabled={!newCustomModel.trim()}
            >
              {t("options.llm.addModel")}
            </button>
          </div>
        </div>

        {/* Default Model */}
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">
              {t("options.llm.defaultModelLabel")}
            </span>
          </label>
          <select
            className="select select-bordered"
            value={currentDefaultModel || ""}
            onChange={(e) =>
              handleSetDefaultModel(provider, e.target.value || undefined)
            }
          >
            <option value="">{t("options.llm.selectModel")}</option>
            {safeModels.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
        </div>
      </>
    );
  };

  const renderLLMTab = () => {
    const isInDevelopment = (provider: LLMProviderType) =>
      IN_DEVELOPMENT_PROVIDERS.includes(provider);

    const renderDefaultCheckbox = (provider: LLMProviderType) => (
      <div className="form-control">
        <label className="label cursor-pointer justify-start gap-4">
          <input
            type="checkbox"
            className="checkbox-primary checkbox"
            checked={llmSettings.provider === provider}
            onChange={(e) => {
              if (e.target.checked) {
                setLlmSettings({ ...llmSettings, provider });
              }
            }}
          />
          <span className="label-text font-medium">
            {t("options.llm.setAsDefault")}
          </span>
        </label>
      </div>
    );

    const renderProviderSettings = () => {
      switch (viewingProvider) {
        case "openai":
          return (
            <div className="flex flex-col gap-4">
              {renderDefaultCheckbox("openai")}

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">
                    {t("options.llm.apiKey")}
                  </span>
                </label>
                <input
                  type="password"
                  className="input input-bordered"
                  placeholder={t("options.llm.apiKeyPlaceholder")}
                  value={llmSettings.openai.apiKey}
                  onChange={(e) =>
                    setLlmSettings({
                      ...llmSettings,
                      openai: { ...llmSettings.openai, apiKey: e.target.value },
                    })
                  }
                />
                <label className="label">
                  <span className="label-text-alt text-base-content/60">
                    {t("options.llm.openaiApiKeyHint")}
                  </span>
                </label>
              </div>

              {renderModelList("openai", llmSettings.openai.models)}

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">
                    {t("options.llm.baseUrl")}
                    <span className="ml-2 text-xs text-base-content/60">
                      ({t("options.llm.optional")})
                    </span>
                  </span>
                </label>
                <input
                  type="text"
                  className="input input-bordered"
                  placeholder="https://api.openai.com/v1"
                  value={llmSettings.openai.baseUrl || ""}
                  onChange={(e) =>
                    setLlmSettings({
                      ...llmSettings,
                      openai: {
                        ...llmSettings.openai,
                        baseUrl: e.target.value,
                      },
                    })
                  }
                />
                <label className="label">
                  <span className="label-text-alt text-base-content/60">
                    {t("options.llm.baseUrlHint")}
                  </span>
                </label>
              </div>
            </div>
          );

        case "azure-openai":
          return (
            <div className="flex flex-col gap-4">
              {renderDefaultCheckbox("azure-openai")}

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">
                    {t("options.llm.apiKey")}
                  </span>
                </label>
                <input
                  type="password"
                  className="input input-bordered"
                  placeholder={t("options.llm.apiKeyPlaceholder")}
                  value={llmSettings.azureOpenai.apiKey}
                  onChange={(e) =>
                    setLlmSettings({
                      ...llmSettings,
                      azureOpenai: {
                        ...llmSettings.azureOpenai,
                        apiKey: e.target.value,
                      },
                    })
                  }
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">
                    {t("options.llm.azureEndpoint")}
                  </span>
                </label>
                <input
                  type="text"
                  className="input input-bordered"
                  placeholder="https://your-resource.openai.azure.com"
                  value={llmSettings.azureOpenai.endpoint}
                  onChange={(e) =>
                    setLlmSettings({
                      ...llmSettings,
                      azureOpenai: {
                        ...llmSettings.azureOpenai,
                        endpoint: e.target.value,
                      },
                    })
                  }
                />
                <label className="label">
                  <span className="label-text-alt text-base-content/60">
                    {t("options.llm.azureEndpointHint")}
                  </span>
                </label>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">
                    {t("options.llm.azureApiVersion")}
                  </span>
                </label>
                <input
                  type="text"
                  className="input input-bordered"
                  placeholder="2024-02-15-preview"
                  value={llmSettings.azureOpenai.apiVersion}
                  onChange={(e) =>
                    setLlmSettings({
                      ...llmSettings,
                      azureOpenai: {
                        ...llmSettings.azureOpenai,
                        apiVersion: e.target.value,
                      },
                    })
                  }
                />
              </div>

              {renderModelList("azure-openai", llmSettings.azureOpenai.models)}
              <label className="label -mt-2">
                <span className="label-text-alt text-base-content/60">
                  {t("options.llm.azureModelHint")}
                </span>
              </label>
            </div>
          );

        case "claude":
          return (
            <div className="flex flex-col gap-4">
              {renderDefaultCheckbox("claude")}

              <div className="alert alert-warning">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 shrink-0 stroke-current"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <span>{t("options.llm.inDevelopment")}</span>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">
                    {t("options.llm.apiKey")}
                  </span>
                </label>
                <input
                  type="password"
                  className="input input-bordered"
                  placeholder={t("options.llm.apiKeyPlaceholder")}
                  value={llmSettings.claude.apiKey}
                  onChange={(e) =>
                    setLlmSettings({
                      ...llmSettings,
                      claude: { ...llmSettings.claude, apiKey: e.target.value },
                    })
                  }
                />
                <label className="label">
                  <span className="label-text-alt text-base-content/60">
                    {t("options.llm.claudeApiKeyHint")}
                  </span>
                </label>
              </div>

              {renderModelList("claude", llmSettings.claude.models)}
            </div>
          );

        case "gemini":
          return (
            <div className="flex flex-col gap-4">
              {renderDefaultCheckbox("gemini")}

              <div className="alert alert-warning">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 shrink-0 stroke-current"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <span>{t("options.llm.inDevelopment")}</span>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">
                    {t("options.llm.apiKey")}
                  </span>
                </label>
                <input
                  type="password"
                  className="input input-bordered"
                  placeholder={t("options.llm.apiKeyPlaceholder")}
                  value={llmSettings.gemini.apiKey}
                  onChange={(e) =>
                    setLlmSettings({
                      ...llmSettings,
                      gemini: { ...llmSettings.gemini, apiKey: e.target.value },
                    })
                  }
                />
              </div>

              {renderModelList("gemini", llmSettings.gemini.models)}
            </div>
          );

        case "ollama":
          return (
            <div className="flex flex-col gap-4">
              {renderDefaultCheckbox("ollama")}

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">
                    {t("options.llm.ollamaEndpoint")}
                  </span>
                </label>
                <input
                  type="text"
                  className="input input-bordered"
                  placeholder="http://localhost:11434"
                  value={llmSettings.ollama.endpoint}
                  onChange={(e) =>
                    setLlmSettings({
                      ...llmSettings,
                      ollama: {
                        ...llmSettings.ollama,
                        endpoint: e.target.value,
                      },
                    })
                  }
                />
                <label className="label">
                  <span className="label-text-alt text-base-content/60">
                    {t("options.llm.ollamaEndpointHint")}
                  </span>
                </label>
              </div>

              {renderModelList("ollama", llmSettings.ollama.models)}
            </div>
          );

        default:
          return null;
      }
    };

    return (
      <div className="flex flex-col gap-6">
        {/* Provider Selection */}
        <div className="rounded-xl bg-base-300 p-4">
          <h3 className="mb-4 text-lg font-medium">
            {t("options.llm.provider")}
          </h3>

          <div className="flex flex-wrap gap-2">
            {LLM_PROVIDERS.map((provider) => {
              const isViewing = viewingProvider === provider;
              const isDefault = llmSettings.provider === provider;
              const isDev = isInDevelopment(provider);
              return (
                <button
                  key={provider}
                  className={`btn gap-1 ${
                    isViewing ? "btn-primary" : "btn-outline"
                  }`}
                  onClick={() => setViewingProvider(provider)}
                >
                  {t(`options.llm.providers.${provider}`)}
                  {isDefault && (
                    <span className="badge badge-success badge-xs">
                      {t("options.llm.default")}
                    </span>
                  )}
                  {isDev && (
                    <span className="badge badge-warning badge-xs">
                      {t("options.llm.dev")}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Provider Settings */}
        <div className="rounded-xl bg-base-300 p-4">
          <h3 className="mb-4 text-lg font-medium">
            {t(`options.llm.providers.${viewingProvider}`)}{" "}
            {t("options.llm.settings")}
          </h3>
          {renderProviderSettings()}
        </div>
      </div>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "general":
        return renderGeneralTab();
      case "templates":
        return renderTemplatesTab();
      case "variables":
        return renderVariablesTab();
      case "llm":
        return renderLLMTab();
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
                      activeTab === tab.id
                        ? "!bg-primary font-medium !text-primary-content"
                        : "hover:bg-base-300"
                    }
                    onClick={() => setActiveTab(tab.id)}
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
