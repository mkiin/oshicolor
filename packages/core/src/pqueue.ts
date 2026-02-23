type Comparator<T> = (a: T, b: T) => number;

/**
 * ソート済み優先度キュー
 *
 * 挿入時はフラグを立てておき、取り出し時に遅延ソートする。
 */
export class PQueue<T> {
    contents: T[];
    private _sorted: boolean;
    private _comparator: Comparator<T>;

    constructor(comparator: Comparator<T>) {
        this._comparator = comparator;
        this.contents = [];
        this._sorted = false;
    }

    private _sort(): void {
        if (!this._sorted) {
            this.contents.sort(this._comparator);
            this._sorted = true;
        }
    }

    push(item: T): void {
        this.contents.push(item);
        this._sorted = false;
    }

    peek(index?: number): T {
        this._sort();
        const i = typeof index === "number" ? index : this.contents.length - 1;
        // 呼び出し側が size() > 0 を確認済みであることが前提
        // biome-ignore lint/style/noNonNullAssertion: 有効なインデックスであることを前提とする
        return this.contents[i]!;
    }

    pop(): T | undefined {
        this._sort();
        return this.contents.pop();
    }

    size(): number {
        return this.contents.length;
    }

    map<U>(mapper: (item: T, index: number) => U): U[] {
        this._sort();
        return this.contents.map(mapper);
    }
}
