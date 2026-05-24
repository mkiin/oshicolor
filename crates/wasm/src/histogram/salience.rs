//! # Salience
//! Salience using Cam16UcsJmh with DeltaE and ImprovedDeltaE.
//! Color Picker: https://apps.colorjs.io/picker/cam16-jmh
//!
//! Instead of luminance and chroma, Cam16UcsJmh uses lightness and
//! colorfulness.
//!
//! For other color spaces, light and color are mapped to physics rather than
//! perception (luminance and chroma). This results in a perceptual coupling
//! of light and color; if force a color into high/low luminance, the viewed
//! color is not accurate to human intentions. Lightness and colorfulness
//! instead maps linearly to perception, decoupling light and color.
//!
//! Cam16UcsJmh's components result in a much more elegant salience
//! calculations, being the euclidian distance of all components. However,
//! for saliency mapping, lightness still dominates, so not all components
//! can be weighted equally.
//!
//! Cam16 provides Parameters which allows us to set viewing conditions. This
//! will adjust colors to appear as they would under said viewing conditions.
//! May be unwanted for our use case.
//!
//! ref: <https://docs.rs/palette/0.7.6/palette/cam16/struct.Cam16UcsJmh.html>
use palette::IntoColor;

use super::diff::{Bucketing, Difference};

pub use super::Spec;
use super::*;
use itertools::Itertools;
use std::cmp::Ordering;

/// 候補チャンクのサイズ。native は論理コア数で並列、wasm はスレッド非対応なので 1 で逐次。
#[cfg(not(target_arch = "wasm32"))]
fn candidate_chunk_size() -> usize {
    rayon::current_num_threads().max(1)
}

#[cfg(target_arch = "wasm32")]
fn candidate_chunk_size() -> usize {
    1
}

/// チャンク内の各 threshold を bucket + score する。native は rayon 並列、wasm は逐次。
/// collect は入力順を保つので、後段の idx 順選択は逐次版と一致する。
#[cfg(not(target_arch = "wasm32"))]
fn score_candidates(filtered: &[Spec], chunk: &[i32]) -> Vec<(i32, f32, Vec<Histo>)> {
    use rayon::prelude::*;
    chunk
        .par_iter()
        .map(|&th| {
            let histo = bucket(filtered, th as f32);
            (th, score_histogram(&histo), histo)
        })
        .collect()
}

#[cfg(target_arch = "wasm32")]
fn score_candidates(filtered: &[Spec], chunk: &[i32]) -> Vec<(i32, f32, Vec<Histo>)> {
    chunk
        .iter()
        .map(|&th| {
            let histo = bucket(filtered, th as f32);
            (th, score_histogram(&histo), histo)
        })
        .collect()
}

use palette::{
    Clamp, FromColor,
    cam16::{Cam16, Cam16Jmh},
};

