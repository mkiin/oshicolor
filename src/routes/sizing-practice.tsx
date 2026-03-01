import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/sizing-practice")({
    component: RouteComponent,
});

const SAMPLE_IMAGE = "https://picsum.photos/seed/oshicolor/800/600";

const THUMBNAILS = [
    "https://picsum.photos/seed/a/400/400",
    "https://picsum.photos/seed/b/400/400",
    "https://picsum.photos/seed/c/400/400",
    "https://picsum.photos/seed/d/400/400",
    "https://picsum.photos/seed/e/400/400",
    "https://picsum.photos/seed/f/400/400",
];

// ============================================================
// Section 2: 16:9 の画像プレビューエリア
//
// こうしたい: 横幅いっぱいの 16:9 エリアに画像を全体表示したい
// ① コンテナの横幅を親いっぱいにしたい
// ② コンテナの縦横比を 16:9 に固定したい
// ③ 画像を切り取らずに収めたい
// ============================================================
const ImageSection: React.FC = () => (
    <section className="space-y-2">
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide">
            Section 2: 16:9 プレビュー
        </h2>
        {/* TODO(human) */}
    </section>
);

// ============================================================
// Section 3: サムネイルグリッド
//
// こうしたい: 同じサイズのサムネイルを3列で並べたい
// ① 3列のグリッドを作りたい
// ② 各セルを正方形に固定したい
// ③ 画像でセルを隙間なく埋めたい（多少切れてもOK）
// ④ 角丸にしたい（object-cover との組み合わせに注意）
// ============================================================
const ThumbnailGrid: React.FC = () => (
    <section className="space-y-2">
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide">
            Section 3: サムネイルグリッド
        </h2>
        {/* TODO(human) */}
        {THUMBNAILS.map((src) => (
            <div key={src}>
                <img src={src} alt="サムネイル" />
            </div>
        ))}
    </section>
);

// ============================================================
// Section 4: ヒーローセクション
//
// こうしたい: 画面の高さいっぱいに背景を広げて、テキストを中央に置きたい
// ① 高さを画面いっぱいにしたい
// ② テキストを縦横中央に置きたい
// ============================================================
const HeroSection: React.FC = () => (
    <section className="space-y-2">
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide">
            Section 4: ヒーローセクション
        </h2>
        {/* TODO(human) */}
        <div>
            <p>画面いっぱいのヒーロー</p>
        </div>
    </section>
);

// ============================================================
// RouteComponent
//
// こうしたい: コンテンツを中央に寄せて、横幅が広がりすぎないようにしたい
// ① 最大幅を制限したい
// ② 中央寄せにしたい
// ③ 左右に余白を持たせたい
// ④ 各セクションの間に均等な余白を入れたい
// ============================================================
function RouteComponent() {
    return (
        // TODO(human): 上のコメントを参考にクラスをつけてください
        <div>
            <h1 className="text-2xl font-bold">Tailwind Sizing Practice</h1>
            <ImageSection />
            <ThumbnailGrid />
            <HeroSection />
        </div>
    );
}
