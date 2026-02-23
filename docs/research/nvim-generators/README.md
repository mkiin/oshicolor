# Neovim カラースキーム生成ツール 調査まとめ

> 調査日: 2026-02-22

各プロダクトの個別調査は対応するファイルを参照。

---

## プロダクト一覧

| ファイル | プロダクト | 言語 | 入力方式 |
|---|---|---|---|
| [xeno-nvim.md](./xeno-nvim.md) | xeno.nvim | Lua | 2色 → HSL 10段階スケール |
| [root-loops.md](./root-loops.md) | Root Loops | TypeScript | 6パラメータ → Okhsl 均等分割 |
| [nvim-highlite.md](./nvim-highlite.md) | nvim-highlite | Lua | 50+セマンティックロール |
| [lush-nvim.md](./lush-nvim.md) | lush.nvim | Lua | DSL + 色の関係式 |
| [colorgen-nvim.md](./colorgen-nvim.md) | colorgen-nvim | Rust | TOML テンプレート |
| [vimcolors-org.md](./vimcolors-org.md) | vimcolors.org | TypeScript | Web UI 8スロット |

---

## 設計思想の比較

| 観点 | xeno.nvim | Root Loops | nvim-highlite | lush.nvim | colorgen-nvim | vimcolors.org |
|---|---|---|---|---|---|---|
| 入力の少なさ | ★★★（2色） | ★★★（パラメータ） | ★（50+色） | △（DSL） | ★★（TOML） | ★★（8スロット） |
| 色空間 | HSL | Okhsl | RGB整数 | HSL / HSLuv | RGB (#hex) | RGB (#hex) |
| 生成方式 | トーンスケール | Hue均等分割 | 直接定義 | 関係式派生 | テンプレート展開 | パッケージ委譲 |
| Diagnostic | 固定（red固定） | ANSI red 対応 | 専用4色 | ユーザー次第 | ユーザー次第 | vim-colors 依存 |
| TreeSitter 対応 | link（一部直接） | link（ANSI経由） | link（FW） | link / inherit | link 記法 | vim-colors 依存 |
| 配布用エクスポート | なし | .vim / JSON | .lua / .vim | Shipwright | .lua 生成 | .vim ダウンロード |

---

## oshicolor への主要示唆

### 色生成アプローチ

1. **xeno.nvim 方式（トーンスケール）**: OKLch で signatureColor を10段階スケールに展開。L=0.90→fg, L=0.12→bg 等を固定ルールで決定
2. **Root Loops 方式（Hue 均等分割）**: signatureHue を起点に Okhsl 60° 刻みで6アクセント色を自動生成
3. **組み合わせ**: bg/fg はトーンスケール、アクセントは Hue 均等分割の組み合わせが最も有望

### ロール設計

1. **クラスター化（nvim-highlite から）**: keyword/loop/conditional を同色クラスターに分類し、6色入力で全グループを展開
2. **Diagnostic 固定色**: error(赤系)/warning(橙)/hint(紫)/info(青) は自動生成せず固定色として別枠管理
3. **italic/bold のセマンティクス**: conditional=italic, exception=bold 等の慣習は設計しやすく採用する価値がある

### Lua 出力

1. **現代的な API**: `vim.api.nvim_set_hl(0, "group", attrs)` を使う（colorgen-nvim の実装）
2. **セクション分割**: highlights / Treesitter / LSP / Plugin 系を分けてコメントを付ける
3. **パレット分離**: `palette.lua` + `theme.lua` の2ファイル構成が可読性・保守性に優れる
