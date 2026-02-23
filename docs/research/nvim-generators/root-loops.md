# Root Loops 調査レポート

> 調査日: 2026-02-22
> リポジトリ: `sample-repo/nvim-generators/root-loops/`
> 言語: TypeScript (SvelteKit)

---

## 設計思想

**「Hue ホイールを均等分割して ANSI 16色を生成し、そこから全ハイライトを決める」**

直接色を指定しない。6つのパラメータ（スライダー）を操作して色調を決める。
色空間に **Okhsl**（culori ライブラリ）を使用。
OKLab の知覚均一性を HSL の操作感で扱える色空間で、Hue ホイールの等間隔が知覚的にも等間隔になる。

---

## パラメータ体系（`src/lib/ingredients.ts`）

| パラメータ | 型 | 役割 |
|---|---|---|
| `fruit` | enum 12種 | アクセント Hue の起点（0〜360° に均等マッピング） |
| `flavor` | Fruity/Classic/Intense | Hue に +0°/+15°/+30° シフト |
| `artificialColors` | 0〜10 | アクセント彩度（Okhsl S） |
| `sugar` | 1〜10 | アクセント明度（Okhsl L） |
| `milk` | 0〜3 | 背景/前景の明度（ロジスティック関数で連続制御） |
| `sogginess` | 0〜10 | ベース色（bg/fg）の彩度 |

---

## 色生成メカニズム（`src/lib/cereals.ts`）

### アクセント色生成（60° 均等分割）

```typescript
const numberOfAccentColors = 6;
for (let i = 0; i <= numberOfAccentColors; i++) {
  const hue = Math.round(360 / numberOfAccentColors) * i + accentHueShift;
  accentColors.push({ mode: "okhsl", h: hue, s: accentSaturation, l: accentLightness });
}
// → 60°間隔で red/yellow/green/cyan/blue/magenta が生成される
```

### bg/fg 生成（ロジスティック関数）

```typescript
function logisticsFn(a: number, k: number): (x: number) => number {
  // a=左端明度, k=右端明度, milk値[0-3]で連続制御
}

const backgroundFn = logisticsFn(4, 96);   // milk=0→L=4%, milk=3→L=96%
const foregroundFn = logisticsFn(96, 4);   // milk=0→L=96%, milk=3→L=4%
```

milk=0 はダークモード（bg暗/fg明）、milk=3 はライトモード（bg明/fg暗）。

### ANSI カラーへのマッピング

```typescript
// accentColors[0]=red(0°), [1]=yellow(60°), [2]=green(120°),
// [3]=cyan(180°), [4]=blue(240°), [5]=magenta(300°)
red:     accentColors[0]
yellow:  accentColors[1]
green:   accentColors[2]
cyan:    accentColors[3]
blue:    accentColors[4]
magenta: accentColors[5]
```

bright バリアントは `sugar + 1` で同じ式を使い明度を1段上げる。

---

## ロール割り当て（`src/lib/export/neovim.ts`）

ANSI 16色構造（`Cereals`）から直接マッピング。

```typescript
// 構文色
{ group: "@variable.builtin",    fg: c.darkred    }  // this, self
{ group: "@keyword.function",    fg: c.darkmagenta }
{ group: "@type.builtin",        fg: c.darkyellow  }
{ group: "@string.regexp",       fg: c.darkred     }
{ group: "@constructor",         fg: c.yellow      }
{ group: "@markup.heading",      fg: c.darkblue, style: "bold" }

// コメントアノテーション（bg反転）
{ group: "@comment.error",       fg: c.background, bg: c.red }
{ group: "@comment.todo",        fg: c.background, bg: c.blue }
```

ロール割り当ては ANSI 色名（red/green/blue...）の「意味」に基づく固定ルール。
生成された色の実際の Hue に関わらず `red` → エラー系に使われる。

---

## アーキテクチャ

```
入力: パラメータ群（fruit=Hue起点, sugar=明度, etc.）
       ↓
  Okhsl: 60°均等分割でアクセント6色生成
  Okhsl: ロジスティック関数でbg/fg生成
       ↓
  ANSI 16色パレット（Cereals 構造体）
       ↓
  意味ベースの固定マッピング（darkred→エラー/変数, darkblue→見出し等）
       ↓
  Neovim .vim ファイル / VSCode JSON
```

---

## エクスポート形式

- Neovim `.vim` ファイル（truecolor + ANSI fallback 両対応）
- VSCode JSON
- kitty / WezTerm / Alacritty ターミナルテーマ

---

## oshicolor への示唆

- **Okhsl の採用**: 知覚均一な Hue 分割が可能。oshicolor の色空間候補として有力
- **60° 均等分割**: signatureHue を起点に 60° 刻みで6色生成すればアクセントパレットを自動構築できる
- **ロジスティック関数**: milk パラメータによる bg/fg の連続制御は独創的。oshicolor では `signatureHue` + 固定 L で代替可能
- **ANSI 意味ベース**: `red→エラー` という意味割り当ては Root Loops / nvim-highlite の共通解。Diagnostic 色の扱い方として参考になる
