# リファレンス

## ツール一覧

| #   | ツール名                     | カテゴリ         | 読み取り専用 |
| --- | ---------------------------- | ---------------- | :----------: |
| 1   | `create_project`             | プロジェクト管理 |      ✗       |
| 2   | `get_project`                | プロジェクト管理 |     true     |
| 3   | `delete_project`             | プロジェクト管理 |      ✗       |
| 4   | `list_projects`              | プロジェクト管理 |     true     |
| 5   | `list_screens`               | スクリーン管理   |     true     |
| 6   | `get_screen`                 | スクリーン管理   |     true     |
| 7   | `generate_screen_from_text`  | AI生成           |      ✗       |
| 8   | `upload_screens_from_images` | AI生成           |      ✗       |
| 9   | `edit_screens`               | AI生成           |      ✗       |
| 10  | `generate_variants`          | AI生成           |      ✗       |
| 11  | `create_design_system`       | デザインシステム |      ✗       |
| 12  | `update_design_system`       | デザインシステム |      ✗       |
| 13  | `list_design_systems`        | デザインシステム |     true     |
| 14  | `apply_design_system`        | デザインシステム |      ✗       |

## ツール詳細

### create_project

新しいStitchプロジェクトを作成します。プロジェクトはUIデザインとフロントエンドコードのコンテナです。プロジェクト作成前にデザインシステムを作成することを推奨します。

**アノテーション:** destructive

**入力**

```json
{
  "type": "object",
  "properties": {
    "title": {
      "type": "string",
      "description": "Optional. The title of the project."
    }
  },
  "required": []
}
```

**出力**

生成されたname、title、メタデータを含むProjectリソースを返します。

**プロンプト例**

> Create a new Stitch project called 'Marketing Site'

> Start a new design project

> Set up a new project for my app

---

### get_project

プロジェクト名を使用して、特定のStitchプロジェクトの詳細を取得します。

**アノテーション:** readOnly

**入力**

```json
{
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "description": "Required. Resource name. Format: `projects/{project}`. Example: `projects/4044680601076201931`"
    }
  },
  "required": ["name"]
}
```

**出力**

Projectリソースオブジェクトを返します。

**プロンプト例**

> Get the details of project 4044680601076201931

> Show me the project info

> What's in my project?

---

### delete_project

特定のStitchプロジェクトを削除します。この操作は元に戻せません。実行前に「yes」または「no」で確認してください。削除は永続的かつ不可逆です。

**アノテーション:** destructive

**入力**

```json
{
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "description": "Required. Resource name. Format: `projects/{project}`. Example: `projects/4044680601076201931`"
    }
  },
  "required": ["name"]
}
```

**出力**

削除の確認を返します。

**プロンプト例**

> Delete project 4044680601076201931

> Remove my old test project

> Clean up the staging project

---

### list_projects

ユーザーがアクセス可能なすべてのStitchプロジェクトを一覧表示します。デフォルトでは所有プロジェクトが表示されます。

**アノテーション:** readOnly

**入力**

```json
{
  "type": "object",
  "properties": {
    "filter": {
      "type": "string",
      "description": "Optional. AIP-160 filter on `view` field. Supported: `view=owned` (default), `view=shared`."
    }
  },
  "required": []
}
```

**出力**

Projectリソースオブジェクトの配列を返します。

**プロンプト例**

> List all my Stitch projects

> Show me my projects

> List shared projects

---

### list_screens

指定されたStitchプロジェクト内のすべてのスクリーンを一覧表示します。

**アノテーション:** readOnly

**入力**

```json
{
  "type": "object",
  "properties": {
    "projectId": {
      "type": "string",
      "description": "Required. Project ID (e.g., '4044680601076201931'), without `projects/` prefix."
    }
  },
  "required": ["projectId"]
}
```

**出力**

Screenオブジェクトの配列を返します。

**プロンプト例**

> List all screens in project 12345

> Show me the designs in this project

> What screens are in my project?

---

### get_screen

プロジェクト内の特定のスクリーンの詳細を取得します。

**アノテーション:** readOnly

**入力**

