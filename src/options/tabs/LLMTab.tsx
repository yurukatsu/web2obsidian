import type { OptionsStateReturn } from "../hooks/useOptionsState";
import {
  LLMProviderType,
  LLM_PROVIDERS,
  IN_DEVELOPMENT_PROVIDERS,
} from "../../types/llm";

interface LLMTabProps {
  state: OptionsStateReturn;
  t: (key: string) => string;
}

export function LLMTab({ state, t }: LLMTabProps) {
  const {
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
  } = state;

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
}
