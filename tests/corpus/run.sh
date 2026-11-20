#!/bin/sh
# Corpus check: every table in tests/corpus/fixtures/*.json through the APA copier, checked by tests/corpus/checks.js.
# Make fixtures with tests/corpus/dump.sh. Writes tests/corpus/report.json and tests/corpus/report.html (both ignored).
set -e
here=$(cd "$(dirname "$0")" && pwd)
root=$(cd "$here/../.." && pwd)
ls "$here"/fixtures/*.json >/dev/null 2>&1 || { echo "no fixtures: run tests/corpus/dump.sh first"; exit 0; }
page="$root/ui/_corpus.html"
python3 -I - "$here" "$root" "$page" <<'PY'
import json, pathlib, sys
here, root, page = map(pathlib.Path, sys.argv[1:])
fixtures = {p.stem: json.loads(p.read_text(encoding="utf-8")) for p in sorted((here / "fixtures").glob("*.json"))}
html = (root / "ui/index.html").read_text(encoding="utf-8")
inject = "<script>window.FIXTURES = " + json.dumps(fixtures).replace("</", "<\\/") + ";</script>"
html = html.replace('<script src="app.js"></script>', inject + '<script src="app.js"></script><pre id="result"></pre><script src="../tests/corpus/checks.js"></script>')
page.write_text(html, encoding="utf-8")
PY
chrome=$(command -v google-chrome-stable || command -v google-chrome || command -v chromium)
profile=$(mktemp -d)
timeout 600 "$chrome" --headless=new --disable-gpu --no-first-run --user-data-dir="$profile" --allow-file-access-from-files --virtual-time-budget=600000 --dump-dom "file://$page" 2>/dev/null > "$here/.dom.html"
rm -rf "$profile" "$page"
python3 -I "$here/report.py" "$here/.dom.html" "$here"
