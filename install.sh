#!/bin/sh
# Installs jAPAsp from the latest GitHub release, or updates it: run the same line again.
#   curl -LsSf https://raw.githubusercontent.com/onetrickpony1/jAPAsp/main/install.sh | sh
set -eu

repo="onetrickpony1/jAPAsp"
case "$(uname -s)-$(uname -m)" in
	Linux-x86_64)  asset="japasp-linux-x86_64.tar.gz" ;;
	Darwin-arm64)  asset="japasp-macos-aarch64.tar.gz" ;;
	Darwin-x86_64) asset="japasp-macos-x86_64.tar.gz" ;;
	*) echo "jAPAsp has no build for $(uname -s) $(uname -m) yet." >&2; exit 1 ;;
esac

dir="${XDG_DATA_HOME:-$HOME/.local/share}/japasp"
bin="$HOME/.local/bin"
mkdir -p "$dir" "$bin"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

echo "Downloading $asset"
curl -fL --progress-bar "https://github.com/$repo/releases/latest/download/$asset" -o "$tmp/$asset" || {
	echo "Couldn't download jAPAsp. Check your internet connection. If it works, there may be no release yet: see https://github.com/$repo/releases"
	exit 1
}
tar -xzf "$tmp/$asset" -C "$tmp"
# Replace the file instead of writing into it, so a running copy keeps working until it closes
cp "$tmp/japasp" "$dir/japasp.new"
chmod 755 "$dir/japasp.new"
mv -f "$dir/japasp.new" "$dir/japasp"
ln -sf "$dir/japasp" "$bin/japasp"

if [ "$(uname -s)" = "Linux" ]; then
	missing=$(ldd "$dir/japasp" 2>/dev/null | grep "not found" || true)
	if [ -n "$missing" ]; then
		echo
		echo "jAPAsp needs WebKitGTK 4.1, which isn't installed. Install it, then start jAPAsp:"
		echo "  Debian, Ubuntu:  sudo apt install libwebkit2gtk-4.1-0"
		echo "  Fedora:          sudo dnf install webkit2gtk4.1"
		echo "  Arch:            sudo pacman -S webkit2gtk-4.1"
	else
		"$dir/japasp" --desktop-entry || true
	fi
fi

echo
echo "Installed $("$dir/japasp" --version 2>/dev/null || echo japasp) in $dir"
case ":$PATH:" in
	*":$bin:"*) echo "Start it from your app menu, or run: japasp" ;;
	*) echo "Run it with: $bin/japasp  (add $bin to your PATH to type just 'japasp')" ;;
esac
