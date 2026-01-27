import type { OptionsStateReturn } from "../hooks/useOptionsState";
import {
  PROPERTY_INPUT_TYPES,
  type PropertyInputType,
} from "../../types/template";
import {
  type LLMProviderType,
  LLM_PROVIDERS,
  getAvailableModels,
} from "../../types/llm";

interface TemplatesTabProps {
  state: OptionsStateReturn;
  t: (key: string, params?: Record<string, string>) => string;
}

export const TemplatesTab = ({ state, t }: TemplatesTabProps) => {
  const {
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
    llmSettings,
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
  } = state;

  const selectedSet = getSelectedSet();
  const selectedTemplate = getSelectedTemplate();

  return (
    <div className="flex h-full gap-6">
      {/* Template Sets Sidebar */}
      <div className="w-56 shrink-0">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-sm font-medium">{t("options.templates.sets")}</h4>
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
                      updateTemplateInSet(selectedSetId, selectedTemplateType, {
                        folder: e.target.value,
                      })
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
                      updateTemplateInSet(selectedSetId, selectedTemplateType, {
                        filename: e.target.value,
                      })
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
                            onClick={() => handleMoveProperty(propIndex, "up")}
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
                      updateTemplateInSet(selectedSetId, selectedTemplateType, {
                        content: e.target.value,
                      })
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
