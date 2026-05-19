import type { ConvertRequest, ConvertResponse } from "../workers/cam16-worker.ts";
import type { Parameters } from "../types/cam16.ts";

export type ConvertOptions = {
    workerCount?: number;
};

const splitRgba = (rgba: Uint8ClampedArray, chunks: number): Uint8ClampedArray[] => {
    const pixels = rgba.length >>> 2;
    const baseChunkPixels = Math.floor(pixels / chunks);
    const remainder = pixels % chunks;
    const result: Uint8ClampedArray[] = [];
    let cursor = 0;
    for (let i = 0; i < chunks; i++) {
        const chunkPixels = baseChunkPixels + (i < remainder ? 1 : 0);
        const byteLen = chunkPixels * 4;
        const slice = new Uint8ClampedArray(byteLen);
        slice.set(rgba.subarray(cursor, cursor + byteLen));
        result.push(slice);
        cursor += byteLen;
    }
    return result;
};

const defaultWorkerCount = (): number => {
    const cores = typeof navigator !== "undefined" ? (navigator.hardwareConcurrency ?? 4) : 4;
    return Math.max(1, cores - 1);
};

export const convertPixelsParallel = async (
    rgba: Uint8ClampedArray,
    params: Parameters,
    options: ConvertOptions = {},
): Promise<Float32Array> => {
    const workerCount = options.workerCount ?? defaultWorkerCount();
    const chunks = splitRgba(rgba, workerCount);
    const totalPixels = rgba.length >>> 2;
    const out = new Float32Array(totalPixels * 3);

    const workers: Worker[] = chunks.map(
        () => new Worker(new URL("../workers/cam16-worker.ts", import.meta.url), { type: "module" }),
    );

    try {
        const promises = workers.map(
            (worker, idx) =>
                new Promise<{ id: number; data: Float32Array }>((resolve, reject) => {
                    worker.addEventListener("message", (event: MessageEvent<ConvertResponse>) => {
                        resolve({ id: event.data.id, data: new Float32Array(event.data.jmh) });
                    });
                    worker.addEventListener("error", (event) => {
                        reject(new Error(`worker ${idx} error: ${event.message}`));
                    });
                    const chunk = chunks[idx];
                    const req: ConvertRequest = { id: idx, rgba: chunk.buffer, params };
                    worker.postMessage(req, [chunk.buffer]);
                }),
        );

        const responses = await Promise.all(promises);
        responses.sort((a, b) => a.id - b.id);

        let offset = 0;
        for (const { data } of responses) {
            out.set(data, offset);
            offset += data.length;
        }
    } finally {
        for (const w of workers) w.terminate();
    }

    return out;
};
