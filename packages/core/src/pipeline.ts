import type { Filter, Palette, Swatch } from "@oshicolor/color";
import type { ImageData } from "@oshicolor/image";
import { applyFilters } from "@oshicolor/image";
import type { Generator, Quantizer } from "./types";

type StageMap<T> = { [name: string]: T };

/** 各ステージ（フィルタ / 量子化器 / ジェネレータ）の登録と取得 */
class Stage<T> {
    private _map: StageMap<T> = {};

    constructor(private _pipeline: BasicPipeline) {}

    names(): string[] {
        return Object.keys(this._map);
    }

    has(name: string): boolean {
        return !!this._map[name];
    }

    get(name: string): T | undefined {
        return this._map[name];
    }

    /**
     * ステージ関数を名前で登録する
     *
     * @returns パイプライン本体（メソッドチェーン用）
     */
    register(name: string, fn: T): BasicPipeline {
        this._map[name] = fn;
        return this._pipeline;
    }
}

/** パイプライン処理の入力オプション */
export type StageOptions = {
    name: string;
    options?: object;
};

/** パイプライン処理の設定 */
export type ProcessOptions = {
    filters: string[];
    quantizer: string | StageOptions;
    generators: (string | StageOptions)[];
};

/** パイプラインの処理結果 */
export type ProcessResult = {
    /** 量子化器が生成した全 Swatch（フィルタ適用済み） */
    colors: Swatch[];
    /** ジェネレータ名 → Palette のマップ */
    palettes: { [name: string]: Palette };
};

type StageTask<Q> = {
    name: string;
    fn: Q;
    options?: object;
};

type ProcessTasks = {
    filters: StageTask<Filter>[];
    quantizer: StageTask<Quantizer>;
    generators: StageTask<Generator>[];
};

/**
 * フィルタ → 量子化 → パレット生成の3ステージパイプライン
 *
 * 各ステージに実装を名前で登録し、ProcessOptions で使用する実装を指定して実行する。
 */
export class BasicPipeline {
    filter: Stage<Filter> = new Stage(this);
    quantizer: Stage<Quantizer> = new Stage(this);
    generator: Stage<Generator> = new Stage(this);

    async process(
        imageData: ImageData,
        opts: ProcessOptions,
    ): Promise<ProcessResult> {
        const tasks = this._buildProcessTasks(opts);
        const filteredData = this._filterColors(tasks.filters, imageData);
        const colors = this._quantizeColors(tasks.quantizer, filteredData);
        const palettes = await this._generatePalettes(tasks.generators, colors);
        return { colors, palettes };
    }

    private _buildProcessTasks(opts: ProcessOptions): ProcessTasks {
        // "*" はすべての登録済みジェネレータを意味する
        const generators =
            opts.generators.length === 1 && opts.generators[0] === "*"
                ? this.generator.names().map((n) => n as string | StageOptions)
                : opts.generators;

        return {
            filters: opts.filters.map((f) => this._createTask(this.filter, f)),
            quantizer: this._createTask(this.quantizer, opts.quantizer),
            generators: generators.map((g) =>
                this._createTask(this.generator, g),
            ),
        };
    }

    private _createTask<Q>(
        stage: Stage<Q>,
        o: string | StageOptions,
    ): StageTask<Q> {
        const name = typeof o === "string" ? o : o.name;
        const options = typeof o === "string" ? undefined : o.options;
        // stage.get(name) は register 済みであることが前提のため安全
        // biome-ignore lint/style/noNonNullAssertion: 登録済みのステージ名のみが渡される
        return { name, fn: stage.get(name)!, options };
    }

    private _filterColors(
        filters: StageTask<Filter>[],
        imageData: ImageData,
    ): ImageData {
        return applyFilters(
            imageData,
            filters.map(({ fn }) => fn),
        );
    }

    private _quantizeColors(
        quantizer: StageTask<Quantizer>,
        imageData: ImageData,
    ): Swatch[] {
        return quantizer.fn(imageData.data, {
            colorCount: quantizer.options
                ? ((quantizer.options as { colorCount?: number }).colorCount ??
                  64)
                : 64,
            ...quantizer.options,
        });
    }

    private async _generatePalettes(
        generators: StageTask<Generator>[],
        colors: Swatch[],
    ): Promise<{ [name: string]: Palette }> {
        const results = await Promise.all(
            generators.map(({ fn, options }) =>
                Promise.resolve(fn(colors, options)),
            ),
        );
        return results.reduce(
            (acc, palette, i) => {
                // reduce の index は generators と 1:1 対応するため安全
                // biome-ignore lint/style/noNonNullAssertion: Promise.all の結果と generators は同長
                acc[generators[i]!.name] = palette;
                return acc;
            },
            {} as { [name: string]: Palette },
        );
    }
}
