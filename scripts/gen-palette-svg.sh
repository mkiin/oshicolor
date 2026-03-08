#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <image> [-k <num_colors>]" >&2
  exit 1
fi

IMAGE="$1"
shift

COLORS=$(okolors "$IMAGE" "$@")
COLOR_ARRAY=($COLORS)
COUNT=${#COLOR_ARRAY[@]}
SWATCH_SIZE=40
WIDTH=$((COUNT * SWATCH_SIZE))

echo "<svg height=\"${SWATCH_SIZE}\" viewBox=\"0 0 ${WIDTH} ${SWATCH_SIZE}\" xmlns=\"http://www.w3.org/2000/svg\">"
echo "  <rect id=\"swatch\" width=\"${SWATCH_SIZE}\" height=\"${SWATCH_SIZE}\"/>"

for i in "${!COLOR_ARRAY[@]}"; do
  X=$((i * SWATCH_SIZE))
  echo "  <use href=\"#swatch\" x=\"${X}\" fill=\"#${COLOR_ARRAY[$i]}\"/>"
done

echo "</svg>"