```json
{
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "description": "Required. Resource name. Format: `projects/{project}/screens/{screen}`"
    },
    "projectId": {
      "type": "string",
      "description": "Required (deprecated). Project ID without prefix."
    },
    "screenId": {
      "type": "string",
      "description": "Required (deprecated). Screen ID without prefix."
    }
  },
  "required": ["name", "projectId", "screenId"]
}
```

`projectId`と`screenId`は`name`（リソース名形式）に置き換えられる予定ですが、現在は3つすべてが必須です。

**出力**

htmlCode、screenshot、figmaExportのファイル参照とダウンロードURLを含むScreenオブジェクトを返します。

**プロンプト例**

> Get the details of screen abc123 in project 12345

> Show me the screen info

> Check the status of this screen

---

### generate_screen_from_text

テキストプロンプトから新しいスクリーンを生成します。この処理には通常数分かかります。接続エラーが発生しても再試行しないでください。接続エラーは必ずしも失敗を意味しません。数分後に`get_screen`を使用して確認してください。output_componentsに提案が含まれている場合は、ユーザーに提示してください。承認された場合、その提案を新しいプロンプトとして再度呼び出してください。

**アノテーション:** destructive

**入力**

```json
{
  "type": "object",
  "properties": {
    "projectId": {
      "type": "string",
      "description": "Required. Project ID without prefix."
    },
    "prompt": {
      "type": "string",
      "description": "Required. Text prompt describing the screen to generate."
    },
    "deviceType": {
      "type": "string",
      "enum": ["DEVICE_TYPE_UNSPECIFIED", "MOBILE", "DESKTOP", "TABLET", "AGNOSTIC"]
    },
    "modelId": {
      "type": "string",
      "enum": ["MODEL_ID_UNSPECIFIED", "GEMINI_3_PRO", "GEMINI_3_FLASH"]
    }
  },
  "required": ["projectId", "prompt"]
}
```

**出力**

生成されたScreenオブジェクトとSessionOutputComponentエントリ（テキスト、提案、またはデザイン参照）を返します。

**プロンプト例**

> Generate a mobile login screen for project 12345

> Design a dashboard page with charts and statistics

> Create a landing page with a hero section, features grid, and footer

> Build a settings page for a dark-themed app

---

### upload_screens_from_images

1つ以上の画像をプロジェクトにアップロードし、各画像に対して新しいスクリーンを作成します。ユーザーのプロンプトに基づいて変更が必要な場合は、結果のスクリーンに対して`edit_screens`を使用してください。`fileContentBase64`フィールドにはBase64エンコードされた画像を含める必要があります。ローカルファイルをエンコードするには、`base64 -w 0 my_image.png`などのユーティリティを使用してください。

**アノテーション:** destructive

**入力**

```json
{
  "type": "object",
  "properties": {
    "projectId": {
      "type": "string",
      "description": "Required. Project ID without prefix."
    },
    "images": {
      "type": "array",
      "description": "Required. Array of images to upload.",
      "items": {
        "$ref": "#/$defs/FileUpload"
      }
    }
  },
  "required": ["projectId", "images"]
}
```

**FileUpload**

```json
{
  "type": "object",
  "properties": {
    "fileContentBase64": {
      "type": "string",
      "description": "Required. Base64-encoded file content."
    },
    "mimeType": {
      "type": "string",
      "description": "Required. MIME type (e.g., \"image/png\")."
    }
  },
  "required": ["fileContentBase64", "mimeType"]
}
```

**出力**

アップロードが成功した場合はScreenメタデータを、失敗した場合はエラー詳細を返します。

**プロンプト例**

> Upload this screenshot to project 12345

> Import these mockup images into my project

> Add these wireframe images as screens

---

### edit_screens

テキストプロンプトを使用して既存のスクリーンを編集します。`generate_screen_from_text`と同様に、この処理には通常数分かかります。接続エラーが発生しても再試行しないでください。接続エラーは必ずしも失敗を意味しません。数分後に`get_screen`を使用して確認してください。output_componentsに提案が含まれている場合は、ユーザーに提示してください。承認された場合、その提案を新しいプロンプトとして再度呼び出してください。

**アノテーション:** destructive

**入力**

