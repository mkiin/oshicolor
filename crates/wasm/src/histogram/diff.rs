//! Tools that help with reasoning about color differences
#![allow(unused)]
use palette::GetHue;
use palette::color_difference::{DeltaE, ImprovedDeltaE};

use crate::histogram::ColorOrder;

use super::Spec;
use super::util::{normalize_to_sum, stretched_exp};

/// Multiple colors against multiple colors (filter)
pub trait Bucketing {
    fn can_bucket(&self, a: &Self, threshold: f32) -> bool;
}

/// Weighting setup for salience calculations
pub type WeightsType = [f32; 3];

pub enum Weights {
    Bucketing,
    Salience,
    SalienceNaive,
}

/// Default weights for Cam16UcsJmh components for various calculations
impl Weights {
    pub fn value(&self) -> WeightsType {
        match *self {
            Weights::Bucketing => [1.0, 1.0, 1.5],
            Weights::Salience => [1.0, 1.0, 1.0],
            Weights::SalienceNaive => [1.0, 5.0, 0.0],
        }
    }
}

/// DeltaE, Salience, and it's naive and improved implementations.
pub trait Difference {
    /// Delta E
    fn de(&self, a: &Self) -> f32;
    /// Delta E improved
    fn de_i(&self, a: &Self) -> f32;
    /// Delta E Native
    fn de_naive(&self, a: &Self) -> f32;
    /// Delta E Native Improved
    fn de_naive_i(&self, a: &Self) -> f32;
    /// Salience
    fn sal(&self, a: &Self, w: WeightsType) -> f32;
    /// Salience Improved
    fn sal_i(&self, a: &Self, w: WeightsType) -> f32;
    /// Salience Native
    fn sal_naive(&self, ord: &ColorOrder, w: WeightsType) -> f32;
    /// Salience Native Improved
    fn sal_naive_i(&self, ord: &ColorOrder, w: WeightsType) -> f32;
}

impl Difference for Spec {
    fn de(&self, a: &Self) -> f32 {
        self.delta_e(*a)
    }
    fn de_i(&self, a: &Self) -> f32 {
        self.improved_delta_e(*a)
    }

    fn de_naive(&self, a: &Self) -> f32 {
        delta_e_naive(self, a)
    }
    fn de_naive_i(&self, a: &Self) -> f32 {
        improved_delta_e_naive(self, a)
    }

    fn sal(&self, a: &Self, w: WeightsType) -> f32 {
        salience(self, a, w)
    }
    fn sal_i(&self, a: &Self, w: WeightsType) -> f32 {
        improved_salience(self, a, w)
    }

    fn sal_naive(&self, ord: &ColorOrder, w: WeightsType) -> f32 {
        salience_naive(self, ord, w)
    }
    fn sal_naive_i(&self, ord: &ColorOrder, w: WeightsType) -> f32 {
        improved_salience_naive(self, ord, w)
    }
}

impl Bucketing for Spec {
    /// Evaluate if self can bucket with another Spec.
    ///
    /// A color can bucket (group) with another color if the hue, colorfulness,
    /// and lightness are similar enough and below a threshold. Humans tend to
    /// sort colors based on hue, then colorfulness and lightness. The latter
    /// two sorts may be interchangeable in order.
    ///
    /// This may seem similar to `sal`, but the goal and usage is different.
    /// `sal` is intended to be used for many colors against a single color
    /// (background) to discover "attention", while `can_bucket` is meant to
    /// be used for many colors against many other colors for the purposes of
    /// grouping.
    fn can_bucket(&self, a: &Self, threshold: f32) -> bool {
        // Lower difference means more similar
        let mut dj: f32 = self.lightness - a.lightness;
        let mut dm: f32 = sal_delta_m(self, a);
        let mut dh: f32 = sal_delta_h(self, a);

        // normalize each component so they scale like 0 to 100 threshold
        // colorfulness "softcaps" around 40; rare for a color to go above
        // hue delta only goes up to 180
        let n_max = 100.0;
        let (ml, mm, mh) = (100.0, 40.0, 180.0);
        let (nl, nm, nh) = (1.0 / ml, 1.0 / mm, 1.0 / mh);
        (dj, dm, dh) = (dj * nl * n_max, dm * nm * n_max, dh * nh * n_max);
        // for hue, this means that threshold 1.0 = 1.8 delta_h w/o weight adjust

        let weights = Weights::Bucketing.value();
        let weights = normalize_to_sum(weights, 3.0);
        let (wl, wc, wh) = (weights[0], weights[1], weights[2]);

        dj *= wl;
        dm *= wc;
        dh *= wh;

        let sclr = 1.0;
        let diff: f32 = sclr * (dj.powi(2) + dm.powi(2) + dh.powi(2)).sqrt();
        // let diff: f32 = dh;

        diff <= threshold
    }
}

