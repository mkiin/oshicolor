# R2/V9 仕様

実装後に記述する。

## 設計の考え方

- 6 seeds（Vibrant + Muted × 3軸）から neutral palette + syntax fg + UI 色 + diagnostic 色を生成する
- neutral palette は main-V.hue + 極小 chroma + L 9段階で bg/surface/テキストをカバー
- syntax fg は seed の hue/chroma を保ち、bg とのコントラストが取れる L に調整
- diagnostic は固定 hue だが L/C を全体の tone に合わせる
- 初期スコープは 66 ハイライトグループ（Editor UI 26 + Syntax 20 + Diagnostic 16 + Diff 4）
