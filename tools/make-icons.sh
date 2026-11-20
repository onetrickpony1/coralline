#!/bin/sh
# Renders ui/icon.svg (the blue icon, the source) to the app icons, plus the dark, pink and green versions the app
# switches to with the theme. Needs rsvg-convert and ImageMagick.
set -e
root=$(cd "$(dirname "$0")/.." && pwd)
out="$root/src-tauri/icons"
src="$root/ui/icon.svg"
mkdir -p "$root/ui/icons" "$out/variants"

# Tile colours per version (light, middle, deep). Blue is the source file's own.
variant() {
	name=$1; a=$2; b=$3; c=$4
	sed -e "s/#4f8dff/$a/; s/#2f62ea/$b/; s/#1d45c4/$c/" "$src" > "$root/ui/icons/icon-$name.svg"
	rsvg-convert -w 256 -h 256 "$root/ui/icons/icon-$name.svg" -o "$out/variants/$name.png"
}
variant blue "#4f8dff" "#2f62ea" "#1d45c4"
variant dark "#5a5e68" "#383b43" "#212329"
variant pink "#ff8fbb" "#ec4d8e" "#c92a6c"
variant green "#98cc52" "#6aa72a" "#3f7a12"   # around JASP's green, #8cc63e

# Bundle icons (installers, file managers): the blue version
rsvg-convert -w 32 -h 32 "$src" -o "$out/32x32.png"
rsvg-convert -w 128 -h 128 "$src" -o "$out/128x128.png"
rsvg-convert -w 256 -h 256 "$src" -o "$out/128x128@2x.png"
rsvg-convert -w 512 -h 512 "$src" -o "$out/icon.png"
tmp=$(mktemp -d)
for s in 16 24 32 48 64 128 256; do rsvg-convert -w $s -h $s "$src" -o "$tmp/$s.png"; done
magick "$tmp"/16.png "$tmp"/24.png "$tmp"/32.png "$tmp"/48.png "$tmp"/64.png "$tmp"/128.png "$tmp"/256.png "$out/icon.ico"
rm -rf "$tmp"
echo "icons written to $out and ui/icons"