#[inline]
fn delta_e_naive(a: &Spec, b: &Spec) -> f32 {
    // Jmh delta, just no h.
    let dl = a.lightness - b.lightness;
    let dm = a.colorfulness - b.colorfulness;
    (dl.powi(2) + dm.powi(2)).powf(0.5)
}

#[inline]
fn improved_delta_e_naive(a: &Spec, b: &Spec) -> f32 {
    // Jmh improved delta, just no h.
    let dl = (a.lightness - b.lightness).powi(2);
    let dm = (a.colorfulness - b.colorfulness).powi(2);

    // new scalar to roughly match ~1 JND
    // not proved, ai guessed ~1.5-1.55 around there
    1.55 * (dl + dm).powf(0.63 * 0.5)
}

#[inline]
/// Calculate the perceptual salience of a against b
fn salience(a: &Spec, b: &Spec, w: WeightsType) -> f32 {
    let mut dj = a.lightness - b.lightness;
    let mut dm = sal_delta_m(a, b);
    let mut dh = sal_delta_h(a, b);

    let weights = normalize_to_sum(w, 3.0);
    let (wj, wm, wh) = (weights[0], weights[1], weights[2]);

    dj *= wj;
    dm *= wm;
    dh *= wh;

    (dj.powi(2) + dm.powi(2) + dh.powi(2)).sqrt()
}

#[inline]
fn improved_salience(a: &Spec, b: &Spec, w: WeightsType) -> f32 {
    1.85 * salience(a, b, w).powf(0.48)
}

#[inline]
/// Naive does not take into account the hue of the color.
fn salience_naive(a: &Spec, ord: &ColorOrder, w: WeightsType) -> f32 {
    // Expect calculations to underrepresent, especially in cases where
    // the only difference is hue.
    let b = ord.bg_naive();

    let mut dj = a.lightness - b.lightness;
    let mut dm = sal_delta_m(a, &b);

    let weights = normalize_to_sum(w, 2.0);
    let (wj, wm) = (weights[0], weights[1]);

    dj *= wj;
    dm *= wm;

    (dj.powi(2) + dm.powi(2)).sqrt()
}

#[inline]
fn improved_salience_naive(a: &Spec, ord: &ColorOrder, w: WeightsType) -> f32 {
    2.73 * salience_naive(a, ord, w).powf(0.52) // already sqrt
}

/// Return the smallest difference from two cyclic hues
fn hue_distance(a: &Spec, b: &Spec) -> f32 {
    let h1 = a.get_hue().into_degrees();
    let h2 = b.get_hue().into_degrees();
    let diff = (h2 - h1).abs() % 360.0;
    diff.min(360.0 - diff)
}

/// Return delta colorfulness taking into account lightness of a
///
/// Delta colorfulness has no affect:
///   - towards 0 lightness (black for all colorfulness)
#[inline]
pub fn sal_delta_m(a: &Spec, b: &Spec) -> f32 {
    let dm = (a.colorfulness - b.colorfulness).abs();

    // lightness
    let sclr_j = {
        let d = 3.0;
        let p = 2.0;
        let aj = a.lightness;
        stretched_exp(aj, d, p)
    };

    dm * sclr_j
}

/// Return delta hue taking into account lightness and colorfulness of a
///
/// Delta hue has no affect:
///   - towards 0 lightness (black for all hues)
///   - towards 0 colorfulness (grey for all hues)
#[inline]
pub fn sal_delta_h(a: &Spec, b: &Spec) -> f32 {
    let dh = hue_distance(a, b);

    // lightness
    let sclr_j = {
        let d = 3.0;
        let p = 2.0;
        let aj = a.lightness;
        stretched_exp(aj, d, p)
    };

    // colorfulness
    let sclr_m = {
        let d = 3.0;
        let p = 2.0;
        let am = a.colorfulness;
        stretched_exp(am, d, p)
    };

    dh * sclr_j * sclr_m
}
