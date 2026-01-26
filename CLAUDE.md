# CLAUDE.md - Web2Obsidian Development Guide

This file serves as a reference for Claude Code when resuming development.

## Project Overview

Web2Obsidian is a Chrome extension for clipping web pages and YouTube videos to Obsidian with AI-powered summarization.

## Directory Structure

```
src/
├── background/          # Service worker (background script)
│   └── index.ts         # Message handlers, context menus, clip task processing
├── components/          # Shared React components
│   ├── index.ts         # Component exports
│   ├── icons.tsx        # Icon components (GearIcon, etc.)
│   ├── Alert.tsx        # Alert component
│   ├── ThemeToggle.tsx  # Dark/Light theme toggle
│   ├── LanguageToggle.tsx # Language toggle (flag emojis)
│   ├── ProgressStep.tsx # Progress step indicator
│   ├── TaskItem.tsx     # Task history item
│   └── RunningTaskItem.tsx # Running task with progress
├── content/             # Content script
│   └── index.ts         # Page extraction, keyboard shortcuts, toast
├── options/             # Settings page
│   └── Options.tsx      # Main settings component (~2000 lines)
├── popup/               # Popup UI
│   └── Popup.tsx        # Main popup component
├── services/            # API services
│   ├── llm.ts           # LLM API calls (OpenAI, Azure, Ollama)
│   └── obsidian-api.ts  # Obsidian Local REST API client
├── types/               # TypeScript type definitions
│   ├── llm.ts           # LLM provider types
│   ├── template.ts      # Template types
│   └── task.ts          # Task/history types
├── i18n/
│   ├── index.ts         # i18next configuration
│   └── locales/
│       ├── en.json      # English translations
│       └── ja.json      # Japanese translations
├── utils/
│   └── index.ts         # Template processing, utilities
└── styles/
    └── globals.css      # TailwindCSS + DaisyUI styles
```

## Key Features

### Implemented
- **Web Page Clipping**: Extract content via Readability, save to Obsidian
- **YouTube Clipping**: Extract video metadata and transcripts
- **LLM Integration**: Content summarization and tag generation
- **Template System**: Customizable templates with variables
- **Template Sets**: Multiple configurations with keyboard shortcuts
- **Context Menu**: Right-click to clip with template selection
- **Connection Status**: Real-time Obsidian connection indicator in popup
- **Auto-open Obsidian**: Prompt to open when not running

### In Development
- Claude API integration
- Gemini API integration

## Key Files

### `src/background/index.ts`
Service worker handling:
- Context menu creation and clicks
- Message handlers (CLIP_PAGE, CHECK_OBSIDIAN_CONNECTION, etc.)
- Clip task processing with progress updates
- Obsidian connection checking and retry logic

### `src/content/index.ts`
Content script handling:
- Page info extraction (Readability for content)
- YouTube transcript extraction
- Keyboard shortcut handling
- Toast notifications

### `src/services/obsidian-api.ts`
Obsidian Local REST API client:
- `saveToObsidian()`: Save note via PUT /vault/{path}
- `testObsidianConnection()`: Check API connectivity
- `openObsidianVaultFromServiceWorker()`: Open vault via URI scheme

### `src/types/llm.ts`
LLM provider types:
- `LLMProviderType`: "openai" | "azure-openai" | "claude" | "gemini" | "ollama"
- `IN_DEVELOPMENT_PROVIDERS`: ["claude", "gemini"]
- Provider settings interfaces

### `src/types/template.ts`
Template types:
- `Template`: Structure with folder, filename, properties, content, LLM settings
- `TemplateSet`: Collection of templates with keyboard shortcut
- `PropertyInputType`: "text" | "list" | "checkbox" | "date" | "datetime" | "number" | "tags"

## Message Types

Communication between popup/content and background:

| Message | Description |
|---------|-------------|
| `CLIP_PAGE` | Start clip task (from popup) |
| `CLIP_WITH_CONNECTION_CHECK` | Clip with connection check (from content script) |
| `CHECK_OBSIDIAN_CONNECTION` | Check if Obsidian is connected |
| `OPEN_OBSIDIAN` | Open Obsidian vault |
| `GET_TASKS` | Get task history |
| `TASK_UPDATE` | Task progress update (broadcast) |

## Storage

| Key | Storage | Description |
|-----|---------|-------------|
| `vaultName` | sync | Obsidian vault name |
| `obsidianApiSettings` | sync | API key, port, insecure mode |
| `llmSettings` | sync | LLM provider settings |
| `language` | sync | UI language (en/ja) |
| `theme` | sync | UI theme (light/dark) |
| `templateSettings` | local | Template sets and defaults |
| `taskHistory` | local | Recent clip tasks |

## Commands

```bash
npm run dev      # Development build (watch)
npm run build    # Production build
npm run test     # Run tests
npm run lint     # ESLint
```

## Architecture Notes

1. **Connection Flow**:
   - Popup checks connection on load
   - Shows indicator (green/red/yellow dot)
   - Disables clip button if not connected
   - Context menu/shortcuts prompt to open Obsidian if not connected

2. **Clip Flow**:
   - Check connection → Extract page info → LLM processing (optional) → Save to Obsidian
   - Progress updates sent via `TASK_UPDATE` message
   - Toast notification on completion

3. **Template Processing**:
   - Variables replaced: `{{title}}`, `{{url}}`, `{{content}}`, etc.
   - Properties converted to YAML frontmatter
   - LLM can generate content and/or tags

## Localization

Update both `en.json` and `ja.json` when adding UI text:
```json
// Structure
{
  "popup": { ... },
  "options": { ... },
  "toast": { ... },
  "contextMenu": { ... }
}
```

## Tech Stack

- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite + CRXJS
- **Styling**: TailwindCSS + DaisyUI
- **i18n**: i18next
- **Extension**: Chrome Extension Manifest V3
