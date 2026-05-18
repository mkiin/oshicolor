// Web Worker: ImageData の RGBA バイト列の一部 (chunk) を受け取り、各画素を CAM16-UCS Jmh に
// 変換した Float32Array (J,M,h を 3 要素ずつ) を返す。BakedParameters は構造体なので postMessage の
// 構造化クローンで渡す (画像非依存のため毎回送っても安価)。

import { bake } from "../usecases/baked-parameters.ts";
import { srgbToCam16UcsJmh } from "../usecases/cam16.ts";
import type { Parameters } from "../types/cam16.ts";

export type ConvertRequest = {
    /** 識別子 (Worker pool で複数 chunk を投げ分けるとき用) */
    id: number;
    /** RGBA バイト列の chunk (4 バイト × N 画素) */
    rgba: ArrayBuffer;
    /** 観察条件パラメータ。Worker 内で bake() し直す */
    params: Parameters;
};

export type ConvertResponse = {
    id: number;
    /** J, M, h を 3 要素ずつ並べた Float32Array (画素数 × 3) */
    jmh: ArrayBuffer;
};

const handleMessage = (event: MessageEvent<ConvertRequest>): void => {
    const { id, rgba, params } = event.data;
    const baked = bake(params);
    const bytes = new Uint8ClampedArray(rgba);
    const pixels = bytes.length >>> 2;
    const out = new Float32Array(pixels * 3);
    for (let i = 0; i < pixels; i++) {
        const jmh = srgbToCam16UcsJmh([bytes[i * 4], bytes[i * 4 + 1], bytes[i * 4 + 2]], baked);
        out[i * 3] = jmh.j;
        out[i * 3 + 1] = jmh.m;
        out[i * 3 + 2] = jmh.h;
    }
    const response: ConvertResponse = { id, jmh: out.buffer };
    // 出力 buffer を Transferable で返してゼロコピー。
    (self as DedicatedWorkerGlobalScope).postMessage(response, [out.buffer]);
};

(self as DedicatedWorkerGlobalScope).addEventListener("message", handleMessage);
