#!/bin/sh
# Renders ui/icon.svg (the blue icon, the source) to the app icons, plus the dark, pink and green versions the app
# switches to with the theme. 16, 24 and 32 px come from the hand-tuned ui/icon-small/icon-<size>.svg. Needs
# rsvg-convert and ImageMagick.
set -e
root=$(cd "$(dirname "$0")/.." && pwd)
out="$root/src-tauri/icons"
src="$root/ui/icon.svg"
mkdir -p "$root/ui/icons" "$out/variants"

# One size of one colour version: the hand-tuned drawing for 16, 24 and 32 px, the main one otherwise
# render <svg> <size> <out.png> [sed script for the colours]
render() {
	file=$1
	[ -f "$root/ui/icon-small/icon-$2.svg" ] && file="$root/ui/icon-small/icon-$2.svg"
	sed -e "${4:-}" "$file" | rsvg-convert -w "$2" -h "$2" -o "$3"
}

# Tile colours per version (light, middle, deep). Blue is the source file's own. Pink also gets a dimmer clay slope,
# which otherwise blends into the pink tile.
variant() {
	name=$1; a=$2; b=$3; c=$4
	colours="s/#4f8dff/$a/; s/#2f62ea/$b/; s/#1d45c4/$c/"
	[ "$name" = pink ] && colours="$colours; s/class=\"clay\" fill-opacity=\"0.5\"/class=\"clay\" fill-opacity=\"0.4\"/"
	sed -e "$colours" "$src" > "$root/ui/icons/icon-$name.svg"
	render "$src" 256 "$out/variants/$name.png" "$colours"
	# Windows: an .ico per colour for the taskbar and the Start menu shortcut
	t=$(mktemp -d)
	for s in 16 24 32 48 64 256; do render "$src" $s "$t/$s.png" "$colours"; done
	magick "$t"/16.png "$t"/24.png "$t"/32.png "$t"/48.png "$t"/64.png "$t"/256.png "$out/variants/$name.ico"
	rm -rf "$t"
}
variant blue "#4f8dff" "#2f62ea" "#1d45c4"
variant dark "#5a5e68" "#383b43" "#212329"
variant pink "#ff8fbb" "#ec4d8e" "#c92a6c"
variant green "#98cc52" "#6aa72a" "#3f7a12"   # around JASP's green, #8cc63e

# Bundle icons (installers, file managers): the blue version
render "$src" 32 "$out/32x32.png"
rsvg-convert -w 128 -h 128 "$src" -o "$out/128x128.png"
rsvg-convert -w 256 -h 256 "$src" -o "$out/128x128@2x.png"
rsvg-convert -w 512 -h 512 "$src" -o "$out/icon.png"
tmp=$(mktemp -d)
for s in 16 24 32 48 64 128 256; do render "$src" $s "$tmp/$s.png"; done
magick "$tmp"/16.png "$tmp"/24.png "$tmp"/32.png "$tmp"/48.png "$tmp"/64.png "$tmp"/128.png "$tmp"/256.png "$out/icon.ico"
rm -rf "$tmp"
echo "icons written to $out and ui/icons"
