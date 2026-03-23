# 効果的なプロンプティング

**効果的な結果に向けて反復するための実践的なガイド**

このガイドでは、Stitch を使ってアプリをデザイン・改善するための効果的なプロンプトの作成方法を説明します。

## プロジェクトの始め方

広い概念から始めるか、具体的な詳細から始めるかを選びましょう。複雑なアプリの場合は、まず全体像から始め、その後画面ごとに詳細を掘り下げていくのが効果的です。

### 概要レベル vs. 詳細なプロンプト

まずは一般的なアイデアから始めましょう。

**概要レベル:**

> An app for marathon runners.

より良い出発点を得るために、コア機能を説明しましょう。

**詳細レベル:**

> An app for marathon runners to engage with a community, find partners, get training advice, and find races near them.

### 形容詞で雰囲気を設定する

形容詞を使ってアプリの雰囲気を定義しましょう（色、フォント、画像に影響します）。

> A vibrant and encouraging fitness tracking app.

> A minimalist and focused app for meditation.

## 画面ごとの反復によるアプリの改善

### 具体的で段階的な変更を行う

Stitch は明確で具体的な指示で最も良い結果を出します。一つの画面やコンポーネントに集中し、1回のプロンプトで1～2つの調整を行いましょう。

**具体的に指示する:** Stitch に何をどう変更するかを伝えましょう。

- 特定の要素を指定する
- 特定の画面を指定する
- 具体的な視覚的変更を指定する
- ブランドテーマを参照する

> Change the primary call-to-action button on the login screen to be larger and use the brand's primary blue color.

### 特定の画面・機能に集中する

- **EC商品詳細ページ:** "Product detail page for a Japandi-styled tea store. Sells herbal teas, ceramics. Neutral, minimal colors, black buttons. Soft, elegant font."
- **EC商品詳細ページ:** "Product detail page for Japanese workwear-inspired men's athletic apparel. Dark, minimal design, dark blue primary color. Minimal clothing pictures, natural fabrics, not gaudy."

### 希望する画像の説明

画像のスタイルや内容をガイドしましょう。

- **特定の画像スタイル:** "Music player page for 'Suburban Legends.' Album art is a macro, zoomed-in photo of ocean water. Page background/imagery should reflect this."

## アプリテーマの制御

### 色

特定の色をリクエストするか、カラーパレットのムードを説明しましょう。

- **特定の色のプロンプト:** "Change primary color to forest green."
- **ムードベースのプロンプト:** "Update theme to a warm, inviting color palette."

### フォントとボーダー

タイポグラフィや要素のスタイル（ボタン、コンテナ）を変更しましょう。

- **フォントスタイル:** "Use a playful sans-serif font." または "Change headings to a serif font."
- **ボーダー/ボタンスタイル:** "Make all buttons have fully rounded corners." または "Give input fields a 2px solid black border."

**テーマの組み合わせ:**

> Book discovery app: serif font for text, light green brand color for accents.

## デザイン内の画像を変更する方法

### 画像を変更する際は具体的に

変更する画像を明確に特定しましょう。アプリのコンテンツに基づいた説明的な用語を使いましょう。

**一般的な画像の指定:**

> Change background of [all] [product] images on [landing page] to light taupe.

**特定の画像の指定:**

- 場所を定義する
- 対象となるコンテンツを説明する
- 指示を出す

> On 'Team' page, image of 'Dr. Carter (Lead Dentist)': update her lab coat to black.

### テーマ変更に合わせて画像を調整する

テーマカラーを更新する場合、画像もその変更を反映すべきかどうかを指定しましょう。

> Update theme to light orange. Ensure all images and illustrative icons match this new color scheme.

## アプリのテキスト言語を変更する

以下のプロンプトを使用しましょう：

> Switch all product copy and button text to Spanish.

## Stitch を使うためのヒント

- **明確かつ簡潔に:** 曖昧さを避けましょう。
- **反復と実験:** さらなるプロンプトでデザインを改善しましょう。
- **一度に一つの大きな変更:** 影響を確認しやすく、調整しやすくなります。
- **UI/UX キーワードを使用:** 例: "navigation bar"、"call-to-action button"、"card layout"
- **要素を具体的に参照:** 例: "primary button on sign-up form"、"image in hero section"
- **確認と改善:** 変更が意図通りでない場合は、表現を変えるか、より具体的に指定しましょう。
