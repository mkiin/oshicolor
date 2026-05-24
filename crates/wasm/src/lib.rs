//! wallust v4 の色抽出を WebAssembly から呼べるようにしたエントリ
//! ロジックは library/wallust を再構築したもので、CLI と fs と cache は持たない
mod backends;
mod colors;
mod config;
mod histogram;

use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

use crate::colors::Colors;
use crate::config::{Config, KmeansConfig, SalienceConfig, Style};
use crate::histogram::ansi::ansi;
use crate::histogram::kmeans::kmeans;
use crate::histogram::{HistoParams, Histogram, Palette};

/// JS から渡す抽出設定
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct ExtractConfig {
    palette: String,
    style: String,
    use16cols: bool,
    dynamic: bool,
    threshold: u8,
    check_contrast: bool,
    saturation: Option<u8>,
    k: u8,
    min_dist: f32,
}

impl Default for ExtractConfig {
    fn default() -> Self {
        let kmeans = KmeansConfig::default();
        Self {
            palette: "salience".into(),
            style: "dark".into(),
            use16cols: false,
            dynamic: true,
            threshold: 14,
            check_contrast: false,
            saturation: None,
            k: kmeans.k,
            min_dist: kmeans.min_dist,
        }
    }
}

/// JS へ返す 19 色の hex
#[derive(Debug, Serialize)]
struct ColorsHex {
    background: String,
    foreground: String,
    cursor: String,
    color0: String,
    color1: String,
    color2: String,
    color3: String,
    color4: String,
    color5: String,
    color6: String,
    color7: String,
    color8: String,
    color9: String,
    color10: String,
    color11: String,
    color12: String,
    color13: String,
    color14: String,
    color15: String,
}

impl From<Colors> for ColorsHex {
    fn from(c: Colors) -> Self {
        Self {
            background: c.background.to_string(),
            foreground: c.foreground.to_string(),
            cursor: c.cursor.to_string(),
            color0: c.color0.to_string(),
            color1: c.color1.to_string(),
            color2: c.color2.to_string(),
            color3: c.color3.to_string(),
            color4: c.color4.to_string(),
            color5: c.color5.to_string(),
            color6: c.color6.to_string(),
            color7: c.color7.to_string(),
            color8: c.color8.to_string(),
            color9: c.color9.to_string(),
            color10: c.color10.to_string(),
            color11: c.color11.to_string(),
            color12: c.color12.to_string(),
            color13: c.color13.to_string(),
            color14: c.color14.to_string(),
            color15: c.color15.to_string(),
        }
    }
}

impl ExtractConfig {
    fn into_config(self) -> Config {
        let palette = match self.palette.as_str() {
            "ansi" => Palette::Ansi,
            "kmeans" => Palette::Kmeans,
            _ => Palette::Salience,
        };
        let style = match self.style.as_str() {
            "light" => Style::Light,
            _ => Style::Dark,
        };
        Config {
            threshold: self.threshold,
            dynamic: self.dynamic,
            check_contrast: self.check_contrast,
            saturation: self.saturation,
            salience: SalienceConfig::default(),
            kmeans: KmeansConfig {
                k: self.k,
                min_dist: self.min_dist,
            },
            style,
            use16cols: self.use16cols,
            palette,
        }
    }
}

/// 抽出本体。wallust の gen_colors の run + postcolor 相当を fs と cache 抜きで再構成したもの
fn extract(bytes: &[u8], cfg: &Config) -> anyhow::Result<Colors> {
    let rgb8 = backends::decode_and_resize(bytes)?;
    let histop = HistoParams::from_config(cfg);

    let mut colors = match histop.palette {
        Palette::Salience => {
            let mut histo = Histogram::from_params_empty(&histop);
            histo
                .use_dynamic_lookup(&rgb8, cfg.dynamic)
                .dedup()
                .post_dedup()
                .with_intensity(&histop.salience)
                .salience_palette(&histop.salience.sampling)
        }
        Palette::Ansi => ansi(&rgb8, histop.ord),
        Palette::Kmeans => kmeans(&rgb8, histop.kmeans),
    };

    colors.use16col(histop.use16cols);
    postcolor(cfg, &mut colors);
    Ok(colors)
}

/// キャッシュ対象外の安い後処理。wallust の postcolor と同じ順序
fn postcolor(c: &Config, colors: &mut Colors) {
    if c.use16cols {
        colors.set_16col();
    }
    if c.check_contrast {
        colors.check_contrast_all();
    }
    if let Some(s) = c.saturation {
        colors.saturate_colors(f32::from(s) / 100.0);
    }
}

/// native から呼べる入口。19 色を (フィールド名, hex) で返す。parity テスト用
#[allow(clippy::too_many_arguments)]
pub fn gen_hex(
    bytes: &[u8],
    palette: &str,
    style: &str,
    use16cols: bool,
    dynamic: bool,
    threshold: u8,
    check_contrast: bool,
    saturation: Option<u8>,
) -> anyhow::Result<Vec<(&'static str, String)>> {
    let cfg = ExtractConfig {
        palette: palette.to_string(),
        style: style.to_string(),
        use16cols,
        dynamic,
        threshold,
        check_contrast,
        saturation,
        ..ExtractConfig::default()
    }
    .into_config();
    let c = extract(bytes, &cfg)?;
    Ok(vec![
        ("background", c.background.to_string()),
        ("foreground", c.foreground.to_string()),
        ("cursor", c.cursor.to_string()),
        ("color0", c.color0.to_string()),
        ("color1", c.color1.to_string()),
        ("color2", c.color2.to_string()),
        ("color3", c.color3.to_string()),
        ("color4", c.color4.to_string()),
        ("color5", c.color5.to_string()),
        ("color6", c.color6.to_string()),
        ("color7", c.color7.to_string()),
        ("color8", c.color8.to_string()),
        ("color9", c.color9.to_string()),
        ("color10", c.color10.to_string()),
        ("color11", c.color11.to_string()),
        ("color12", c.color12.to_string()),
        ("color13", c.color13.to_string()),
        ("color14", c.color14.to_string()),
        ("color15", c.color15.to_string()),
    ])
}

/// 画像バイト列と設定を受け取り 16 色 + bg/fg/cursor の hex を返す
#[wasm_bindgen(js_name = genColorsFromBytes)]
pub fn gen_colors_from_bytes(bytes: &[u8], config: JsValue) -> Result<JsValue, JsValue> {
    #[cfg(feature = "panic-hook")]
    console_error_panic_hook::set_once();

    let cfg: ExtractConfig = if config.is_undefined() || config.is_null() {
        ExtractConfig::default()
    } else {
        serde_wasm_bindgen::from_value(config).map_err(|e| JsValue::from_str(&e.to_string()))?
    };

    let colors =
        extract(bytes, &cfg.into_config()).map_err(|e| JsValue::from_str(&e.to_string()))?;
    let hex = ColorsHex::from(colors);
    serde_wasm_bindgen::to_value(&hex).map_err(|e| JsValue::from_str(&e.to_string()))
}
