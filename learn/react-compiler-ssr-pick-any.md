# React Compiler を SSR に誤適用して起きた3層のバグ

## 概要

`@vitejs/plugin-react` v6 + `@rolldown/plugin-babel` で React Compiler を有効化したとき、SSR クラッシュと TypeScript 型エラーが同時に発生した。原因を追うと、ランタイムエラー・ライブラリ設計・TypeScript 言語仕様の3層が絡み合っていた。

---

## 発端：SSR クラッシュ

`vp dev` を起動すると以下のエラーが出た。

```
TypeError: Cannot read properties of null (reading 'useMemoCache')
    at react_compiler-runtime.js
    at RootDocument (__root.tsx:37)
```

`useMemoCache` は React Compiler が生成するコードが使う内部フック。SSR（`react-dom/server`）のレンダリング中に、このフックのディスパッチャが `null` になっているためクラッシュした。

ログに `✨ new dependencies optimized: react/compiler-runtime` が出ていた。これは「変更前まで使われていなかったモジュールが今回から使われ始めた」というサインで、直前の設定変更が原因だと絞り込めた。

---

## 原因 1：`plugins` と `presets` で環境フィルタリングの可否が変わる

### 変更前の設定

```ts
babel({
    plugins: ["babel-plugin-react-compiler"],
});
```

### `@rolldown/plugin-babel` の `applyToEnvironment` フック

```ts
// packages/babel/src/index.ts
applyToEnvironment(environment: PartialEnvironment) {
    const envOptions = filterPresetsWithEnvironment(configFilteredOptions!, environment)
    if (
        !envOptions.presets?.length &&
        !envOptions.plugins?.length &&   // ← plugins があると常に true
        !envOptions.overrides?.some(...)
    ) {
        return false  // この環境には適用しない
    }
    return true
}
```

`filterPresetsWithEnvironment` は `presets` のみを環境でフィルタリングする。`plugins` は環境に関係なく常にそのまま残る。そのため `!envOptions.plugins?.length` は `false` になり、`applyToEnvironment` は client/ssr を問わず `true` を返す。

### ソースから確認

```ts
// packages/babel/src/options.ts
export function filterPresetsWithEnvironment(
    options: PluginOptions,
    environment: PartialEnvironment,
): PluginOptions {
    return {
        ...options,
        presets: options.presets
            ? filterPresetArrayWithEnvironment(options.presets, environment)
            : undefined,
        // plugins はフィルタされない
    };
}
```

`plugins` はどこにも触れていない。`presets` を使い `RolldownBabelPreset` の `applyToEnvironmentHook` を実装しないと環境制御ができない設計になっている。

---

## 原因 2：`reactCompilerPreset()` が正しい解決策だった

`@vitejs/plugin-react` v6 が提供する `reactCompilerPreset` の実装：

```ts
// packages/plugin-react/src/reactCompilerPreset.ts
export const reactCompilerPreset = (options = {}): RolldownBabelPreset => ({
    preset: () => ({
        plugins: [["babel-plugin-react-compiler", options]],
    }),
    rolldown: {
        filter: {
            // React コンポーネントらしいファイルのみ変換（パフォーマンス最適化）
            code:
                options.compilationMode === "annotation"
                    ? /['"]use memo['"]/
                    : /\b[A-Z]|\buse/,
        },
        // クライアント環境のみに適用
        applyToEnvironmentHook: (env) => env.config.consumer === "client",
        optimizeDeps: {
            include:
                options.target === "17" || options.target === "18"
                    ? ["react-compiler-runtime"]
                    : ["react/compiler-runtime"],
        },
    },
});
```

`applyToEnvironmentHook: (env) => env.config.consumer === "client"` によって SSR 環境を自動で除外している。また `filter.code` でコンポーネントやフックを含むファイルのみにトランスフォームを絞ることでビルドパフォーマンスも改善している。

### 正しい設定