```json
{
  "type": "object",
  "properties": {
    "projectId": {
      "type": "string",
      "description": "Required. Project ID without prefix."
    },
    "selectedScreenIds": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Required. Screen IDs to edit, without `screens/` prefix."
    },
    "prompt": {
      "type": "string",
      "description": "Required. Edit instruction."
    },
    "deviceType": {
      "type": "string",
      "enum": ["DEVICE_TYPE_UNSPECIFIED", "MOBILE", "DESKTOP", "TABLET", "AGNOSTIC"]
    },
    "modelId": {
      "type": "string",
      "enum": ["MODEL_ID_UNSPECIFIED", "GEMINI_3_PRO", "GEMINI_3_FLASH"]
    }
  },
  "required": ["projectId", "selectedScreenIds", "prompt"]
}
```

**出力**

更新されたScreenオブジェクトを返します。

**プロンプト例**

> Change the button color to blue on screen abc123

> Make the hero text larger and add a subtitle

> Add a navigation bar to these screens

> Switch the layout to a two-column grid

---

### generate_variants

既存のスクリーンのデザインバリアントを生成します。

**アノテーション:** destructive

**入力**

```json
{
  "type": "object",
  "properties": {
    "projectId": {
      "type": "string",
      "description": "Required. Project ID without prefix."
    },
    "selectedScreenIds": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Required. Screen IDs to generate variants for."
    },
    "prompt": {
      "type": "string",
      "description": "Required. Text guiding variant generation."
    },
    "variantOptions": {
      "$ref": "#/$defs/VariantOptions",
      "description": "Required. Variant configuration."
    },
    "deviceType": {
      "type": "string",
      "enum": ["DEVICE_TYPE_UNSPECIFIED", "MOBILE", "DESKTOP", "TABLET", "AGNOSTIC"]
    },
    "modelId": {
      "type": "string",
      "enum": ["MODEL_ID_UNSPECIFIED", "GEMINI_3_PRO", "GEMINI_3_FLASH"]
    }
  },
  "required": ["projectId", "selectedScreenIds", "prompt", "variantOptions"]
}
```

**VariantOptions**

```json
{
  "type": "object",
  "properties": {
    "variantCount": {
      "type": "integer",
      "description": "Number of variants (1–5). Default: 3."
    },
    "creativeRange": {
      "type": "string",
      "enum": ["CREATIVE_RANGE_UNSPECIFIED", "REFINE", "EXPLORE", "REIMAGINE"]
    },
    "aspects": {
      "type": "array",
      "items": {
        "type": "string",
        "enum": [
          "VARIANT_ASPECT_UNSPECIFIED",
          "LAYOUT",
          "COLOR_SCHEME",
          "IMAGES",
          "TEXT_FONT",
          "TEXT_CONTENT"
        ]
      }
    }
  }
}
```

**出力**

生成されたバリアントのScreenオブジェクトを返します。

**プロンプト例**

> Generate 3 variants of screen abc123 focusing on layout and color

> Reimagine my landing page with radical variations

> Create subtle refinements of these screens

> Show me 5 different color schemes for this design

---

### create_design_system

プロジェクトの新しいデザインシステムを作成します。すべてのスクリーンに適用される基本的なデザイントークン（色、タイポグラフィ、形状、外観）を設定します。

**アノテーション:** destructive

**入力**

```json
{
  "type": "object",
  "properties": {
    "designSystem": {
      "$ref": "#/$defs/DesignSystem",
      "description": "Required. The design system to create."
    },
    "projectId": {
      "type": "string",
      "description": "Optional. Project ID. If empty, creates a global (unassociated) asset."
    }
  },
  "required": ["designSystem"]
}
```

**DesignSystem**

```json
{
  "type": "object",
  "properties": {
    "displayName": {
      "type": "string",
      "description": "Optional. Display name."
    },
    "theme": {
      "$ref": "#/$defs/DesignTheme",
      "description": "Optional. Theme configuration."
    },
    "designTokens": {
      "type": "string",
      "description": "Optional. Serialized DTCG format design tokens."
    },
    "styleGuidelines": {
      "type": "string",
      "description": "Optional. Freeform style guideline text."
    }
  }
}
```

**DesignTheme**

