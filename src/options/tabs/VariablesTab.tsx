import type { OptionsStateReturn } from "../hooks/useOptionsState";

interface VariablesTabProps {
  state: OptionsStateReturn;
  t: (key: string) => string;
}

export function VariablesTab({ state, t }: VariablesTabProps) {
  const {
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
  } = state;

  return (
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
              onChange={(e) => setNewVarName(e.target.value)}
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
}
