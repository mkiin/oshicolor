import type { Vec3 } from "@oshicolor/color";
import type { Pixels } from "@oshicolor/image";
import { Histogram } from "@oshicolor/image";

const SIGBITS = 5;
const RSHIFT = 8 - SIGBITS;

type Dimension = {
    r1: number;
    r2: number;
    g1: number;
    g2: number;
    b1: number;
    b2: number;
    [d: string]: number;
};

/**
 * RGB 色空間の直方体（VBox）
 *
 * MMCQ アルゴリズムの基本単位。直方体を繰り返し二分割することで代表色を生成する。
 */
export class VBox {
    static build(pixels: Pixels): VBox {
        const h = new Histogram(pixels, { sigBits: SIGBITS });
        const { rmin, rmax, gmin, gmax, bmin, bmax } = h;
        return new VBox(rmin, rmax, gmin, gmax, bmin, bmax, h);
    }

    dimension: Dimension;
    private _volume = -1;
    private _avg: Vec3 | null = null;
    private _count = -1;

    constructor(
        r1: number,
        r2: number,
        g1: number,
        g2: number,
        b1: number,
        b2: number,
        public histogram: Histogram,
    ) {
        // dimension は split 操作で変更されるため、ヒストグラムから取らず明示指定する
        this.dimension = { r1, r2, g1, g2, b1, b2 };
    }

    /** キャッシュを無効化する（split 後に呼ばれる） */
    invalidate(): void {
        this._volume = this._count = -1;
        this._avg = null;
    }

    volume(): number {
        if (this._volume < 0) {
            const { r1, r2, g1, g2, b1, b2 } = this.dimension;
            this._volume = (r2 - r1 + 1) * (g2 - g1 + 1) * (b2 - b1 + 1);
        }
        return this._volume;
    }

    count(): number {
        if (this._count < 0) {
            const { hist, getColorIndex } = this.histogram;
            const { r1, r2, g1, g2, b1, b2 } = this.dimension;
            let c = 0;
            for (let r = r1; r <= r2; r++) {
                for (let g = g1; g <= g2; g++) {
                    for (let b = b1; b <= b2; b++) {
                        const idx = getColorIndex(r, g, b);
                        c += hist[idx] ?? 0;
                    }
                }
            }
            this._count = c;
        }
        return this._count;
    }

    clone(): VBox {
        const { r1, r2, g1, g2, b1, b2 } = this.dimension;
        return new VBox(r1, r2, g1, g2, b1, b2, this.histogram);
    }

    /** 直方体内のピクセルの加重平均色を返す */
    avg(): Vec3 {
        if (!this._avg) {
            const { hist, getColorIndex } = this.histogram;
            const { r1, r2, g1, g2, b1, b2 } = this.dimension;
            let ntot = 0;
            let rsum = 0;
            let gsum = 0;
            let bsum = 0;
            const mult = 1 << (8 - SIGBITS);

            for (let r = r1; r <= r2; r++) {
                for (let g = g1; g <= g2; g++) {
                    for (let b = b1; b <= b2; b++) {
                        const h = hist[getColorIndex(r, g, b)] ?? 0;
                        if (!h) continue;
                        ntot += h;
                        rsum += h * (r + 0.5) * mult;
                        gsum += h * (g + 0.5) * mult;
                        bsum += h * (b + 0.5) * mult;
                    }
                }
            }

            if (ntot) {
                this._avg = [
                    Math.round(rsum / ntot),
                    Math.round(gsum / ntot),
                    Math.round(bsum / ntot),
                ];
            } else {
                // ピクセルがない場合は中心色を返す
                this._avg = [
                    Math.round((mult * (r1 + r2 + 1)) / 2),
                    Math.round((mult * (g1 + g2 + 1)) / 2),
                    Math.round((mult * (b1 + b2 + 1)) / 2),
                ];
            }
        }
        return this._avg;
    }

    contains(rgb: Vec3): boolean {
        const { r1, r2, g1, g2, b1, b2 } = this.dimension;
        const rq = rgb[0] >> RSHIFT;
        const gq = rgb[1] >> RSHIFT;
        const bq = rgb[2] >> RSHIFT;
        return (
            rq >= r1 && rq <= r2 && gq >= g1 && gq <= g2 && bq >= b1 && bq <= b2
        );
    }

