#!/bin/sh
# Dumps every .jasp file under a folder (default: the Data Library of the installed JASP Flatpak) into tests/corpus/fixtures.
set -e
here=$(cd "$(dirname "$0")" && pwd)
bin="$here/../../src-tauri/target/release/japasp"
lib=${1:-"$(flatpak info --show-location org.jaspstats.JASP)/files/Resources/Data Sets/Data Library"}
mkdir -p "$here/fixtures"
find "$lib" -name '*.jasp' | while IFS= read -r f; do
	rel=${f#"$lib"/}
	out="$here/fixtures/$(printf '%s' "${rel%.jasp}" | tr '/' '~').json"
	"$bin" --json "$f" > "$out" || { echo "FAILED: $rel"; rm -f "$out"; }
done
echo "$(ls "$here"/fixtures/*.json | wc -l) files"
