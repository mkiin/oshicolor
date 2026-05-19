---
title: CAM16 並列変換の zero-copy 最適化検証 (SharedArrayBuffer / OffscreenCanvas / ImageBitmap)
labels: [research]
mvp: 3
feature: color-extract
created: 2026-05-19
branch:
---

# CAM16 並列変換の zero-copy 最適化検証

## 何をやるか

`#040` の PoC では `splitRgba` で元の `Uint8ClampedArray` から各 Worker 用 `ArrayBuffer` への 1 回コピーが発生している。これは `ArrayBuffer` を分割 transfer できない制約から来る最小コストだが、SharedArrayBuffer や OffscreenCanvas + ImageBitmap を導入すれば完全ゼロコピーの経路を作れる。本 issue はその実現可能性と性能向上幅を検証する。

検証する 3 アプローチ:

| 案 | 仕組み | 必要な前提 |
|---|---|---|
| A. 元 buffer を全 Worker に structured clone | コピーが Worker 数分発生 | なし |
| B. SharedArrayBuffer | 1 本のバッファを全 Worker で参照 | COOP / COEP ヘッダ |
| C. OffscreenCanvas + ImageBitmap | UI 側で transferControlToOffscreen し Worker 内で getImageData | Worker 内 Canvas API |

## なぜやるか

`#040` のベンチで 1024² で OKLch の 2.29 倍速いことを実測したが、コピー 1 回が残った状態での値になる。oshicolor は数 k² 規模のキャラ画像を扱う想定なので、さらに伸ばせる余地があれば取りたい。

ただし最適化は本実装 (`#035` `#043`) の安定後に行うべきで、現状の `convertPixelsParallel` 構造でも実用速度は十分に出ている。本 issue は急がない研究枠として idea ではなく open に置き、優先度を `mvp = 3` に下げて運用する。

COOP / COEP ヘッダの導入はアプリ全体に影響するので、Cloudflare Workers の応答ヘッダ設定と既存の外部画像読み込み (CORS) との競合確認も本 issue でカバーする。

## 完了条件

- [ ] 案 A / B / C のうち実装可能なものを順に試す
- [ ] 同じ条件 (1024² 画像、Worker 数 8) で `#040` のベンチと比較した速度向上幅を計測
- [ ] COOP / COEP 設定の影響を確認 (外部画像読み込み、iframe 等)
- [ ] 採用判定レポートを `docs/references/cam16/parallel-zero-copy.md` に記録
- [ ] 結果が現状実装より 1.5 倍以上速ければ採用、未満なら現状維持

## 関連

- 出発: docs/issue/done/040-cam16-ucs-ts-poc.md (PoC の備忘)
- 採用判定の前段: docs/references/cam16/ts-port-feasibility.md §6
- 触る予定のファイル: src/features/color-extract/usecases/cam16-parallel.ts, src/features/color-extract/workers/cam16-worker.ts
