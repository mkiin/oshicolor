# Tailwind サイズ制御 練習問題

各問題の `___` を埋めてください。
答えは一番下にあります。最初は見ないで挑戦してください。

---

## Q1. 基準の識別

次の4つのクラスを「固定値 / 親コンテナ / コンテンツ」に分類してください。

```
w-32 / w-full / w-fit / w-1/2
```

| クラス | 基準         |
| ------ | ------------ |
| w-32   | 固定値       |
| w-full | 親コンテナ   |
| w-fit  | コンテナ自身 |
| w-1/2  | 親コンテナ   |

---

## Q2. h-full の落とし穴

次のコードで、内側の div は期待通り高さ 256px になりますか？なぜですか？

```html
<!-- ケースA -->
<div>
  <div class="h-full bg-red-200">コンテンツ</div>
</div>

<!-- ケースB -->
<div class="h-64">
  <div class="h-full bg-red-200">コンテンツ</div>
</div>
```

- ケースA: \_\_\_（理由: ならない。`h-full`は親コンテナ基準で考えるけれど親に256pxが指定されていないため、fullで指定したとしてもその値にならない）
- ケースB: \_\_\_（理由: 親の高さ基準で考える`h-full`が指定されている、親の高さがh-6, 256pxのためなる

---

## Q3. 制約 vs 固定

「最大 512px まで広がり、画面が狭い場合は縮む」要件を実装してください。

```html
<!-- ❌ これの何が問題か答えてください -->
<div class="w-128">
  <!-- ✅ 正しい実装 -->
  <div class="___"></div>
</div>
```

問題点: \_\_\_

---

## Q4. object-fit の選択

次の2つの用途に適した `object-fit` クラスを選んでください。

```html
<!-- ① イラストの全体をプレビューしたい（切り取りNG）-->
<div class="w-64 h-64">
  <img class="w-full h-full ___" />
</div>

<!-- ② ユーザーアイコンを正方形で統一表示したい（切り取りOK）-->
<div class="w-12 h-12 rounded-full overflow-hidden">
  <img class="w-full h-full ___" />
</div>
```

---

## Q5. レイアウト組み立て

「横幅は最大 768px で中央寄せ、縦は画面全体を占める」ページ全体のレイアウトを実装してください。

```html
<div class="___ ___ ___">
  <!-- コンテンツ -->
</div>
```

---

## Q6. 総合問題

次の要件を満たす画像プレビューカードを実装してください。

要件:

- カードの横幅は親いっぱい
- 画像エリアは 16:9 固定
- 画像は比率を保ってエリアを埋める（多少切れてもOK）
- カードタイトルはコンテンツ幅に合わせた自然なサイズ

```html
<div class="___">
  <div class="___">
    <img class="w-full h-full ___" src="..." alt="..." />
  </div>
  <h2 class="___">タイトル</h2>
</div>
```

---

---

---

## 答え

### Q1

| クラス | 基準               |
| ------ | ------------------ |
| w-32   | 固定値（128px）    |
| w-full | 親コンテナ（100%） |
| w-fit  | コンテンツ         |
| w-1/2  | 親コンテナ（50%）  |

### Q2

- ケースA: **ならない**（理由: 親に高さが設定されていないため `h-full = 100%` の基準がなく、`height: auto` 相当になる）
- ケースB: **なる**（理由: 親が `h-64 = 256px` を持つため、`h-full = 256px` が確定する）

### Q3

```html
<div class="max-w-2xl"></div>
```

問題点: `w-128` は Tailwind に存在しないクラス。また固定値では画面が狭いときにはみ出す。`max-w-` を使えば「最大〇〇まで」という制約になりレスポンシブに対応できる。

### Q4

```html
<!-- ① -->
<img class="w-full h-full object-contain" />

<!-- ② -->
<img class="w-full h-full object-cover" />
```

### Q5

```html
<div class="max-w-3xl mx-auto h-screen"></div>
```

### Q6

```html
<div class="w-full">
  <div class="w-full aspect-video">
    <img class="w-full h-full object-cover" src="..." alt="..." />
  </div>
  <h2 class="w-fit">タイトル</h2>
</div>
```
