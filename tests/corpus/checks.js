// Corpus checks: every table of every fixture through the APA copier, checked against rules that need no human.
// Writes a JSON report into #result.
(function () {
	"use strict";
	var report = [];
	var numbersIn = function (text) {
		// Numbers as written in the APA copy: "1,296", "-.25", "0.973", "26.32%"
		var out = [];
		// Scientific notation first ("1.45×10-7" in the plain text, the exponent was a superscript)
		var sup = { "⁻": "-", "⁺": "+", "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9" };
		text = text.replace(/(-?\d+(?:\.(\d+))?)×10\s*([-+⁻⁺]?[\d⁰-⁹]+)/g, function (all, mant, frac, exp) {
			exp = exp.replace(/[⁻⁺⁰-⁹¹²³]/g, function (c) { return sup[c]; });
			out.push({ value: parseFloat(mant) * Math.pow(10, parseInt(exp, 10)), dp: (frac || "").length - parseInt(exp, 10), rel: true });
			return " ";
		});
		var re = /-?(?:\d[\d,]*(?:\.\d+)?|\.\d+)/g, m;
		while ((m = re.exec(text)))
			out.push({ value: parseFloat(m[0].replace(/,/g, "").replace(/^(-?)\./, "$10.")), dp: (m[0].split(".")[1] || "").length });
		return out;
	};
	var rawNumbers = function (model) {
		var fields = (model.get("schema") || {}).fields || [];
		var out = [];
		(model.get("data") || []).forEach(function (row) {
			fields.forEach(function (f) {
				if (f.type === "string" || f.type === "separator")
					return;
				var v = row[f.name];
				if (v && typeof v === "object")
					v = v.value;
				if (typeof v === "number" && isFinite(v))
					out.push({ value: v, field: f.title || f.name, pc: /pc/.test(f.format || "") });
			});
		});
		return out;
	};
	var matches = function (raw, tokens, text) {
		if (Math.abs(raw.value) < 0.001 && /< \.001/.test(text))
			return true;
		var targets = raw.pc ? [raw.value * 100, raw.value] : [raw.value];
		return tokens.some(function (t) {
			var tol = t.rel ? Math.abs(t.value) * 0.01 : 0.5 * Math.pow(10, -t.dp) + 1e-9;
			return targets.some(function (v) { return Math.abs(Math.abs(t.value) - Math.abs(v)) <= tol + Math.abs(v) * 1e-9; });
		});
	};

	for (var name in window.FIXTURES) {
		var file = window.FIXTURES[name];
		var groups;
		try {
			groups = window.coralline.build(file);
		} catch (e) {
			report.push({ file: name, analysis: "(whole file)", title: "", problems: ["build crashed: " + e] });
			continue;
		}
		groups.forEach(function (group) {
			group.items.forEach(function (item) {
				var entry = { file: name, analysis: group.name, title: item.title, problems: [], unmatched: [], todo: [], number: item.number };
				report.push(entry);
				if (item.error) {
					entry.problems.push("crash: " + item.error);
					return;
				}
				if (item.failed) {  // empty or failed in JASP: shown as such, nothing to check
					entry.skipped = item.failed;
					return;
				}
				var apa = item.apa;
				entry.todo = apa.todo;
				entry.html = apa.html;
				entry.jasp = item.plain ? item.plain.outerHTML : "";
				var text = apa.text;

				// The change list: present, every entry with a reason, no rule with nothing to show, no markup leaking in
				if (!Array.isArray(apa.changes) || apa.changes.length === 0)
					entry.problems.push("no change list");
				else
					apa.changes.forEach(function (c) {
						if (!c.rule || !c.detail)
							entry.problems.push("change without a rule or reason");
						if (c.examples.some(function (e) { return /style=|class=|data-apa-todo|undefined/.test(e.from + e.to) || e.from === e.to; }))
							entry.problems.push("bad change example in " + c.rule);
					});

				// Words that mean something went wrong
				var bad = /^(NaN|undefined|null|-?Infinity|\[object.*)$/;
				$(apa.html).find("td, th").each(function () {
					var v = _apaPlain(this.innerHTML);
					if (bad.test(v))
						entry.problems.push("bad value in a cell: " + v);
				});
				// Exponents only where meant: Bayes factors and their posterior probabilities
				var expHolder = document.createElement("div");
				expHolder.innerHTML = apa.html;
				var expTable = expHolder.querySelector("table");
				if (expTable) {
					var expHead = $(expTable).children("thead").children("tr").toArray();
					var expGrid = _apaGrid(expHead.concat($(expTable).children("tbody").children("tr").toArray()));
					expGrid.placed.forEach(function (i) {
						if (i.row < expHead.length || !/×\s*10/.test(i.cell.textContent))
							return;
						var h = expHead.length ? expGrid.grid[expHead.length - 1][i.col] : null;
						var heading = h ? _apaLabel(h) : "";
						if (!/^(BF|log|Error|P\()/.test(heading))
							entry.problems.push("exponent notation outside a Bayes column (" + heading + ")");
					});
				}

				// Structure
				var holder = document.createElement("div");
				holder.innerHTML = apa.html;
				var table = holder.querySelector("table");
				if (!table) {
					entry.problems.push("no table in output");
					return;
				}
				var head = $(table).children("thead").children("tr").toArray();
				var body = $(table).children("tbody").children("tr").toArray();
				var grid = _apaGrid(head.concat(body));
				var widths = grid.grid.map(function (r) { return r.filter(function (c) { return c; }).length; });
				var width = Math.max.apply(null, widths);
				if (widths.some(function (w) { return w !== width; }))
					entry.problems.push("rows of different widths: " + widths.join(","));
				if (body.length === 0)
					entry.problems.push("no body rows");
				for (var c = 0; c < width; c++) {
					var cells = grid.placed.filter(function (i) { return i.row >= head.length && i.col <= c && c < i.col + i.colSpan; });
					if (cells.length > 0 && cells.every(function (i) { return _apaPlain(i.cell.innerHTML) === ""; }))
						entry.problems.push("empty column " + (c + 1));
					var headed = grid.placed.some(function (i) { return i.row < head.length && i.col <= c && c < i.col + i.colSpan && _apaPlain(i.cell.innerHTML) !== ""; });
					if (!headed && head.length > 0)
						entry.problems.push("column " + (c + 1) + " has no heading and no placeholder");
				}

				// p columns: 3 decimals, no leading zero
				var lastHead = head.length - 1;
				if (lastHead >= 0)
					for (var col = 0; col < width; col++) {
						var h = grid.grid[lastHead][col];
						if (!h || !/^p$/.test(_apaLabel(h)))
							continue;
						grid.placed.filter(function (i) { return i.row > lastHead && i.col === col; }).forEach(function (i) {
							var v = _apaPlain(i.cell.innerHTML).replace(/[*†‡ᵃ-ᶻ]+$/, "");
							if (v !== "" && !/^(< \.001|\.\d{3}|1\.000|—|-)$/.test(v))
								entry.problems.push("p value not APA: " + v);
						});
					}

				// Every number JASP has must be in the copy (rounded), unless the copy moved it on purpose
				var tokens = numbersIn(text);
				var isMatrix = /Correlation/i.test(item.title);
				rawNumbers(item.model).forEach(function (raw) {
					if (raw.field === "Missing" && raw.value === 0)
						return;  // goes with Valid when N moves to the note
					if (isMatrix && /^p(-value)?$/.test(raw.field))
						return;  // p values become asterisks
					if (!matches(raw, tokens, text))
						entry.unmatched.push(raw.field + "=" + raw.value);
				});

				// N: what the tables say against what the data says
				var others = group.items.filter(function (o) { return o !== item && o.plain; }).map(function (o) { return { table: o.plain, title: o.model.get("title") }; });
				var fromTables = apaSampleSize(item.plain, _apaPlain(item.model.get("title") || ""), others);
				var fromData = group.sampleSize && group.sampleSize.n;
				if (fromTables.n !== undefined && fromData !== undefined && fromTables.n !== fromData)
					entry.problems.push("N from tables (" + fromTables.n + ") differs from N in the data (" + fromData + ")");
				entry.nNote = (text.match(/(Number of (studies|effects)[^.]*|N = [^.]*)\./) || [""])[0];
			});
		});
	}
	document.getElementById("result").textContent = JSON.stringify(report);
})();