```json
{
  "type": "object",
  "properties": {
    "colorMode": { "type": "string", "enum": ["COLOR_MODE_UNSPECIFIED", "LIGHT", "DARK"] },
    "font": { "type": "string", "enum": ["FONT_UNSPECIFIED", "INTER", "DM_SANS", "GEIST", "..."] },
    "roundness": {
      "type": "string",
      "enum": ["ROUNDNESS_UNSPECIFIED", "ROUND_FOUR", "ROUND_EIGHT", "ROUND_TWELVE", "ROUND_FULL"]
    },
    "preset": { "type": "string", "description": "Required. Preset color name." },
    "saturation": { "type": "integer", "description": "Optional. 1–4." },
    "customColor": { "type": "string", "description": "Optional. Hex color." },
    "backgroundLight": { "type": "string", "description": "Optional. Light mode bg hex." },
    "backgroundDark": { "type": "string", "description": "Optional. Dark mode bg hex." },
    "description": { "type": "string", "description": "Optional. Theme description." }
  },
  "required": ["colorMode", "font", "roundness", "preset"]
}
```

**出力**

作成されたデザインシステムのAssetを返します。

**プロンプト例**

> Create a dark mode design system with Inter font and round corners

> Set up a design system with blue as the primary color

> Create a brand identity with Geist font and minimal roundness

---

### update_design_system

既存のデザインシステムを更新します。`name`フィールドでアセットを識別します。

**アノテーション:** destructive

**入力**

```json
{
  "type": "object",
  "properties": {
    "designSystem": {
      "$ref": "#/$defs/Asset",
      "description": "Required. Asset wrapper with `name` to identify and `designSystem` to update."
    }
  },
  "required": ["designSystem"]
}
```

**Asset**

```json
{
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "description": "Required. Resource name. Format: `assets/{asset}`"
    },
    "designSystem": {
      "$ref": "#/$defs/DesignSystem",
      "description": "The updated design system content."
    },
    "version": {
      "type": "string",
      "description": "Read-only. Version counter."
    }
  }
}
```

**出力**

更新されたAssetを返します。

**プロンプト例**

> Update the design system to use dark mode

> Change the font to Geist in our design system

> Update the roundness to fully rounded

---

### list_design_systems

プロジェクトのすべてのデザインシステムを一覧表示します（projectIdが指定されていない場合はグローバルデザインシステムを表示します）。

**アノテーション:** readOnly

**入力**

```json
{
  "type": "object",
  "properties": {
    "projectId": {
      "type": "string",
      "description": "Optional. Project ID. If empty, lists global design systems."
    }
  },
  "required": []
}
```

**出力**

デザインシステムを含むAssetオブジェクトの配列を返します。

**プロンプト例**

> List all design systems in project 12345

> Show me the available design systems

> What design systems do I have?

---

### apply_design_system

デザインシステムを1つ以上のスクリーンに適用し、システムのトークン（色、フォント、形状）に合わせて外観を変更します。

**アノテーション:** destructive

**入力**

```json
{
  "type": "object",
  "properties": {
    "projectId": {
      "type": "string",
      "description": "Required. Project ID without prefix."
    },
    "selectedScreenIds": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Required. Screen IDs to update, without `screens/` prefix."
    },
    "assetId": {
      "type": "string",
      "description": "Required. Design system asset ID (from `list_design_systems`), without `assets/` prefix."
    }
  },
  "required": ["projectId", "selectedScreenIds", "assetId"]
}
```

**出力**

更新されたScreenオブジェクトを返します。

**プロンプト例**

> Apply the blue design system to all screens in project 12345

> Restyle these screens with the brand identity

> Use design system abc to update my screens

---

## 共有型

### Screen

Stitchプロジェクト内の生成されたスクリーンデザインです。

