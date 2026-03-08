#!/usr/bin/env bash
set -euo pipefail

IMG_DIR="debug/img"
OUT_DIR="debug/palettes"

mkdir -p "$OUT_DIR"

for f in "$IMG_DIR"/*.png; do
  name=$(basename "$f" .png)
  echo "Processing: $name"
  ./scripts/gen-palette-svg.sh "$f" > "$OUT_DIR/${name}.svg"
done

echo "Done: $(ls "$OUT_DIR"/*.svg | wc -l) SVGs generated in $OUT_DIR"
