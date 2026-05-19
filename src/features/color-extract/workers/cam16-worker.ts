import { bake } from "../usecases/baked-parameters.ts";
import { srgbToCam16UcsJmh } from "../usecases/cam16.ts";
import type { Parameters } from "../types/cam16.ts";

export type ConvertRequest = {
    id: number;
    rgba: ArrayBuffer;
    params: Parameters;
};

export type ConvertResponse = {
    id: number;
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
    (self as DedicatedWorkerGlobalScope).postMessage(response, [out.buffer]);
};

(self as DedicatedWorkerGlobalScope).addEventListener("message", handleMessage);
