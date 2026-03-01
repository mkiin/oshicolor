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
    "https://picsum.photos/seed/g/400/400",
    "https://picsum.photos/seed/h/400/400",
    "https://picsum.photos/seed/i/400/400",
];

// ============================================================
// Section 2: 16:9 の画像プレビューエリア
//
// こうしたい: 横幅いっぱいの 16:9 エリアに画像を全体表示したい
// ① コンテナの横幅を親いっぱいにしたい → w-full系で対応できるか？親の要素いっぱいに広がるはず
// ② コンテナの縦横比を 16:9 に固定したい-> accepct系？
// ③ 画像を切り取らずに収めたい -> object-contain
// 画像単一だけ表示の場合は、imgタグにdivタグと同じ内容を記載しても動作としては成り立つ。だけど画像の上に文字表示などをする場合は, divコンテナが必要になる
// ============================================================
const ImageSection: React.FC = () => (
    <section className="space-y-2 ">
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide">
            Section 2: 16:9 プレビュー
        </h2>
        <div className="w-full h-full aspect-video">
            <img
                src={SAMPLE_IMAGE}
                alt="SECTION2:16:9プレビュー"
                className="object-cover w-full h-full"
            />
        </div>
    </section>
);

// ============================================================
// Section 3: サムネイルグリッド
//
// こうしたい: 同じサイズのサムネイルを3列で並べたい gridを使えそう
// ① 3列のグリッドを作りたい
// ② 各セルを正方形に固定したい asspect-square
// ③ 画像でセルを隙間なく埋めたい（多少切れてもOK） object-cover
// ④ 角丸にしたい（object-cover との組み合わせに注意） radius
// ============================================================
const ThumbnailGrid: React.FC = () => (
    <section className="space-y-2">
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide">
            Section 3: サムネイルグリッド
        </h2>
        {/* TODO(human) */}
        <div className="grid grid-cols-3">
            {THUMBNAILS.map((src) => (
                <div key={src} className="overflow-hidden rounded-lg">
                    <img
                        src={src}
                        alt="サムネイル"
                        className="w-full h-full object-cover"
                    />
                </div>
            ))}
        </div>
    </section>
);

// ============================================================
// Section 4: ヒーローセクション
//
// こうしたい: 画面の高さいっぱいに背景を広げて、テキストを中央に置きたい
// ① 高さを画面いっぱいにしたい
// ② テキストを縦横中央に置きたい
// あるコンテンツ基準で、何か配置したい(例：画像の上に文字など)
// -> relative(基準となるコンテナ要素) absolute(配置したいコンテンツ)
// -> 場所調整は`inset`を利用する
// absolute要素は`flex`を使用して,位置調整もできる
// ============================================================
const HeroSection: React.FC = () => (
    <section>
        {/* TODO(human): relative を使って画像の上に h2 を重ねてください */}
        <div className="h-screen relative">
            <img
                src={SAMPLE_IMAGE}
                alt="ヒーロー画像"
                className="object-cover w-full h-full"
            />
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide absolute inset-0 flex items-center justify-center">
                Section 4: ヒーローセクション
            </h2>
        </div>
    </section>
);

// ============================================================
// RouteComponent
//
// こうしたい: コンテンツを中央に寄せて、横幅が広がりすぎないようにしたい
// ① 最大幅を制限したい : max-w 系? 親なら、w-screen, w-full,
// ② 中央寄せにしたい : 左右marginをatuoにすることで中央寄せになるらしい。原理について気になるところ
// ③ 左右に余白を持たせたい max-w-*, mx-auto, px-4はレスポンシブの王道パターンらしい
// ④ 各セクションの間に均等な余白を入れたい : divのもつ各要素の間に余白を入れたいという意味, この場合space-y系で縦軸の余白を調節できる
// ============================================================
function RouteComponent() {
    return (
        <>
            <div className="max-w-3xl mx-auto px-4 space-y-8">
                <h1 className="text-2xl font-bold text-center underline">
                    Tailwind Sizing Practice
                </h1>
                <ImageSection />
                <ThumbnailGrid />
            </div>
            <HeroSection />
        </>
    );
}
// ● 今回学んだことをまとめると：
//
//   レイアウトの基礎
//   - max-w-* + mx-auto + px-4 — 中央寄せコンテナの王道パターン
//   - space-y-* — 子要素間の縦余白を一括管理
//
//   サイズと比率
//   - aspect-video / aspect-square — 縦横比の固定
//   - object-cover / object-contain — 画像の収め方
//   - w-full h-full — 親を埋める
//
//   重ね合わせ
//   - overflow-hidden + rounded-* — 角丸クリッピングはセット
//   - relative + absolute — 要素を浮かせる基準点と浮かせる要素
//   - DOM の順序 — 後に書いた要素が上のレイヤー
//
//
