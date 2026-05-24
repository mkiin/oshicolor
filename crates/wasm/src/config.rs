//! wallust の Config のうち色抽出に要る部分だけを再構築したもの
use crate::histogram::{ColorOrder, Palette, SalienceIntensity, SamplingMode};

#[derive(Debug, Clone, Copy, Default)]
pub enum Style {
    #[default]
    Dark,
    Light,
}

#[derive(Debug, Clone, Copy, Default)]
pub struct SalienceConfig {
    pub sampling: SamplingMode,
    pub intensity: SalienceIntensity,
}

#[derive(Debug, Clone, Copy)]
pub struct KmeansConfig {
    pub k: u8,
    pub min_dist: f32,
}

impl Default for KmeansConfig {
    fn default() -> Self {
        Self {
            k: 16,
            min_dist: 10.0,
        }
    }
}

/// 抽出パイプラインが参照する設定。wallust の Config の部分集合にあたる
#[derive(Debug, Clone, Copy, Default)]
pub struct Config {
    pub threshold: u8,
    pub dynamic: bool,
    pub check_contrast: bool,
    pub saturation: Option<u8>,
    pub salience: SalienceConfig,
    pub kmeans: KmeansConfig,
    pub style: Style,
    pub use16cols: bool,
    pub palette: Palette,
}

impl From<Style> for ColorOrder {
    fn from(value: Style) -> Self {
        match value {
            Style::Dark => Self::LightFirst,
            Style::Light => Self::DarkFirst,
        }
    }
}