    /**
     * 最長次元で直方体を二分割する
     *
     * ピクセルが 0 なら空配列、1 なら cloneを返す。
     */
    split(): VBox[] {
        const { hist, getColorIndex } = this.histogram;
        const { r1, r2, g1, g2, b1, b2 } = this.dimension;
        const count = this.count();
        if (!count) return [];
        if (count === 1) return [this.clone()];

        const rw = r2 - r1 + 1;
        const gw = g2 - g1 + 1;
        const bw = b2 - b1 + 1;
        const maxw = Math.max(rw, gw, bw);

        let accSum: Uint32Array | null = null;
        let total = 0;
        let maxd: "r" | "g" | "b" | null = null;

        if (maxw === rw) {
            maxd = "r";
            accSum = new Uint32Array(r2 + 1);
            for (let r = r1; r <= r2; r++) {
                let sum = 0;
                for (let g = g1; g <= g2; g++) {
                    for (let b = b1; b <= b2; b++) {
                        sum += hist[getColorIndex(r, g, b)] ?? 0;
                    }
                }
                total += sum;
                accSum[r] = total;
            }
        } else if (maxw === gw) {
            maxd = "g";
            accSum = new Uint32Array(g2 + 1);
            for (let g = g1; g <= g2; g++) {
                let sum = 0;
                for (let r = r1; r <= r2; r++) {
                    for (let b = b1; b <= b2; b++) {
                        sum += hist[getColorIndex(r, g, b)] ?? 0;
                    }
                }
                total += sum;
                accSum[g] = total;
            }
        } else {
            maxd = "b";
            accSum = new Uint32Array(b2 + 1);
            for (let b = b1; b <= b2; b++) {
                let sum = 0;
                for (let r = r1; r <= r2; r++) {
                    for (let g = g1; g <= g2; g++) {
                        sum += hist[getColorIndex(r, g, b)] ?? 0;
                    }
                }
                total += sum;
                accSum[b] = total;
            }
        }

        let splitPoint = -1;
        const reverseSum = new Uint32Array(accSum.length);
        for (let i = 0; i < accSum.length; i++) {
            const d = accSum[i] ?? 0;
            if (!d) continue;
            if (splitPoint < 0 && d > total / 2) splitPoint = i;
            reverseSum[i] = total - d;
        }

        // count >= 2 のとき maxd / accSum は必ず設定される（unreachable guard）
        if (maxd === null || accSum === null) return [];
        return doCut(maxd, this, accSum, reverseSum, splitPoint);
    }
}

const doCut = (
    d: "r" | "g" | "b",
    vbox: VBox,
    accSum: Uint32Array,
    reverseSum: Uint32Array,
    splitPoint: number,
): VBox[] => {
    const dim1 = `${d}1`;
    const dim2 = `${d}2`;
    // dim1/dim2 は "r1","g1","b1" など既知キーのため安全
    // biome-ignore lint/style/noNonNullAssertion: dimension の既知キー
    const d1 = vbox.dimension[dim1]!;
    // biome-ignore lint/style/noNonNullAssertion: dimension の既知キー
    let d2 = vbox.dimension[dim2]!;
    const vbox1 = vbox.clone();
    const vbox2 = vbox.clone();
    const left = splitPoint - d1;
    const right = d2 - splitPoint;

    if (left <= right) {
        d2 = Math.min(d2 - 1, ~~(splitPoint + right / 2));
        d2 = Math.max(0, d2);
    } else {
        d2 = Math.max(d1, ~~(splitPoint - 1 - left / 2));
        // biome-ignore lint/style/noNonNullAssertion: dimension の既知キー
        d2 = Math.min(vbox.dimension[dim2]!, d2);
    }

    while (!(accSum[d2] ?? 0)) d2++;

    let c2 = reverseSum[d2] ?? 0;
    while (!c2 && (accSum[d2 - 1] ?? 0)) {
        d2--;
        c2 = reverseSum[d2] ?? 0;
    }

    vbox1.dimension[dim2] = d2;
    vbox2.dimension[dim1] = d2 + 1;

    return [vbox1, vbox2];
};
