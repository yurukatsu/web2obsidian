# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Web2Obsidian is a Chrome extension (Manifest V3) for clipping web pages and YouTube videos to Obsidian with AI-powered summarization. Built with React 18, TypeScript, Vite, and CRXJS.

## Commands

```bash
npm run dev           # Vite dev server with HMR (port 5173)
npm run build         # tsc + vite build → dist/
npm run test          # Vitest in watch mode
npm run test -- --run # Single test run (used by pre-push hook)
npm run test:coverage # Coverage report (v8: text/json/html)
npm run lint          # ESLint (ts,tsx files)
npm run lint:fix      # ESLint with auto-fix
npm run format        # Prettier write
npm run type-check    # tsc --noEmit
```

To run a single test file: `npx vitest run src/utils/index.test.ts`

## Architecture

### Extension Entry Points

The manifest is defined programmatically in `src/manifest.ts` (CRXJS converts it to JSON during build).

| Entry Point | Files | Purpose |
|-------------|-------|---------|
| Popup | `src/popup/index.html` → `main.tsx` → `Popup.tsx` | Extension toolbar popup |
| Options | `src/options/index.html` → `main.tsx` → `Options.tsx` | Full-page settings (open_in_tab) |
| Background | `src/background/index.ts` | Service worker: message routing, task processing, context menus |
| Content | `src/content/index.ts` | Injected on all pages: extraction, shortcuts, toast |

### Message-Based Communication

All cross-context communication uses `chrome.runtime.sendMessage()` with a `type` field. Background service worker is the central hub.

Key message types: `CLIP_PAGE`, `CLIP_WITH_CONNECTION_CHECK`, `CHECK_OBSIDIAN_CONNECTION`, `OPEN_OBSIDIAN`, `GET_TASKS`, `TASK_UPDATE` (broadcast from background to popup).

**Async pattern**: Handlers return `true` to keep the message channel open, then call `sendResponse()` after async work completes. Background broadcasts task progress via `TASK_UPDATE` messages (errors swallowed since popup may be closed).

### Clip Task Lifecycle

```
startClipTask() → creates task in storage → async runClipTask():
  extracting → [llm_content] → [llm_tags] → saving → done
```

Each step update broadcasts a `TASK_UPDATE` message. Task history is capped at 10 items in local storage.

### Storage Split

- **`chrome.storage.sync`**: Settings (vault, API keys, LLM config, language, theme) — syncs across devices, 100KB limit
- **`chrome.storage.local`**: Template sets and task history — larger data, device-local
- Migration logic in `src/background/index.ts` handles moving templates from sync→local (backward compat).

### Content Extraction

Two-layer approach: Defuddle library (primary, superior extraction) → basic DOM fallback. Markdown conversion via Turndown. YouTube pages get separate transcript extraction.

### LLM Provider System

- Types in `src/types/llm.ts`: `LLMProviderType` = `"openai" | "azure-openai" | "claude" | "gemini" | "ollama"`
- `IN_DEVELOPMENT_PROVIDERS`: `["claude", "gemini"]` — UI shows these as disabled
- `src/services/llm.ts`: Single `callLLM()` dispatcher routes to provider-specific functions
- Templates can override the default provider/model

### Template System

- Template variables: `{{title}}`, `{{url}}`, `{{content}}`, `{{domain}}`, `{{date}}`, `{{time}}`, etc.
- Template sets bundle web + YouTube templates together with a keyboard shortcut
- Properties are converted to YAML frontmatter
- Processing logic in `src/utils/index.ts`

### i18n Dual System

- React components: `useTranslation()` hook via i18next provider
- Background service worker: Direct JSON imports + `getLocalizedMessage()` helper (avoids async overhead)
- Locales: `src/i18n/locales/en.json` and `ja.json` — **always update both** when adding UI text

## Path Aliases

Configured in `vite.config.ts` and `tsconfig.json`:
- `@/*` → `src/*`, `@components/*` → `src/components/*`, `@utils/*` → `src/utils/*`, `@types/*` → `src/types/*`, `@i18n/*` → `src/i18n/*`, `@hooks/*` → `src/hooks/*`

## Testing

- Framework: Vitest with jsdom environment
- Chrome API mock: `src/test/setup.ts` stubs `chrome.*` globals (storage, runtime, tabs, scripting)
- Custom render: `src/test/utils.tsx` provides `renderWithProviders()` wrapping components with i18next
- Tests colocated: `*.test.ts` next to source files

## Git Hooks (Lefthook)

- **Pre-commit** (parallel): lint with auto-fix, format with auto-fix, typecheck (`tsc --noEmit`)
- **Pre-push**: full test suite (`npm run test -- --run`)

## Styling

TailwindCSS + DaisyUI. Custom theme configured in `tailwind.config.js` with purple primary (`#8766DA`). Global styles in `src/styles/globals.css`. Tailwind class sorting via `prettier-plugin-tailwindcss`.

## Key Conventions

- Console logs prefixed with `[Web2Obsidian]` for filtering
- ESLint allows `console.warn()` and `console.error()` only (no `console.log` in production)
- Unused variables use `_` prefix (ESLint configured)
- `@typescript-eslint/no-explicit-any` is warning level, not error
