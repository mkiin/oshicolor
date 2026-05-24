//! # Kmeans Palette
//! Color palette generation using K-means clustering in Lab color space. Directly produces a
//! [`Colors`] output sorted by lightness, bypassing the histogram pipeline. Before, we used to have
//! 5 runs of kmeans, however, using hamerly should be enough with a good enough pool.
//! Kmeans used to be considered a backend by me, however, it makes much more sense to have it as a
//! palette, since it takes bytes and selects them as colors, which is what salience and ansi does
//! basically.
use std::cmp::Ordering;

use kmeans_colors::get_kmeans_hamerly;
use palette::{
    FromColor, IntoColor, Lab, Srgb, cast::ComponentsAs, color_difference::DeltaE, white_point::D65,
};

use crate::colors::{Colors, ColorsSrgb};
use crate::config::KmeansConfig;

/// convert raw RGB bytes from a backend into Lab pixels
pub fn bytes_to_lab(bytes: &[u8]) -> Vec<Lab> {
    let img_vec: &[Srgb<u8>] = bytes.components_as();
    img_vec
        .iter()
        .map(|px| px.into_format::<f32>().into_color())
        .collect()
}

/// Takes bytes from a backend and returns Colors
/// Centroids are sorted dark to light, deduped by perceptual distance, then
/// 8 are sampled evenly across the range.
pub fn kmeans(bytes: &[u8], config: KmeansConfig) -> Colors {
    let pixels = bytes_to_lab(bytes);

    fastrand::seed(0xBEEF);

    let result = get_kmeans_hamerly(
        config.k.into(),
        100,
        1e-3,
        false,
        &pixels,
        fastrand::u64(..),
    );

    // sort centroids by Lab lightness (dark to light)
    let mut centroids: Vec<Lab<D65, f32>> = result.centroids;
    centroids.sort_by(|a, b| a.l.partial_cmp(&b.l).unwrap_or(Ordering::Equal));

    // drop centroids that are perceptually too close to the previous kept one
    let mut deduped: Vec<Lab<D65, f32>> = vec![];
    for c in centroids {
        let too_close = deduped
            .last()
            .map(|&prev| prev.delta_e(c) < config.min_dist)
            .unwrap_or(false);
        if !too_close {
            deduped.push(c);
        }
    }

    let n = deduped.len().max(1);

    // sample 8 evenly spaced colors across the deduped range
    let sample = |i: usize| -> Srgb {
        let idx = if n == 1 { 0 } else { (i * (n - 1)) / 7 };
        Srgb::from_color(deduped[idx])
    };

    // slightly lighten color0 for the bright-black (color8) slot
    let bright_black = {
        let mut lab = deduped[0];
        lab.l = (lab.l + 10.0).min(100.0);
        Srgb::from_color(lab)
    };

    let c: [Srgb; 8] = std::array::from_fn(sample);

    ColorsSrgb {
        background: c[0],
        foreground: c[7],
        cursor: c[7],

        color0: c[0],
        color1: c[1],
        color2: c[2],
        color3: c[3],
        color4: c[4],
        color5: c[5],
        color6: c[6],
        color7: c[7],

        color8: bright_black,
        color9: c[1],
        color10: c[2],
        color11: c[3],
        color12: c[4],
        color13: c[5],
        color14: c[6],
        color15: c[7],
    }
    .into()
}
