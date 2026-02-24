import type React from "react";
import {} from "@/features/neovim-preview/components/neovim-editor-area";
import {} from "@/features/neovim-preview/components/neovim-statusline";
import {} from "@/features/neovim-preview/components/neovim-tabline";
import type { NeovimColorTokens } from "@/features/neovim-preview/types/index";

export type NeoVimPreviewProps = {
    // 表示に使う色トークン
    colors: NeovimColorTokens;
    // コンテンツ
    // ハイライトを表示するコード文字列
    code: string;
    lauguage: string;
    fileName?: string;

    // UI トグル
    // 行番号を表示するか
    showLineNumber?: boolean;
    // ステータスラインを表示するか
    showStatusLine?: boolean;
    // タブラインを表示するか
    showTabLine?: boolean;

    // 見た目調整
    // ステータスラインに表示するモード
    mode?: "NORMAL" | "INSERT" | "VISUAL";
    // 外側のコンテナへの追加クラス
    className?: string;
};

const NeoVimPreview: React.FC<NeoVimPreviewProps> = () => {
    return (
        <div>
            <NeoVimTabLine />
            <NeoVimEditorArea />
            <NeoVimStatusLine />
        </div>
    );
};

export { NeoVimPreview };
