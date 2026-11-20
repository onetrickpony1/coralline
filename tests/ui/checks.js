// Runs every fixture through the app's build() and checks the APA output. Results go into #result as JSON.
(function () {
	var out = { tables: 0, errors: [], failures: [], notes: {} };
	var expect = function (ok, what) { if (!ok) out.failures.push(what); };
	var byName = {};
	for (var name in window.FIXTURES) {
		var groups = window.japasp.show(window.FIXTURES[name], name + ".jasp");
		byName[name] = groups;
		groups.forEach(function (g) {
			g.items.forEach(function (item) {
				out.tables++;
				if (item.error)
					out.errors.push(name + " / " + item.title + ": " + item.error);
			});
		});
	}
	var note = function (file, number) {
		var all = [].concat.apply([], (byName[file] || []).map(function (g) { return g.items; }));
		var item = all.find(function (i) { return i.number === number; });
		if (!item || !item.apa)
			return "";
		return item.apa.text.split("\n").filter(function (l) { return /^Note\./.test(l); }).join(" ");
	};
	if (byName["Album Sales"]) {
		expect(/N = 200\./.test(note("Album Sales", 1)), "Album Sales table 1: N = 200 in the note");
		expect(/N = 200\./.test(note("Album Sales", 2)), "Album Sales table 2: N = 200 from the descriptives");
	}
	if (byName["Directed Reading Activities"])
		expect(/N = 44\./.test(note("Directed Reading Activities", 1)), "t-test: N = 44");
	if (byName["Beer Goggles"])
		expect(/N = 48\./.test(note("Beer Goggles", 1)), "ANOVA: N = 48");
	if (byName["Exam Anxiety"])
		expect(/N = 103\./.test(note("Exam Anxiety", 1)), "correlation without n: N = 103 from the data");
	if (byName["Fear of Statistics"])
		expect(/N = 2,571\./.test(note("Fear of Statistics", 1)), "reliability: N = 2,571 from the data");
	if (byName["Beer Goggles"])
		expect(/N = 48\./.test(note("Beer Goggles", 2)), "simple main effects: N = 48 from the ANOVA table");
	if (byName["Beer Goggles"])
		expect([].concat.apply([], byName["Beer Goggles"].map(function (g) { return g.items; })).some(function (i) { return /Levene/.test(i.rawTitle) && i.check && !i.number; }), "Levene's test (\"Test for Equality of Variances\") starts out of the report");
	// The page shows the last file: its cards must be there with copy buttons
	expect(document.querySelectorAll(".card button.primary").length > 0, "cards with copy buttons are shown");
	expect(document.querySelectorAll(".side a").length === document.querySelectorAll(".card").length, "one sidebar link per card");
	out.missingN = [].concat.apply([], Object.keys(byName).map(function (f) { return [].concat.apply([], byName[f].map(function (g) { return g.items.filter(function (i) { return i.apa && /add sample size|sample sizes differ/.test(i.apa.text); }).map(function (i) { return f + " / " + g.title + " / " + i.title; }); })); }));
	out.stubs = [].concat.apply([], Object.keys(byName).map(function (f) { return [].concat.apply([], byName[f].map(function (g) { return g.items.filter(function (i) { return i.apa; }).map(function (i) { var lines = i.apa.text.split("\n"); var head = lines.slice(2).find(function (l) { return !/^\t/.test(l); }) || ""; return f + " / " + i.title + ": " + head.split("\t").slice(0, 2).join(" | "); }); })); }));
	document.getElementById("result").textContent = JSON.stringify(out);
})();
