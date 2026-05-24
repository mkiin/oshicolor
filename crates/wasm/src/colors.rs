//! Colors と Myrgb の定義。wallust の colors.rs から色計算に要る部分だけを再構築したもの
//! 端末シーケンスやテンプレートや owo_colors の表示系は持たない
use std::fmt;

use palette::{Hsv, IntoColor, Srgb};

/// 16 色 + bg/fg/cursor のスキーム
#[derive(Debug, Copy, Clone)]
pub struct Colors {
    pub cursor: Myrgb,
    pub background: Myrgb,
    pub foreground: Myrgb,
    pub color0: Myrgb,
    pub color1: Myrgb,
    pub color2: Myrgb,
    pub color3: Myrgb,
    pub color4: Myrgb,
    pub color5: Myrgb,
    pub color6: Myrgb,
    pub color7: Myrgb,
    pub color8: Myrgb,
    pub color9: Myrgb,
    pub color10: Myrgb,
    pub color11: Myrgb,
    pub color12: Myrgb,
    pub color13: Myrgb,
    pub color14: Myrgb,
    pub color15: Myrgb,
}

/// sRGB のラッパ。変換と modification のメソッドを持つ
#[derive(Debug, Copy, Clone, PartialEq)]
pub struct Myrgb(pub Srgb);

/// `#RRGGBB` で表示する
impl fmt::Display for Myrgb {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        let (r, g, b) = self.0.into_format::<u8>().into_components();
        write!(f, "#{r:02X}{g:02X}{b:02X}")
    }
}

impl Myrgb {
    pub fn to_rgb8(self) -> (u8, u8, u8) {
        self.0.into_format::<u8>().into_components()
    }

    /// pywal util.py 由来の darken
    pub fn darken(&self, amount: f32) -> Self {
        use palette::Darken;
        Self(self.0.darken(amount))
    }

    /// pywal util.py 由来の lighten
    pub fn lighten(&self, amount: f32) -> Self {
        use palette::Lighten;
        Self(self.0.lighten(amount))
    }

    /// 2 色の線形補間の中点
    pub fn blend(&self, other: Self) -> Self {
        let me = self.0;
        let other = other.0;
        Self(Srgb::new(
            0.5 * me.red + 0.5 * other.red,
            0.5 * me.green + 0.5 * other.green,
            0.5 * me.blue + 0.5 * other.blue,
        ))
    }

    /// amount は [0.0, 1.0]
    pub fn saturate(&self, amount: f32) -> Self {
        use palette::Saturate;
        let a: Hsv = self.0.into_color();
        let rgb: Srgb<f32> = a.saturate(amount).into_color();
        Self(rgb)
    }
}

impl Colors {
    /// bool ラッパ。コンストラクタパターン用
    pub fn use16col(&mut self, x: bool) -> &mut Self {
        if x { self.set_16col() } else { self }
    }

    /// 下半分の色を暗くして色数が多い錯覚を作る pywal16 由来の変種
    pub fn set_16col(&mut self) -> &mut Self {
        self.color1 = self.color1.darken(0.25);
        self.color2 = self.color2.darken(0.25);
        self.color3 = self.color3.darken(0.25);
        self.color4 = self.color4.darken(0.25);
        self.color5 = self.color5.darken(0.25);
        self.color6 = self.color6.darken(0.25);
        self
    }

    /// amount は 0.0 から 1.0
    pub fn saturate_colors(&mut self, amount: f32) {
        if amount > 1.0 && amount.is_sign_negative() {
            return;
        }
        let _ = [
            &mut self.color1,
            &mut self.color2,
            &mut self.color3,
            &mut self.color4,
            &mut self.color5,
            &mut self.color6,
            &mut self.color9,
            &mut self.color10,
            &mut self.color11,
            &mut self.color12,
            &mut self.color13,
            &mut self.color14,
        ]
        .map(|i| *i = i.saturate(amount));
    }

    /// fg と bg の WCAG コントラストが十分か
    pub fn contrast_well(a: Myrgb, b: Myrgb) -> bool {
        use palette::color_difference::Wcag21RelativeContrast;
        a.0.has_min_contrast_text(b.0)
    }

    /// 全色のコントラストを調整する。pywal は color0/7/8/15 を無視する
    pub fn check_contrast_all(&mut self) {
        let a = [
            &mut self.color1,
            &mut self.color2,
            &mut self.color3,
            &mut self.color4,
            &mut self.color5,
            &mut self.color6,
            &mut self.color9,
            &mut self.color10,
            &mut self.color11,
            &mut self.color12,
            &mut self.color13,
            &mut self.color14,
        ];

        let mut i: u32 = 0;
        let mut bg_already_dark = false;

        while !Self::contrast_well(self.background, self.foreground) && i < 10 {
            self.background = self.background.darken(0.15);
            self.foreground = self.foreground.lighten(0.15);
            bg_already_dark = true;
            i += 1;
        }
        for col in a {
            i = 0;
            while !Self::contrast_well(self.background, *col) && i < 5 {
                if !bg_already_dark {
                    self.background = self.background.darken(0.15);
                    bg_already_dark = true;
                }
                *col = col.lighten(0.05);
                i += 1;
            }
        }
    }
}

impl From<Srgb> for Myrgb {
    fn from(v: Srgb) -> Myrgb {
        Myrgb(v)
    }
}

impl From<&Srgb> for Myrgb {
    fn from(v: &Srgb) -> Myrgb {
        Myrgb(*v)
    }
}

impl From<Srgb<u8>> for Myrgb {
    fn from(c: Srgb<u8>) -> Self {
        Self(c.into_format())
    }
}

impl From<Myrgb> for Srgb<u8> {
    fn from(c: Myrgb) -> Self {
        c.0.into_format()
    }
}

/// ColorsSrgb から Colors へ変換するためのヘルパ
pub(crate) struct ColorsSrgb {
    pub cursor: Srgb,
    pub background: Srgb,
    pub foreground: Srgb,
    pub color0: Srgb,
    pub color1: Srgb,
    pub color2: Srgb,
    pub color3: Srgb,
    pub color4: Srgb,
    pub color5: Srgb,
    pub color6: Srgb,
    pub color7: Srgb,
    pub color8: Srgb,
    pub color9: Srgb,
    pub color10: Srgb,
    pub color11: Srgb,
    pub color12: Srgb,
    pub color13: Srgb,
    pub color14: Srgb,
    pub color15: Srgb,
}

impl From<ColorsSrgb> for Colors {
    fn from(v: ColorsSrgb) -> Colors {
        Self {
            cursor: Myrgb(v.cursor),
            background: Myrgb(v.background),
            foreground: Myrgb(v.foreground),
            color0: Myrgb(v.color0),
            color1: Myrgb(v.color1),
            color2: Myrgb(v.color2),
            color3: Myrgb(v.color3),
            color4: Myrgb(v.color4),
            color5: Myrgb(v.color5),
            color6: Myrgb(v.color6),
            color7: Myrgb(v.color7),
            color8: Myrgb(v.color8),
            color9: Myrgb(v.color9),
            color10: Myrgb(v.color10),
            color11: Myrgb(v.color11),
            color12: Myrgb(v.color12),
            color13: Myrgb(v.color13),
            color14: Myrgb(v.color14),
            color15: Myrgb(v.color15),
        }
    }
}
