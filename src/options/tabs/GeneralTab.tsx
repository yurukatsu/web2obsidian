import type { OptionsStateReturn } from "../hooks/useOptionsState";
import {
  OBSIDIAN_API_HTTPS_PORT,
  OBSIDIAN_API_HTTP_PORT,
} from "../../services/obsidian-api";

interface GeneralTabProps {
  state: OptionsStateReturn;
  t: (key: string, params?: Record<string, string>) => string;
}

export function GeneralTab({ state, t }: GeneralTabProps) {
  const {
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
  } = state;

  return (
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
            <label className="label cursor-pointer justify-start gap-4">
              <input
                type="checkbox"
                className="toggle toggle-primary toggle-sm"
                checked={obsidianApiSettings.enabled}
                onChange={(e) =>
                  setObsidianApiSettings({
                    ...obsidianApiSettings,
                    enabled: e.target.checked,
                  })
                }
              />
              <span className="label-text font-medium">
                {t("options.obsidianApi.enabled")}
              </span>
            </label>
            <label className="label pt-0">
              <span className="label-text-alt text-base-content/60">
                {t("options.obsidianApi.enabledHint")}
              </span>
            </label>
          </div>

          {obsidianApiSettings.enabled && (
            <>
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
            </>
          )}
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
}
