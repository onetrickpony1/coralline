#!/bin/sh
# Interface test: renders every fixture in headless Chrome and checks the APA output.
# Fixtures are JSON dumps (`japasp --json FILE.jasp > tests/ui/fixtures/NAME.json`); they aren't in the repo,
# and the test is skipped when there are none.
set -e
here=$(cd "$(dirname "$0")" && pwd)
root=$(cd "$here/../.." && pwd)
ls "$here"/fixtures/*.json >/dev/null 2>&1 || { echo "no fixtures, skipped"; exit 0; }
page="$root/ui/_test.html"
python3 -I - "$here" "$root" "$page" <<'PY'
import json, pathlib, sys
here, root, page = map(pathlib.Path, sys.argv[1:])
fixtures = {p.stem: json.loads(p.read_text(encoding="utf-8")) for p in sorted((here / "fixtures").glob("*.json"))}
html = (root / "ui/index.html").read_text(encoding="utf-8")
inject = "<script>window.FIXTURES = " + json.dumps(fixtures).replace("</", "<\\/") + ";</script>"
checks = "<pre id=\"result\"></pre><script src=\"../tests/ui/checks.js\"></script>"
html = html.replace('<script src="app.js"></script>', inject + '<script src="app.js"></script>' + checks)
page.write_text(html, encoding="utf-8")
PY
chrome=$(command -v google-chrome-stable || command -v google-chrome || command -v chromium)
profile=$(mktemp -d)
dom=$(timeout 120 "$chrome" --headless=new --disable-gpu --no-first-run --user-data-dir="$profile" --allow-file-access-from-files --dump-dom "file://$page" 2>/dev/null)
rm -rf "$profile" "$page"
printf '%s' "$dom" | python3 -I -c '
import html, json, re, sys
m = re.search(r"<pre id=\"result\">(.*?)</pre>", sys.stdin.read(), re.S)
if not m or not m.group(1):
    sys.exit("FAIL: the page did not finish (a script error?)")
r = json.loads(html.unescape(m.group(1)))
print("tables:", r["tables"], "errors:", len(r["errors"]), "failed checks:", len(r["failures"]))
for line in r.get("missingN", []): print("   no N:", line)
import os
if os.environ.get("SHOW_STUBS"):
    for line in r.get("stubs", []): print("   stub:", line)
for line in r["errors"] + r["failures"]:
    print("  ", line)
sys.exit(1 if r["errors"] or r["failures"] or r["tables"] == 0 else 0)
'
