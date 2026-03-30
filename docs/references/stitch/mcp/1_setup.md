# Stitch via MCP

Model Context Protocol を使用して、IDE や CLI を Stitch に接続します。

Stitch Model Context Protocol (MCP) サーバーを使用すると、Cursor、Antigravity、Gemini CLI などの AI ツールから Stitch プロジェクトに直接アクセスできます。

## Remote MCP について

一般的な MCP サーバーは**ローカル**で動作します。ハードドライブ上のファイルを読み取ったり、マシン上でスクリプトを実行したりします。一方、Stitch は**リモート** MCP サーバーであり、クラウド上で動作します。

リモートであるため、あなたの代わりに操作する AI エージェントが実際にデザインを変更する権限を持っていることを確認するための、安全な「ハンドシェイク」が必要です。

## API Keys と OAuth

Stitch MCP サーバーは2つの認証方法をサポートしています：

- **API Keys**: Stitch Settings ページで生成される永続的なキーです。
- **OAuth**: 手動キー入力をサポートしていない特定の AI クライアント、またはディスク上に永続的なシークレットを保存することが制限されている環境で必要な、ブラウザベースの認証フローです。

### どちらを使うべきか

ほとんどの場合、**API Keys** が最も簡単な方法です。ツールを最速で接続できます。ただし、特定の状況では OAuth の方が追加のセットアップに見合う価値があります。

| シナリオ             | API Keys を使う場合                                                                                                   | OAuth を使う場合                                                                                                                         |
| -------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| クライアントサポート | ツール（例：Cursor、Antigravity、Gemini CLI）が設定ファイルまたは環境変数で API キーを受け入れる場合。                | ツール（例：Webベースのツール）が「サインイン」フローを要求し、手動でキーを入力する方法がない場合。                                      |
| ストレージポリシー   | ローカルの `.json` や `.env` ファイルにシークレットキーを保存することが標準的なプライベートマシンを使用している場合。 | 永続的なシークレットをハードドライブに保存することがブロックされている、またはリスクのある「ゼロトラスト」やエフェメラル環境にいる場合。 |
| 失効管理             | Stitch Settings ページからキーを手動で削除し、ローカルファイルからも削除することに問題がない場合。                    | ローカルファイルを探すことなく、Stitch Settings ページから「ログアウト」してツールのアクセスを即座に無効化したい場合。                   |
| セッションロジック   | 手動で変更するまで無期限に有効な接続が必要な場合。                                                                    | 有効期限を設定したり、一定期間の非アクティブ後に再承認を要求できるセッションベースの接続を好む場合。                                     |

## API Key セットアップ

1. Stitch Settings ページに移動します。
2. **API Keys** セクションまでスクロールします。
3. **「Create API Key」** をクリックして新しい API キーを生成します。
4. API キーをコピーし、安全な場所に保存します。

### API Keys の保管について

> **注意:** API キーを公開される可能性のある場所に保存しないでください。パブリックリポジトリに API キーをコミットしないでください。他のユーザーが閲覧できるクライアント側コードに API キーを含めないでください。

## MCP クライアントセットアップ

### Gemini CLI

Gemini CLI 用の Stitch 拡張機能をインストールします。

```bash
gemini extensions install https://github.com/gemini-cli-extensions/stitch
```

### Cursor

`.cursor/mcp.json` ファイルを作成し、以下のエントリを追加します：

```json
{
  "mcpServers": {
    "stitch": {
      "url": "https://stitch.googleapis.com/mcp",
      "headers": {
        "X-Goog-Api-Key": "YOUR-API-KEY"
      }
    }
  }
}
```

### Antigravity

Agent Panel で右上の三点メニューをクリックし、**MCP Servers** を選択します。**Manage MCP Servers** をクリックし、**「View raw config」** を選択して以下のエントリを追加します：

```json
{
  "mcpServers": {
    "stitch": {
      "serverUrl": "https://stitch.googleapis.com/mcp",
      "headers": {
        "X-Goog-Api-Key": "YOUR-API-KEY"
      }
    }
  }
}
```

### VSCode

コマンドパレット（Cmd+Shift+P）を開き、「MCP: Add Server」と入力します。**「Add MCP Server」** を選択します。**HTTP** を選択してリモート MCP サーバーを追加します。Stitch MCP URL `https://stitch.googleapis.com/mcp` を入力します。名前を「stitch」に設定して確認します。

