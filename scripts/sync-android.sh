#!/usr/bin/env bash
# 把 web 端资源同步进安卓工程的 assets/www（WebView 加载的本地页面）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WWW="$ROOT/android/app/src/main/assets/www"

rm -rf "$WWW"
mkdir -p "$WWW"

cp "$ROOT/index.html" "$ROOT/manifest.webmanifest" "$ROOT/sw.js" "$WWW/"
cp "$ROOT"/icon-*.png "$WWW/"
cp -r "$ROOT/css" "$ROOT/js" "$WWW/"

echo "synced -> $WWW"
find "$WWW" -type f | sed "s|$WWW|  www|"
