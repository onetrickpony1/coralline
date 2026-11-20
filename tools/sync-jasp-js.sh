#!/bin/sh
# Copies JASP's results-page code (the table renderer and the APA copier) from a jasp-desktop checkout
# into ui/vendor/jasp, and records which commit it came from.
# Usage: tools/sync-jasp-js.sh [path to jasp-desktop]   (default: ../jAPAsp/jasp-desktop)
set -e
here=$(cd "$(dirname "$0")/.." && pwd)
src=${1:-"$here/../jAPAsp/jasp-desktop"}
js="$src/Desktop/html/js"
out="$here/ui/vendor/jasp"
mkdir -p "$out"
for f in jquery-3.7.0.js underscore-min.js backbone-1.5.0.js jaspwidgets.js object.js utils.js table.js; do
	cp "$js/$f" "$out/$f"
done
# JASP's tests for this code (the APA rules among them), run by tests/apa/run.sh; kept out of ui/ so the app doesn't ship them
cp "$js/utils-test.js" "$here/tests/apa/utils-test.js"
commit=$(git -C "$src" rev-parse HEAD)
branch=$(git -C "$src" rev-parse --abbrev-ref HEAD)
cat > "$out/SOURCE.md" <<MD
# Vendored JASP code

These files are copied unchanged from [jasp-desktop](https://github.com/jasp-stats/jasp-desktop) (\`Desktop/html/js\`),
branch \`$branch\`, commit \`$commit\`. They are licensed AGPL-3.0, like this project.

Update them with \`tools/sync-jasp-js.sh\`. Don't edit them here: fixes go into the JASP branch first.
MD
echo "synced from $branch $commit"
