# oshicolor 実装要件整理

## Context

project.md（製品概要）から実装に落とし込める要件を抽出し、優先度・依存関係・技術アプローチを整理する。
現状のコードベースはスキャフォールド段階（ルートは `/` のみ、DB は `todos` プレースホルダー）であり、
すべてのドメイン機能がこれから実装となる。

---

## 現状の実装済み要素

| 項目 | 状態 |
|---|---|
| TanStack Start + Cloudflare Workers スキャフォールド | ✅ 完了 |
| Radix UI + Tailwind CSS 基本コンポーネント (7種) | ✅ 完了 |
| TanStack Router (ファイルベース) | ✅ 完了 |
| Drizzle ORM + D1 接続設定 | ✅ 完了 |
| Jotai / TanStack Query インストール済み | ✅ 完了 |
| Biome / TypeScript 設定 | ✅ 完了 |
| Alchemy IaC (prod/dev stage 分離) | ✅ 完了 |
| ドメイン機能 (features/) | ❌ 未着手 |
| DB スキーマ (実際のテーブル) | ❌ 未着手 |
| ルート (/ 以外) | ❌ 未着手 |

---

## 抽出した実装要件

### R1: 画像アップロード・色抽出（コアバリュー）

**要件**:
- ユーザーが画像（JPG/PNG/WebP）をアップロードできる
- **クライアントサイドのみ**でカラーパレットを抽出する（画像をサーバーに送信しない）
- 抽出する色数: 5〜16色程度（ユーザーが調整可能）
- アニメ・イラスト画像に適した色抽出アルゴリズム（代表色、彩度が高い色を優先）
- 抽出した各色に色名を自動付与する

**技術アプローチ**:

アルゴリズム: **貪欲法（Greedy Algorithm）+ OKLab 知覚距離**

参考実装（anicolors/color-extractor.ts）を基に、距離計算を RGB ユークリッドから OKLab 知覚距離に改善する。RGB 空間は人間の知覚と一致しないため、アニメ画像で「RGB 上は離れているが視覚的に似て見える色」が選ばれる問題を解消する。

1. Canvas に画像を原寸（`naturalWidth/naturalHeight`）で描画し `getImageData()` で全ピクセル取得
2. 8px 間隔でサンプリング、以下を除外:
   - 透明ピクセル（alpha < 128）
   - 極端な明度（輝度 30 未満 / 225 超）
3. RGB 各チャンネルを 24 単位で量子化してグルーピング
4. 出現回数 ≥ 10 の上位 20 色を候補に絞る
5. 貪欲法で多様性最大化: 既選択色との **OKLab 知覚距離**（`culori` の `differenceEuclidean('oklab')`）が最大の色を順次選択
6. `culori` で HEX 変換し、`color-name-list` + 独自 nearest 検索で色名付与

**実装定数**:

| 定数 | 値 | 根拠 |
|---|---|---|
| サンプリング間隔 | 8px | パフォーマンスと精度のトレードオフ |
| 量子化ステップ | 24 | 色の多様性を保ちつつノイズ除去 |
| 透明度閾値 | alpha < 128 | 半透明ピクセルを除外 |
| 明度下限 / 上限 | 30 / 225 | エディタで使いにくい極端な色を除外 |
| 候補色フィルタ | 出現回数 ≥ 10 | ノイズ色を除去 |
| 候補色上限 | 20 色 | 貪欲法の計算コスト抑制 |

**ColorPoint 型**:

```typescript
type ColorPoint = {
  id: number;     // 1始まりの連番
  x: number;      // 正規化座標（0〜1）
  y: number;      // 正規化座標（0〜1）
  color: string;  // HEX文字列 "#RRGGBB"
  name?: string;  // 色名（color-name-list + nearest 検索で解決）
}
```

**依存パッケージ**:

| パッケージ | 用途 |
|---|---|
| `culori` | OKLab 距離計算・HEX 変換（R3 コントラスト調整と共用） |
| `color-name-list` | 色名データベース（v14.x、活発にメンテナンス中） |

**不採用ライブラリ（参考実装との差分）**:

| パッケージ | 不採用理由 |
|---|---|
| `nearest-color` | 開発停止（7年更新なし）。`culori` で独自 nearest 実装に置き換え |
| `color` | `culori` に機能統合されるため不要 |
| `quantize` | MVP は貪欲法で十分。開発停止の可能性あり |

**配置**: `src/features/color-extractor/`

---

### R2: Neovim ハイライトグループへの自動カラーマッピング

**要件**:
- 抽出したパレットを以下のハイライトグループに自動マッピングする
  - `Normal` (背景・前景)
  - `Comment`
  - `String`
  - `Function`
  - `Keyword`
  - `Type`
  - `Number` / `Boolean`
  - `Variable`
  - `Operator`
  - カーソル行 / 選択範囲 / 行番号
- **初期実装はルールベース**: 色相・明度・彩度による分類ルール
  - 最も暗い色 → 背景 (Normal bg)
  - 最も明るい色 → 前景テキスト (Normal fg)
  - 彩度が高い青系 → Keyword
  - 彩度が高い緑系 → String
  - 彩度が高い黄/橙系 → Function
  - 低彩度・中明度 → Comment
  など
- ダーク / ライト 両バリアントを生成する

**配置**: `src/features/theme-generator/color-mapper.ts`

---

### R3: コントラスト自動調整

