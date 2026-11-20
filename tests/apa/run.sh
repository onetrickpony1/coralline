#!/bin/sh
# Runs JASP's results-page tests (utils-test.js, with the APA table rules) in headless Chrome.
# Exits non-zero when a test fails or the page doesn't finish.
here=$(cd "$(dirname "$0")" && pwd)
chrome=$(command -v google-chrome-stable || command -v google-chrome || command -v chromium || command -v chromium-browser)
[ -n "$chrome" ] || { echo "no Chrome or Chromium found"; exit 1; }
profile=$(mktemp -d)
result=$(timeout 120 "$chrome" --headless=new --disable-gpu --no-sandbox --no-first-run --user-data-dir="$profile" --allow-file-access-from-files --dump-dom "file://$here/run.html" 2>/dev/null \
	| sed -n '/<pre id="out">/,/<\/pre>/p' | sed 's/<[^>]*>//g; s/&amp;/\&/g; s/&lt;/</g; s/&gt;/>/g; s/&quot;/"/g')
rm -rf "$profile"
printf '%s\n' "$result"
printf '%s' "$result" | grep -q '^passed [0-9]* failed 0$' || exit 1
