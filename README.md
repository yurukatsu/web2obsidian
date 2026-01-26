<p align="center">
  <img src="docs/images/logo.svg" alt="Web2Obsidian Logo" width="128" height="128">
</p>

# Web2Obsidian

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension%20MV3-4285F4?logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/mv3/)
[![Obsidian](https://img.shields.io/badge/Obsidian-Plugin-7C3AED?logo=obsidian&logoColor=white)](https://obsidian.md/)

[日本語](README.ja.md)

A Chrome extension for clipping web pages and YouTube videos to Obsidian with AI-powered summarization.

## Features

- **Web Page Clipping**: Save any web page to Obsidian in markdown format
- **YouTube Video Clipping**: Save YouTube video metadata and transcripts
- **LLM Integration**: Use AI to summarize content and auto-generate tags
- **Template System**: Customize note structure with flexible templates
- **Template Sets**: Create multiple template configurations with keyboard shortcuts
- **Right-click Context Menu**: Quick access to clipping from any page
- **Connection Status**: Real-time Obsidian connection indicator
- **Multilingual**: English and Japanese support

## Screenshots

![Web2Obsidian Screenshot](docs/images/screenshot.png)

## Requirements

- Chrome browser (or Chromium-based browsers)
- [Obsidian](https://obsidian.md/)
- [Obsidian Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api) plugin

## Supported LLM Providers

| Provider | Status |
|----------|--------|
| OpenAI | ✅ Supported |
| Azure OpenAI | ✅ Supported |
| Ollama | ✅ Supported |
| Claude | 🚧 In Development |
| Gemini | 🚧 In Development |

## Installation

### From Source

```bash
# Clone the repository
git clone https://github.com/yourusername/web2obsidian.git
cd web2obsidian

# Install dependencies
npm install

# Build for production
npm run build
```

After building, load the `dist` folder in Chrome:
1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `dist` folder

## Configuration

### 1. Obsidian Setup

1. Install the [Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api) plugin in Obsidian
2. Enable the plugin and copy your API key
3. Note the port number (default: 27124 for HTTPS)

### 2. Extension Setup

1. Click the Web2Obsidian icon in Chrome toolbar
2. Go to Settings
3. Enter your Vault name and API key
4. Configure your preferred LLM provider (optional)

### LLM Provider Setup

1. Open the "LLM Provider" tab in settings
2. Select a provider and configure the API key
3. Add/remove available models
4. Select the default model
5. Check "Set as default provider" to use this provider

### Templates

Templates support the following variables:

#### Web Variables
| Variable | Description |
|----------|-------------|
| `{{title}}` | Page title |
| `{{url}}` | Page URL |
| `{{domain}}` | Domain name |
| `{{description}}` | Page description |
| `{{author}}` | Author |
| `{{published}}` | Published date |
| `{{content}}` | Page content |
| `{{selection}}` | Selected text |

#### YouTube Variables
| Variable | Description |
|----------|-------------|
| `{{title}}` | Video title |
| `{{url}}` | Video URL |
| `{{channel}}` | Channel name |
| `{{videoId}}` | Video ID |
| `{{duration}}` | Video duration |
| `{{transcript}}` | Transcript |

#### Date/Time Variables
| Variable | Description |
|----------|-------------|
| `{{date}}` | Current date (YYYY-MM-DD) |
| `{{time}}` | Current time (HH:mm) |
| `{{datetime}}` | Date and time (YYYY-MM-DD HH:mm) |
| `{{year}}` | Year (YYYY) |
| `{{month}}` | Month (MM) |
| `{{day}}` | Day (DD) |

## Usage

### Popup
Click the extension icon to open the popup. If connected to Obsidian, click "Clip to Obsidian" to save the current page.

### Keyboard Shortcuts
Configure custom keyboard shortcuts for each template set in Settings > Templates.

### Right-click Menu
Right-click on any page to access "Clip to Obsidian" from the context menu. If you have multiple template sets, you can choose which one to use.

## Development

```bash
# Start development server (watch mode)
npm run dev

# Build for production
npm run build

# Run tests
npm run test

# Lint
npm run lint
```

## Tech Stack

- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite + CRXJS
- **Styling**: TailwindCSS + DaisyUI
- **i18n**: i18next
- **Extension**: Chrome Extension Manifest V3

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Obsidian](https://obsidian.md/) - The knowledge management app
- [Obsidian Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api) - REST API plugin for Obsidian
- [CRXJS](https://crxjs.dev/) - Chrome Extension Vite Plugin