| フィールド          | 型             | 説明                                                               |
| ------------------- | -------------- | ------------------------------------------------------------------ |
| `name`              | string         | リソース名。形式: `projects/{project}/screens/{screen}`            |
| `id`                | string         | （非推奨）スクリーンID。                                           |
| `title`             | string         | スクリーンのタイトル。                                             |
| `prompt`            | string         | スクリーン生成に使用されたプロンプト。                             |
| `screenshot`        | File           | スクリーンのスクリーンショット画像。                               |
| `htmlCode`          | File           | スクリーンのHTMLコード。                                           |
| `figmaExport`       | File           | スクリーンのFigmaエクスポート。                                    |
| `designSystem`      | Asset          | （読み取り専用）使用されたデザインシステム。                       |
| `theme`             | DesignTheme    | 生成に使用されたテーマ。                                           |
| `deviceType`        | DeviceType     | デバイスタイプ。                                                   |
| `screenType`        | ScreenType     | スクリーンタイプ。                                                 |
| `screenMetadata`    | ScreenMetadata | メタデータ（エージェント、ステータス、表示モード）。               |
| `width`             | string         | スクリーンの幅。                                                   |
| `height`            | string         | スクリーンの高さ。                                                 |
| `groupId`           | string         | 関連スクリーンのグループID（例：バリアント）。                     |
| `groupName`         | string         | グループの表示名。                                                 |
| `generatedBy`       | string         | 生成元の識別子。                                                   |
| `isCreatedByClient` | boolean        | APIアップロードで作成された場合はtrue、エージェントの場合はfalse。 |

### File

| フィールド          | 型           | 説明                                                               |
| ------------------- | ------------ | ------------------------------------------------------------------ |
| `name`              | string       | リソース名。形式: `projects/{project}/files/{file}`                |
| `downloadUrl`       | string       | ダウンロード用URL。画像の場合はFIFEベースURL。                     |
| `mimeType`          | string       | 例: `"image/png"`, `"text/html"`                                   |
| `fileContentBase64` | string       | （書き込み専用）アップロード用のBase64エンコードされたコンテンツ。 |
| `uploadBlobId`      | string       | アップロードサービスからのBlobId。                                 |
| `userFeedback`      | UserFeedback | （読み取り専用）最新のフィードバック。                             |

### FileUpload

`upload_screens_from_images`で使用されます。

| フィールド          | 型     | 必須 | 説明                                                                   |
| ------------------- | ------ | :--: | ---------------------------------------------------------------------- |
| `fileContentBase64` | string | true | Base64エンコードされたファイルコンテンツ。`base64 -w 0 <file>`を使用。 |
| `mimeType`          | string | true | MIMEタイプ。例: `"image/png"`                                          |

### DesignSystem

一貫性のあるブランドデザインを生成するために使用される、視覚的・機能的なデザインガイドラインを表します。

| フィールド        | 型          | 説明                                     |
| ----------------- | ----------- | ---------------------------------------- |
| `displayName`     | string      | デザインシステムの表示名。               |
| `theme`           | DesignTheme | テーマ設定。                             |
| `designTokens`    | string      | DTCG形式のシリアライズされたJSON。       |
| `styleGuidelines` | string      | 自由形式のスタイルガイドラインテキスト。 |

### Asset

デザインシステムリソースのラッパーです（`update_design_system`で使用）。

| フィールド     | 型           | 説明                                                       |
| -------------- | ------------ | ---------------------------------------------------------- |
| `name`         | string       | リソース名。形式: `assets/{asset}`                         |
| `designSystem` | DesignSystem | デザインシステムのコンテンツ。                             |
| `version`      | string       | （読み取り専用）バージョンカウンター。0 = バージョンなし。 |

### DesignTheme

| フィールド        | 型        | 必須  | 説明                                                  |
| ----------------- | --------- | :---: | ----------------------------------------------------- |
| `colorMode`       | ColorMode | true  | ライトモードまたはダークモード。                      |
| `font`            | Font      | true  | タイポグラフィの選択。                                |
| `roundness`       | Roundness | true  | 角の丸み。                                            |
| `preset`          | string    | true  | プリセットカラー名。                                  |
| `saturation`      | integer   | false | 彩度（1-4）。                                         |
| `customColor`     | string    | false | カスタムプライマリカラー（16進数、例: `"#ff0000"`）。 |
| `backgroundLight` | string    | false | ライトモードの背景色（16進数）。                      |
| `backgroundDark`  | string    | false | ダークモードの背景色（16進数）。                      |
| `description`     | string    | false | テーマの簡単な説明。                                  |

