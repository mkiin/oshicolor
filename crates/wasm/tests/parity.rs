//! 第 1 層 parity テスト。再構築した抽出関数が native で wallust CLI の出力と一致するか見る。
//! 参照は scripts/wallust-golden.sh が backend=resized で生成した wallust-reference.json。
//! 画像は $NIKKE_DIR に置く。どちらかが無ければ skip する。
use std::collections::BTreeMap;
use std::path::PathBuf;

const FIELDS: [&str; 19] = [
    "background",
    "foreground",
    "cursor",
    "color0",
    "color1",
    "color2",
    "color3",
    "color4",
    "color5",
    "color6",
    "color7",
    "color8",
    "color9",
    "color10",
    "color11",
    "color12",
    "color13",
    "color14",
    "color15",
];

fn reference_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../tests/features/color-extract/fixtures/wallust-reference.json")
}

fn nikke_dir() -> PathBuf {
    match std::env::var("NIKKE_DIR") {
        Ok(d) => PathBuf::from(d),
        Err(_) => PathBuf::from(std::env::var("HOME").unwrap_or_default()).join("Pictures/nikke"),
    }
}

#[test]
fn matches_wallust_cli() {
    let ref_path = reference_path();
    let dir = nikke_dir();
    if !ref_path.exists() || !dir.exists() {
        eprintln!(
            "skip: 参照 {} か画像 {} が無い。scripts/wallust-golden.sh --all で生成する",
            ref_path.display(),
            dir.display()
        );
        return;
    }

    let raw = std::fs::read_to_string(&ref_path).expect("参照 JSON を読む");
    let reference: serde_json::Value = serde_json::from_str(&raw).expect("参照 JSON を parse");
    let images = reference.as_object().expect("トップは object");

    let mut mismatches: Vec<String> = Vec::new();
    let mut checked = 0usize;

    for (name, palettes) in images {
        let img_path = dir.join(format!("{name}.png"));
        let Ok(bytes) = std::fs::read(&img_path) else {
            eprintln!("skip image: {}", img_path.display());
            continue;
        };

        for palette in ["salience", "ansi", "kmeans"] {
            for style in ["dark", "light"] {
                let expected = &palettes[palette][style];
                let got =
                    oshicolor_wasm::gen_hex(&bytes, palette, style, false, true, 14, false, None)
                        .expect("抽出が成功する");
                let got: BTreeMap<&str, String> = got.into_iter().collect();

                for field in FIELDS {
                    let exp = expected[field].as_str().unwrap_or("");
                    let act = got.get(field).map(String::as_str).unwrap_or("");
                    if exp != act {
                        mismatches.push(format!(
                            "{name} {palette}/{style} {field}: 期待 {exp} 実際 {act}"
                        ));
                    }
                }
                checked += 1;
            }
        }
    }

    eprintln!(
        "照合した palette 数: {checked}, 不一致 field 数: {}",
        mismatches.len()
    );
    for m in mismatches.iter().take(40) {
        eprintln!("  {m}");
    }
    assert!(mismatches.is_empty(), "{} 件の不一致", mismatches.len());
}
