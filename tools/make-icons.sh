#!/bin/sh
# Renders ui/icon.svg to the app icons in src-tauri/icons (needs rsvg-convert and ImageMagick)
set -e
root=$(cd "$(dirname "$0")/.." && pwd)
out="$root/src-tauri/icons"
svg="$root/ui/icon.svg"
rsvg-convert -w 32 -h 32 "$svg" -o "$out/32x32.png"
rsvg-convert -w 128 -h 128 "$svg" -o "$out/128x128.png"
rsvg-convert -w 256 -h 256 "$svg" -o "$out/128x128@2x.png"
rsvg-convert -w 512 -h 512 "$svg" -o "$out/icon.png"
tmp=$(mktemp -d)
for s in 16 24 32 48 64 128 256; do rsvg-convert -w $s -h $s "$svg" -o "$tmp/$s.png"; done
magick "$tmp"/16.png "$tmp"/24.png "$tmp"/32.png "$tmp"/48.png "$tmp"/64.png "$tmp"/128.png "$tmp"/256.png "$out/icon.ico"
rm -rf "$tmp"
echo "icons written to $out"
