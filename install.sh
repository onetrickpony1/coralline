#!/bin/sh
# Installs Coralline from the latest GitHub release, or updates it: run the same line again.
#   curl -LsSf https://raw.githubusercontent.com/onetrickpony1/coralline/main/install.sh | sh
set -eu

repo="onetrickpony1/coralline"
case "$(uname -s)-$(uname -m)" in
	Linux-x86_64)  asset="coralline-linux-x86_64.tar.gz" ;;
	Darwin-arm64)  asset="coralline-macos-aarch64.tar.gz" ;;
	Darwin-x86_64) asset="coralline-macos-x86_64.tar.gz" ;;
	*) echo "Coralline has no build for $(uname -s) $(uname -m) yet." >&2; exit 1 ;;
esac

dir="${XDG_DATA_HOME:-$HOME/.local/share}/coralline"
bin="$HOME/.local/bin"
mkdir -p "$dir" "$bin"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

echo "Downloading $asset"
curl -fL --progress-bar "https://github.com/$repo/releases/latest/download/$asset" -o "$tmp/$asset" || {
	echo "Couldn't download Coralline. Check your internet connection. If it works, there may be no release yet: see https://github.com/$repo/releases"
	exit 1
}
tar -xzf "$tmp/$asset" -C "$tmp"
# Replace the file instead of writing into it, so a running copy keeps working until it closes
cp "$tmp/coralline" "$dir/coralline.new"
chmod 755 "$dir/coralline.new"
mv -f "$dir/coralline.new" "$dir/coralline"
ln -sf "$dir/coralline" "$bin/coralline"

# Up to 0.1.0 the app was called jAPAsp (command japasp): remove that install. Its settings move over when Coralline starts.
old="${XDG_DATA_HOME:-$HOME/.local/share}/japasp"
if [ -f "$old/japasp" ]; then
	rm -f "$old/japasp"
	[ "$(readlink "$bin/japasp" 2>/dev/null)" = "$old/japasp" ] && rm -f "$bin/japasp"
	rmdir "$old" 2>/dev/null || true
	echo "Removed the old jAPAsp install"
fi

if [ "$(uname -s)" = "Linux" ]; then
	missing=$(ldd "$dir/coralline" 2>/dev/null | grep "not found" || true)
	if [ -n "$missing" ]; then
		echo
		echo "Coralline needs WebKitGTK 4.1, which isn't installed. Install it, then start Coralline:"
		echo "  Debian, Ubuntu:  sudo apt install libwebkit2gtk-4.1-0"
		echo "  Fedora:          sudo dnf install webkit2gtk4.1"
		echo "  Arch:            sudo pacman -S webkit2gtk-4.1"
	else
		"$dir/coralline" --desktop-entry || true
	fi
fi

echo
echo "Installed $("$dir/coralline" --version 2>/dev/null || echo coralline) in $dir"
case ":$PATH:" in
	*":$bin:"*) echo "Start it from your app menu, or run: coralline" ;;
	*) echo "Run it with: $bin/coralline  (add $bin to your PATH to type just 'coralline')" ;;
esac
