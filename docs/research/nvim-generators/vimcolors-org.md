# vimcolors.org 調査レポート

> 調査日: 2026-02-22
> リポジトリ: `sample-repo/nvim-generators/vimcolors.org/`
> 言語: TypeScript (Next.js)

---

## 設計思想

**「8スロット色入力 UI から Vim カラースキームを即座に生成してダウンロードできる Web ツール」**

ターゲットはカラーカスタマイズ初心者。
コード記述不要で、カラーピッカーをクリックするだけでテーマが完成する。
生成は `vim-colors` npm パッケージに委譲しており、vimcolors.org 自体は UI と色管理のみを担当する。

---

## 入力色スロット（`lib/colors.ts`）

```typescript
type Colors = {
  bg?: string; // 背景色
  fg?: string; // 前景色（文字色）
  comments?: string; // コメント色
  menus?: string; // メニュー・ステータスバー色
  color1?: string; // アクセント1
  color2?: string; // アクセント2
  color3?: string; // アクセント3
  color4?: string; // アクセント4
  color5?: string; // アクセント5
  color6?: string; // アクセント6
};
```

合計 10スロット（bg/fg/comments/menus + 6アクセント）。

---

## UI コンポーネント（`components/Terminal/Terminal.tsx`）

### プレビュー表示

TypeScript のコードサンプルをリアルタイムプレビューとして表示。
各 Token（構文要素）に色スロットをマッピングしてプレビューする。

```tsx
const W1 = ({ children }) => <Token c="color1">{children}</Token>  // 変数
const W2 = ({ children }) => <Token c="color2">{children}</Token>  // キーワード
const W3 = ({ children }) => <Token c="color3">{children}</Token>  // 文字列
const W4 = ({ children }) => <Token c="color4">{children}</Token>  // 関数
const W5 = ({ children }) => <Token c="color5">{children}</Token>  // import
const W6 = ({ children }) => <Token c="color6">{children}</Token>  // 括弧
const Comment = ...  // コメント
```

プレビューコード:

```typescript
import vimColors from "vim-colors";
// We'll use this later
function poweredBy() {
  console.log("powered by vimcolors.org");
}
class Theme {
  constructor(private name: string) { ... }
}
```

### 色明度判定（`lib/colors.ts`）

```typescript
// ITU-R BT.601 相対輝度
const brightness = (r * 299 + g * 587 + b * 114) / 1000;
const isLightOrDark = brightness > 155 ? "light" : "dark";
```

bg 色から dark/light を自動判定し、テーマの背景モードを設定する。

---

## 生成・ダウンロード（`lib/file.ts`）

```typescript
import vim from "vim-colors";  // npm パッケージ

function generate(name: string, colors: Colors, darkOrLight: "dark" | "light") {
  const vimScript = vim(name, {
    dark: darkOrLight === "dark",
    bg: ..., fg: ..., comments: ..., menus: ...,
    scheme: [color1, color2, color3, color4, color5, color6],
  });

  download(`${name}.vim`, vimScript);  // ブラウザダウンロード
}
```

色のロールへの展開は `vim-colors` npm パッケージが担当。
vimcolors.org は入力と配信のみを行う。

---

## デフォルト色

初期値は `sick-colors` パッケージ（作者の公開テーマ）から取得。

```typescript
import sick from "sick-colors";
const [colors, setColors] = useState<Colors>({
  bg: sick.background,
  fg: sick.foreground,
  comments: sick.magenta,
  menus: sick.black,
  color1: sick.red,
  color2: sick.green,
  color3: sick.yellow,
  color4: sick.blue,
  color5: sick.magenta,
  color6: sick.cyan,
});
```

---

## アーキテクチャ

```
UI: カラーピッカー（react-color SketchPicker）
       ↓
  Colors 状態管理（React useState）
  bg 変更 → isLightOrDark() → dark/light 自動切替
       ↓
  プレビュー: Token コンポーネントがリアルタイム更新
       ↓
  ダウンロード: vim-colors(name, {...}) → .vim ファイル
```

---

## 6色スロットの割り当て推測

vimcolors.org のプレビューから推測した slot の意味:

| スロット | プレビュー上の用途                                     |
| -------- | ------------------------------------------------------ |
| color1   | 変数・識別子                                           |
| color2   | キーワード（function, class, private, static, return） |
| color3   | 文字列リテラル                                         |
| color4   | 関数名・メソッド名                                     |
| color5   | import キーワード                                      |
| color6   | 括弧                                                   |

実際の Vim グループへの展開は `vim-colors` パッケージ内部で行われる。

---

## oshicolor への示唆

- **8スロット設計**: bg/fg/comments/menus + 6アクセントという分割は直感的。oshicolor の生成結果もこの枠組みで整理できる
- **`vim-colors` の実装参照**: npm パッケージが実際の展開ロジックを持っているため、そちらの調査が必要
- **輝度判定**: BTU-R BT.601 による `(r*299 + g*587 + b*114) / 1000` は oshicolor の color-extractor と同じ手法（係数が近い）
- **プレビューファースト**: 色を選ぶ → 即座にコードに色が付く UX は oshicolor の Web アプリ設計でも参考になる
