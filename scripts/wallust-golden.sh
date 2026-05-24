#!/usr/bin/env bash
#
# native wallust CLI を叩きやすくするラッパー。golden parity 用の参照パレットを作る。
#
# wallust は最終パレットを cache に JSON で書くだけで stdout には hex を出さないため、
# XDG_CACHE_HOME を一時ディレクトリに向けて、そこに書かれた palette JSON を拾う。
# backend は parity を環境非依存にするため resized (image の Gaussian) に固定する。
#
# 使い方:
#   単発     ./scripts/wallust-golden.sh <image.png> [palette] [style]
#              palette = salience | ansi | kmeans   (既定 salience)
#              style   = dark | light               (既定 dark)
#            19 色の hex を JSON オブジェクトで stdout に出す。
#
#   一括     ./scripts/wallust-golden.sh --all
#            $NIKKE_DIR の全 png を salience/ansi/kmeans × dark/light で回し、
#            $OUT に参照 JSON を書き出す。
#
# 環境変数:
#   WALLUST_BIN  wallust バイナリ      (既定 library/wallust/target/release/wallust)
#   NIKKE_DIR    参照画像ディレクトリ  (既定 $HOME/Pictures/nikke)
#   OUT          一括出力先            (既定 tests/features/color-extract/fixtures/wallust-reference.json)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WALLUST_BIN="${WALLUST_BIN:-$ROOT/library/wallust/target/release/wallust}"
NIKKE_DIR="${NIKKE_DIR:-$HOME/Pictures/nikke}"
OUT="${OUT:-$ROOT/tests/features/color-extract/fixtures/wallust-reference.json}"
BACKEND="resized"

if [[ ! -x "$WALLUST_BIN" ]]; then
  echo "wallust バイナリが見つからない: $WALLUST_BIN" >&2
  echo "先に: (cd library/wallust && cargo build --release)" >&2
  exit 1
fi

# extract_one <image> <palette> <style>  ->  19 色 hex の JSON オブジェクトを stdout へ
extract_one() {
  local img="$1" palette="$2" style="$3"
  local cache cfg file
  cache="$(mktemp -d)"
  cfg="$cache/wallust.toml"
  printf 'style = "%s"\n' "$style" > "$cfg"

  XDG_CACHE_HOME="$cache" XDG_CONFIG_HOME="$cache" \
    "$WALLUST_BIN" run "$img" -b "$BACKEND" -p "$palette" -C "$cfg" -s -T -q \
    >/dev/null 2>&1 || true

  # 最終パレット JSON は color15 を含む唯一のファイル。backend の生バイトや
  # auto 中間ファイルは hit しない。
  file="$(grep -rls '"color15"' "$cache/wallust" 2>/dev/null | head -n1 || true)"
  if [[ -z "$file" ]]; then
    rm -rf "$cache"
    echo "パレット生成に失敗: $img ($palette/$style)" >&2
    return 1
  fi
  jq -c '.' "$file"
  rm -rf "$cache"
}

if [[ "${1:-}" == "--all" ]]; then
  [[ -d "$NIKKE_DIR" ]] || { echo "画像ディレクトリがない: $NIKKE_DIR" >&2; exit 1; }
  result="{}"
  for img in "$NIKKE_DIR"/*.png; do
    name="$(basename "$img" .png)"
    echo "  -> $name" >&2
    obj="$(jq -n \
      --argjson sd "$(extract_one "$img" salience dark)" \
      --argjson sl "$(extract_one "$img" salience light)" \
      --argjson ad "$(extract_one "$img" ansi dark)" \
      --argjson al "$(extract_one "$img" ansi light)" \
      --argjson kd "$(extract_one "$img" kmeans dark)" \
      --argjson kl "$(extract_one "$img" kmeans light)" \
      '{salience:{dark:$sd,light:$sl},ansi:{dark:$ad,light:$al},kmeans:{dark:$kd,light:$kl}}')"
    result="$(jq --arg n "$name" --argjson o "$obj" '.[$n]=$o' <<<"$result")"
  done
  echo "$result" | jq -S '.' > "$OUT"
  echo "書き出した: $OUT" >&2
else
  img="${1:?image path required}"
  extract_one "$img" "${2:-salience}" "${3:-dark}"
fi
