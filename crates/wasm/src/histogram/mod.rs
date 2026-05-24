//! Histogram
//!
//! This module purpuse is to gather the colors into a Histogram that can later be sampled.
//! There are two main methods, one that uses salience and other that is
//!
//! Each module handles it's own palette implementation, that means, the resulted [`Color`] struct,
//! which is the final colors diplayed to the user. This is to handle specifics within it's module
//! and/or using helpers from this (super) mod. This allows more control on the result, rather than
//! looking for a 'functional' perfect solution.

// wallust を忠実に再構築したモジュールなので、上流の構造を保つために今は使わないヘルパや、
// #036 intensity と #037 sampling mode で使う enum バリアントを残している。dead_code を許可する。
#![allow(dead_code)]
// from_rgb のような wallust 由来の命名を上流に合わせて残すため。
#![allow(clippy::wrong_self_convention)]

use palette::Darken;
use palette::Lighten;
use palette::Srgb;
use palette::cam16::{BakedParameters, Cam16UcsJmh, Parameters, StaticWp, Surround};
use palette::cast::ComponentsAs;
use palette::hues::Cam16Hue;
use palette::white_point::D65;

use crate::colors::{Colors, ColorsSrgb, Myrgb};
use crate::config::{Config, KmeansConfig, SalienceConfig};

use diff::Bucketing;
pub use diff::{Difference, Weights};
use util::avg;

use self::salience::rgb_to_cam;

pub mod ansi;
mod diff;
pub mod kmeans;
pub mod salience;
mod util;

#[derive(Debug, PartialEq, Eq, Clone, Copy, Default)]
/// how the image colors are processed into a palette
pub enum Palette {
    /// salience-based histogram palette (default). Perceptual salience picks the most visually prominent colors from the image.
    #[default]
    Salience,
    /// ANSI terminal color palette. Orders colors to follow the classic TTY convention: color0 → black, color1 → red-ish, color2 → green-ish, and so on.
    Ansi,
    /// k-means clustering palette. Groups pixels into clusters in Lab color space and uses the centroids as colors.
    Kmeans,
}

/// Our working types
pub type Spec = Cam16UcsJmh<f32>;
type Specs = Vec<Spec>;
type View = BakedParameters<StaticWp<D65>, f32>;

#[derive(Debug, Copy, Clone, PartialEq)]
pub struct Histo {
    pub color: Spec,
    pub count: usize,
    pub score: f32,
}

#[derive(Debug, Default)]
pub struct HistoParams {
    pub threshold: f32,
    pub ord: ColorOrder,
    pub skip: bool,
    pub salience: SalienceConfig,
    pub kmeans: KmeansConfig,
    pub palette: Palette,
    pub use16cols: bool,
    pub complementary: bool,
    pub dynamic: bool,
}

/// This is the representation of the colors that are gathered in a context/view with other
/// details. As is, it represents and it's used for a Salience based histogram, but can be used for
/// more than that use case.
#[derive(Clone)]
pub struct Histogram {
    pub histo: Vec<Histo>,
    pub threshold: f32,
    pub ord: ColorOrder,
    pub skip: bool,
    pub view: BakedParameters<StaticWp<D65>, f32>,
}

/// Enum to indicate how to sort the colors. This can allow you to choose which colors you would
/// like to use (e.g. light scheme or dark scheme), since you got them as the first colors.
/// Using these with [`full`] or [`resize`] backends, the LightFirst will give a more pastel
/// colors. While the DarkFrist will give you more heavy ones (more hue ones)
/// WARN: Although they are not the same, given the inmense flexibility, ColorOrder could just be
/// treated as a "dark" or "light" theme/style/scheme switcher. If we require afterwards to sort
/// the histogram as a way to get darker colors, we could simply do that without ColorOrder.
#[derive(Debug, Copy, Clone, Default)]
pub enum ColorOrder {
    /// `colors[0]` will be the lightest, and `colors.last()` will be the darkest
    /// This is, usually, for dark themes.
    #[default]
    LightFirst,
    /// `colors[0]` will be the darkest, and `colors.last()` will be the lightest
    DarkFirst,
}

// How the palettes will samples colors passed from the colorspace
#[derive(Debug, Default, Clone, Copy, PartialEq)]
pub enum SamplingMode {
    High,
    #[default]
    Balanced,
    Distributed,
    Low,
}

impl std::fmt::Display for SamplingMode {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SamplingMode::High => write!(f, "high"),
            SamplingMode::Balanced => write!(f, "balanced"),
            SamplingMode::Distributed => write!(f, "distributed"),
            SamplingMode::Low => write!(f, "low"),
        }
    }
}

/// How to sort colors based on intensity
#[derive(Debug, Default, Clone, Copy, PartialEq)]
pub enum SalienceIntensity {
    #[default]
    Normal,
    Pastel,
    Vibrant,
}

