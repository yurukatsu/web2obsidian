<p align="center">
  <img src="docs/images/logo.svg" alt="Web2Obsidian Logo" width="128" height="128">
</p>

# Web2Obsidian

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension%20MV3-4285F4?logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/mv3/)
[![Obsidian](https://img.shields.io/badge/Obsidian-Plugin-7C3AED?logo=obsidian&logoColor=white)](https://obsidian.md/)

[English](README.md)

Web ページや YouTube 動画を Obsidian にクリップする Chrome 拡張機能。AI による要約機能付き。

## 機能

- **Web ページのクリップ**: 任意の Web ページをマークダウン形式で Obsidian に保存
- **YouTube 動画のクリップ**: YouTube 動画のメタデータとトランスクリプトを保存
- **LLM 連携**: AI を使用してコンテンツの要約やタグの自動生成
- **テンプレートシステム**: カスタマイズ可能なテンプレートでノートを整理
- **テンプレートセット**: キーボードショートカット付きの複数テンプレート設定
- **右クリックメニュー**: 任意のページから素早くクリップ
- **接続ステータス**: Obsidian 接続状態をリアルタイム表示
- **多言語対応**: 日本語・英語

## スクリーンショット

![Web2Obsidian スクリーンショット](docs/images/screenshot.png)

## 必要条件

- Chrome ブラウザ（または Chromium ベースのブラウザ）
- [Obsidian](https://obsidian.md/)
- [Obsidian Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api) プラグイン

## 対応 LLM プロバイダ

| プロバイダ | ステータス |
|-----------|-----------|
| OpenAI | ✅ 対応 |
| Azure OpenAI | ✅ 対応 |
| Ollama | ✅ 対応 |
| Claude | 🚧 開発中 |
| Gemini | 🚧 開発中 |

## インストール

### ソースから

```bash
# リポジトリをクローン
git clone https://github.com/yourusername/web2obsidian.git
cd web2obsidian

# 依存関係のインストール
npm install

# プロダクションビルド
npm run build
```

ビルド後、`dist` フォルダを Chrome に読み込みます:
1. `chrome://extensions/` を開く
2. 「デベロッパーモード」を有効化
3. 「パッケージ化されていない拡張機能を読み込む」をクリック
4. `dist` フォルダを選択

## 設定

### 1. Obsidian の設定

1. Obsidian に [Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api) プラグインをインストール
2. プラグインを有効化し、API キーをコピー
3. ポート番号を確認（デフォルト: HTTPS は 27124）

### 2. 拡張機能の設定

1. Chrome ツールバーの Web2Obsidian アイコンをクリック
2. 設定を開く
3. Vault 名と API キーを入力
4. 必要に応じて LLM プロバイダを設定

### LLM プロバイダの設定

1. 設定ページの「LLM プロバイダ」タブを開く
2. 使用するプロバイダを選択し、API キーを設定
3. 利用可能なモデルを追加/削除
4. デフォルトモデルを選択
5. 「デフォルトプロバイダに設定」チェックボックスで使用するプロバイダを指定

### テンプレート

テンプレートでは以下の変数が使用可能:

#### Web 変数
| 変数 | 説明 |
|------|------|
| `{{title}}` | ページタイトル |
| `{{url}}` | ページ URL |
| `{{domain}}` | ドメイン名 |
| `{{description}}` | ページ説明 |
| `{{author}}` | 著者 |
| `{{published}}` | 公開日 |
| `{{content}}` | ページコンテンツ |
| `{{selection}}` | 選択テキスト |

#### YouTube 変数
| 変数 | 説明 |
|------|------|
| `{{title}}` | 動画タイトル |
| `{{url}}` | 動画 URL |
| `{{channel}}` | チャンネル名 |
| `{{videoId}}` | 動画 ID |
| `{{duration}}` | 動画の長さ |
| `{{transcript}}` | トランスクリプト |

#### 日時変数
| 変数 | 説明 |
|------|------|
| `{{date}}` | 現在の日付 (YYYY-MM-DD) |
| `{{time}}` | 現在の時刻 (HH:mm) |
| `{{datetime}}` | 日時 (YYYY-MM-DD HH:mm) |
| `{{year}}` | 年 (YYYY) |
| `{{month}}` | 月 (MM) |
| `{{day}}` | 日 (DD) |

## 使い方

### ポップアップ
拡張機能アイコンをクリックしてポップアップを開きます。Obsidian に接続されていれば、「Obsidian にクリップ」をクリックして現在のページを保存できます。

### キーボードショートカット
設定 > テンプレートで、各テンプレートセットにカスタムキーボードショートカットを設定できます。

### 右クリックメニュー
任意のページで右クリックし、「Obsidian にクリップ」を選択できます。複数のテンプレートセットがある場合は、使用するセットを選択できます。

## 開発

```bash
# 開発サーバー起動（ウォッチモード）
npm run dev

# プロダクションビルド
npm run build

# テスト
npm run test

# リント
npm run lint
```

## 技術スタック

- **フレームワーク**: React 18 + TypeScript
- **ビルドツール**: Vite + CRXJS
- **スタイリング**: TailwindCSS + DaisyUI
- **国際化**: i18next
- **拡張機能**: Chrome Extension Manifest V3

## コントリビュート

コントリビュート大歓迎です！お気軽に Pull Request を送ってください。

## ライセンス

このプロジェクトは Apache License 2.0 の下でライセンスされています。詳細は [LICENSE](LICENSE) ファイルをご覧ください。

## 謝辞

- [Obsidian](https://obsidian.md/) - ナレッジマネジメントアプリ
- [Obsidian Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api) - Obsidian 用 REST API プラグイン
- [CRXJS](https://crxjs.dev/) - Chrome Extension Vite Plugin
