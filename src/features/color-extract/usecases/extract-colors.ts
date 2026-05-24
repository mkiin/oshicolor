import type { Colors, ExtractConfig } from "../types/colors";

type GenColors = (bytes: Uint8Array, config: ExtractConfig) => unknown;

// wasm はクライアントでだけ読む。SSR でサーバが wasm js を評価しないよう動的 import にする。
let genPromise: Promise<GenColors> | null = null;

const loadGen = (): Promise<GenColors> => {
  if (genPromise === null) {
    genPromise = import("@generated/wasm/oshicolor_wasm.js").then(
      async (mod) => {
        await mod.default();
        return (bytes, config) => mod.genColorsFromBytes(bytes, config);
      },
    );
  }
  return genPromise;
};

// 画像 Blob と設定を受け取り、wallust v4 を再構築した wasm で 16 色 + bg/fg/cursor の hex を返す。
export const extractColors = async (
  image: Blob,
  config: ExtractConfig,
): Promise<Colors> => {
  const gen = await loadGen();
  const bytes = new Uint8Array(await image.arrayBuffer());
  return gen(bytes, config) as Colors;
};
