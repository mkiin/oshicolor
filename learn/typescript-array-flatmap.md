# TypeScript 配列操作: filter + map の non-null assertion 問題と flatMap

## 問題

`filter` で null を除外しても、続く `map` では TypeScript が型絞り込みを引き継がない。

```typescript
// Bad: ! が必要になる
SLOTS.filter((slot) => palette[slot] != null).map((slot) => ({ hex: palette[slot]!.hex })); // ! が必要
```

## 解決: flatMap で1ステップにまとめる

```typescript
// Good: ! 不要
SLOTS.flatMap((slot) => {
  const swatch = palette[slot];
  if (!swatch) return []; // スキップ
  return [{ hex: swatch.hex, slot }];
});
```

変数に受けることで TypeScript が型を確定できる。

## flatMap の使いどころ

| パターン                            | 手法                            |
| ----------------------------------- | ------------------------------- |
| null/undefined をスキップしつつ変換 | `flatMap` + `if (!x) return []` |
| 1要素を複数に展開                   | `flatMap` + 配列を返す          |
| 単純な変換のみ                      | `map` で十分                    |
| 条件だけで絞り込む                  | `filter` で十分                 |

## 代替: 型述語を使う filter（参考）

型述語 `(x): x is T` を書けば `filter` でも絞り込めるが、記述量が増えるため `flatMap` を優先する。

```typescript
SLOTS.map((slot) => (palette[slot] ? { hex: palette[slot]!.hex, slot } : null)).filter(
  (c): c is VibrantColor => c !== null,
);
```