### ScreenMetadata

| フィールド         | 型                | 説明                                                                                                          |
| ------------------ | ----------------- | ------------------------------------------------------------------------------------------------------------- |
| `agentType`        | AgentTypeEnum     | `TURBO_AGENT`, `PRO_AGENT`, `IMAGE_AGENT`, `GENIE_AGENT`, `IMAGE_PRO_AGENT`, `HATTER_AGENT`, `GEMINI_3_AGENT` |
| `status`           | ScreenStatusEnum  | `IN_PROGRESS`, `COMPLETE`, `FAILED`                                                                           |
| `statusMessage`    | string            | エージェントからの人間が読めるステータスメッセージ。                                                          |
| `displayMode`      | DisplayModeEnum   | `SCREENSHOT`, `HTML`, `CODE`, `MARKDOWN`, `STICKY_NOTE`                                                       |
| `isRemixed`        | boolean           | リミックスから作成されたかどうか。                                                                            |
| `componentRegions` | ComponentRegion[] | コンポーネント領域のアノテーション。                                                                          |

### SessionOutputComponent

生成ツールからoutput_componentsで返されます。

| フィールド   | 型     | 説明                                   |
| ------------ | ------ | -------------------------------------- |
| `text`       | string | エージェントのテキスト応答。           |
| `suggestion` | string | ユーザーへの提案されたフォローアップ。 |
| `design`     | Design | 生成されたデザイン参照。               |

### UserFeedback

| フィールド             | 型     | 説明                                                                                                 |
| ---------------------- | ------ | ---------------------------------------------------------------------------------------------------- |
| `rating`               | string | `POSITIVE`または`NEGATIVE`。                                                                         |
| `comment`              | string | 追加コメント。                                                                                       |
| `designFeedbackReason` | string | `DESIGN_DOESNT_MATCH_PROMPT`, `EDIT_DOESNT_MATCH_PROMPT`, `COMPONENT_ISSUE`, `INCORRECT_THEME`など。 |

### VariantOptions

| フィールド      | 型              | 説明                                         |
| --------------- | --------------- | -------------------------------------------- |
| `variantCount`  | integer         | 生成するバリアント数（1-5）。デフォルト: 3。 |
| `creativeRange` | CreativeRange   | クリエイティブの自由度レベル。               |
| `aspects`       | VariantAspect[] | 注目するアスペクト。                         |

---

## 列挙型

### DeviceType Enum

| 値                        | 説明                         |
| ------------------------- | ---------------------------- |
| `DEVICE_TYPE_UNSPECIFIED` | 未指定。                     |
| `MOBILE`                  | モバイルデバイス。           |
| `DESKTOP`                 | デスクトップデバイス。       |
| `TABLET`                  | タブレットデバイス。         |
| `AGNOSTIC`                | 特定のデバイスに依存しない。 |

### ModelId Enum

| 値                     | 説明             |
| ---------------------- | ---------------- |
| `MODEL_ID_UNSPECIFIED` | 未指定。         |
| `GEMINI_3_PRO`         | Gemini 3 Pro。   |
| `GEMINI_3_FLASH`       | Gemini 3 Flash。 |

### ScreenType Enum

| 値                        | 説明                      |
| ------------------------- | ------------------------- |
| `SCREEN_TYPE_UNSPECIFIED` | デフォルトはDESIGN。      |
| `DESIGN`                  | デザインスクリーン。      |
| `IMAGE`                   | 画像のみ。                |
| `PROTOTYPE`               | デザインプロトタイプ。    |
| `DOCUMENT`                | ドキュメント（例: PRD）。 |

### ColorMode Enum

| 値                       | 説明           |
| ------------------------ | -------------- |
| `COLOR_MODE_UNSPECIFIED` | 未指定。       |
| `LIGHT`                  | ライトモード。 |
| `DARK`                   | ダークモード。 |

### Font Enum

29種類のサポートされているフォントファミリー:

