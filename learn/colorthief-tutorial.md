# colorthiefを使って画像から色を抽出してカラーパレットを作ってみた

## はじめに

画像から自動で色を抜き出してカラーパレットを作りたい、という場面がたまにある。デザインツールの配色提案とか、画像に合わせたUIのテーマ生成とか。

自分は `colorthief` というnpmパッケージでこれをやっている。画像を渡すと「この画像で一番使われている色はこれ」「パレットにするとこの5色」みたいなことを教えてくれる。

https://github.com/lokesh/color-thief

npm の年間ダウンロード数は 700万超で、色抽出系のライブラリとしてはデファクトに近い。2026年3月に v3 がリリースされて TypeScript で書き直され、API が一新された。この記事は v3 の内容。

この記事では colorthief の3つの主要API、`getColor`・`getPalette`・`getSwatches` をそれぞれ動かして、何が返ってくるのかを見ていく。

## 準備

```bash
npm install colorthief
```

colorthief はブラウザでもNode.jsでも動く。ブラウザなら `<img>` 要素や `ImageBitmap` を、Node.jsならファイルパスや `Buffer` を渡せる。Node.js で使う場合は `sharp` が peer dependency として必要。

この記事ではブラウザ環境で試す。今回は[pxhere](https://pxhere.com/)で拾ってきたフリー背景画像を使う。

![sunflower-flowers-sun-summer-oil-delicate-1684790-pxhere.com.jpg](https://qiita-image-store.s3.ap-northeast-1.amazonaws.com/0/3879693/1460f962-8182-4e75-8db4-ca57f65402e2.jpeg)

3つのAPIを一気に実行した結果がこれ。上から getColor（代表色1色）、getPalette（16色パレット）、getSwatches（6スロット）。

![getColor・getPalette・getSwatches の実行結果](screenshot.png)

getColor が返した代表色は `#5575bc`。空の青が選ばれた。getPalette の16色を見ると、空の濃淡、ひまわりの黄色、茎葉の緑、地面の茶色と、画像の構成がそのまま色に出ている。getSwatches では Vibrant に `#496bb8`（青）、LightVibrant に `#e2a60f`（黄）が入った。この2色を拾うだけで「ひまわりっぽい配色」が作れる。getPalette だと16色の中から自分で選ぶ必要があるが、getSwatches なら用途別に分類済みなのでそのまま使いやすい。

ここからは各APIの使い方を見ていく。

## getColor: 画像の代表色を1色取得する

一番シンプルなAPI。画像から「この画像を1色で表すならこれ」という色を返す。

```ts
import { getColor } from "colorthief";

const img = document.querySelector("img");
const color = await getColor(img);

color.hex(); // '#e84393'
color.rgb(); // { r: 232, g: 67, b: 147 }
color.isDark; // false
color.textColor; // '#000000'
```

v3 で返ってくる `Color` オブジェクトが地味に便利で、`.hex()` や `.rgb()` はもちろん、`.oklch()` で OkLch 色空間の値も取れる。`.isDark` と `.textColor` を使えば、その色を背景にしたとき白文字と黒文字のどちらが読みやすいかを自分で計算しなくて済む。

```ts
color.oklch(); // { l: 0.64, c: 0.21, h: 353 }
color.css("oklch"); // 'oklch(0.64 0.21 353)'
color.contrast.white; // 3.42（白とのWCAGコントラスト比）
color.contrast.black; // 6.14
```

内部的には `getPalette` を `colorCount: 5` で呼んで、その中から代表色を1つ選んでいる。

## getPalette: カラーパレットを取得する

画像から複数の色を抽出する。`colorCount` で何色取るかを指定できる。

```ts
import { getPalette } from "colorthief";

const img = document.querySelector("img");
const palette = await getPalette(img, { colorCount: 5 });

palette.forEach((color) => {
  console.log(color.hex(), color.proportion);
});
```

`colorCount` のデフォルトは10。2〜20の範囲で指定できる。

返ってくる `Color[]` は population（その色が画像中で占めるピクセル数）順に並んでいる。最初の要素が一番面積の大きい色。各色には `proportion`（0〜1）も付いていて、画像全体のうち何割をその色が占めているかがわかる。

## getSwatches: 意味のある6色を取得する

`getPalette` が「画像に多い色」を返すのに対して、`getSwatches` は色に意味づけをして返してくれる。

```ts
import { getSwatches } from "colorthief";

const img = document.querySelector("img");
const swatches = await getSwatches(img);

if (swatches.Vibrant) {
  header.style.background = swatches.Vibrant.color.css();
  header.style.color = swatches.Vibrant.titleTextColor.css();
}
```

6つのスロットに色が入る。

| スロット     | 意味               | 使いどころ               |
| ------------ | ------------------ | ------------------------ |
| Vibrant      | 鮮やかな色         | メインのアクセントカラー |
| Muted        | 控えめな色         | 背景色                   |
| DarkVibrant  | 暗くて鮮やかな色   | ヘッダー、ステータスバー |
| DarkMuted    | 暗くて控えめな色   | テキスト背景             |
| LightVibrant | 明るくて鮮やかな色 | ハイライト、ホバー       |
| LightMuted   | 明るくて控えめな色 | カード背景、ボーダー     |

注意点として、**スロットが `null` になることがある**。画像によっては該当する色が見つからない。例えばモノクロ写真だと Vibrant 系は全部 null になる。使うときは `?.` でアクセスするのが安全。

各 Swatch には `titleTextColor` と `bodyTextColor` も付いていて、その色の上に文字を置くときに読みやすい色を返してくれる。

## getPalette と getSwatches の違い

自分が最初に混乱したのがこの2つの使い分け。

`getPalette` は画像のピクセルを量子化して「多い順」に色を返す。面積が大きい色が優先されるので、背景色みたいな地味な色が上位に来やすい。

`getSwatches` は内部で16色のパレットを作った後、その中から「鮮やかさ」と「明るさ」の基準で6つの役割に分類する。OkLch という色空間でスコアリングしていて、各スロットにはターゲットとなる明度・彩度が設定されている。

ざっくり言うと:

- 画像に含まれる色をそのまま知りたい → `getPalette`
- UIのテーマカラーとして使いやすい色が欲しい → `getSwatches`

## オプション

ここまでのコード例では省略していたが、各APIには共通のオプションが渡せる。

```ts
const palette = await getPalette(img, {
  colorCount: 8,
  quality: 10,
  colorSpace: "oklch",
  ignoreWhite: true,
  minSaturation: 0.05,
});
```

よく使うものだけ抜粋する。

| オプション      | デフォルト | 説明                                                                           |
| --------------- | ---------- | ------------------------------------------------------------------------------ |
| `colorCount`    | `10`       | パレットの色数。2〜20                                                          |
| `quality`       | `10`       | 何ピクセルごとにサンプリングするか。1なら全ピクセル（遅い）                    |
| `colorSpace`    | `'oklch'`  | 量子化の色空間。`'oklch'` か `'rgb'`。oklch の方が知覚的に均一なパレットになる |
| `ignoreWhite`   | `true`     | 白ピクセルをスキップする                                                       |
| `minSaturation` | `0`        | HSV 彩度がこの値未満のピクセルをスキップ（0〜1）                               |

`colorSpace` は v3 で追加されたオプションで、デフォルトが `'oklch'` になっている。RGB で量子化すると知覚的に偏ったパレットになりがちだが、OkLch だと人間の目で見て均等に散らばった色が出やすい。

`quality` は体感だと10で十分。1にしても結果はほぼ変わらないのに処理時間は跳ね上がる。大量の画像を処理するなら50くらいまで上げても大きな劣化はなかった。

## CLI

コードを書かなくても `npx` でさくっと試せる。

```bash
npx colorthief-cli photo.jpg
# #c94f6e

npx colorthief-cli palette photo.jpg --count 5
# #c94f6e
# #5a8fa3
# #d4a853
# #2d1b4e
# #dfe6e9

npx colorthief-cli swatches photo.jpg
# Vibrant         #e84393
# Muted           #a0b4c0
# DarkVibrant     #8b1a3a
# DarkMuted       #4a5568
# LightVibrant    #f6a5c1
# LightMuted      #d4d8dc
```

`--json` を付けると Color オブジェクトの全プロパティが JSON で出る。CI やスクリプトに組み込みたいときに便利。

## まとめ

colorthief で画像からカラーパレットを作る方法を試した。

- `getColor`: 代表色1色。シンプルに使いたいとき向け
- `getPalette`: N色のパレット。画像の色構成を知りたいとき向け
- `getSwatches`: 意味づけされた6色。UIテーマの自動生成に向いている

自分のプロジェクトでは `getPalette` でドミナントカラーを抽出しつつ、`getSwatches` の Vibrant/Muted 系をアクセント色の候補として使っている。

公式サイトにはライブデモがあって、画像をドラッグ&ドロップして試せる。動画からのリアルタイム抽出（`observe` API）のデモもあるので、気になる人は触ってみるといい。

https://lokeshdhakar.com/projects/color-thief/
