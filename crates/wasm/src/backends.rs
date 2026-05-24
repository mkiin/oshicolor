//! 画像バイト列をデコードして RGB8 に縮小する
//! wallust の resized バックエンド相当で、環境差を避けるため image の純スカラー Gaussian を使う
use anyhow::Result;
use image::GenericImageView;

/// デコードしてアスペクト比を保ったまま縮小し RGB8 の生バイトを返す
pub fn decode_and_resize(bytes: &[u8]) -> Result<Vec<u8>> {
    let img = image::load_from_memory(bytes)?;
    let (w, h) = img.dimensions();
    let (nw, nh) = shrink(w, h);
    Ok(img
        .resize(nw, nh, image::imageops::Gaussian)
        .into_rgb8()
        .into_raw())
}

/// 長辺が 1024px 以上のとき半分にする。wallust の resized::shrink と同じ
fn shrink(w: u32, h: u32) -> (u32, u32) {
    if w >= 1024 || h >= 1024 {
        (w / 2, h / 2)
    } else {
        (w, h)
    }
}