**要件**:
- WCAG 2.1 コントラスト比基準を参照し、背景と各前景色のコントラスト比を検証・調整する
  - 最低: 4.5:1（通常テキスト）
  - 推奨: 7:1 以上（長時間コーディング）
- キャラクターの色彩をできる限り保ちつつ調整（明度のみ変更、色相は保持）
- 調整前後をユーザーに視覚的に提示する（任意）

**技術アプローチ**:
- OKLch 色空間でL値（明度）を調整
- `src/styles/index.css` 内の OKLch変数システムと統一

**配置**: `src/features/theme-generator/contrast-adjuster.ts`

---

### R4: Neovim Lua ファイル生成・エクスポート

**要件**:
- マッピング済みのカラーデータから Neovim Lua カラースキームファイルを生成する
- 生成形式:
  - **Neovim Lua** (MVP必須): `vim.api.nvim_set_hl()` 形式
  - **hex リスト** (任意): plain text
  - **CSS 変数** (任意): `--color-keyword: #...;`
  - **JSON** (任意)
- ユーザーがワンクリックでファイルをダウンロードできる

**配置**: `src/features/theme-generator/lua-generator.ts`、`src/features/theme-generator/exporters.ts`

---

### R5: リアルタイムプレビュー UI

**要件**:
- 生成されたテーマが Neovim でどう見えるかをブラウザ上に表示する
- サンプルコード: TypeScript / Python / Lua の最低 2〜3言語対応
- ユーザーが個別の色を GUI 上で微調整できる（カラーピッカー）
- 微調整は即座にプレビューに反映（リアルタイム）
- ダーク / ライト バリアント切り替えボタン

**技術アプローチ**:
- Jotai でカラー編集状態を管理（`src/features/editor/stores/`）
- syntax highlight はカスタム CSS クラスでシミュレート（実際の Neovim を使わない）
- カラーピッカー UI: `react-colorful`（2.8 KB gzip、TypeScript ネイティブ、メンテナンス活発。開発停止の `react-color` は不採用）

**配置**: `src/features/editor/`

---

### R6: コミュニティギャラリー

**要件**:
- ユーザーが作成したテーマを公開できる（オプション、強制ではない）
- 一覧表示: サムネイル + Neovim プレビュー
- キャラクター名・作品名・タグで検索できる
- テーマをダウンロードできる
- ページネーション対応

**技術アプローチ**:
- テーマデータを D1 に保存（`themes` テーブル）
- 画像サムネイルを R2 に保存
- Server Functions でデータ取得
- TanStack Query でキャッシュ

**配置**: `src/features/gallery/`

---

### R7: DB スキーマ設計

**必要なテーブル**:

```
themes
  id            TEXT PRIMARY KEY (nanoid)
  name          TEXT NOT NULL
  sourceImage   TEXT (R2 オブジェクトキー、任意)
  palette       TEXT (JSON: ColorPoint[])
  darkVariant   TEXT (JSON: HighlightMap)
  lightVariant  TEXT (JSON: HighlightMap)
  isPublished   INTEGER (0/1)
  characterName TEXT
  workTitle     TEXT
  tags          TEXT (JSON: string[])
  createdAt     INTEGER (unixepoch)
  updatedAt     INTEGER (unixepoch)
```

**配置**: `src/db/schema.ts`（既存ファイルを更新）

---

### R8: ルート構成

| ルート | 機能 |
|---|---|
| `/` | ランディングページ（画像アップロード起点） |
| `/editor` | テーマエディタ（プレビュー・色調整・エクスポート） |
| `/gallery` | コミュニティギャラリー一覧 |
| `/gallery/$themeId` | テーマ詳細・ダウンロード |

---

### R9: 多言語対応 (i18n)

**要件**:
- 日本語・英語の両方を初期リリースから含める
- UI テキストを外部リソースとして管理する

**技術アプローチ**:
- TanStack Start 対応の i18n ライブラリ（`react-i18next` または `@inlang/paraglide-js`）
- URL ベースの言語切り替えは MVP では不要、ブラウザ設定に従う

---

## 実装優先度と依存関係

```
[MVP フェーズ1]
R7 (DB スキーマ)
  └→ R6 (ギャラリー)

R1 (色抽出)
  └→ R2 (カラーマッピング)
       └→ R3 (コントラスト調整)
            └→ R4 (Lua 生成)
                 └→ R5 (プレビュー UI + エディタ)

R8 (ルート構成) ... 並行して構築

[MVP フェーズ2]
R6 (ギャラリー) ... フェーズ1 完了後
R9 (i18n) ... 任意タイミング
```

### 最小実装順

1. **R7**: DB スキーマ更新
2. **R8**: ルートファイル作成（空ページ）
3. **R1**: 色抽出エンジン（Canvas + k-means）
4. **R2 + R3**: カラーマッピング + コントラスト調整
5. **R4**: Lua ジェネレーター
6. **R5**: エディタ UI + プレビュー
7. **R6**: ギャラリー（フェーズ2）
8. **R9**: i18n（フェーズ2）

---

## 検証方法

- R1: 実際のアニメキャラ画像をアップロードして 5〜10 色が抽出されることを確認
- R2: 抽出した色が各 Neovim ハイライトグループに割り当てられることを確認
- R3: コントラスト比 4.5:1 以上が保証されることをユニットテストで確認
- R4: 生成された Lua ファイルが Neovim で `source` コマンドで読み込めることを確認
- R5: プレビュー UI で色変更が即座に反映されることをブラウザで確認
- R6: テーマを公開・検索・ダウンロードできる E2E フローを確認
