import { Swatch } from "@oshicolor/color";
import type { Pixels } from "@oshicolor/image";
import { PQueue } from "./pqueue";
import type { QuantizerOptions } from "./types";
import { VBox } from "./vbox";

/** 第1フェーズで population ソートで使う分割割合 */
const FRACT_BY_POPULATIONS = 0.75;

const splitBoxes = (pq: PQueue<VBox>, target: number): void => {
    let lastSize = pq.size();
    while (pq.size() < target) {
        const vbox = pq.pop();
        if (!vbox || vbox.count() <= 0) break;

        const [vbox1, vbox2] = vbox.split();
        if (!vbox1) break;

        pq.push(vbox1);
        if (vbox2 && vbox2.count() > 0) pq.push(vbox2);

        // 新しいボックスが生成されなくなったら収束
        if (pq.size() === lastSize) break;
        lastSize = pq.size();
    }
};

const generateSwatches = (pq: PQueue<VBox>): Swatch[] => {
    const swatches: Swatch[] = [];
    while (pq.size()) {
        // pq.size() > 0 を確認済みのため安全
        // biome-ignore lint/style/noNonNullAssertion: size() > 0 を while 条件で確認済み
        const v = pq.pop()!;
        swatches.push(new Swatch(v.avg(), v.count()));
    }
    return swatches;
};

/**
 * Modified Median Cut Quantization (MMCQ)
 *
 * ピクセルバッファを量子化して代表色 Swatch 配列を返す。
 * 第1フェーズは population ソート、第2フェーズは population × volume ソートで分割する。
 *
 * @param pixels - RGBA 順の Uint8ClampedArray
 * @param opts - 量子化オプション（colorCount）
 * @returns 代表色の Swatch 配列
 */
export const MMCQ = (pixels: Pixels, opts: QuantizerOptions): Swatch[] => {
    if (pixels.length === 0 || opts.colorCount < 2 || opts.colorCount > 256) {
        throw new Error("Wrong MMCQ parameters");
    }

    const vbox = VBox.build(pixels);
    const pq = new PQueue<VBox>((a, b) => a.count() - b.count());
    pq.push(vbox);

    // フェーズ1: population ソートで分割
    splitBoxes(pq, FRACT_BY_POPULATIONS * opts.colorCount);

    // フェーズ2: population × volume ソートに切り替えて残りを分割
    const pq2 = new PQueue<VBox>(
        (a, b) => a.count() * a.volume() - b.count() * b.volume(),
    );
    pq2.contents = pq.contents;
    splitBoxes(pq2, opts.colorCount);

    return generateSwatches(pq2);
};
