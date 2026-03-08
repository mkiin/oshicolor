#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <image> [-k <num_colors>]" >&2
  exit 1
fi

IMAGE="$1"
shift

# MIMEタイプ判定
case "$IMAGE" in
  *.jpg|*.jpeg) MIME="image/jpeg" ;;
  *.gif)        MIME="image/gif" ;;
  *.webp)       MIME="image/webp" ;;
  *)            MIME="image/png" ;;
esac

B64=$(base64 -w 0 "$IMAGE")

COLORS=$(okolors "$IMAGE" "$@")
COLOR_ARRAY=($COLORS)
COUNT=${#COLOR_ARRAY[@]}

THUMB_W=160
THUMB_H=100
GAP=8
SWATCH_SIZE=40
SWATCHES_X=$((THUMB_W + GAP))
SWATCH_Y=$(( (THUMB_H - SWATCH_SIZE) / 2 ))
TOTAL_W=$((SWATCHES_X + COUNT * SWATCH_SIZE))
TOTAL_H=$THUMB_H

echo "<svg height=\"${TOTAL_H}\" viewBox=\"0 0 ${TOTAL_W} ${TOTAL_H}\" xmlns=\"http://www.w3.org/2000/svg\">"
echo "  <image href=\"data:${MIME};base64,${B64}\" x=\"0\" y=\"0\" width=\"${THUMB_W}\" height=\"${THUMB_H}\" preserveAspectRatio=\"xMidYMid slice\"/>"
echo "  <rect id=\"swatch\" width=\"${SWATCH_SIZE}\" height=\"${SWATCH_SIZE}\"/>"

for i in "${!COLOR_ARRAY[@]}"; do
  X=$((SWATCHES_X + i * SWATCH_SIZE))
  echo "  <use href=\"#swatch\" x=\"${X}\" y=\"${SWATCH_Y}\" fill=\"#${COLOR_ARRAY[$i]}\"/>"
done

echo "</svg>"
