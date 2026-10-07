#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
modules="${NODE_MODULES:-}"

if [ -z "$modules" ]; then
  work="$(mktemp -d)"
  trap 'rm -rf "$work"' EXIT
  npm install --silent --no-audit --no-fund --prefix "$work" three@0.186.1 cannon-es@0.20.0 esbuild@0.28
  modules="$work/node_modules"
fi

bundle() {
  NODE_PATH="$modules" "$modules/.bin/esbuild" "$root/tools/vendor/$1.entry.js" \
    --bundle --minify --format=esm --target=es2020 \
    --banner:js="/* $2 · MIT License · see /credits.txt */" \
    --outfile="$root/public/assets/vendor/$1.min.js"
}

bundle three "three.js 0.186.1"
bundle cannon "cannon-es 0.20.0"