impl std::fmt::Display for SalienceIntensity {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SalienceIntensity::Normal => write!(f, "normal"),
            SalienceIntensity::Pastel => write!(f, "pastel"),
            SalienceIntensity::Vibrant => write!(f, "vibrant"),
        }
    }
}

/// Constraints for a color to be accepted and gathered
/// This will not alter the background, only the colors selected
pub const DARKEST: f32 = 5.0;
pub const LIGHTEST: f32 = 95.0;
pub const MIN_COLORFULNESS: f32 = 10.0;
pub const COL_DARK_MIN_SAL: f32 = 7.5;
pub const COL_LIGHT_MIN_SAL: f32 = 15.0;
pub const BG_DARK_ENFORCE_L_DELTA: f32 = 5.0;
pub const BG_LIGHT_ENFORCE_L_DELTA: f32 = 10.0;

// Constraints for background generation
// This will alter only the background (probably)
pub const BG_DARK_MIN_SAL: f32 = 7.5;
pub const BG_LIGHT_MIN_SAL: f32 = 15.0;
pub const BG_DARK_L_SOFTMIN: f32 = 2.0;
pub const BG_DARK_L_SOFTMAX: f32 = 5.0;
pub const BG_LIGHT_L_SOFTMIN: f32 = 90.0;
pub const BG_LIGHT_L_SOFTMAX: f32 = 95.0;
pub const BG_COLORFULNESS_MIN: f32 = 2.5;
pub const BG_COLORFULNESS_MAX: f32 = 7.5;

// Default bg's for dark/light
pub const DARKEST_COL: Spec = Spec::new_const(DARKEST, MIN_COLORFULNESS, Cam16Hue::new(210.0));
pub const LIGHTEST_COL: Spec = Spec::new_const(LIGHTEST, MIN_COLORFULNESS, Cam16Hue::new(30.0));

// const C0_MIN_SAL_BG: f32 = 1.5;
const C0_MIN_SAL_BG: f32 = 1.0;

//NOTE: a impl Into<> can be used, if needeed
impl HistoParams {
    pub fn from_config(c: &Config) -> Self {
        Self {
            threshold: c.threshold.into(),
            ord: c.style.into(),
            salience: c.salience,
            kmeans: c.kmeans,
            palette: c.palette,
            use16cols: c.use16cols,
            dynamic: c.dynamic,
            ..Self::default()
        }
    }
}

impl Histogram {
    /// Assume dark theme user is in a dimly-lit room with a no-so-blinding monitor?
    ///
    /// Adapting Luminance: overall room brightness
    ///      Night Dark room                5 ====> 20
    ///      Dimly lit room/movie theater  20 ====> 50
    ///      Office/typical indoor         80 ===> 200
    ///      Bright office/sunny indoor   200 ===> 500
    ///      Outdoor shade/cloudy day     500 ==> 1000
    ///      Direct sunlight             2000 => 10000
    /// Background Luminance: background
    ///      % to full white, best guess per theme
    /// Surround: ambient lighting at edges of FOV
    //XXX: maybe just new() as empty, like String::new()
    pub fn new_empty(threshold: f32, ord: ColorOrder, skip: bool) -> Self {
        let (wp, bg_lum) = match ord {
            ColorOrder::LightFirst => (140.0, 0.2),
            ColorOrder::DarkFirst => (500.0, 0.8),
        };
        let mut view = Parameters::default_static_wp(wp); // <- adapting luminance
        view.background_luminance = bg_lum;
        view.surround = Surround::Average;

        Self {
            histo: vec![],
            view: view.into(),
            threshold,
            ord,
            skip,
        }
    }

    /// Same as new_empty but uses HistoParams
    pub fn from_params_empty(p: &HistoParams) -> Self {
        Self::new_empty(p.threshold, p.ord, p.skip)
    }

    /// Same as new but uses HistoParams, computes bytes into colors
    pub fn from_params(p: &HistoParams, bytes: &[u8]) -> Self {
        Self::new(p.threshold, p.ord, p.skip, bytes)
    }

    /// Set threshold. Helper for dynamic histo generator
    pub fn with_th(self, threshold: f32) -> Self {
        Self { threshold, ..self }
    }

    /// Sets the histo. Helper used in dynamic histo gen (with_histo naming convention(?)
    pub fn fill_histo(self, bytes: &[u8]) -> Self {
        Self {
            histo: gather(&read_bytes(bytes, self.view), self.threshold, false),
            ..self
        }
    }

    pub fn fill_histo_mut(&mut self, bytes: &[u8]) -> &mut Self {
        self.histo = gather(&read_bytes(bytes, self.view), self.threshold, false);
        self
    }