```ts
import viteReact, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";

// @ts-expect-error - @rolldown/plugin-babel の型バグ（後述）
babel({ presets: [reactCompilerPreset()] });
```

---

## 原因 3：`Pick<any, K>` で全プロパティが必須になる TypeScript の挙動

`babel({ presets: [reactCompilerPreset()] })` と書いたとき、TypeScript が以下のエラーを出した。

```
Argument of type '{ presets: RolldownBabelPreset[]; }' is not assignable
to parameter of type 'PluginOptions'.
Type '{ presets: RolldownBabelPreset[]; }' is missing the following
properties from type 'PluginOptions': plugins, assumptions,
auxiliaryCommentAfter, ... ts(2345)
```

`PluginOptions` で `plugins` が **必須** になっているという意味だが、ソース上は optional のはずだ。

### 型推論の連鎖

```ts
// @rolldown/plugin-babel/dist/index.d.mts

// Babel 7 では babel.InputOptions が存在しない → any
type InputOptions8 = babel.InputOptions

// IsAny<any> = true なので InputOptions = TransformOptions（Babel 7 の型）
type InputOptions = IsAny<InputOptions8> extends false
    ? InputOptions8
    : TransformOptions

// Pick<TransformOptions, 'plugins' | ...> のはずが...
interface InnerTransformOptions extends Pick<
    InputOptions,
    'plugins' | 'assumptions' | 'auxiliaryCommentAfter' | ...
> { ... }
```

ここで `InputOptions` が `TransformOptions` に解決されれば `plugins?`（optional）になるが、実際には型の解決が想定通りに進まず `any` のままになることがある。

### `Pick<any, K>` の挙動

```ts
type A = Pick<any, "plugins" | "assumptions">;
// → { plugins: any; assumptions: any }  ← required！optional ではない
```

TypeScript において `Pick<any, K>` は各キーを `any` 型の **必須プロパティ** として展開する。`any` は型の境界を溶かすため、元の型の optional 修飾子 `?` が失われる。

つまり、`@babel/core@7.x` で `babel.InputOptions` が `any` になった時点で、`Pick<any, 'plugins' | ...>` によって `InnerTransformOptions` の全フィールドが必須になり、`PluginOptions` を満たすには `plugins` 等を明示的に渡す必要が生じる。

### `@ts-expect-error` の配置ミスが重なった

加えて、`@ts-expect-error` の配置に問題があった。

```ts
// @ts-expect-error - 説明1行目       ← suppress はここの次の行に適用
// 説明2行目                           ← suppress がここに適用される（エラーなし）
babel({ presets: [reactCompilerPreset()] }); // ← エラーが素通り
```

`@ts-expect-error` は **直後の1行** のエラーを抑制する。間にコメント行が入ると suppress がずれ、対象行のエラーが抑制されなくなる。

```ts
// 正しい配置
// @ts-expect-error - 1行で収める
babel({ presets: [reactCompilerPreset()] });
```

---

## まとめ

| 層                  | 問題                                                               | 解決策                                              |
| ------------------- | ------------------------------------------------------------------ | --------------------------------------------------- |
| ランタイム          | SSR に React Compiler が適用されて `useMemoCache` がクラッシュ     | `reactCompilerPreset()` を使う                      |
| ライブラリ設計      | `plugins` 指定では `applyToEnvironment` が環境フィルタを効かせない | `presets` + `RolldownBabelPreset` を使う            |
| TypeScript 言語仕様 | `Pick<any, K>` で全プロパティが必須になる                          | `@ts-expect-error` で抑制（ライブラリ側の修正待ち） |
| `@ts-expect-error`  | 複数行コメントで suppress がずれる                                 | suppress 対象行の直前1行に配置する                  |

React Compiler 自体のバグではなく、Babel 7/8 の型定義の過渡期と、プラグインの環境フィルタリング設計の理解不足が重なった問題だった。
