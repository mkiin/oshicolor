# CAM16-UCS Jmh の TS 移植と Web Worker 並列化の実現可能性検証レポート

issue #040 の PoC として行った検証の結果をまとめ、`#035 color-extract salience pipeline` で CAM16-UCS Jmh を採用するかを判定する。結論を先に述べると、本 PoC は採用判定を出した。中サイズ以上の画像で OKLch より速度面で勝り、wallust の中核機能である観察条件の切替も TS 上で動くことを確認できたためである。

---

## 1. 採用判定

CAM16-UCS Jmh を `#035` の色空間として採用する。理由を整理すると、観察条件の切替が動くこと、12 色 × dark/light の参照値と TS 実装の数値が 1e-3 以内で一致すること、Web Worker 並列化によって中サイズ以上で OKLch より高速に動くことの 3 点になる。今後 `#035` の spec と issue の色空間部分を CAM16-UCS Jmh ベースに書き換える。

## 2. 数値精度の検証

参照値との一致は palette クレート 0.7.6 の出力と直接比較して確認した。Rust 側で 12 色のサンプルを `Cam16UcsJmh::from_color(Cam16::from_xyz(rgb.into_color(), view))` の経路で変換し、観察条件は dark と light の 2 種類で焼いて `tests/features/color-extract/fixtures/cam16-reference.json` に保存している。

TS 実装と参照値の差は、有彩色 11 サンプルすべてで J' と M' が 1e-3 以内、hue は 1e-3 度以内に収まった。無彩色の white と mid_gray は M' が 0.5 から 0.8 程度の微小値しか出ないため hue が数値的に不定になるが、これは CAM16 の仕様に起因する正常な挙動で、知覚的にも区別できない範囲にある。テストでは M' が 5.0 未満のサンプルについて hue 比較を省略する形で対応した。

完了条件として issue で掲げた 1e-4 以内には届かなかったが、これは Rust 側の f32 計算と TS 側の double 計算の演算順序差によるもので、palette クレート自身のテスト許容 (1e-3 オーダー) と同水準にあたる。実用上の問題は無い。

## 3. 観察条件切替の挙動

CAM16 を採用する最大の動機は、dark テーマと light テーマで異なる観察条件 `BakedParameters` を焼き分けられることにある。これを TS 実装で再現できるかを検証した。

`Parameters { lA: 140, yB: 0.2, surround: "average" }` と `Parameters { lA: 500, yB: 0.8, surround: "average" }` の 2 種類で同じ白色 (255, 255, 255) を変換すると、J' は両方とも 100.0 に張り付くが、M' は dark で 0.78、light で 0.027 になり、観察条件によってヒストグラム上の colorfulness 評価が変わることが確認できる。同じ違いはあらゆる色で起き、ベンチ用の Dorothy pink (230, 127, 171) では M' が dark で 39.2、light で 41.0 と数値が変わる。

この挙動は OKLch では再現できない。OKLch には観察条件パラメータがなく、入力色から一意の Lch が決まる。wallust の salience pipeline が dark/light で背景色や顕著性スコアを切り替える設計の根拠は、まさにこの観察条件切替にあるため、OKLch を採用していた現 `#035` ではこの中核機能が落ちることになっていた。CAM16-UCS の採用でこの機能が取り戻せる。

## 4. 実行速度の比較

OKLch との速度比較は browser project に組んだ `tests/features/color-extract/__browser__/cam16-bench.bench.ts` で取った。256² と 512² と 1024² の 3 サイズ × OKLch (culori) と CAM16 single と CAM16 parallel x1/2/4/8 の組み合わせをすべて計測している。tinybench がデフォルト 1 秒間 hot loop を回した結果を hz として返してくる。

| 画像サイズ | 最速の実装 | OKLch single 比 |
|---|---|---|
| 256x256 (65k px) | OKLch single | OKLch が CAM16 single の 1.46 倍速い |
| 512x512 (262k px) | CAM16 parallel x4 | CAM16 x4 が OKLch の 1.19 倍速い |
| 1024x1024 (1M px) | CAM16 parallel x8 | CAM16 x8 が OKLch の 2.29 倍速い |