次に、`mcp.json` ファイルを編集して API キーを追加します：

```json
{
  "servers": {
    "stitch": {
      "url": "https://stitch.googleapis.com/mcp",
      "type": "http",
      "headers": {
        "Accept": "application/json",
        "X-Goog-Api-Key": "YOUR-API-KEY"
      }
    }
  }
}
```

### Claude Code

`claude mcp` コマンドを使用して認証し、以下のエントリを追加します：

```bash
claude mcp add stitch --transport http https://stitch.googleapis.com/mcp --header "X-Goog-Api-Key: api-key" -s user
```

## OAuth セットアップ

MCP クライアントが Stitch と通信するために、2つのシークレットを生成する必要があります：

- **Project ID**: 作業のコンテナです。
- **Access Token**: プロジェクトの認証を検証するための短期間有効なキーです。

### ステップ 1: Google Cloud SDK のインストール

Stitch は安全な認証のために `gcloud` CLI に依存しています。まだインストールしていない場合は、[クイックスタート](https://cloud.google.com/sdk/docs/quickstart)からグローバルにインストールするか、以下の手順でスタンドアロンとしてインストールできます。

**Standalone**

```bash
# ダウンロードとインストール（標準環境向けの簡易版）
curl https://sdk.cloud.google.com | bash
exec -l $SHELL

# プロンプトを回避するためのローカル設定
export CLOUDSDK_CORE_DISABLE_PROMPTS=1
```

**Homebrew**

```bash
brew install --cask google-cloud-sdk
```

### ステップ 2: 二重認証

2回ログインする必要があります。1回目は**ユーザー**として、2回目は**アプリケーション**（ローカルコード / MCP クライアント）としてです。

```bash
# 1. ユーザーログイン（ブラウザが開きます）
gcloud auth login

# 2. Application Default Credentials (ADC) ログイン
# MCP サーバーが安全にあなたを「なりすまし」できるようにします
gcloud auth application-default login
```

### ステップ 3: プロジェクトと権限の設定

作業プロジェクトを選択し、Stitch API を有効にします。また、サービスを利用するためのユーザー権限を付与する必要があります。

```bash
# [YOUR_PROJECT_ID] を実際の Google Cloud Project ID に置き換えてください
PROJECT_ID="[YOUR_PROJECT_ID]"

gcloud config set project "$PROJECT_ID"

# Stitch API を有効にする
gcloud beta services mcp enable stitch.googleapis.com --project="$PROJECT_ID"

# Service Usage Consumer ロールを付与する
USER_EMAIL=$(gcloud config get-value account)
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="user:$USER_EMAIL" \
    --role="roles/serviceusage.serviceUsageConsumer" \
    --condition=None
```

### ステップ 4: シークレットの生成（.env）

最後に、Access Token を生成して `.env` ファイルに保存します。

> **注意:** このコマンドは既存の `.env` ファイルを上書きします。

```bash
# トークンを取得する
TOKEN=$(gcloud auth application-default print-access-token)

# 注意: 既存の .env ファイルを上書きします
echo "GOOGLE_CLOUD_PROJECT=$PROJECT_ID" > .env
echo "STITCH_ACCESS_TOKEN=$TOKEN" >> .env

echo "Secrets generated in .env"
```

### ステップ 5: トークンの更新

> **注意:** Access Token は一時的なものです（通常1時間で有効期限が切れます）。MCP クライアントが応答しなくなったり、「Unauthenticated」と表示された場合は、以下の手順が必要です：

1. ステップ 4 のコマンドを再実行して `.env` ファイルを更新します。
2. `.env` から新しい `STITCH_ACCESS_TOKEN` の値を MCP クライアントの設定ファイルにコピーします。

ほとんどの MCP クライアントは `.env` ファイルを自動的に読み取らないため、トークンの有効期限が切れるたびに設定ファイルを手動で更新する必要があります。

### MCP クライアントの設定

`.env` ファイルの値を MCP クライアントの設定にコピーします。以下のプレースホルダーを `.env` ファイルの実際の値に置き換えてください：

- `<YOUR_PROJECT_ID>` → `.env` の `GOOGLE_CLOUD_PROJECT` の値
- `<YOUR_ACCESS_TOKEN>` → `.env` の `STITCH_ACCESS_TOKEN` の値

> **重要:** Access Token の有効期限が切れるたびに（1時間ごと）、設定ファイルの Authorization ヘッダーを手動で更新する必要があります。更新手順についてはステップ 5 を参照してください。

#### Cursor

`.cursor/mcp.json` ファイルを作成し、以下のエントリを追加します：

```json
{
  "mcpServers": {
    "stitch": {
      "url": "https://stitch.googleapis.com/mcp",
      "headers": {
        "Authorization": "Bearer <YOUR_ACCESS_TOKEN>",
        "X-Goog-User-Project": "<YOUR_PROJECT_ID>"
      }
    }
  }
}
```

#### Antigravity

Agent Panel で右上の三点メニューをクリックし、**MCP Servers** を選択します。**Manage MCP Servers** をクリックし、**「View raw config」** を選択して以下のエントリを追加します：

```json
{
  "mcpServers": {
    "stitch": {
      "serverUrl": "https://stitch.googleapis.com/mcp",
      "headers": {
        "Authorization": "Bearer <YOUR_ACCESS_TOKEN>",
        "X-Goog-User-Project": "<YOUR_PROJECT_ID>"
      }
    }
  }
}
```

#### VSCode

コマンドパレット（Cmd+Shift+P）を開き、「MCP: Add Server」と入力します。**「Add MCP Server」** を選択します。**HTTP** を選択してリモート MCP サーバーを追加します。Stitch MCP URL `https://stitch.googleapis.com/mcp` を入力します。名前を「stitch」に設定して確認します。

次に、`mcp.json` ファイルを編集してヘッダーを追加します：

```json
{
  "servers": {
    "stitch": {
      "url": "https://stitch.googleapis.com/mcp",
      "type": "http",
      "headers": {
        "Accept": "application/json",
        "Authorization": "Bearer <YOUR_ACCESS_TOKEN>",
        "X-Goog-User-Project": "<YOUR_PROJECT_ID>"
      }
    }
  }
}
```

#### Claude Code

`claude mcp` コマンドを使用してサーバーを追加します：

```bash
claude mcp add stitch \
  --transport http https://stitch.googleapis.com/mcp \
  --header "Authorization: Bearer <YOUR_ACCESS_TOKEN>" \
  --header "X-Goog-User-Project: <YOUR_PROJECT_ID>" \
  -s user

# -s user: $HOME/.claude.json に保存します
# -s project: ./.mcp.json に保存します
```

#### Gemini CLI

Gemini CLI 用の Stitch 拡張機能をインストールします：

```bash
gemini extensions install https://github.com/gemini-cli-extensions/stitch
```

## 利用可能なツール

認証が完了すると、AI アシスタントは Stitch ワークフローを管理するための以下のツールにアクセスできるようになります。

### Project Management

| ツール           | 説明                                     | パラメータ                                                                    |
| ---------------- | ---------------------------------------- | ----------------------------------------------------------------------------- |
| `create_project` | UI 作業用の新しいコンテナを作成します。  | `name` (string): プロジェクトの表示名。                                       |
| `list_projects`  | アクティブなデザインの一覧を取得します。 | `filter` (string): 所有またはシェアされたプロジェクトでフィルタリングします。 |

### Screen Management

| ツール         | 説明                                                   | パラメータ                                                                        |
| -------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------- |
| `list_screens` | 特定のプロジェクト内のすべてのスクリーンを取得します。 | `project_id` (string): 検査するプロジェクトの ID。                                |
| `get_project`  | 単一プロジェクトの詳細情報を取得します。               | `name` (string): プロジェクトのユニーク名。                                       |
| `get_screen`   | 単一スクリーンの詳細情報を取得します。                 | `project_id` (string): プロジェクトの ID。`screen_id` (string): スクリーンの ID。 |

### デザインの新規作成

| ツール                      | 説明                                               | パラメータ                                                                                                                                                                               |
| --------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `generate_screen_from_text` | テキストプロンプトから新しいデザインを作成します。 | `project_id` (string): プロジェクトの ID。`prompt` (string): デザインを生成するためのテキストプロンプト。`model_id` (string): 使用するモデル（`GEMINI_3_PRO` または `GEMINI_3_FLASH`）。 |

## 利用規約

この製品を使用することにより、以下のライセンスの利用規約に同意したものとみなされます：[Google APIs Terms of Service](https://developers.google.com/terms)。