impl Histogram {
    /// This parser only needs 6 _ [0..=5]. Sorted by lowest salience first.
    /// The whole point of this palette is that colors are sorted by salience in
    /// accordance to the chosen background color.
    ///
    /// Two sorts are made.
    ///     (1) a naive salience sort that does not take into account hue
    ///         to determine the least salient color to be set a bg, and
    ///     (2) a salience sort against the chose bg color.
    ///
    /// With colors finally sorted with salience against bg, operations onto
    /// the first and last color will not alter salience ordering, so long as
    /// the operations make sense (i.e. only make least salient less salient
    /// and most salient more salient). You shouldn't mess with the hue.
    pub fn salience_palette(&self, mode: &SamplingMode) -> Colors {
        let ee = Myrgb(Srgb::<u8>::new(238, 238, 238).into_format()); // #EEEEEE

        // Always use col[0] for background. All of the previous logic on
        // colorspace saliencelch is there to ensure that col0 is the most
        // prominent color.

        // If we have more than 6 colors, we can have c[0] and c[1] be different.
        // Removed to shift all colors over for more elegant assignment later.
        // Now we have min 6 colors.
        let mut cams: Vec<_> = self.histo.iter().map(|c| c.color).collect();

        let mut bg = if cams.len() > 6 {
            cams.remove(0)
        } else {
            cams[0]
        };
        bg = self.constrain_col_as_bg(bg);
        let res =
            self.constrain_col_against_cols(bg, &cams, &[self.ord.bg_min_sal(), C0_MIN_SAL_BG]);
        let (bg, col0) = (res[0], res[1]);

        // If we still have more colors, turn cols[6] into fg, col7, col8, and col15
        let high_factor = 0.45;
        let high = if cams.len() > 6 {
            match mode {
                SamplingMode::Low => self.ord.inc_sal_l()(cams[6], high_factor),
                SamplingMode::Balanced => self.ord.inc_sal_l()(
                    cams[*util::sample_center_idxs(&cams, 6)
                        .last()
                        .expect("Not Empty")],
                    high_factor,
                ),
                _ => self.ord.inc_sal_l()(*cams.last().expect("not empty"), high_factor),
            }
        } else {
            self.ord.inc_sal_l()(*cams.last().expect("not empty"), high_factor)
        };

        let (fg, col7, col8, col15) = match self.ord {
            ColorOrder::LightFirst => {
                let fg = self.ord.inc_sal_l()(high, 0.25);
                let col7 = high;
                let col8 = self.ord.dec_sal_l()(col7, 0.30);
                let col15 = ee.blend(Myrgb(self.to_rgb(high)));
                (fg, col7, col8, col15)
            }
            ColorOrder::DarkFirst => {
                let fg = high.darken(high_factor);
                let col7 = high.darken(high_factor);
                let col8 = col7.darken(0.30);
                let col15 = high.darken(0.85);
                (fg, col7, col8, Myrgb(self.to_rgb(col15)))
            }
        };

        let cols: Vec<_> = cams.into_iter().map(|c| self.to_rgb(c)).collect();

        // sample colors 0-5 that we will use
        let c: &[Srgb] = match mode {
            SamplingMode::Low => &cols,
            SamplingMode::Balanced => &util::sample_center(&cols, 6),
            SamplingMode::Distributed => &util::sample_distributed(&cols, 6),
            SamplingMode::High => &cols[cols.len() - 6..],
        };

        ColorsSrgb {
            background: self.to_rgb(bg),
            foreground: self.to_rgb(fg),
            cursor: Myrgb(self.to_rgb(fg)).blend(c[4].into()).0,

            /* First row */
            color0: self.to_rgb(col0),
            color1: c[0],
            color2: c[1],
            color3: c[2],
            color4: c[3],
            color5: c[4],
            color6: c[5],
            color7: self.to_rgb(col7),

            /* Second row */
            color8: self.to_rgb(col8),
            color9: c[0],
            color10: c[1],
            color11: c[2],
            color12: c[3],
            color13: c[4],
            color14: c[5],
            color15: col15.0,
        }
        .into()
    }

    pub fn dedup(&mut self) -> &mut Self {
        self.histo
            .iter_mut()
            .dedup_by_with_count(|a, b| a.color.can_bucket(&b.color, self.threshold))
            .for_each(|x| x.1.count += x.0);
        self
    }

    pub fn post_dedup(&mut self) -> &mut Self {
        // Make the most prominent (most count) color as the background
        // i.e. if blue themed wallpaper, then blue theme!
        let (idx, _) = self
            .histo
            .iter()
            .enumerate()
            .max_by_key(|(_, item)| item.count)
            .expect("Not Empty Iterator");
        let max_histo = self.histo[idx];

        let bg = max_histo.color;
        let cams: Vec<Spec> = self.histo.iter().map(|h| h.color).collect();
        let bg = self.constrain_col_as_bg(bg);
        let _res = constrain_col_against_cols(bg, &cams, &self.ord, &[self.ord.bg_min_sal()]);
        // let bg = res[0];

        self.histo.sort_by(|a, b| {
            a.color
                .sal_naive(&self.ord, Weights::Bucketing.value())
                .partial_cmp(&b.color.sal_naive(&self.ord, Weights::Bucketing.value()))
                .unwrap_or(Ordering::Equal)
        });

        self
    }

    /// This sorts the histo in a way that you get more "softer" pastel like colors, or the
    /// opposite, while preserving the background color, which is [0]. SalienceIntensity::Normal
    /// just does nothing, leaving the original sort by salience.
    //TODO: Maybe store the background color as it's own variable in Salience struct
    pub fn with_intensity(&mut self, c: &SalienceConfig) -> &mut Self {
        let bg = self.histo[0];
        match c.intensity {
            // Pastel と Vibrant は #036 で実装する。今は Normal と同じ並びにする
            SalienceIntensity::Pastel | SalienceIntensity::Vibrant | SalienceIntensity::Normal => {}
        }
        self.histo.insert(0, bg);
        self
    }

    pub fn constrain_col_against_cols(
        &self,
        context: Spec,
        cols: &[Spec],
        thresholds: &[f32],
    ) -> Vec<Spec> {
        constrain_col_against_cols(context, cols, &self.ord, thresholds)
    }
    pub fn to_rgb(&self, a: Spec) -> Srgb {
        let cam16: Cam16Jmh<f32> = a.into_color();
        let xyz = cam16.into_xyz(self.view);
        Srgb::from_color(xyz)
    }
    pub fn from_rgb(&self, a: Srgb) -> Spec {
        rgb_to_cam(a, self.view)
    }

