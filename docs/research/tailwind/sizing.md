# Tailwind サイズ制御のメンタルモデル

## 核心: 2つの問い

サイズを指定するとき、常にこの2つを問う。

```
① 何を基準にするか？
   → 固定値 / 親コンテナ / コンテンツ自身

② 「上限・下限」か「ちょうど」か？
   → max-/min- / w-/h-
```

---

## スケールの読み方（前提知識）

### 数値スケール（固定値）

Tailwind の数値は **4px 単位**。

| クラス | px    |
| ------ | ----- |
| w-1    | 4px   |
| w-2    | 8px   |
| w-4    | 16px  |
| w-8    | 32px  |
| w-16   | 64px  |
| w-32   | 128px |
| w-64   | 256px |
| w-96   | 384px |

### 名前付きスケール（max-w- 専用）

`max-w-` には T シャツサイズのような名前がある。`w-` には使えない点に注意。

| クラス    | px     | 用途         |
| --------- | ------ | ------------ |
| max-w-xs  | 320px  | モバイル幅   |
| max-w-sm  | 384px  |              |
| max-w-md  | 448px  |              |
| max-w-lg  | 512px  |              |
| max-w-xl  | 576px  |              |
| max-w-2xl | 672px  |              |
| max-w-3xl | 768px  | タブレット幅 |
| max-w-4xl | 896px  |              |
| max-w-5xl | 1024px | PC幅         |

### 特殊キーワード

| クラス   | 意味                   |
| -------- | ---------------------- |
| w-full   | 100%（親コンテナ基準） |
| w-screen | 100vw（ビューポート）  |
| h-screen | 100vh（ビューポート）  |
| w-auto   | auto                   |
| w-fit    | fit-content            |

---

## 基準の3種類

### 1. 固定値

```html
<!-- 数値は 4px 単位 (4 = 16px, 8 = 32px) -->
<div class="w-64 h-32"><!-- 256px × 128px --></div>
```

### 2. 親コンテナ基準（%）

```html
<div class="w-full">
    <!-- width: 100%  親の横幅いっぱい -->
    <div class="h-full">
        <!-- height: 100% 親の高さいっぱい ※落とし穴あり →後述 -->
        <div class="w-1/2"><!-- width: 50%  --></div>
    </div>
</div>
```

### 3. コンテンツ基準

```html
<div class="w-auto">
    <!-- デフォルト。コンテンツに合わせて伸縮 -->
    <div class="w-fit">
        <!-- コンテンツぴったり（はみ出さない） -->
        <div class="w-max"><!-- コンテンツの最大幅（折り返さない） --></div>
    </div>
</div>
```

---

## 上限・下限で「制約する」

固定値で決め打ちするより、**制約で範囲を絞る**ほうが柔軟。

```html
<!-- 最大 512px まで。それ以下は自然サイズ -->
<img class="max-w-lg" />

<!-- 最小 300px は確保。それ以上はコンテンツに従う -->
<div class="min-w-64">
    <!-- 高さは最大 256px まで。溢れない -->
    <div class="max-h-64 overflow-hidden"></div>
</div>
```

### よく使う組み合わせ

```html
<!-- レスポンシブな画像の基本形 -->
<img class="max-w-full h-auto" />
<!--       ↑ 親を超えない   ↑ 縦横比を保つ -->
```

---

## h-full の落とし穴

`h-full` は **親に高さが設定されていないと効かない**。

```html
<!-- ❌ 親に高さがないと h-full は機能しない -->
<div>
    <!-- height: auto (高さ未設定) -->
    <div class="h-full">
        <!-- 効かない -->

        <!-- ✅ 親に高さを与える -->
        <div class="h-64">
            <!-- height: 256px -->
            <div class="h-full">
                <!-- height: 100% = 256px ✅ -->

                <!-- ✅ または親を画面全体に -->
                <div class="h-screen">
                    <!-- height: 100vh -->
                    <div class="h-full"><!-- ✅ --></div>
                </div>
            </div>
        </div>
    </div>
</div>
```

---

## 画像サイズと object-fit

`<img>` はコンテナのサイズに対して「どう収まるか」を `object-fit` で制御する。

```
コンテナ (w-48 h-48)
┌──────────────┐
│              │
│   画像       │
│              │
└──────────────┘
```

| クラス           | 動作                         | 用途               |
| ---------------- | ---------------------------- | ------------------ |
| `object-contain` | 比率を保ってコンテナに収める | イラスト・全体表示 |
| `object-cover`   | 比率を保ってコンテナを埋める | サムネイル・背景   |
| `object-fill`    | 比率を無視して引き伸ばす     | ほぼ使わない       |
| `object-none`    | 元サイズのままクロップ       | 特殊用途           |

```html
<!-- イラストプレビューの推奨形 -->
<div class="w-full max-h-96">
    <img class="w-full h-full object-contain" />
</div>

<!-- サムネイル一覧の推奨形 -->
<div class="w-24 h-24">
    <img class="w-full h-full object-cover" />
</div>
```

---

## 実践: よく使うパターン

### 親いっぱいに広げる

```html
<div class="w-full h-full"></div>
```

### 画面全体を占める

```html
<div class="w-screen h-screen"></div>
```

### 中央に固定幅で表示（ページレイアウト）

```html
<div class="max-w-lg mx-auto">
    <!-- max-w-lg = 最大 512px、mx-auto = 左右中央寄せ -->
</div>
```

### コンテンツに応じて縮む（ボタン等）

```html
<button class="w-fit px-4 py-2"></button>
```

### 縦横比を固定したコンテナ（アスペクト比）

```html
<div class="w-full aspect-video">
    <!-- 16:9 -->
    <div class="w-full aspect-square"><!-- 1:1  --></div>
</div>
```

---

## 判断フローチャート

```
サイズを決めるとき
│
├─ 固定のピクセル数が決まっている？
│   → w-{n} / h-{n}
│
├─ 親コンテナに合わせたい？
│   ├─ 横: w-full
│   └─ 縦: h-full（親に高さが必要）
│
├─ コンテンツに合わせたい？
│   → w-auto / w-fit
│
└─ 「最大〇〇まで」と制約したい？
    → max-w-{n} / max-h-{n}
```
