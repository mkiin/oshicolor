#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
CLI="$ROOT_DIR/node_modules/.bin/colorthief"
OUT_DIR="$ROOT_DIR/debug/palettes/colorthief"
IMG_BASE="$ROOT_DIR/debug/img"

mkdir -p "$OUT_DIR"

SWATCH_ROLES=("Vibrant" "Muted" "DarkVibrant" "DarkMuted" "LightVibrant" "LightMuted")
SWATCH_LABELS=("Vibrant" "Muted" "DkVibrant" "DkMuted" "LtVibrant" "LtMuted")

# Layout
SVG_W=660
PAD=20
USABLE_W=$((SVG_W - PAD * 2))
BLOCK_H=175

generate_svg() {
    local game="$1"
    local img_dir="$IMG_BASE/$game"
    local out_file="$OUT_DIR/${game}.svg"

    mapfile -d '' images < <(find "$img_dir" -name "*.png" -print0 | sort -z)

    local n=${#images[@]}
    local total_h=$((n * BLOCK_H + PAD * 2))

    {
        printf '<svg xmlns="http://www.w3.org/2000/svg" width="%s" height="%s" style="background:#111111; font-family:ui-monospace,monospace;">\n' \
            "$SVG_W" "$total_h"

        local block_y=$PAD

        for img in "${images[@]}"; do
            local name
            name=$(basename "$img" .png)

            echo "  Processing: $name" >&2

            local dom_json pal_json swa_json
            dom_json=$("$CLI" color "$img" --json --color-space rgb)
            pal_json=$("$CLI" palette "$img" --json --count 16 --color-space rgb)
            swa_json=$("$CLI" swatches "$img" --json --color-space rgb)

            local dom_hex dom_text
            dom_hex=$(jq -r '.hex' <<<"$dom_json")
            dom_text=$(jq -r 'if .isDark then "#ffffff" else "#000000" end' <<<"$dom_json")

            # y positions (ブロック内相対)
            local y_name=18
            local y_dom=25 h_dom=28
            local y_pal=60 h_pal=30
            local y_swa=98 h_swa=62

            printf '  <g transform="translate(0,%s)">\n' "$block_y"

            # キャラ名
            printf '    <text x="%s" y="%s" fill="#aaaaaa" font-size="13" font-weight="bold">%s</text>\n' \
                "$PAD" "$y_name" "$name"

            # ドミナントカラー バー
            printf '    <rect x="%s" y="%s" width="%s" height="%s" fill="%s" rx="3"/>\n' \
                "$PAD" "$y_dom" "$USABLE_W" "$h_dom" "$dom_hex"
            printf '    <text x="%s" y="%s" fill="%s" font-size="10" text-anchor="end">%s</text>\n' \
                $((PAD + USABLE_W - 6)) $((y_dom + h_dom / 2 + 4)) "$dom_text" "$dom_hex"

            # パレット 16色
            local pal_count
            pal_count=$(jq 'length' <<<"$pal_json")
            for ((i = 0; i < pal_count; i++)); do
                local hex cell_x cell_w
                hex=$(jq -r ".[$i].hex" <<<"$pal_json")
                cell_w=$(echo "scale=4; $USABLE_W / $pal_count" | bc)
                cell_x=$(echo "scale=4; $PAD + $i * $USABLE_W / $pal_count" | bc)
                printf '    <rect x="%s" y="%s" width="%s" height="%s" fill="%s"/>\n' \
                    "$cell_x" "$y_pal" "$cell_w" "$h_pal" "$hex"
            done

            # スウォッチ 6スロット
            local swa_cell_w
            swa_cell_w=$(echo "scale=4; $USABLE_W / ${#SWATCH_ROLES[@]}" | bc)
            for ((i = 0; i < ${#SWATCH_ROLES[@]}; i++)); do
                local role="${SWATCH_ROLES[$i]}"
                local label="${SWATCH_LABELS[$i]}"
                local swa_x swa_cx
                swa_x=$(echo "scale=4; $PAD + $i * $USABLE_W / ${#SWATCH_ROLES[@]}" | bc)
                swa_cx=$(echo "scale=4; $swa_x + $swa_cell_w / 2" | bc)

                local is_null
                is_null=$(jq -r ".\"$role\" == null" <<<"$swa_json")

                if [ "$is_null" = "true" ]; then
                    printf '    <rect x="%s" y="%s" width="%s" height="%s" fill="#2a2a2a" rx="2"/>\n' \
                        "$swa_x" "$y_swa" "$swa_cell_w" "$h_swa"
                    printf '    <text x="%s" y="%s" fill="#555555" font-size="9" text-anchor="middle">—</text>\n' \
                        "$swa_cx" $((y_swa + h_swa / 2 + 4))
                else
                    local swa_hex swa_text
                    swa_hex=$(jq -r ".\"$role\".hex" <<<"$swa_json")
                    swa_text=$(jq -r ".\"$role\" | if .isDark then \"#ffffff\" else \"#000000\" end" <<<"$swa_json")
                    printf '    <rect x="%s" y="%s" width="%s" height="%s" fill="%s" rx="2"/>\n' \
                        "$swa_x" "$y_swa" "$swa_cell_w" "$h_swa" "$swa_hex"
                    printf '    <text x="%s" y="%s" fill="%s" font-size="8" text-anchor="middle">%s</text>\n' \
                        "$swa_cx" $((y_swa + 14)) "$swa_text" "$label"
                    printf '    <text x="%s" y="%s" fill="%s" font-size="9" text-anchor="middle">%s</text>\n' \
                        "$swa_cx" $((y_swa + h_swa - 8)) "$swa_text" "$swa_hex"
                fi
            done

            printf '  </g>\n'
            block_y=$((block_y + BLOCK_H))
        done

        printf '</svg>\n'
    } >"$out_file"

    echo "Generated: $out_file ($n characters)"
}

for game in genshin starrail; do
    if [ -d "$IMG_BASE/$game" ]; then
        generate_svg "$game"
    fi
done