    pub fn to_rgbs(&self) -> Vec<Srgb> {
        self.histo.iter().map(|i| self.to_rgb(i.color)).collect()
    }

    /// Return a histogram sorted asc on score (count and salience) based on bg
    pub fn sort_by_score(&mut self, bg: Spec) {
        // Some kind of constant I pulled from thin air to be used in a formula.
        //
        // The formula is that given colors A and B, where B is half as
        // salient as A, we need 2^cnt_sclr count for B to overpower A.
        let cnt_sclr = 4.0;

        // Factor to adjust salience to score
        // Salience seems to generally scale from 0-100, with slightly preceptable
        // at 5. In other words, with a black background, a pure white color would
        // yield salience 100.
        let sal_factor = 1.0 / 20.0 * 1.5;

        self.histo.iter_mut().for_each(|hs| {
            let score_log_scaled = (hs.count as f32).powf(1.0 / cnt_sclr);
            let col = hs.color;
            hs.score =
                score_log_scaled * (1.0 + col.sal_i(&bg, Weights::Bucketing.value()) * sal_factor);
        });
        self.histo.sort_by(|a, b| {
            b.score
                .partial_cmp(&a.score)
                .unwrap_or(std::cmp::Ordering::Greater)
        });
    }

    /// Turn the color into a sane background given a collection of planned colors to use
    pub fn constrain_col_as_bg(&self, col: Spec) -> Spec {
        let mut bg = col;
        let least_sal: &Spec = &self.histo[0].color;
        bg.lightness = match self.ord {
            ColorOrder::LightFirst => least_sal
                .lightness
                .max(bg.lightness)
                .clamp(BG_DARK_L_SOFTMIN, BG_DARK_L_SOFTMAX),
            ColorOrder::DarkFirst => least_sal
                .lightness
                .min(bg.lightness)
                .clamp(BG_LIGHT_L_SOFTMIN, BG_LIGHT_L_SOFTMAX),
        };
        bg.colorfulness = least_sal
            .colorfulness
            .min(bg.colorfulness)
            .clamp(BG_COLORFULNESS_MIN, BG_COLORFULNESS_MAX);
        bg.clamp()
    }

    /// Either use one threshold or multiple ones.
    /// if dynamic, checks for a cached threshold first before running auto_threshold.
    pub fn use_dynamic_lookup(&mut self, bytes: &[u8], dynamic: bool) -> &mut Self {
        if dynamic {
            self.auto_threshold(bytes);
        } else {
            self.fill_histo_mut(bytes);
        }
        self
    }

    /// Threshold lookup exclusive to the Salience method, given that Ansi does not care about it.
    /// 逐次で回す。join 順が idx 順なのでマルチスレッド版と結果は同じになる
    fn auto_threshold(&mut self, bytes: &[u8]) -> &mut Self {
        let mut threshold = 20;

        // CAM16 変換と前段フィルタはどちらも閾値に依存しない。1 回だけ行い 42 候補で使い回す。
        // wallust は候補ごとにやり直すがマルチスレッドで隠す。wasm は逐次なのでここを集約する
        let specs = read_bytes(bytes, self.view);
        let filtered = gather_filtered(&specs);

        let idx = [
            14, 16, 13, 17, 12, 18, 11, 19, 10, 20, 9, 21, 8, 22, 23, 24, 25, 26, 27, 28, 29, 30,
            31, 32, 33, 34, 35, 36, 37, 7, 6, 5, 4, 3, 2, 38, 39, 40, 41, 42, 43, 44,
        ];

        // bucket が本体の重さ。低 threshold ほどバケットが激増して O(P^2) に近づくが、
        // early-exit が通常そこへ到達する前に止める。wallust と同じくチャンク単位で評価し、
        // counter 状態を idx 順に通すことで、chunk_size に依らず逐次版と出力が一致する。
        // native は chunk を rayon で並列化、wasm はスレッド非対応なので逐次にする。
        let chunk_size = candidate_chunk_size();

        let mut best_histo: Vec<Histo> = Vec::new();
        let mut best = -1.0;
        let mut prev_score = -1.0;
        let mut counter = 0;

        'outer: for chunk in idx.chunks(chunk_size) {
            let results = score_candidates(&filtered, chunk);

            for (th, score, histo) in results {
                if score > best {
                    best = score;
                    best_histo = histo;
                    threshold = th;
                }

                if prev_score > 0.0 {
                    if prev_score > score {
                        counter += 1;
                    } else {
                        counter = 0;
                    }
                    // If it lowers twice, we already have the best histo
                    if counter == 2 {
                        break 'outer;
                    }
                }

                prev_score = score;
            }
        }