    pub fn update_threshold(&mut self, threshold: f32) -> &mut Self {
        self.threshold = threshold;
        self
    }

    /// Same as new_empty, but fills `.histo` with `bytes`
    pub fn new(threshold: f32, ord: ColorOrder, skip: bool, bytes: &[u8]) -> Self {
        Self::fill_histo(Self::new_empty(threshold, ord, skip), bytes)
    }
}

fn read_bytes(bytes: &[u8], view: View) -> Specs {
    let s: &[Srgb<u8>] = bytes.components_as();
    s.iter()
        .map(|x| rgb_to_cam(x.into_format(), view))
        .collect::<Specs>()
}

/// 閾値に依存しない前段のふるい分け。
/// auto_threshold が 42 候補で使い回せるよう gather から切り出した。
/// lightness と colorfulness の範囲、および naive salience でふるいにかける。
fn gather_filtered(colors: &[Spec]) -> Specs {
    // We can't use only salience as a filter because there are scenarios
    // where colors will be of equal brightness but of high differences in
    // colorfulness.
    //
    // Colorfulness at low lightness is a bit wonky, as it is only
    // salient-accuracte for specific hues

    let lights = colors.iter().map(|c| c.lightness).collect::<Vec<_>>();
    let darkest = lights
        .iter()
        .fold(f32::INFINITY, |a, &b| a.min(b))
        .max(DARKEST);
    let lightest = lights
        .iter()
        .fold(f32::NEG_INFINITY, |a, &b| a.max(b))
        .min(LIGHTEST);
    //
    // We don't care about mexchroma, but 0.0 to 1.0 chroma is grayscale like
    // we use lesschroma on monochromatic or similar imgs, so it doesn't error out
    let colorfulnesses = colors.iter().map(|c| c.colorfulness).collect::<Vec<_>>();
    let origcl = avg(&colorfulnesses);
    let lesscl = colorfulnesses.iter().fold(f32::INFINITY, |a, &b| a.min(b));
    let ch = if origcl <= MIN_COLORFULNESS {
        lesscl
    } else {
        origcl / 2.5
    };

    // improved variant b/c standardized to 1 JND and beyond (to the best we could)
    colors
        .iter()
        .copied()
        .filter(|x| {
            x.lightness >= darkest
                && x.lightness <= lightest
                && x.colorfulness >= ch
                && x.sal_naive_i(&ColorOrder::LightFirst, Weights::SalienceNaive.value())
                    > COL_DARK_MIN_SAL
                && x.sal_naive_i(&ColorOrder::DarkFirst, Weights::SalienceNaive.value())
                    > COL_LIGHT_MIN_SAL
        })
        .collect()
}

/// 閾値に依存する bucketing 本体。ふるい済みの色を threshold でまとめる。
fn bucket(colors: &[Spec], threshold: f32) -> Vec<Histo> {
    let mut histo: Vec<Histo> = vec![];

    'outter: for c in colors {
        // Check if whether the color is new or is already in the vec
        for hist in &mut histo {
            // if any color is between a threshold, count it up
            if hist.color.can_bucket(c, threshold) {
                hist.count += 1;
                continue 'outter;
            }
        }
        // if we reach here, the color hasn't been found in the histrogram,
        // so we found a new color.
        histo.push(Histo {
            color: *c,
            count: 1,
            score: 0.0,
        });
    }
    histo
}

fn gather(colors: &[Spec], threshold: f32, _improved: bool) -> Vec<Histo> {
    bucket(&gather_filtered(colors), threshold)
}

impl ColorOrder {
    pub fn bg_naive(&self) -> Spec {
        match self {
            ColorOrder::LightFirst => DARKEST_COL,
            ColorOrder::DarkFirst => LIGHTEST_COL,
        }
    }

    pub fn bg_min_sal(&self) -> f32 {
        match self {
            ColorOrder::LightFirst => BG_DARK_MIN_SAL,
            ColorOrder::DarkFirst => BG_LIGHT_MIN_SAL,
        }
    }

    /// Returns the function accordingly
    pub fn dec_sal_l(&self) -> fn(Spec, f32) -> Spec {
        match self {
            ColorOrder::LightFirst => Spec::darken,
            ColorOrder::DarkFirst => Spec::lighten,
        }
    }

    /// Returns the function accordingly
    pub fn inc_sal_l(&self) -> fn(Spec, f32) -> Spec {
        match self {
            ColorOrder::LightFirst => Spec::lighten,
            ColorOrder::DarkFirst => Spec::darken,
        }
    }
}

impl std::fmt::Display for Palette {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Palette::Ansi => write!(f, "Ansi"),
            Palette::Salience => write!(f, "Salience"),
            Palette::Kmeans => write!(f, "Kmeans"),
        }
    }
}
