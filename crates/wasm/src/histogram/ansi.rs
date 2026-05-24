//! # Ansi
//! In this module we handle the ansi palette mode.
//! Colors are classified by HSV hue into standard ANSI slots:
//!     Red     falls between 0   and 60  degrees.
//!     Yellow  falls between 61  and 120 degrees.
//!     Green   falls between 121 and 180 degrees.
//!     Cyan    falls between 181 and 240 degrees.
//!     Blue    falls between 241 and 300 degrees.
//!     Magenta falls between 301 and 360 degrees.
//!
//! HSV is used instead of CAM16 since only hue classification is needed,
//! making this path significantly faster than the salience pipeline.
use palette::cast::ComponentsAs;
use palette::{Darken, Hsv, IntoColor, Lighten, Srgb};

use super::ColorOrder;
use super::util::avg;
use crate::colors::{Colors, ColorsSrgb};

#[derive(Clone, Copy)]
struct Range {
    hue_start: f32,
    hue_end: f32,
    sat_def: f32,
    val_def: f32,
}

const RED: Range = Range {
    hue_start: 0.0,
    hue_end: 60.0,
    sat_def: 0.90,
    val_def: 0.65,
};
const YELLOW: Range = Range {
    hue_start: 60.0,
    hue_end: 120.0,
    sat_def: 0.90,
    val_def: 0.75,
};
const GREEN: Range = Range {
    hue_start: 120.0,
    hue_end: 180.0,
    sat_def: 0.80,
    val_def: 0.65,
};
const CYAN: Range = Range {
    hue_start: 180.0,
    hue_end: 210.0,
    sat_def: 0.80,
    val_def: 0.75,
};
const BLUE: Range = Range {
    hue_start: 210.0,
    hue_end: 280.0,
    sat_def: 0.90,
    val_def: 0.55,
};
const MAGENTA: Range = Range {
    hue_start: 280.0,
    hue_end: 360.0,
    sat_def: 0.80,
    val_def: 0.70,
};

// how much to trust ansi defaults vs image colors (0.0 = full image, 1.0 = full ansi)
const T: f32 = 1.0 / 2.0;

/// Classify pixels into an ANSI hue slot, draining matches so they can't be reused.
fn get_color(specs: &mut Vec<(f32, f32, f32)>, r: &Range) -> Srgb {
    let mut hues = vec![];
    let mut sats = vec![];
    let mut vals = vec![];

    specs.retain(|&(h, s, v)| {
        if (r.hue_start..=r.hue_end).contains(&h) {
            hues.push(h);
            sats.push(s);
            vals.push(v);
            false // drain
        } else {
            true
        }
    });

    let hue = if hues.is_empty() {
        (r.hue_start + r.hue_end) / 2.0
    } else {
        T * (r.hue_start + r.hue_end) / 2.0 + (1.0 - T) * avg(&hues)
    };
    let sat = if sats.is_empty() {
        r.sat_def
    } else {
        T * r.sat_def + (1.0 - T) * avg(&sats)
    };
    let val = if vals.is_empty() {
        r.val_def
    } else {
        T * r.val_def + (1.0 - T) * avg(&vals)
    };

    Hsv::new(hue, sat, val).into_color()
}

/// Main ansi function, handles dark and light themes/styles
pub fn ansi(bytes: &[u8], ord: ColorOrder) -> Colors {
    let pixels: &[Srgb<u8>] = bytes.components_as();

    // (hue_degrees, saturation, value)
    let mut specs: Vec<(f32, f32, f32)> = pixels
        .iter()
        .map(|p| {
            let hsv: Hsv = p.into_format::<f32>().into_color();
            (hsv.hue.into_positive_degrees(), hsv.saturation, hsv.value)
        })
        .collect();

    let dark = 0.05_f32;
    let lighty = 0.95_f32;

    // black: darkest pixel or synthesized very dark color
    let black: Srgb = {
        let found = specs.iter().find(|&&(_, _, v)| v < dark).copied();
        if let Some((h, s, v)) = found {
            Hsv::new(h, s * 0.3, v).into_color()
        } else {
            let vals: Vec<f32> = specs.iter().map(|&(_, _, v)| v).collect();
            let sats: Vec<f32> = specs.iter().map(|&(_, s, _)| s).collect();
            let hues: Vec<f32> = specs.iter().map(|&(h, _, _)| h).collect();
            let v = (7.0 * dark + avg(&vals)) / 8.0;
            let s = (2.0 * 0.0 + avg(&sats)) / 3.0;
            Hsv::new(avg(&hues), s, v).into_color()
        }
    };

    // gray: lightest pixel or synthesized very light color
    let gray: Srgb = {
        let found = specs.iter().find(|&&(_, _, v)| v > lighty).copied();
        if let Some((h, s, v)) = found {
            Hsv::new(h, s * 0.3, v).into_color()
        } else {
            let vals: Vec<f32> = specs.iter().map(|&(_, _, v)| v).collect();
            let sats: Vec<f32> = specs.iter().map(|&(_, s, _)| s).collect();
            let hues: Vec<f32> = specs.iter().map(|&(h, _, _)| h).collect();
            let v = (4.0 * lighty + avg(&vals)) / 5.0;
            let s = (2.0 * 0.0 + avg(&sats)) / 3.0;
            Hsv::new(avg(&hues), s, v).into_color()
        }
    };

    // val_def: lighter for dark themes (LightFirst), darker for light themes (DarkFirst)
    let (red_r, yellow_r, green_r, cyan_r, blue_r, magenta_r) = match ord {
        ColorOrder::LightFirst => (RED, YELLOW, GREEN, CYAN, BLUE, MAGENTA),
        ColorOrder::DarkFirst => (
            Range {
                val_def: 0.45,
                ..RED
            },
            Range {
                val_def: 0.55,
                ..YELLOW
            },
            Range {
                val_def: 0.45,
                ..GREEN
            },
            Range {
                val_def: 0.55,
                ..CYAN
            },
            Range {
                val_def: 0.35,
                ..BLUE
            },
            Range {
                val_def: 0.50,
                ..MAGENTA
            },
        ),
    };

    let red = get_color(&mut specs, &red_r);
    let yellow = get_color(&mut specs, &yellow_r);
    let green = get_color(&mut specs, &green_r);
    let cyan = get_color(&mut specs, &cyan_r);
    let blue = get_color(&mut specs, &blue_r);
    let magenta = get_color(&mut specs, &magenta_r);

    match ord {
        ColorOrder::LightFirst => ColorsSrgb {
            background: black.darken_fixed(0.2),
            foreground: gray,
            cursor: gray,
            color0: black.lighten_fixed(0.1),
            color1: red,
            color2: green,
            color3: yellow,
            color4: blue,
            color5: magenta,
            color6: cyan,
            color7: gray,
            color8: black.lighten_fixed(0.25),
            color9: red,
            color10: green,
            color11: yellow,
            color12: blue,
            color13: magenta,
            color14: cyan,
            color15: gray,
        }
        .into(),
        ColorOrder::DarkFirst => ColorsSrgb {
            background: gray.lighten_fixed(0.1),
            foreground: black,
            cursor: black,
            color0: black,
            color1: red,
            color2: green,
            color3: yellow,
            color4: blue,
            color5: magenta,
            color6: cyan,
            color7: gray.darken_fixed(0.1),
            color8: black.lighten_fixed(0.1),
            color9: red,
            color10: green,
            color11: yellow,
            color12: blue,
            color13: magenta,
            color14: cyan,
            color15: gray,
        }
        .into(),
    }
}