        self.histo = best_histo;
        self.threshold = threshold as f32;
        self
    }
}

/// based off sort_by_score, instead of a background, tests saliency between colors
fn score_histogram(histo: &[Histo]) -> f32 {
    if histo.len() < 2 {
        return 0.0;
    } // Not enought to compare

    let cnt_sclr = 4.0;
    let mut total = 0.0;
    let mut weight = 0.0;

    for i in 0..histo.len() {
        for j in (i + 1)..histo.len() {
            let sal = histo[i]
                .color
                .sal_i(&histo[j].color, Weights::Salience.value());

            // same count weighting from sort_by_score
            let wi = (histo[i].count as f32).powf(1.0 / cnt_sclr);
            let wj = (histo[j].count as f32).powf(1.0 / cnt_sclr);
            let w = wi * wj;

            total += sal * w;
            weight += w;
        }
    }

    if weight == 0.0 {
        return 0.0;
    }
    total / weight
}

pub fn rgb_to_cam(a: Srgb, view: View) -> Spec {
    let cam16 = Cam16::from_xyz(a.into_color(), view);
    Cam16UcsJmh::from_color(cam16)
}

/// Return a color that is like `col` but is constrained to the minimum
/// salient and delta lightness `cols`.
///
/// You can use the returned color as the "true" background, and then sort
/// a collection of colors against said color against salience. Sometimes
/// sorting may change as you alter the background, so this is to /finalize/
/// the background and then sort.
///
/// If you're using Vec<Histo> or Vec<Histoscore>, map it flat as Vec<Spec>,
/// then use the `bg` returned here to sort your Vec.
///
/// For thresholds, pass in a size `n` vector to get a size `n` vector back,
/// whose first element satisfies against the least salient colors in `cols`,
/// of `thresholds[0]`, and whose `i`th element satisfies `thresholds[i]` for
/// return vector [i-1].
///
/// In other words, [0.5, 0.1] means...
///     the least salient color is at least 0.5 salient against ret[0]
///     ret[1] is at least 0.1 salient against ret[0]
///     ...
///     ret[n] is at least thresholds[n] salient against ret[n-1]
///
/// When we reach pure black, all remaining elements will be black.
pub fn constrain_col_against_cols(
    context: Spec,
    cols: &[Spec],
    ord: &ColorOrder,
    thresholds: &[f32],
) -> Vec<Spec> {
    if thresholds.is_empty() {
        return vec![cols[0]];
    }
    let mut thresholds = thresholds.to_vec();
    thresholds.reverse();
    let mut cols = cols.to_vec();

    // Initial sorting against context to get least salient color
    cols.sort_by(|a, b| {
        a.sal(&context, Weights::Salience.value())
            .partial_cmp(&b.sal(b, Weights::Salience.value()))
            .unwrap_or(Ordering::Equal)
    });

    let least_sal = *cols.first().expect("not empty");

    // Define how we sort
    let dec_sal_l = ord.dec_sal_l();

    let mut mod_and_sort = |mut ctx, mut other: Spec, t: f32, is_initial_bg: bool| -> Spec {
        let dl_enforce = match ord {
            ColorOrder::LightFirst => BG_DARK_ENFORCE_L_DELTA,
            ColorOrder::DarkFirst => BG_LIGHT_ENFORCE_L_DELTA,
        };

        while other.sal_i(&ctx, Weights::Salience.value()) < t
            || ((ctx.lightness - other.lightness).abs() < dl_enforce && is_initial_bg)
        {
            // ctx = ctx.desaturate(0.05); // prefer darken over desaturate
            ctx = dec_sal_l(ctx, 0.05);
            ctx = ctx.clamp();

            if ctx.lightness < BG_DARK_L_SOFTMIN || ctx.lightness > BG_LIGHT_L_SOFTMAX {
                break;
            };

            // This continuous sort needs to be done if salience calculations
            // differ would result in different sorting as a result of ctx alterations.
            cols.sort_by(|a, b| {
                a.sal(&ctx, Weights::Salience.value())
                    .partial_cmp(&b.sal(&ctx, Weights::Salience.value()))
                    .unwrap_or(Ordering::Equal)
            });
            if is_initial_bg {
                other = *cols.first().expect("not empty")
            };
        }
        ctx
    };

    let mut ret: Vec<Spec> = Vec::new();
    let mut threshold = thresholds.pop().expect("not empty");

    // Tune ctx against lowest salient color (or ctx) and continuously sort
    let context = mod_and_sort(context, least_sal, threshold, true);

    ret.push(context);

    while !thresholds.is_empty() {
        threshold = thresholds.pop().expect("not empty");
        ret.push(mod_and_sort(context, context, threshold, false))
    }

    ret.reverse();

    ret
}
