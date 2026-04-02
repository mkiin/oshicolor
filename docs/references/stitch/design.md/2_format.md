# DESIGN.md フォーマット

DESIGN.md ファイルのセクション、トークン、構造について。

DESIGN.md ファイルには二つの側面があります。Markdown はあなたが読み書きするもので、デザインシステムの人間にとって分かりやすい要約です。その裏側では、Stitch が構造化トークンを管理しており、生成時の一貫性を保つための正確な値として使用されます。

このページでは、Markdown に記述する内容を説明します。

## セクション

すべての DESIGN.md は同じ構造に従います。プロジェクトに関係のないセクションは省略できますが、順序は維持してください。

### Overview

デザインの外観と雰囲気に関する総合的な説明です。ここでは個性を記述します。遊び心があるのか、それともプロフェッショナルなのか？密度が高いのか、それともゆとりがあるのか？このセクションは、特定のトークンが適用されない場合に、エージェントの高レベルな判断を導きます。

```markdown
## Overview

A calm, professional interface for a healthcare scheduling platform.
Accessibility-first design with high contrast and generous touch targets.
```

### Colors

プライマリ、セカンダリ、ターシャリ、ニュートラルのカラーパレットです。各色には HEX 値と、エージェントがどのように使用すべきかを説明する役割を含める必要があります。

```markdown
## Colors

- **Primary** (#2665fd): CTAs, active states, key interactive elements
- **Secondary** (#6074b9): Supporting actions, chips, toggle states
- **Tertiary** (#bd3800): Accent highlights, badges, decorative elements
- **Neutral** (#757681): Backgrounds, surfaces, non-chromatic UI
```

エージェントはこれらの基本値から名前付きカラーも生成します：surface、on-primary、error、outline など多数。これらは Material のカラーロール規則に従い、構造化トークンとして利用できます。

### Typography

フォントファミリーと、タイポグラフィ階層における役割です：display、headline、title、body、label の各レベル。

```markdown
## Typography

- **Headline Font**: Inter
- **Body Font**: Inter
- **Label Font**: Inter

Headlines use semi-bold weight. Body text uses regular weight at 14–16px.
Labels use medium weight at 12px with uppercase for section headers.
```

Headline フォントと Body フォントの関係性は重要です。同じファミリー（例：Inter）を使用すると統一感が生まれます。異なるファミリーを組み合わせると（例：セリフ体の Headline とサンセリフ体の Body）、視覚的なコントラストが生まれ、エージェントはそれを意図的に全体に反映します。

### Elevation

デザインがどのように奥行きと階層を表現するかを定義します。シャドウを使用するデザインもあれば、フラットに保つデザインもあります。

```markdown
## Elevation

This design uses no shadows. Depth is conveyed through border contrast
and surface color variation (surface, surface-container, surface-bright).
```

Elevation を使用する場合は、シャドウのプロパティ（spread、blur、color）と、どのコンポーネントに適用すべきかを指定してください。

### Components

コンポーネントのアトムに対するスタイルガイダンスです。アプリケーションに最も関連性の高いコンポーネントに焦点を当ててください。

| Component     | 指定すべき内容                                                             |
| ------------- | -------------------------------------------------------------------------- |
| Buttons       | バリアント（primary, secondary, tertiary）、サイズ、パディング、角丸、状態 |
| Chips         | 選択、フィルター、アクションの各バリアント                                 |
| Lists         | アイテムのスタイル、区切り線、先頭・末尾の要素                             |
| Inputs        | テキストフィールド、テキストエリア、ラベル、ヘルパーテキスト、エラー状態   |
| Checkboxes    | チェック済み、未チェック、不確定状態                                       |
| Radio buttons | 選択済みと未選択状態                                                       |
| Tooltips      | 配置、色、タイミング                                                       |

```markdown
## Components

- **Buttons**: Rounded (8px), primary uses brand blue fill, secondary uses outline
- **Inputs**: 1px border, surface-variant background, 12px padding
- **Cards**: No elevation, 1px outline border, 12px corner radius
```

プロジェクトのコンテキストに基づいてコンポーネントを提案できます。例えば、モバイルアプリにはナビゲーションバー、ダッシュボードにはデータテーブルなどです。

### Do's and Don'ts

実用的なガイドラインとよくある落とし穴です。デザイン作成時のガードレールとして機能します。

```markdown
## Do's and Don'ts

- Do use the primary color only for the single most important action per screen
- Don't mix rounded and sharp corners in the same view
- Do maintain WCAG AA contrast ratios (4.5:1 for normal text)
- Don't use more than two font weights on a single screen
```

## 二重表現（Dual Representation）

あなたが目にする Markdown は一つの側面に過ぎません。Stitch は同じ情報の構造化バージョンも保持しています：HEX 値、フォント列挙型、スペーシングスケール、完全な名前付きカラーパレットなどです。Markdown を編集すると、Stitch は両方の表現を整合させます。

つまり、Markdown では大まかに記述しても（「暖色系、丸みのある雰囲気」）、Stitch がそれを正確なトークンに変換します。あるいは、正確に記述すれば（#2665fd、8px の角丸）、Stitch はその値をそのまま尊重します。

**両方の表現は同じデザインシステムを記述しています。** Markdown はコラボレーションのため、トークンは一貫性の強制のためにあります。
