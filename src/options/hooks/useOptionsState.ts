import { useState, useEffect, useRef, useCallback } from "react";
import type {
  Template,
  TemplateSet,
  TemplateSettings,
  TemplateProperty,
  PropertyInputType,
} from "../../types/template";
import {
  createDefaultTemplateSettings,
  createNewTemplateSet,
  type LegacyTemplateSettings,
  type LegacyTemplateSettingsV2,
  migrateTemplateSettings,
  migrateTemplateSettingsV2,
} from "../../types/template";
import type { LLMSettings, LLMProviderType } from "../../types/llm";
import { createDefaultLLMSettings, getAvailableModels } from "../../types/llm";
import type { ObsidianApiSettings } from "../../services/obsidian-api";
import {
  createDefaultObsidianApiSettings,
  testObsidianConnection,
} from "../../services/obsidian-api";

export interface CustomVariable {
  name: string;
  value: string;
}

export type SaveStatus = "idle" | "saving" | "saved" | "error";
export type TabId = "general" | "templates" | "variables" | "llm";

export function useOptionsState(
  t: (key: string, params?: Record<string, string>) => string
) {
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
  );
  const [newPropKey, setNewPropKey] = useState("");
  const [newPropValue, setNewPropValue] = useState("");
  const [newPropType, setNewPropType] = useState<PropertyInputType>("text");
  const [newCustomModel, setNewCustomModel] = useState("");
  const [listItemInputs, setListItemInputs] = useState<Record<string, string>>(
    {}
  );
  const isInitialized = useRef(false);
  const syncSaveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const localSaveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const pendingSyncDataRef = useRef<Record<string, unknown>>({});
  const pendingLocalDataRef = useRef<Record<string, unknown>>({});

  // ==========================================================================
  // Settings Load
  // ==========================================================================

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const syncResult = await chrome.storage.sync.get([
          "vaultName",
          "customVariables",
          "llmSettings",
          "obsidianApiSettings",
        ]);

        setVaultName(syncResult.vaultName || "");
        setCustomVariables(syncResult.customVariables || []);

        if (syncResult.llmSettings) {
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
            await chrome.storage.local.set({
              templateSettings: templateData,
            });
            await chrome.storage.sync.remove(["templateSettings"]);
          }
        }

        if (templateData) {
          const stored = templateData;
          if (stored.sets && stored.defaultSetId) {
            setTemplateSettings(stored);
          } else if (stored.defaultSet) {
            const migrated = migrateTemplateSettingsV2(
              stored as LegacyTemplateSettingsV2
            );
            setTemplateSettings(migrated);
          } else if (stored.templates) {
            const migrated = migrateTemplateSettings(
              stored as LegacyTemplateSettings
            );
            setTemplateSettings(migrated);
          } else {
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

  // ==========================================================================
  // Auto-save
  // ==========================================================================

  const saveToSyncStorage = useCallback((data: Record<string, unknown>) => {
    // Accumulate pending changes so rapid updates don't overwrite each other
    pendingSyncDataRef.current = { ...pendingSyncDataRef.current, ...data };

    if (syncSaveTimeoutRef.current) {
      clearTimeout(syncSaveTimeoutRef.current);
    }

    syncSaveTimeoutRef.current = setTimeout(() => {
      const pendingData = pendingSyncDataRef.current;
      pendingSyncDataRef.current = {};
      setSaveStatus("saving");
      console.log(
        "[Web2Obsidian] Saving to sync storage:",
        Object.keys(pendingData)
      );
      chrome.storage.sync.set(pendingData, () => {
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

  const saveToLocalStorage = useCallback((data: Record<string, unknown>) => {
    // Accumulate pending changes so rapid updates don't overwrite each other
    pendingLocalDataRef.current = { ...pendingLocalDataRef.current, ...data };

    if (localSaveTimeoutRef.current) {
      clearTimeout(localSaveTimeoutRef.current);
    }

    localSaveTimeoutRef.current = setTimeout(() => {
      const pendingData = pendingLocalDataRef.current;
      pendingLocalDataRef.current = {};
      setSaveStatus("saving");
      console.log(
        "[Web2Obsidian] Saving to local storage:",
        Object.keys(pendingData)
      );
      if (pendingData.templateSettings) {
        const ts = pendingData.templateSettings as TemplateSettings;
        console.log("[Web2Obsidian] Template sets being saved:", {
          sets: ts.sets?.map((s) => s.name),
          defaultSetId: ts.defaultSetId,
        });
      }
      chrome.storage.local.set(pendingData, () => {
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

  // Flush pending saves immediately when leaving the page
  useEffect(() => {
    const flushPendingSaves = () => {
      const syncData = pendingSyncDataRef.current;
      const localData = pendingLocalDataRef.current;

      if (Object.keys(syncData).length > 0) {
        if (syncSaveTimeoutRef.current)
          clearTimeout(syncSaveTimeoutRef.current);
        pendingSyncDataRef.current = {};
        chrome.storage.sync.set(syncData);
      }
      if (Object.keys(localData).length > 0) {
        if (localSaveTimeoutRef.current)
          clearTimeout(localSaveTimeoutRef.current);
        pendingLocalDataRef.current = {};
        chrome.storage.local.set(localData);
      }
    };

    window.addEventListener("beforeunload", flushPendingSaves);
    return () => window.removeEventListener("beforeunload", flushPendingSaves);
  }, []);

  // ==========================================================================
  // Built-in variables
  // ==========================================================================

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

  // ==========================================================================
  // Template set getters
  // ==========================================================================

  const getAllSets = (): TemplateSet[] => {
    return templateSettings.sets;
  };

  const getSelectedSet = (): TemplateSet | null => {
    return templateSettings.sets.find((s) => s.id === selectedSetId) || null;
  };

  const getSelectedTemplate = (): Template | null => {
    const set = getSelectedSet();
    if (!set) return null;
    return selectedTemplateType === "web"
      ? set.webTemplate
      : set.youtubeTemplate;
  };

  // ==========================================================================
  // Template set handlers
  // ==========================================================================

  const updateTemplateSet = (setId: string, updates: Partial<TemplateSet>) => {
    setTemplateSettings({
      ...templateSettings,
      sets: templateSettings.sets.map((s) =>
        s.id === setId ? { ...s, ...updates } : s
      ),
    });
  };

  const handleAddSet = () => {
    const newSet = createNewTemplateSet(`Set ${templateSettings.sets.length}`);
    setTemplateSettings({
      ...templateSettings,
      sets: [...templateSettings.sets, newSet],
    });
    setSelectedSetId(newSet.id);
  };

  const handleDeleteSet = (setId: string) => {
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
    setSelectedSetId(templateSettings.defaultSetId);
  };

  const handleSetAsDefault = (setId: string) => {
    setTemplateSettings({
      ...templateSettings,
      defaultSetId: setId,
    });
  };

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

  // ==========================================================================
  // Shortcut handlers
  // ==========================================================================

  const handleSetShortcutKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    setId: string
  ) => {
    e.preventDefault();
    e.stopPropagation();

    if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) {
      return;
    }

    const parts: string[] = [];
    if (e.ctrlKey || e.metaKey) parts.push("Ctrl");
    if (e.shiftKey) parts.push("Shift");
    if (e.altKey) parts.push("Alt");

    let key = e.key;
    if (key.length === 1) {
      key = key.toUpperCase();
    } else if (key === " ") {
      key = "Space";
    } else if (key === "Escape") {
      setRecordingShortcut(null);
      return;
    }
    parts.push(key);

    const shortcutKey = parts.join("+");
    updateTemplateSet(setId, { shortcutKey });
    setRecordingShortcut(null);
  };

  const clearSetShortcutKey = (setId: string) => {
    updateTemplateSet(setId, { shortcutKey: null });
  };

  // ==========================================================================
  // Property handlers
  // ==========================================================================

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

  // List/tags helpers
  const parseListValue = (value: string): string[] => {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [value];
    } catch {
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

  // ==========================================================================
  // Custom variable handlers
  // ==========================================================================

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

  // ==========================================================================
  // Vault handlers
  // ==========================================================================

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

  // ==========================================================================
  // Import/Export
  // ==========================================================================

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

        if (!importData.settings || typeof importData.settings !== "object") {
          alert(t("options.importExport.invalidFile"));
          return;
        }

        if (!confirm(t("options.importExport.confirmImport"))) {
          return;
        }

        chrome.storage.sync.set(importData.settings, () => {
          if (chrome.runtime.lastError) {
            console.error(
              "Failed to import settings:",
              chrome.runtime.lastError
            );
            alert(t("options.importExport.importError"));
            return;
          }
          window.location.reload();
        });
      } catch (error) {
        console.error("Failed to parse import file:", error);
        alert(t("options.importExport.invalidFile"));
      }
    };
    input.click();
  };

  // ==========================================================================
  // Obsidian API test
  // ==========================================================================

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

  // ==========================================================================
  // LLM model management
  // ==========================================================================

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

    const providerKeyMap = {
      openai: "openai",
      "azure-openai": "azureOpenai",
      claude: "claude",
      gemini: "gemini",
      ollama: "ollama",
    } as const;

    const key = providerKeyMap[provider];
    setLlmSettings({
      ...llmSettings,
      [key]: {
        ...llmSettings[key],
        models: [...llmSettings[key].models, model],
      },
    });
    setNewCustomModel("");
  };

  const handleRemoveModel = (
    provider: "openai" | "azure-openai" | "claude" | "gemini" | "ollama",
    model: string
  ) => {
    const providerKeyMap = {
      openai: "openai",
      "azure-openai": "azureOpenai",
      claude: "claude",
      gemini: "gemini",
      ollama: "ollama",
    } as const;

    const key = providerKeyMap[provider];
    setLlmSettings({
      ...llmSettings,
      [key]: {
        ...llmSettings[key],
        models: llmSettings[key].models.filter((m: string) => m !== model),
      },
    });
  };

  const handleSetDefaultModel = (
    provider: "openai" | "azure-openai" | "claude" | "gemini" | "ollama",
    model: string | undefined
  ) => {
    const providerKeyMap = {
      openai: "openai",
      "azure-openai": "azureOpenai",
      claude: "claude",
      gemini: "gemini",
      ollama: "ollama",
    } as const;

    const key = providerKeyMap[provider];
    setLlmSettings({
      ...llmSettings,
      [key]: { ...llmSettings[key], defaultModel: model },
    });
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

  // ==========================================================================
  // Return
  // ==========================================================================

  return {
    // Tab state
    activeTab,
    setActiveTab,
    saveStatus,

    // General tab
    vaultName,
    setVaultName,
    browseSupported,
    handleBrowseVault,
    handleTestConnection,
    obsidianApiSettings,
    setObsidianApiSettings,
    apiTestStatus,
    apiTestError,
    handleTestObsidianApi,
    handleExportSettings,
    handleImportSettings,

    // Templates tab
    templateSettings,
    selectedSetId,
    setSelectedSetId,
    selectedTemplateType,
    setSelectedTemplateType,
    recordingShortcut,
    setRecordingShortcut,
    newPropKey,
    setNewPropKey,
    newPropValue,
    setNewPropValue,
    newPropType,
    setNewPropType,
    listItemInputs,
    setListItemInputs,
    getAllSets,
    getSelectedSet,
    getSelectedTemplate,
    handleAddSet,
    handleDeleteSet,
    handleSetAsDefault,
    updateTemplateSet,
    updateTemplateInSet,
    handleSetShortcutKeyDown,
    clearSetShortcutKey,
    handleAddProperty,
    handleDeleteProperty,
    handleUpdateProperty,
    handleUpdatePropertyType,
    handleMoveProperty,
    parseListValue,
    handleAddListItem,
    handleRemoveListItem,

    // Variables tab
    webVariables,
    youtubeVariables,
    customVariables,
    newVarName,
    setNewVarName,
    newVarValue,
    setNewVarValue,
    varNameError,
    handleAddVariable,
    handleDeleteVariable,
    handleUpdateVariableValue,

    // LLM tab
    llmSettings,
    setLlmSettings,
    viewingProvider,
    setViewingProvider,
    newCustomModel,
    setNewCustomModel,
    handleAddModel,
    handleRemoveModel,
    handleSetDefaultModel,
    getProviderDefaultModel,
  };
}

export type OptionsStateReturn = ReturnType<typeof useOptionsState>;
