"""Summarises the corpus check: problems, unmatched numbers, placeholders by analysis. Writes report.json and
report.html (each flagged table next to JASP's own rendering). Exit code 1 when there are problems."""
import collections, html, json, pathlib, re, sys

dom, here = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
m = re.search(r'<pre id="result">(.*?)</pre>', dom.read_text(encoding="utf-8"), re.S)
if not m or not m.group(1).strip():
    sys.exit("FAIL: the check page did not finish (a script error?)")
entries = json.loads(html.unescape(m.group(1)))
(here / "report.json").write_text(json.dumps(entries, indent=1, ensure_ascii=False), encoding="utf-8")

problems = [e for e in entries if e["problems"]]
unmatched = [e for e in entries if e.get("unmatched")]
kinds = collections.Counter(re.sub(r"[:(].*", "", p).strip() for e in entries for p in e["problems"])
todo = collections.Counter()
todo_by = collections.defaultdict(collections.Counter)
for e in entries:
    for t in e.get("todo", []):
        k = re.sub(r":.*", "", t)
        todo[k] += 1
        todo_by[k][e["analysis"]] += 1

print(f"tables: {len(entries)}  with problems: {len(problems)}  with numbers missing from the copy: {len(unmatched)}")
for k, n in kinds.most_common():
    print(f"  problem  {n:4}  {k}")
for k, n in todo.most_common():
    top = ", ".join(f"{a} {c}" for a, c in todo_by[k].most_common(5))
    print(f"  to do    {n:4}  {k}  ({top})")

def card(e):
    flags = "".join(f"<li>{html.escape(p)}</li>" for p in e["problems"])
    if e.get("unmatched"):
        flags += f"<li>numbers missing from the copy: {html.escape(', '.join(e['unmatched'][:8]))}{' ...' if len(e['unmatched']) > 8 else ''}</li>"
    for t in e.get("todo", []):
        flags += f"<li class=todo>{html.escape(t)}</li>"
    return (f"<section><h2>{html.escape(e['file'])} / {html.escape(e['analysis'])} / {html.escape(e['title'])}</h2><ul>{flags}</ul>"
            f"<div class=pair><div class=jasp>{e.get('jasp', '')}</div><div class=apa>{e.get('html', '')}</div></div></section>")

flagged = sorted(problems + [e for e in unmatched if e not in problems], key=lambda e: (e["analysis"], e["file"]))
page = ("<!doctype html><meta charset=utf-8><title>Corpus report</title><style>body{font:14px system-ui;margin:16px}"
        "section{border-top:1px solid #ccc;padding:12px 0}h2{font-size:14px;margin:0 0 6px}li{color:#b3261e}li.todo{color:#7a6400}"
        ".pair{display:flex;gap:32px;align-items:flex-start;overflow:auto}.jasp table{font-size:12px;border-collapse:collapse}"
        ".jasp td,.jasp th{padding:1px 6px;border-bottom:1px solid #eee}.apa{font-family:'Times New Roman',serif}</style>"
        f"<h1>Corpus report: {len(entries)} tables, {len(flagged)} flagged</h1>" + "".join(card(e) for e in flagged))
(here / "report.html").write_text(page, encoding="utf-8")
print(f"report: {here / 'report.html'}")
sys.exit(1 if problems else 0)
