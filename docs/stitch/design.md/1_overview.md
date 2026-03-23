# DESIGN.md とは

プロジェクト全体で一貫した UI を生成するために、AI エージェントが読み取るデザインシステムドキュメントです。

すべてのプロジェクトにはビジュアルアイデンティティがあります。カラー、フォント、スペーシング、コンポーネントスタイルなどです。従来、これらは Figma ファイル、ブランド PDF、またはデザイナーの頭の中に存在していました。しかし、これらはいずれも AI エージェントが読み取れるものではありません。

DESIGN.md はそれを変えます。人間とエージェントの両方が読み、編集し、適用できるプレーンテキストのデザインシステムドキュメントです。AGENTS.md のデザイン版と考えてください。

| ファイル  | 読む人                   | 定義する内容                 |
| --------- | ------------------------ | ---------------------------- |
| README.md | 人間                     | プロジェクトの概要           |
| AGENTS.md | コーディングエージェント | プロジェクトのビルド方法     |
| DESIGN.md | デザインエージェント     | プロジェクトの見た目と雰囲気 |

## DESIGN.md がもたらすもの

Stitch のようなデザインエージェントが DESIGN.md を読むと、生成するすべての画面が同じビジュアルルールに従います。カラーパレット、タイポグラフィ、コンポーネントパターンなどです。DESIGN.md がなければ、各画面はバラバラに存在します。DESIGN.md があれば、それらは統一感のあるデザインになります。

DESIGN.md は静的な設定ファイルではなく、**生きたアーティファクト**です。デザインの進化とともに進化します。エージェントが生成し、あなたが改善し、イテレーションの中で画面に再適用されます。

## 作成方法

DESIGN.md を作成するには、手軽なものから精密なものまで 3 つの方法があります。

### エージェントに生成させる

雰囲気を言葉で伝えるだけです。エージェントがあなたの美的意図をトークンとガイドラインに変換します。

> Stitch でプロンプトからデザインシステムを作成する

```
A playful coffee shop ordering app with warm colors, rounded corners, and a friendly feel
```

Stitch は完全なデザインシステム（カラー、タイポグラフィ、スペーシング、コンポーネントスタイル）を生成し、DESIGN.md としてまとめます。

### ブランディングから導出する

既にブランドがある場合は、URL や画像を提供してください。エージェントがパレット、タイポグラフィ、スタイルパターンを抽出し、既存のものから DESIGN.md を構築します。

> Stitch でウェブサイトの URL からデザインシステムをインポートする

### 手動で記述する

上級ユーザーは DESIGN.md を直接作成し、正確なデザインの好みをエンコードできます。すべてのセクションはただの Markdown です。特別な構文もツールも必要ありません。

## 例

以下は、ダークテーマの生産性アプリ向けの最小限の DESIGN.md の例です。

```markdown
# Design System

## Overview

A focused, minimal dark interface for a developer productivity tool.
Clean lines, low visual noise, high information density.

## Colors

- **Primary** (#2665fd): CTAs, active states, key interactive elements
- **Secondary** (#475569): Supporting UI, chips, secondary actions
- **Surface** (#0b1326): Page backgrounds
- **On-surface** (#dae2fd): Primary text on dark backgrounds
- **Error** (#ffb4ab): Validation errors, destructive actions

## Typography

- **Headlines**: Inter, semi-bold
- **Body**: Inter, regular, 14–16px
- **Labels**: Inter, medium, 12px, uppercase for section headers

## Components

- **Buttons**: Rounded (8px), primary uses brand blue fill
- **Inputs**: 1px border, subtle surface-variant background
- **Cards**: No elevation, relies on border and background contrast

## Do's and Don'ts

- Do use the primary color sparingly, only for the most important action
- Don't mix rounded and sharp corners in the same view
- Do maintain 4:1 contrast ratio for all text
```

これがエージェントが次の画面を生成する際に読む内容です。完全なフォーマット仕様については、「The format」を参照してください。
