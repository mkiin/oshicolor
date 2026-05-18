// CAM16-UCS Jmh の参照値を palette クレートで生成して JSON に吐く。
// TS 実装側のテストはこの JSON を fixture として読み、1e-4 以内で一致するかを検証する。
//
// 観察条件は wallust の `Histogram::new_empty` (library/wallust/src/histogram/mod.rs:208-222)
// と同じ 2 種類を使う。
//   dark テーマ (ColorOrder::LightFirst): L_A = 140 cd/m², Y_b = 0.2, Surround::Average
//   light テーマ (ColorOrder::DarkFirst): L_A = 500 cd/m², Y_b = 0.8, Surround::Average

use palette::cam16::{BakedParameters, Cam16, Cam16UcsJmh, Parameters, Surround};
use palette::convert::FromColorUnclamped;
use palette::white_point::D65;
use palette::{IntoColor, Srgb};
use serde::Serialize;

type View = BakedParameters<palette::cam16::StaticWp<D65>, f32>;

#[derive(Serialize)]
struct Jmh {
    j: f32,
    m: f32,
    h: f32,
}

#[derive(Serialize)]
struct Sample {
    name: &'static str,
    rgb: [u8; 3],
    dark: Jmh,
    light: Jmh,
}

#[derive(Serialize)]
struct ViewParams {
    l_a: f32,
    y_b: f32,
    surround: &'static str,
}

#[derive(Serialize)]
struct Fixture {
    /// palette クレートのバージョン
    palette_version: &'static str,
    /// 観察条件パラメータ (TS 側で同じ値を入れて再現できるよう記録)
    dark_view: ViewParams,
    light_view: ViewParams,
    samples: Vec<Sample>,
}

fn make_view(l_a: f32, y_b: f32) -> View {
    let mut p: Parameters<palette::cam16::StaticWp<D65>, f32> = Parameters::default_static_wp(l_a);
    p.background_luminance = y_b;
    p.surround = Surround::Average;
    p.into()
}

fn srgb_to_jmh(rgb: [u8; 3], view: &View) -> Jmh {
    let srgb_u8: Srgb<u8> = Srgb::new(rgb[0], rgb[1], rgb[2]);
    let srgb: Srgb<f32> = srgb_u8.into_format();
    let cam16 = Cam16::from_xyz(srgb.into_color(), *view);
    let jmh: Cam16UcsJmh<f32> = Cam16UcsJmh::from_color_unclamped(cam16);
    Jmh {
        j: jmh.lightness,
        m: jmh.colorfulness,
        h: jmh.hue.into_inner(),
    }
}

fn main() {
    let dark_view = make_view(140.0, 0.2);
    let light_view = make_view(500.0, 0.8);

    let palette_samples: &[(&'static str, [u8; 3])] = &[
        // プリミティブ
        ("white", [255, 255, 255]),
        ("black", [0, 0, 0]),
        ("mid_gray", [128, 128, 128]),
        // ANSI 6 色 (純色)
        ("pure_red", [255, 0, 0]),
        ("pure_green", [0, 255, 0]),
        ("pure_blue", [0, 0, 255]),
        ("pure_yellow", [255, 255, 0]),
        ("pure_cyan", [0, 255, 255]),
        ("pure_magenta", [255, 0, 255]),
        // 検証で実際に使ったキャラ系の色
        ("dorothy_pink", [230, 127, 171]),  // Dorothy salience light low pastel の color3
        ("scarlet_purple", [120, 92, 177]), // Scarlet kmeans -k 24 の color4
        ("red_hood_red", [255, 36, 34]),    // Red Hood salience dark low pastel の color1
        ("snow_white_bg", [251, 237, 244]), // Snow White salience light low pastel の color0
    ];

    let samples: Vec<Sample> = palette_samples
        .iter()
        .map(|(name, rgb)| Sample {
            name,
            rgb: *rgb,
            dark: srgb_to_jmh(*rgb, &dark_view),
            light: srgb_to_jmh(*rgb, &light_view),
        })
        .collect();

    let fixture = Fixture {
        palette_version: env!("CARGO_PKG_VERSION"),
        dark_view: ViewParams {
            l_a: 140.0,
            y_b: 0.2,
            surround: "Average",
        },
        light_view: ViewParams {
            l_a: 500.0,
            y_b: 0.8,
            surround: "Average",
        },
        samples,
    };

    println!("{}", serde_json::to_string_pretty(&fixture).unwrap());
}