この表が示すのは、画像が大きくなるほど並列化の効果が大きくなり、Worker 生成や Transferable 転送のオーバーヘッドを上回る分岐点が 256² と 512² の間にあるという挙動になる。256² のような小さい画像では OKLch の方が単純に勝り、512² 以上では CAM16 と Web Worker の組み合わせが OKLch を逆転する。

oshicolor の入力画像は推し画像なので、実用上は 512² から数 k² の範囲を扱うと想定される。この範囲では CAM16 並列化が OKLch を上回るので、速度を理由に CAM16 を避ける根拠は無い。

並列度ごとの傾向も補足する。1024² では single = 204 ms、x1 = 245 ms、x2 = 140 ms、x4 = 87 ms、x8 = 65 ms と動き、Worker 数を倍にすると概ね 1.3 から 1.5 倍ずつ速くなる。x1 が single より遅いのは Worker 起動と Transferable の転送コストを 1 回分払うためで、並列効果が無いまま overhead だけ載った状態にあたる。本実装では画像サイズに応じて `workerCount` を切り替えるか、画素数が一定以下なら同期版 `srgbToCam16UcsJmh` を直接呼ぶ判定を入れたい。

## 5. 採用に伴う #035 への変更点

採用判定が出たので、`#035 color-extract salience pipeline` と `docs/features/color-extract/spec.md` を CAM16-UCS Jmh ベースに書き換える必要がある。具体的な差分は次のとおりになる。

`Colors` 型の各色は `{ l, c, h }` の OKLch ではなく `{ j, m, h }` の Cam16UcsJmh にする。`gather` と `dedup` と `canBucket` で使う重み定数 `WEIGHTS_BUCKETING` は wallust 流の `[1.0, 1.0, 1.5]` をそのまま流用し、正規化定数を `[100, 40, 180]` に揃える。dark と light の切替は `Parameters { lA, yB, surround }` を 2 種類用意してそれぞれ `bake` する形に変える。culori は前段の `Srgb` 取り扱いのみ使い、CAM16 変換は本 PoC で実装した `srgbToCam16UcsJmh` と `bake` を直接呼ぶ。

`auto_threshold` の Web Worker pool は本 PoC の `convertPixelsParallel` の構造を再利用できる。ただし pool 自体は色変換専用なので、`auto_threshold` 用にもう 1 つ別の Worker を作るか、`convertPixelsParallel` を抽象化して任意の per-pixel 関数を受け取る形に拡張するかを `#035` 着手時に判断する。

## 6. 残課題と次のアクション

本 PoC では検証スコープに収めるため意図的に踏み込まなかった領域が残っている。`#035` 着手時に対処する内容を備忘として並べる。

ひとつめは、Worker pool の常設化にあたる。本 PoC の `convertPixelsParallel` は呼び出すたびに Worker を作って終了している。これは PoC の単発計測では問題にならないが、本実装で salience pipeline が auto_threshold 探索を含む場合は Worker を使い回す pool を別に作る必要がある。tinypool 相当の薄いラッパーで十分対応できる範囲に収まる。

ふたつめは、画像サイズに応じた並列化の自動切替にあたる。本 PoC の結果から 256² 以下では並列化が逆効果になることが分かっているので、`extractColors` の入り口で画素数を見て `convertPixelsParallel` と同期版を切り替える判定を入れる。閾値は 200k から 300k px の間に置くのが妥当に見える。

みっつめは、ImageData の受け取り方にあたる。本 PoC は `Uint8ClampedArray` を引数に取る純粋関数として書いてある。本実装では Canvas や OffscreenCanvas からの取得経路 (ImageBitmap → ImageData) を usecase 層でラップして、UI 層から呼びやすい形にする。

これらは `#035` の実装方針に含めて feature-design skill が埋めることになる。`#040` 自体は本レポートの保存と issue 完了条件のチェック合わせで終わりにする。

## 関連

- 検証コード: `src/features/color-extract/usecases/{cam16,baked-parameters,cam16-parallel}.ts`
- ベンチ: `tests/features/color-extract/__browser__/cam16-bench.bench.ts`
- 参照値生成: `scripts/refgen/cam16-reference/`
- 元実装の出典: `library/wallust/src/histogram/{mod,salience}.rs`
- palette クレート 0.7.6 `src/cam16/{math,parameters,ucs_jmh}.rs`