`INTER` / `ROBOTO` / `DM_SANS` / `GEIST` / `SORA` / `MANROPE` / `LEXEND` / `EPILOGUE` / `BE_VIETNAM_PRO` / `PLUS_JAKARTA_SANS` / `PUBLIC_SANS` / `SPACE_GROTESK` / `SPLINE_SANS` / `WORK_SANS` / `MONTSERRAT` / `METROPOLIS` / `SOURCE_SANS_THREE` / `NUNITO_SANS` / `ARIMO` / `HANKEN_GROTESK` / `RUBIK` / `IBM_PLEX_SANS` / `NEWSREADER` / `NOTO_SERIF` / `DOMINE` / `LIBRE_CASLON_TEXT` / `EB_GARAMOND` / `LITERATA` / `SOURCE_SERIF_FOUR`

### Roundness Enum

| 値                      | 説明                  |
| ----------------------- | --------------------- |
| `ROUNDNESS_UNSPECIFIED` | 未指定。              |
| `ROUND_TWO`             | （非推奨）ラウンド2。 |
| `ROUND_FOUR`            | ラウンド4。           |
| `ROUND_EIGHT`           | ラウンド8。           |
| `ROUND_TWELVE`          | ラウンド12。          |
| `ROUND_FULL`            | 完全に丸い。          |

### CreativeRange Enum

| 値                           | 説明                                 |
| ---------------------------- | ------------------------------------ |
| `CREATIVE_RANGE_UNSPECIFIED` | 未指定。                             |
| `REFINE`                     | 微調整、オリジナルに近い。           |
| `EXPLORE`                    | バランスの取れた探索。（デフォルト） |
| `REIMAGINE`                  | 大胆な探索。                         |

### VariantAspect Enum

| 値                           | 説明                 |
| ---------------------------- | -------------------- |
| `VARIANT_ASPECT_UNSPECIFIED` | 未指定。             |
| `LAYOUT`                     | 要素の配置。         |
| `COLOR_SCHEME`               | カラーパレット。     |
| `IMAGES`                     | 画像の使用。         |
| `TEXT_FONT`                  | フォントの選択。     |
| `TEXT_CONTENT`               | テキストコンテンツ。 |

---

## MCPアノテーション

MCPアノテーションは、MCPサーバーが各ツール定義に付加するメタデータのヒントで、クライアント（AIエージェントやホストアプリケーション）にツールの動作特性を伝えます。MCP仕様の一部であり、クライアントがツールの実装を理解しなくても、よりスマートな判断を行えるようにします。

各ツールには以下の動作アノテーションが含まれています:

| アノテーション    | 意味                                            |
| ----------------- | ----------------------------------------------- |
| `readOnlyHint`    | true = 読み取り専用、変更なし。                 |
| `destructiveHint` | true = リソースの作成・変更・削除の可能性あり。 |
| `idempotentHint`  | true = 繰り返し呼び出しても同じ結果。           |
| `openWorldHint`   | true = 外部システムと連携。                     |

### ツールにおける実際の動作

Stitch MCPサーバーの各ツールは、ツール登録時にこれらを宣言します。例えば:

- **`list_projects`** は`readOnlyHint: true`を持ちます。データを取得するだけなので、エージェントは副作用を心配せずに呼び出せます。
- **`delete_project`** は`readOnlyHint: false`、`destructiveHint: true`、`idempotentHint: false`を持ちます。状態を変更し、破壊的であり、2回呼び出すとエラーになる可能性があります（プロジェクトは既に削除済み）。これにより、クライアントはユーザーに先に確認を求めます。
- **`generate_screen_from_text`** は`destructiveHint: true`と`idempotentHint: false`を持ちます。各呼び出しで新しいスクリーンが作成されるため、タイムアウト時に再試行すると重複が発生する可能性があります。

### アノテーションが重要な理由

これらはヒントであり、強制されるルールではありません。MCPクライアントが以下のことを可能にします:

- 読み取り専用ツールをユーザーへの確認なしに自動承認する
- 破壊的な操作に対して確認ダイアログを表示する
- べき等なツールをネットワーク障害時に安全に再試行する
- `openWorldHint`がtrueの場合に外部とのやり取りを監査する

Stitchサーバーの場合、すべてのツールは`openWorldHint: false`です。これは、Stitchバックエンドとのみやり取りし、任意のサードパーティサービスとはやり取りしないためです。
