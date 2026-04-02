# デバイスタイプ

App と Web の間でキャンバスを選択し、デザインを変換する方法。

Stitch でプロジェクトを開始すると、**App** か **Web** かの選択を求められます。

これは単なる画面サイズの問題ではなく、**Primary Design Surface（主要デザインサーフェス）** を定義することです。デバイスタイプによって、Stitch がレイアウト、ナビゲーション、階層構造をどのように解釈するかが決まります。

## レイアウトはコンテキストに依存する

- **App Mode:** 垂直スクロール、画面下部に配置されたナビゲーション（サムゾーン）、スタック型コンテンツに最適化されています。
- **Web Mode:** 水平方向の広がり、画面上部に配置されたナビゲーション、マルチカラムグリッドに最適化されています。

App Mode でデザインされた画面をデスクトップで表示すると、大きなアプリのように見えます。逆に、Web Mode のデザインをスマートフォンの画面に詰め込むと、重要な詳細やネイティブモバイルアプリで期待される UI コンポーネントが失われることがよくあります。

## モード間のデザイン変換

あるプラットフォームから別のプラットフォームへ移行する最良の方法は、リサイズすることではなく、**翻訳（トランスレート）** することです。

モバイルアプリのデザインがあり、Web バージョンが必要な場合は、そのデバイスタイプに最適化するために何を変更する必要があるかを説明するプロンプトを作成してください。まず、既存のデザインを新しいプロジェクトの **Reference Image** として使用するか、新しい画面の更新として使用します。新しい画面の場合、Stitch の現在の動作では少しコツが必要ですが、以下でそれをスムーズにする方法をいくつか説明します。

### Phase 1: App デザイン

Raffinato アプリの例を見てみましょう。Raffinato はイタリア語で「洗練された」という意味です。モバイル注文フローが最も重要だったため、このプロジェクトは App Mode で開始されました。

> **PROMPT**
>
> **Idea**
> An ordering app for a local quality obsessed espresso focused coffee shop named Raffinato.
>
> **Theme**
> A light, high contrast theme with a modern and minimalistic feel.
>
> **Content**
> Prefer a variable sized grid layout: 1 column on one row, followed by 2 columns on the next. Break up the grid into sections with labels categorizing the types of drinks in each section. Provide a mobile ordering layout for common espresso drinks with placeholder values for prices. Focus on the typographic balance for menu items placing the visual emphasis on the item name and less emphasis on details such as size in ounces, and price.
>
> **Navigation**
> Provide navigation to easily switch screens between main grid, details, and the cart.

このプロンプトにより、スマートフォンに最適な、コンパクトで垂直方向のインターフェースが生成されます。

### Phase 2: Web への変換

Web に移行するには、Web Mode に設定した新しいプロジェクトを作成するか、既存のプロジェクトで更新プロンプトを入力し、画面のダウンロード画像をリファレンスとして使用します。

ここでの目標は、より広い画面スペースをどのように活用するかを Stitch に伝えることです。**Navigation**、**Hero Section**、**Grid Density** など、変更が必要な主要な UI/UX の側面に焦点を当ててください。

以下は、デバイスタイプの変換をプロンプトで処理する方法です：

> **PROMPT**
>
> **Navigation**
> Consolidate the bottom tab bar and top menu into a single, horizontal navigation bar at the top of the screen with links for Home, Menu, Rewards, and Account.
>
> **Hero**
> Transform 'The Daily Focus' card into a split-layout hero section. Place the Cortado text and button on the left, and expand the image to cover the right side.
>
> **Grid Layout**
> Update the product lists from a 2-column mobile layout to a 4-column desktop grid. Maintain the light cream card background and minimalist vibe.

ナビゲーションを上部に移動し、ヒーローコンテンツを分割するよう Stitch に明示的に指示することで、ブランドの雰囲気を保ちながら、デバイスタイプの特性に合わせてデザインを最適化することに焦点を当てています。

## 同じプロジェクト内でのデバイスタイプの切り替え

特定のデバイスタイプで Stitch プロジェクトを作成すると、そのデバイスタイプのサイズで画面が生成され続けます。同じプロジェクト内で別のデバイスタイプに変換するプロンプトを Stitch に与えることはできますが、手動での調整が必要です。

App プロジェクト内で Web プロンプトを生成すると、Stitch は App フレーム内に Web コンテンツを生成します。

- デザインを生成する。
- **Preview > Device Type** を使用して、意図するターゲット（例：Desktop）にビューを切り替える。
- 要素が切れている場合は、フレームを手動でリサイズする。

**Pro Tip: 隠れたコンテンツ**

同じプロジェクト内で App から Web に切り替える場合、デザインフレームの垂直方向の高さを大幅に増やしてみてください。Stitch はウェブサイトの「残りの部分」のロジックを生成していることが多いですが、元の App フレームが短すぎるために非表示になっています。フレームハンドルを下にドラッグすると、レイアウトの残りの部分が表示されることがあります。
