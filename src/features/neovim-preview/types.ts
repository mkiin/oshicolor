export type NeovimColorTokens = {
    // エディタ背景・前傾
    bg: string;
    fg: string;
    comment: string;

    // シンタックス
    fn: string;
    kw: string;
    field: string;
    string: string;
    type: string;
    op: string;
    const: string;
    special: string;

    // UI クローム
    // ステータスライン背景
    statusLineBg?: string;
    // ステータスラインのモード表示に使うアクセントカラー
    accent: string;
};
