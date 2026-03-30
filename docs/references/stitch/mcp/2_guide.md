# Getting Started

Stitch MCPの使い方を学び、すぐに開発を始めましょう。いくつかのヒントやコツも紹介します。

Stitch MCPは、Stitchエディタ内でデザインを生成する機能を、IDE、CLI、またはお好みのAIツールに直接統合します。デザインをコードベースに変換したり、新しい画面を生成したりできます。これにより、Stitchをプログラム的かつ自動的に制御できるようになります。

## はじめる前に

### Authentication

まず最初に、Stitch MCPで認証を行う必要があります。このガイドでは、すでにStitch MCPでの認証が完了していることを前提としています。認証の手順については、**Setup and Authentication Guide**をご確認ください。

### どのコーディングエージェントを使うべきか？

お好みのコーディングエージェントを自由にお使いいただけます。Stitch MCPサーバーは、リモートHTTP MCPサーバーをサポートするコーディングエージェントに統合できます。

## 何を構築するか

StitchからReactコンポーネントシステムを構築します。プロンプトを記述するだけで、Stitchデザインから構造化されたReactコンポーネント一式を取得できます。

## Stitchへのプロンプト

Stitchプロジェクトと、そのプロジェクト内の各画面を表示するプロンプトを記述します。

> **PROMPT**
>
> **Action**
> Show me my Stitch projects.
>
> **Format**
> List out each screen under each project and its screen id.

以下のようなレスポンスが表示されます。ただし、使用するツールやモデルによって表示は異なります。

```
1. Raffinato Coffee Store App
Created: Jan 14, 2026 • Desktop • Light Mode • Private

Screens (3):

- Home Menu
- Full Menu
- Checkout
```

各Stitchプロジェクトには複数の画面を含めることができます。これらの画面には、デザインのコードと画像が格納されています。

## 楽しいプロンプト

MCPツールの魅力は、コンテキストに基づくデータ取得とAIモデルのインテリジェンスの統合にあります。Stitchプロジェクトについて理解を求めたり、ローカルマシンのコンテキストに基づいて新しいデザインやコードを生成するようエージェントに指示したりできます。あるいは、ちょっとした楽しい質問を投げかけることもできます。

> **PROMPT**
>
> **For fun**
> Tell me what my Stitch Projects say about me as a developer.

これはとても楽しいプロンプトです。試してみて共有したい方は、ぜひTwitter / Xで教えてください。さて、本題に戻りましょう。

## コードのプロンプト

エージェントが作業対象のプロジェクトや画面を把握したら、コードや生成された画像にアクセスできます。

> **PROMPT**
>
> **Project + Screen**
> Download the HTML code for the Full Menu screen in the Raffinato project.
>
> **Tool Guidance**
> Use a utility such as curl -L
>
> **Action**
> Create a file named ./tmp/${screen-name}.html with the HTML code.

HTMLファイルは、そのデザイン固有のTailwind CSS設定を含む完全な`<html>`ドキュメントです。

### HTMLから他のUIフレームワークへ

LLMはHTMLをさまざまなUIシステムに変換することに優れています。このHTMLファイルが基盤となります。エージェントにプロンプトを送ることで、HTMLをReact、Vue、Handlebarsだけでなく、FlutterやJetpack Composeなど、Webプラットフォーム以外のUIフレームワークにも変換できます。

## 画像のプロンプト

上記と同様に、Stitch画面の画像をエージェントに要求できます。

> **PROMPT**
>
> **Project + Screen**
> Download the image for the Full Menu screen in the Raffinato project.
>
> **Tool Guidance**
> Use a utility such as curl -L
>
> **Action**
> Create a file named ./tmp/${screen-name}.png containing the image.

これで画像のローカルコピーが作成されます。ただし、まだあまり進んでいません。ここからは一気に進めて、画面全体をReactコンポーネントに変換しましょう。

## Stitch MCPでのAgent Skillsの活用

多くのコーディングエージェントは**Agent Skill Open Standard**をサポートしています。スキルは、MCPサーバーからの特定のツール呼び出しなどのリソースと、指示ベースのプロンプトをカプセル化したものです。このスキルパラダイムは、Stitch MCPからReactコンポーネントシステムを生成するのに最適です。

### Reactコンポーネントシステムの作成

**add-skill**ライブラリを使用すると、GitHub URLから最もよく使われるコーディングエージェントにエージェントスキルをインストールできます。

```bash
npx add-skill google-labs-code/stitch-skills --skill react:components --global
```

このスキルは、使用すべきStitchツール、実行する手順、Reactコンポーネントを適切に分離するためのベストプラクティスをエージェントに提供します。具体的な動作の詳細については、**Stitch Agent Skills GitHub repo**をご確認ください。

インストール後、このスキルをトリガーするプロンプトを記述すれば、あとはエージェントが作業を進めてくれます。

> **PROMPT**
>
> **Skill Trigger**
> Convert the Landing Page screen in the Podcast Project.

エージェントが作業を行い、Viteローカルサーバー上で動作するReactアプリが完成します。
