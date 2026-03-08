#!/usr/bin/env bash
set -euo pipefail

# ===== 調整ポイント =====
LIGHTNESS_LEVELS="45,65"  # 出力する明度レベル（カンマ区切り、Okhsl 0〜100）
NUM_COLORS=8              # 抽出色数
SWATCH_SIZE=40            # スウォッチ1個のサイズ（px）
# =======================

IMG_DIR="debug/img"
OUT_DIR="debug/scheme-palettes"

mkdir -p "$OUT_DIR"

for f in "$IMG_DIR"/*.png; do
  name=$(basename "$f" .png)
  echo "Processing: $name"

  COLORS_OUTPUT=$(okolors "$f" -w 0 -l "$LIGHTNESS_LEVELS" --no-avg-lightness -k "$NUM_COLORS")

  mapfile -t ROWS <<< "$COLORS_OUTPUT"
  NUM_ROWS=${#ROWS[@]}

  FIRST_ROW=(${ROWS[0]})
  COUNT=${#FIRST_ROW[@]}

  TOTAL_W=$((COUNT * SWATCH_SIZE))
  TOTAL_H=$((NUM_ROWS * SWATCH_SIZE))

  {
    echo "<svg height=\"${TOTAL_H}\" viewBox=\"0 0 ${TOTAL_W} ${TOTAL_H}\" xmlns=\"http://www.w3.org/2000/svg\">"
    echo "  <rect id=\"swatch\" width=\"${SWATCH_SIZE}\" height=\"${SWATCH_SIZE}\"/>"

    for row_i in "${!ROWS[@]}"; do
      ROW_COLORS=(${ROWS[$row_i]})
      Y=$((row_i * SWATCH_SIZE))
      for col_i in "${!ROW_COLORS[@]}"; do
        X=$((col_i * SWATCH_SIZE))
        echo "  <use href=\"#swatch\" x=\"${X}\" y=\"${Y}\" fill=\"#${ROW_COLORS[$col_i]}\"/>"
      done
    done

    echo "</svg>"
  } > "$OUT_DIR/${name}.svg"
done

echo "Done: $(ls "$OUT_DIR"/*.svg | wc -l) SVGs generated in $OUT_DIR"
