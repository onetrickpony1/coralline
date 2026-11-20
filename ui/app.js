// jAPAsp: shows every table of a saved JASP file as an APA 7 table, with a copy button for each.
// The tables are drawn by JASP's own code (vendor/jasp), so they match what JASP shows, and the APA copy is
// JASP's "Copy APA Table" code. In the app, Rust reads the file and puts the copy on the clipboard. In a plain
// browser (for tests), a JSON dump from `japasp --json` can be opened instead.
(function () {
	"use strict";

	window.globSet = { decimals: "", pExact: false, normalizedNotation: true };

	const tauri = window.__TAURI__;
	const $id = function (id) { return document.getElementById(id); };
	const root = document.documentElement;

	// ---- Settings, kept in this browser profile (all optional: the app works without storage) ----

	const settings = {
		read: function (key, fallback) {
			try {
				const value = localStorage.getItem("japasp." + key);
				return value === null ? fallback : JSON.parse(value);
			} catch (e) { return fallback; }
		},
		write: function (key, value) {
			try { localStorage.setItem("japasp." + key, JSON.stringify(value)); } catch (e) { /* storage off */ }
		}
	};

	const state = {
		file: null,          // the parsed file
		name: "",
		path: null,          // in the app: the file's path, for reloading
		stamp: null,         // when that file was last saved
		groups: [],
		filter: "all",
		query: "",
		current: null,       // id of the table the keyboard acts on
		copied: new Map(),   // key -> { n: table number, h: content hash } of the tables copied from this file (saved per file)
		files: settings.read("files", {}),   // per file: { start, out: [keys left out], in: [checks put back in] }
		theme: settings.read("theme", "system"),
		zoom: settings.read("zoom", 1),
		highlights: settings.read("highlights", true),
		singleKeys: settings.read("singleKeys", true),   // J, K, C, T, W, B, H without Ctrl (off for screen readers)
		sidebar: settings.read("sidebar", true),     // the table list on the left is shown
		autoReload: settings.read("autoReload", true),
		reduced: root.classList.contains("reduced"),
		appIcon: settings.read("appIcon", "theme"),   // "theme", or a fixed "blue", "dark", "pink" or "green"
		shownIcon: null,   // set by theme-boot.js before the first paint
		recent: settings.read("recent", [])
	};

	// ---- Building the APA tables ----

	function usable(t) { return !!(t && t.schema && t.data && t.data.length > 0 && t.status !== "error"); }

	function plainTable(model) {
		const view = new JASPWidgets.tablePrimitive({ model: model });
		view.render();
		return view.$el.find("table").get(0);
	}

	// Tables that check a test's assumptions or diagnose a model. Most papers leave them out, so they start out of the
	// numbering; one click puts them back.
	const checkTitles = /^(Test of Normality|Assumption Checks|Tests? (of|for) Equality of Variances|Levene|Summary of test against the normal distribution|Shapiro|Test of Sphericity|Homogeneity|Collinearity Diagnostics|Casewise Diagnostics|Influential Cases|Residuals Statistics|Q-Q|Multicollinearity)/i;

	// What the reader settings for the open file are (table numbering, left-out tables)
	function fileKey() { return state.path || state.name || ""; }
	function fileSettings() {
		const saved = state.files[fileKey()] || {};
		return { start: saved.start || 1, out: saved.out || [], in: saved.in || [], copied: saved.copied || {} };
	}
	function saveFileSettings(change) {
		const key = fileKey();
		if (!key)
			return;
		const next = Object.assign(fileSettings(), change);
		// Re-inserted at the end, so the 50 kept are the 50 most recently used files
		delete state.files[key];
		state.files[key] = next;
		const keys = Object.keys(state.files);
		while (keys.length > 50)
			delete state.files[keys.shift()];
		settings.write("files", state.files);
	}

	// A short fingerprint of a table's copy, without its number: tells whether JASP's values changed since a copy
	function contentHash(item) {
		const text = item.apa.text.split("\n").slice(1).join("\n");
		let h = 0;
		for (let i = 0; i < text.length; i++)
			h = (h * 31 + text.charCodeAt(i)) | 0;
		return (h >>> 0).toString(36);
	}

	// What became of a copied table: null (not copied), "ok", "renumbered" or "changed"
	function copyState(item) {
		const copy = state.copied.get(item.key);
		if (!copy || !item.apa || item.left)
			return null;
		if (copy.h !== contentHash(item))
			return "changed";
		return copy.n !== item.number ? "renumbered" : "ok";
	}

	function saveCopied() {
		const copied = {};
		state.copied.forEach(function (v, k) { copied[k] = v; });
		saveFileSettings({ copied: copied });
	}

	// The APA title without its placeholder: what the sidebar and card header show
	function tidyTitle(apa, fallback) {
		const line = apa && apa.text ? apa.text.split("\n")[1] || "" : "";
		const title = line.replace(/\s*\[[^\]]*\]\s*$/, "").trim();
		return title || fallback;
	}

	// Returns [{ title, items: [{ key, number, title, apa | error | failed, left, check }] }]. Tables are numbered across
	// the whole file, from the first number set for this file, skipping tables left out of the report.
	function build(file, firstNumber) {
		const prefs = fileSettings();
		let number = (firstNumber || prefs.start) - 1;
		const seen = {};
		return file.analyses.map(function (analysis, a) {
			const tables = analysis.tables || [];
			const entries = tables.map(function (t, i) { return { t: t, i: i }; }).filter(function (e) { return e.t; });
			const models = entries.map(function (e) { return usable(e.t) ? new JASPWidgets.table(e.t) : null; });
			const plain = models.map(function (m) { return m ? plainTable(m) : null; });
			const items = entries.map(function (entry, j) {
				const key = "a" + a + "-t" + entry.i;
				const rawTitle = _apaPlain(entry.t.title || "");
				const item = { key: key, number: null, title: rawTitle || "Untitled table", rawTitle: rawTitle };
				const model = models[j];
				if (!model) {
					// JASP shows these, but there is nothing to turn into an APA table
					const message = entry.t.error && entry.t.error.errorMessage ? _apaPlain(entry.t.error.errorMessage) : "";
					item.failed = entry.t.status === "error"
						? "JASP couldn't compute this table" + (message ? ": " + message : ".")
						: "This table is empty in JASP, so there is nothing to copy.";
					return item;
				}
				item.check = checkTitles.test(rawTitle);
				item.left = prefs.out.indexOf(key) !== -1 || (item.check && prefs.in.indexOf(key) === -1);
				if (!item.left)
					item.number = ++number;
				item.model = model;
				item.plain = plain[j];
				try {
					item.apa = buildAPATable(apaRenderTable(model), {
						title: model.get("title"),
						subtitle: model.get("subtitle"),
						footnotes: model.get("footnotes"),
						otherTables: plain.map(function (table, k) { return table && k !== j ? { table: table, title: models[k].get("title") } : null; })
							.filter(Boolean),
						dataSampleSize: analysis.sampleSize,  // counted from the saved data, used when the tables don't say
						variableNames: analysis.variables,    // lets the first column be headed "Variable" when it lists them
						shownTable: plain[j]                  // the table as JASP shows it, so the change list includes decimals
					}, item.number || "");
					item.title = tidyTitle(item.apa, item.title);
				} catch (e) {
					item.error = String(e && e.message || e);
				}
				return item;
			});
			// Analyses with the same name get a number ("ANOVA (2)") so the list can tell them apart
			let title = analysis.title || analysis.name || "Analysis";
			seen[title] = (seen[title] || 0) + 1;
			if (seen[title] > 1)
				title += " (" + seen[title] + ")";
			return { title: title, name: analysis.name, sampleSize: analysis.sampleSize, variables: analysis.variables || [], items: items, plotsOnly: items.length === 0 };
		});
	}

	// ---- Small helpers ----

	function el(tag, attrs, children) {
		const node = document.createElement(tag);
		for (const key in attrs || {}) {
			if (key === "text")
				node.textContent = attrs[key];
			else
				node.setAttribute(key, attrs[key]);
		}
		for (const child of children || [])
			node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
		return node;
	}

	// Showing and hiding with a short animation. Showing plays the CSS "enter" animation; hiding plays "leaving"
	// and sets hidden when it ends (at once with Reduce effects). Showing again cancels a hide still running.
	function reveal(node) {
		node.leaveRun = (node.leaveRun || 0) + 1;
		node.classList.remove("leaving");
		if (node.hidden) {
			node.hidden = false;
			replay(node, "enter");
		}
	}
	function conceal(node, done) {
		if (node.hidden || node.classList.contains("leaving")) {
			if (done) done();
			return;
		}
		if (state.reduced) {
			node.hidden = true;
			if (done) done();
			return;
		}
		const run = node.leaveRun = (node.leaveRun || 0) + 1;
		node.classList.add("leaving");
		const finish = function () {
			if (node.leaveRun !== run)
				return;
			node.leaveRun++;
			node.classList.remove("leaving");
			node.hidden = true;
			if (done) done();
		};
		node.addEventListener("animationend", function (e) { if (e.target === node) finish(); }, { once: true });
		setTimeout(finish, 240);  // if no animation runs
	}
	function isShown(node) { return !node.hidden && !node.classList.contains("leaving"); }
	// Plays a one-off animation class again, even if it is already set
	function replay(node, cls) {
		if (state.reduced)
			return;
		node.classList.remove(cls);
		void node.offsetWidth;
		node.classList.add(cls);
		node.addEventListener("animationend", function (e) { if (e.target === node) node.classList.remove(cls); }, { once: true });
	}

	function svgIcon(paths) {
		const ns = "http://www.w3.org/2000/svg";
		const svg = document.createElementNS(ns, "svg");
		svg.setAttribute("viewBox", "0 0 20 20");
		svg.setAttribute("aria-hidden", "true");
		for (const d of paths) {
			const path = document.createElementNS(ns, "path");
			path.setAttribute("d", d);
			svg.appendChild(path);
		}
		return svg;
	}
	const tick = function () { return svgIcon(["M4.5 10.5l3.5 3.5 7.5-8"]); };

	function plural(n, one, many) { return n + " " + (n === 1 ? one : many); }

	let toastTimer = null;
	function toast(message, bad) {
		const node = $id("toast");
		node.textContent = message;
		node.classList.toggle("bad", !!bad);
		node.classList.add("show");
		clearTimeout(toastTimer);
		toastTimer = setTimeout(function () { node.classList.remove("show"); }, bad ? 6000 : 3200);
	}

	function baseName(path) { return String(path).split(/[\\/]/).pop(); }
	function folderOf(path) { const parts = String(path).split(/[\\/]/); parts.pop(); return parts.join("/"); }

	// ---- Themes ----

	const darkQuery = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
	function applyTheme() {
		const resolved = state.theme === "system" ? (darkQuery && darkQuery.matches ? "dark" : "light") : state.theme;
		root.setAttribute("data-theme", resolved);
		for (const button of document.querySelectorAll("[data-theme-choice]"))
			button.setAttribute("aria-checked", String(button.dataset.themeChoice === state.theme));
		applyIcon();
		rove();
	}
	// The icon follows the theme (light: blue, dark: dark grey, pink: pink, green: green) unless one is chosen in the menu
	function applyIcon() {
		const theme = root.getAttribute("data-theme");
		const variant = state.appIcon !== "theme" ? state.appIcon : theme === "dark" ? "dark" : theme === "pink" ? "pink" : theme === "green" ? "green" : "blue";
		for (const button of document.querySelectorAll("[data-icon-choice]"))
			button.setAttribute("aria-checked", String(button.dataset.iconChoice === state.appIcon));
		rove();
		if (variant === state.shownIcon)
			return;
		state.shownIcon = variant;
		const src = "icons/icon-" + variant + ".svg";
		for (const img of document.querySelectorAll("img[data-app-icon]"))
			img.src = src;
		$id("favicon").href = src;
		if (tauri)
			tauri.core.invoke("set_app_icon", { variant: variant }).catch(function (e) { console.warn("app icon:", e); });
	}

	function setTheme(theme) {
		state.theme = theme;
		settings.write("theme", theme);
		applyTheme();
	}
	if (darkQuery && darkQuery.addEventListener)
		darkQuery.addEventListener("change", function () { if (state.theme === "system") applyTheme(); });

	// ---- Showing a file ----

	function show(file, name) {
		state.file = file;
		state.name = name || "";
		state.copied = new Map(Object.entries(fileSettings().copied));
		$id("startNumber").value = String(fileSettings().start);
		$id("startNumber").disabled = false;
		$id("openButton").classList.remove("primary");  // with a file open, copying is the main action
		$id("closeFile").hidden = false;
		$id("fileRule").hidden = false;
		const groups = render();
		$id("empty").hidden = true;
		$id("layout").hidden = false;
		$id("filePill").hidden = false;
		$id("sideButton").hidden = false;
		$id("searchWrap").hidden = false;
		$id("fileName").textContent = state.name;
		$id("fileName").title = state.path || state.name;
		document.title = state.name ? state.name + " – jAPAsp" : "jAPAsp";
		if (tauri && tauri.window && tauri.window.getCurrentWindow)
			tauri.window.getCurrentWindow().setTitle(document.title).catch(function () {});
		$id("tables").scrollTop = 0;
		updateMenu();
		return groups;
	}

	// Draws the sidebar and the cards from state.file. Keeps the reader's place when the file is reloaded.
	function render() {
		const tables = $id("tables");
		const keep = state.current;
		const keepTop = keep && $id(keep) ? $id(keep).getBoundingClientRect().top : null;

		// The open "What changed" panels stay open across reloads
		const openPanels = new Set();
		for (const group of state.groups || [])
			for (const item of group.items)
				if (item.changesPanel && isShown(item.changesPanel))
					openPanels.add(item.key);

		const all = build(state.file);
		const groups = all.filter(function (g) { return !g.plotsOnly; });
		state.groups = groups;
		markDuplicates(groups);
		shownCurrent = null;
		const side = $id("side");
		side.textContent = "";
		tables.textContent = "";

		for (const group of groups) {
			// The count is the tables in the report; the tooltip gives all of them
			const inReport = group.items.filter(function (i) { return i.apa && !i.left; }).length;
			const list = el("details", { open: "" }, [el("summary", { title: group.title + ": " + plural(group.items.length, "table", "tables") + ", " + inReport + " in your report" }, [
				el("span", { class: "g", text: group.title }), el("span", { class: "count", text: String(inReport) })])]);
			side.appendChild(list);
			// One table named like its analysis: the card says it all, so no heading above it
			const sameName = group.items.length === 1 && group.title.toLowerCase().replace(/\W/g, "") === group.items[0].title.toLowerCase().replace(/\W/g, "");
			if (!sameName)
				tables.appendChild(el("h2", { class: "analysis-title", text: group.title }));
			const shortTitles = shortenTitles(group.items);
			for (const item of group.items) {
				const id = "table-" + item.key;
				item.id = id;
				const link = el("a", { href: "#" + id, "data-id": id, title: item.title }, [
					el("span", { class: "n", text: item.number ? String(item.number) : "–" }),
					el("span", { class: "t", text: shortTitles.get(item) }),
					el("span", { class: "mark" })
				]);
				link.addEventListener("click", function (e) {
					e.preventDefault();
					goTo(id);
					if (isNarrow())
						setDrawer(false);
				});
				item.link = link;
				list.appendChild(link);
				item.card = card(item, id);
				tables.appendChild(item.card);
				if (openPanels.has(item.key))
					toggleChanges(item, true);
				updateMark(item);
			}
		}
		const count = countable().length;
		$id("progress").hidden = count === 0;
		if (count === 0) {
			const plotsOnly = all.filter(function (g) { return g.plotsOnly; }).length;
			tables.appendChild(el("p", { class: "no-match", text: all.length === 0
				? "This file has no analyses yet. Run them in JASP, save, and open the file again."
				: plotsOnly === all.length
					? "This file has " + plural(all.length, "analysis", "analyses") + ", but " + (all.length === 1 ? "it only makes" : "they only make") + " plots. jAPAsp turns results tables into APA tables."
					: "None of this file's tables has anything to copy." }));
		}
		updateProgress();

		applyFilter();
		watchCurrent();
		if (keep && $id(keep)) {
			setCurrent(keep);
			if (keepTop !== null)
				tables.scrollTop += $id(keep).getBoundingClientRect().top - keepTop;
		}
		else
			setCurrent(groups.length && groups[0].items.length ? groups[0].items[0].id : null);
		return groups;
	}

	// In the list, titles that share a start ("Post Hoc Comparisons - Charisma", "... - Looks") show only what tells
	// them apart ("… Charisma"); the full title is in the tooltip
	function shortenTitles(items) {
		const out = new Map();
		const prefixOf = function (t) { const m = /^(.+? - )\S/.exec(t); return m ? m[1] : null; };
		const counts = {};
		items.forEach(function (i) { const p = prefixOf(i.title); if (p) counts[p] = (counts[p] || 0) + 1; });
		items.forEach(function (i) {
			const p = prefixOf(i.title);
			out.set(i, p && counts[p] > 1 ? "\u2026 " + i.title.slice(p.length) : i.title);
		});
		return out;
	}

	// Tables that go in the report: converted and not left out
	function countable() {
		const out = [];
		for (const group of state.groups)
			for (const item of group.items)
				if (item.apa && !item.left)
					out.push(item);
		return out;
	}

	// To-dos beyond the title. Almost every table asks for a better title, so the dot only marks extra work.
	function extraTodos(item) { return item.apa ? item.apa.todo.filter(function (t) { return todoKind(t) !== "title"; }) : []; }

	// The ring counts copies (the yellow parts can only be finished in the document, so "copied" is what the app can
	// know). It turns amber while copied tables still have yellow parts, and the line under it says what's left.
	function updateProgress() {
		const items = countable();
		const copied = items.filter(function (i) { return copyState(i) === "ok"; });
		const stale = items.filter(function (i) { const c = copyState(i); return c === "renumbered" || c === "changed"; });
		$id("readyCount").textContent = copied.length + " of " + items.length;
		$id("readyLabel").textContent = items.length === 1 ? "table copied" : "tables copied";
		const yellow = copied.reduce(function (n, i) { return n + i.apa.todo.length; }, 0);
		const hint = $id("readyHint");
		if (stale.length > 0) {
			const them = stale.length === 1 ? "it" : "them";
			const changed = stale.some(function (i) { return copyState(i) === "changed"; });
			hint.textContent = plural(stale.length, "copied table has", "copied tables have") + (changed ? " changed" : " a new number") + " since you copied " + them + ": copy " + them + " again (" + (stale.length === 1 ? "Table " : "Tables ") + stale.map(function (i) { return i.number; }).join(", ") + ").";
		}
		else if (copied.length === 0)
			hint.textContent = items.some(function (i) { return i.apa.todo.length > 0; }) ? "After pasting, replace the highlighted parts (yellow in Word) in your document." : "";
		else if (yellow > 0) {
			const tables = copied.filter(function (i) { return i.apa.todo.length > 0; }).map(function (i) { return i.number; });
			hint.textContent = "Still to do in your document: " + highlightedParts(yellow) + " (" + (tables.length === 1 ? "Table " : "Tables ") + tables.join(", ") + ").";
		}
		else
			hint.textContent = "";
		const wasHidden = hint.hidden;
		hint.hidden = hint.textContent === "";
		if (!hint.hidden && (wasHidden || hint.dataset.said !== hint.textContent))
			replay(hint, "enter");
		hint.dataset.said = hint.textContent;
		hint.classList.toggle("warn", stale.length > 0);
		$id("progress").classList.toggle("unfinished", yellow > 0 || stale.length > 0);
		const circumference = 113.1;
		$id("ringDone").style.strokeDashoffset = String(items.length === 0 ? circumference : circumference * (1 - copied.length / items.length));
		updateBarProgress(copied.length, items.length);
	}

	// The same count in the title bar, for when the table list is hidden or folded into a drawer
	function updateBarProgress(copied, total) {
		$id("barCount").textContent = copied + " of " + total;
		$id("barRingDone").style.strokeDashoffset = String(total === 0 ? 113.1 : 113.1 * (1 - copied / total));
		$id("barProgress").classList.toggle("unfinished", $id("progress").classList.contains("unfinished"));
		showBarProgress();
	}
	function showBarProgress() {
		$id("barProgress").hidden = !state.file || countable().length === 0 || (state.sidebar && !isNarrow());
	}

	// The mark after a table's name. Copied: a tick (with a small yellow dot while it has extra yellow parts).
	// Not copied: yellow dot for extra work (headings, names, page), a quiet dot when only the title is left,
	// green when there is nothing to add. Renumbered or changed since copying: a "copy again" mark.
	function updateMark(item) {
		const mark = item.link.querySelector(".mark");
		mark.textContent = "";
		const todo = item.apa ? item.apa.todo.length : 0;
		const extra = extraTodos(item).length;
		const copy = copyState(item);
		let kind, label;
		if (item.failed || item.error) { kind = "error"; label = item.failed || "Couldn't convert"; }
		else if (item.left) { kind = "left"; label = "Left out of your report"; }
		else if (copy === "renumbered") { kind = "stale"; label = "Now Table " + item.number + ": copy it again (you copied it as Table " + state.copied.get(item.key).n + ")"; }
		else if (copy === "changed") { kind = "stale"; label = "JASP's values changed since you copied it: copy it again"; }
		else if (copy === "ok") { kind = "copied" + (extra > 0 ? " more" : ""); label = todo > 0 ? "Copied. Finish the " + highlightedParts(todo) + " in your document" : "Copied"; }
		else if (extra > 0) { kind = "todo"; label = plural(todo, "highlighted part", "highlighted parts") + " to finish after pasting"; }
		else if (todo > 0) { kind = "title"; label = "Add a title after pasting"; }
		else { kind = "ready"; label = "Nothing to add: ready to paste"; }
		mark.className = "mark " + kind;
		mark.title = label;
		if (copy === "ok")
			mark.appendChild(tick());
		if (kind === "stale")
			mark.appendChild(svgIcon(["M15 8.5A5.5 5.5 0 1 0 14 13", "M15 4.5v4h-4"]));
		mark.appendChild(el("span", { class: "sr", text: label }));
		item.link.classList.toggle("left", kind === "left" || kind === "error");
	}

	function staleCount() { return countable().filter(function (i) { const c = copyState(i); return c === "renumbered" || c === "changed"; }).length; }

	function highlightedParts(n) { return n === 1 ? "highlighted part" : n + " highlighted parts"; }

	// Leaves a table out of the report (no number, not in Copy all) or puts it back
	function setLeftOut(item, left) {
		const prefs = fileSettings();
		const out = prefs.out.filter(function (k) { return k !== item.key; });
		const back = prefs.in.filter(function (k) { return k !== item.key; });
		if (left && !item.check)
			out.push(item.key);
		if (!left && item.check)
			back.push(item.key);
		saveFileSettings({ out: out, in: back });
		state.current = item.id;
		render();
		const now = itemById(item.id);
		if (now && now.card)
			replay(now.card, "settle");
		const stale = staleCount();
		toast((left ? "Left out of your report. The tables after it are renumbered." : "Back in your report as Table " + (now ? now.number : "") + ".")
			+ (stale > 0 ? " " + plural(stale, "copied table has", "copied tables have") + " a new number: copy " + (stale === 1 ? "it" : "them") + " again." : ""));
	}

	function card(item, id) {
		const numberText = item.number ? "Table " + item.number : item.failed || item.error ? "Not converted" : "Not in report";
		const head = el("header", { class: "card-head" }, [
			el("div", { class: "label" }, [el("span", { class: "num", text: numberText }), el("span", { class: "t", text: item.title, title: item.title })])
		]);
		const node = el("article", { class: "card glass" + (item.left ? " left-out" : ""), id: id, "aria-label": numberText + ", " + item.title }, [head]);
		if (item.failed || item.error) {
			node.appendChild(el("div", { class: "error", text: item.failed || "This table couldn't be converted: " + item.error }));
			return node;
		}
		node.addEventListener("pointerdown", function () { setCurrent(id); });
		const safe = "Only changes this list: your JASP file stays the same.";

		if (item.left) {
			const back = el("button", { type: "button", class: "btn", title: "Give it a table number and include it in Copy all. " + safe, text: "Put in report" });
			back.addEventListener("click", function () { setLeftOut(item, false); });
			head.appendChild(el("div", { class: "actions" }, [back]));
			node.appendChild(el("p", { class: "left-note", text: item.check
				? "This table checks the test's assumptions. Reports usually describe that in a sentence, not a table (for example, “Levene's test was not significant”). Put it in your report only if your marking guide asks for it."
				: "Left out of your report: it has no table number and isn't in Copy all." }));
			return node;
		}

		const changesButton = el("button", { type: "button", class: "btn quiet", title: "What was changed to match APA 7 (W)", "aria-expanded": "false", "aria-controls": id + "-changes", text: "What changed" });
		const button = el("button", { type: "button", class: "btn primary", title: "Copy for Word or Google Docs (C)" }, [el("span", { class: "swap", text: "Copy APA table" })]);
		// The less used actions sit in a small menu on the card
		const moreButton = el("button", { type: "button", class: "icon-btn card-more", "aria-haspopup": "true", "aria-expanded": "false", "aria-label": "More for " + numberText, title: "More" }, [svgIcon(["M4.5 10h.01", "M10 10h.01", "M15.5 10h.01"])]);
		const textItem = el("button", { type: "button", title: "For spreadsheets and plain text editors, or if pasting the table doesn't work (T)" }, [el("span", { text: "Copy as plain text" }), el("small", { text: "Only if pasting the table doesn't work" })]);
		const leaveItem = el("button", { type: "button", title: safe }, [el("span", { text: "Leave out of report" }), el("small", { text: "No table number, not in Copy all" })]);
		const cardMenu = el("div", { class: "card-menu glass", role: "group", "aria-label": "More for " + numberText }, [textItem, leaveItem]);
		cardMenu.hidden = true;
		const toggleCardMenu = function (open) {
			if (open)
				reveal(cardMenu);
			else
				conceal(cardMenu);
			moreButton.setAttribute("aria-expanded", String(open));
			if (open)
				textItem.focus();
		};
		moreButton.addEventListener("click", function () { toggleCardMenu(!isShown(cardMenu)); });
		cardMenu.addEventListener("keydown", function (e) { if (e.key === "Escape") { e.stopPropagation(); toggleCardMenu(false); moreButton.focus(); } });
		cardMenu.addEventListener("focusout", function (e) { if (!cardMenu.contains(e.relatedTarget) && e.relatedTarget !== moreButton) toggleCardMenu(false); });
		document.addEventListener("pointerdown", function (e) { if (isShown(cardMenu) && !cardMenu.contains(e.target) && e.target.closest(".card-more") !== moreButton) toggleCardMenu(false); });
		textItem.addEventListener("click", function () { toggleCardMenu(false); copyItem(item, true); });
		leaveItem.addEventListener("click", function () { toggleCardMenu(false); setLeftOut(item, true); });
		head.appendChild(el("div", { class: "actions" }, [changesButton, el("div", { class: "card-more-wrap" }, [moreButton, cardMenu]), button]));

		// Copied, then renumbered or changed by JASP: say so above the table
		item.staleNote = el("p", { class: "stale-note", role: "status" });
		node.appendChild(item.staleNote);

		// To-dos first, so their help is on screen next to the table, not below a tall one
		const todo = item.apa.todo;
		if (todo.length > 0) {
			const chips = el("div", { class: "todo" }, [el("span", { class: "lead", text: "Finish after pasting:" })]);
			const hint = el("div", { class: "todo-hint", role: "status" });
			hint.hidden = true;
			for (const thing of todo) {
				const kind = todoKind(thing);
				const chip = el("button", { type: "button", title: "How to do this, and where", "aria-expanded": "false", text: thing.charAt(0).toUpperCase() + thing.slice(1) });
				chip.addEventListener("click", function () {
					const open = chip.getAttribute("aria-expanded") !== "true";
					for (const other of chips.querySelectorAll("button"))
						other.setAttribute("aria-expanded", "false");
					chip.setAttribute("aria-expanded", String(open));
					if (open) {
						hint.textContent = "";
						for (const part of todoHelp(kind, thing, item))
							hint.appendChild(part);
						if (isShown(hint))
							replay(hint, "swap-in");  // another chip's help: the text crossfades
						reveal(hint);
						flashHighlight(item, kind);
					}
					else
						conceal(hint);
				});
				chips.appendChild(chip);
			}
			node.appendChild(chips);
			node.appendChild(hint);
		}
		else
			node.appendChild(el("div", { class: "todo ready", text: "Nothing to add. Ready to paste." }));

		const notes = tableNotes(item);
		if (notes.length > 0)
			node.appendChild(el("ul", { class: "info" }, notes.map(function (n) { return el("li", { text: n }); })));
		if (item.duplicateOf) {
			const leave = el("button", { type: "button", class: "link", title: safe, text: "Leave this one out" });
			leave.addEventListener("click", function () { setLeftOut(item, true); });
			node.appendChild(el("p", { class: "dup-note" }, ["Same numbers as Table " + item.duplicateOf.number + " (" + item.duplicateOf.title + "). Most reports use only one of these. ", leave]));
		}

		const paper = el("div", { class: "paper" });
		paper.innerHTML = item.apa.html;
		node.appendChild(el("div", { class: "tray" }, [paper]));

		const changes = el("section", { class: "changes", id: id + "-changes", "aria-label": "What changed in " + numberText });
		changes.hidden = true;
		node.appendChild(changes);
		changesButton.addEventListener("click", function () { toggleChanges(item); });
		item.changesButton = changesButton;
		item.changesPanel = changes;

		button.addEventListener("click", function () { copyItem(item, false); });
		item.button = button;
		updateCardState(item);
		return node;
	}

	function updateCardState(item) {
		if (!item.staleNote)
			return;
		const copy = copyState(item);
		const before = state.copied.get(item.key);
		item.staleNote.textContent = copy === "renumbered" ? "You copied this as Table " + before.n + ". It's now Table " + item.number + ": copy it again."
			: copy === "changed" ? "JASP's values changed since you copied this table: copy it again." : "";
		item.staleNote.hidden = item.staleNote.textContent === "";
	}

	// Descriptives tables that repeat each other's numbers (the t test's Group Descriptives and the Descriptives
	// analysis's Descriptive Statistics, for example): the later one gets a note offering to leave it out
	function markDuplicates(groups) {
		const numbers = function (item) {
			const lines = item.apa.text.split("\n").slice(2).filter(function (l) { return !/^Note\./.test(l); });
			return new Set((lines.join("\t").match(/-?\d[\d,]*\.\d+/g) || []));
		};
		const desc = [];
		for (const group of groups)
			for (const item of group.items)
				if (item.apa && !item.left && /descriptiv/i.test(item.rawTitle))
					desc.push(item);
		for (let b = 1; b < desc.length; b++)
			for (let a = 0; a < b; a++) {
				const x = numbers(desc[a]), y = numbers(desc[b]);
				const shared = Array.from(y).filter(function (n) { return x.has(n); }).length;
				if (shared >= 4 && shared >= 0.4 * Math.min(x.size, y.size)) {  // the same means and SDs, say
					desc[b].duplicateOf = desc[a];
					break;
				}
			}
	}


	// What each to-do is about, from the builder's wording
	function todoKind(text) {
		if (/title/.test(text)) return "title";
		if (/names/.test(text)) return "names";
		if (/heading/.test(text)) return "heading";
		if (/sample size/.test(text)) return "sample";
		if (/landscape/.test(text)) return "landscape";
		return "other";
	}

	// Help for a to-do, with an example from the table itself where possible
	function todoHelp(kind, text, item) {
		const parts = [];
		const p = function (html) { const node = el("p"); node.innerHTML = html; parts.push(node); };
		const esc = function (t) { return _apaEscape(String(t)); };
		// Variables in the table's order. Short names the table asks to write out ("drp") become a prompt for the
		// words, so the example is never copied with the code in it.
		const namesTodo = item.apa.todo.find(function (t) { return /names:/.test(t); });
		const unclear = namesTodo ? namesTodo.split(":")[1].split(",").map(function (w) { return w.trim().toLowerCase(); }) : [];
		const vars = tableVariables(item).map(function (v) {
			return unclear.indexOf(v.toLowerCase()) !== -1 ? "[what " + v + " measures]" : apaTitleCase(v);
		});
		// Up to four variables are named; more would make a long title
		const list = vars.length === 0 ? "[what was measured]" : vars.length > 4 ? "the Study Variables"
			: vars.length === 1 ? vars[0] : vars.slice(0, -1).join(", ") + " and " + vars[vars.length - 1];
		if (kind === "title")
			p("Write a short title that says what the table shows, in Title Case. For example: <i>" + esc(item.title + " for " + list) + "</i>." + (vars.length > 4 ? " Naming all " + vars.length + " variables would make the title long; the table names them." : "") + " Use words, not JASP's column names. Replace the yellow text with it after pasting.");
		else if (kind === "names") {
			const word = (text.split(":")[1] || "").split(",")[0].trim();
			p("Replace " + (word ? "<i>" + esc(word) + "</i>" : "each short name") + " with what it measures (for example, <i>Reading score</i>), or keep it and explain it in the note: <i>" + esc(word || "drp") + " = …</i>");
		}
		else if (kind === "heading")
			p("Give the column a short heading that says what it holds, for example <i>Group</i>, <i>Condition</i> or <i>Measure</i>.");
		else if (kind === "sample")
			p("Write how many participants the table is based on, for example <i>N</i> = 120. If it differs between rows, give each one.");
		else if (kind === "landscape")
			p("Turn the page with this table sideways. Word: put a section break before and after the table, then Layout › Orientation › Landscape. Google Docs: select the table, then File › Page setup › Apply to: Selected content › Landscape.");
		p("Then remove the yellow: in Word, Home › Text Highlight Colour › No Colour; in Google Docs, the highlighter › None.");
		parts[parts.length - 1].className = "after";
		return parts;
	}

	// The analysis's variables that this table shows, in the order it shows them, as the table writes them
	function tableVariables(item) {
		const group = state.groups.find(function (g) { return g.items.indexOf(item) !== -1; });
		const lines = item.apa.text.split("\n").slice(2);
		const noteAt = lines.findIndex(function (l) { return /^Note\./.test(l); });
		const body = lines.slice(0, noteAt === -1 ? lines.length : noteAt).join("\n").toLowerCase();
		const found = [];
		for (const name of group && group.variables || []) {
			const label = apaTidyLabel(String(name), true).text;
			const match = new RegExp("(^|[^\\p{L}\\p{N}])" + label.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?=$|[^\\p{L}\\p{N}])", "u").exec(body);
			const at = match ? match.index : -1;
			if (at !== -1 && !found.some(function (f) { return f.label === label; }))
				found.push({ label: label, at: at });
		}
		return found.sort(function (a, b) { return a.at - b.at; }).map(function (f) { return f.label; });
	}

	// Neutral notes on a table: smaller type, and extras some courses don't use (not advice on what to report)
	function tableNotes(item) {
		const notes = [];
		const size = /<table style="[^"]*font-size: (\d+)pt/.exec(item.apa.html);
		if (size && +size[1] < 12)
			notes.push("Smaller type (" + size[1] + " pt) so the table fits the width of the page. APA allows smaller type in tables.");
		// Extras: name the JASP tick box, and say the other numbers stay the same
		const safe = " Your other numbers don't change, and this table updates by itself when you save in JASP.";
		if (/(^|\t)Student(\t|$)/m.test(item.apa.text) && /(^|\t)Welch(\t|$)/m.test(item.apa.text))
			notes.push("JASP gives two versions of the t test: Student's assumes both groups vary about equally, Welch's doesn't. Most reports give one; check your marking guide. To drop the other, untick it in JASP under Tests (Student or Welch)." + safe);
		if (/VS-MPR/.test(item.apa.text))
			notes.push("VS-MPR is an extra most courses don't use. To drop it and its footnote, untick \u201cVovk-Sellke maximum p-ratio\u201d in JASP (in t tests, under Additional Statistics)." + safe);
		return notes;
	}

	// The change list: every rule that changed something, one line each; a click opens the reason and each change
	function toggleChanges(item, open, fromKeyboard) {
		if (!item || !item.changesPanel)
			return;
		const panel = item.changesPanel;
		const show = open === undefined ? !isShown(panel) : open;
		if (show && panel.childElementCount === 0)
			fillChanges(panel, item.apa.changes || [], item);
		if (show)
			reveal(panel);
		else
			conceal(panel);
		item.changesButton.setAttribute("aria-expanded", String(show));
		item.changesButton.classList.toggle("on", show);
		if (show && fromKeyboard)
			panel.querySelector(".lead").focus();
	}

	function fillChanges(panel, changes, item) {
		const cells = changes.reduce(function (n, c) { return n + c.cells; }, 0);
		panel.appendChild(el("p", { class: "lead", tabindex: "-1" }, [
			el("strong", { text: "Your results are the same as in JASP." }),
			" Only rounding, symbols, wording and layout changed to match APA 7 (" + plural(changes.length, "change", "changes") + (cells > 0 ? ", " + plural(cells, "cell", "cells") : "") + "). Open a change to see each value as JASP shows it → the APA version."
		]));
		const fragment = function (html, empty) {
			const span = el("span", { class: "v" + (html === "" ? " none" : "") });
			if (html === "")
				span.textContent = empty;
			else
				span.innerHTML = html;  // table content, inserted like the preview itself
			return span;
		};
		const plainOf = function (html) { const d = document.createElement("div"); d.innerHTML = html; return d.textContent; };
		const list = el("ol", { class: "rules" });
		for (const change of changes) {
			const facts = [];
			if (change.cells > 0)
				facts.push(plural(change.cells, "cell", "cells"));
			if (change.shape)
				facts.push(change.shape.from.rows + " × " + change.shape.from.columns + " → " + change.shape.to.rows + " × " + change.shape.to.columns + " (rows × columns)");
			else if (change.removed > 0)
				facts.push(plural(change.removed, "cell", "cells") + " removed");
			const toggle = el("button", { type: "button", class: "rule", "aria-expanded": "false" }, [
				el("span", { class: "chev", "aria-hidden": "true" }),
				el("strong", { text: change.rule }),
				facts.length ? el("span", { class: "facts", text: facts.join(", ") }) : null
			].filter(Boolean));
			const body = el("div", { class: "rule-body" }, [el("p", { class: "why", text: change.detail })]);
			body.hidden = true;
			toggle.addEventListener("click", function () {
				const open = !isShown(body);
				if (open)
					reveal(body);
				else
					conceal(body);
				toggle.setAttribute("aria-expanded", String(open));
			});
			if (change.examples.length > 0) {
				const pairs = el("ul", { class: "pairs" });
				change.examples.forEach(function (example, i) {
					const row = el("li", {}, [
						fragment(example.from, "(nothing)"),
						el("span", { class: "arrow", "aria-label": "becomes", text: "→" }),
						fragment(example.to, "(removed)")
					]);
					// Only a highlight was added: say why, since the words look the same
					if (example.from !== "" && plainOf(example.from) === plainOf(example.to) && /<mark>/.test(example.to))
						row.appendChild(el("span", { class: "times", text: "highlighted for you to explain" }));
					if (example.times > 1)
						row.appendChild(el("span", { class: "times", text: "×" + example.times }));
					if (i >= 6)
						row.hidden = true;
					pairs.appendChild(row);
				});
				body.appendChild(pairs);
				if (change.examples.length > 6) {
					const extra = change.examples.length - 6;
					const more = el("button", { type: "button", class: "more", "aria-expanded": "false", text: "Show " + extra + " more" });
					more.addEventListener("click", function () {
						const open = more.getAttribute("aria-expanded") !== "true";
						Array.from(pairs.children).forEach(function (row, i) {
							if (i < 6) return;
							if (open) reveal(row);
							else row.hidden = true;  // rows go at once, so the list doesn't jump twice
						});
						more.setAttribute("aria-expanded", String(open));
						more.textContent = open ? "Show less" : "Show " + extra + " more";
						if (!open && more.getBoundingClientRect().top < 0)
							body.scrollIntoView({ block: "nearest", behavior: state.reduced ? "auto" : "smooth" });
					});
					body.appendChild(more);
				}
			}
			list.appendChild(el("li", {}, [toggle, body]));
		}
		panel.appendChild(list);
		const hide = el("button", { type: "button", class: "btn quiet hide-changes", text: "Hide changes" });
		hide.addEventListener("click", function () {
			toggleChanges(item, false);
			item.changesButton.focus();
		});
		panel.appendChild(hide);
	}


	// Which to-do a highlighted spot belongs to, from where it sits in the table
	function spotKind(spot) {
		if (/Too wide/.test(spot.textContent)) return "landscape";
		if (spot.closest("table"))
			return /Add heading/i.test(spot.textContent) ? "heading" : "names";
		const para = spot.closest("p");
		const paras = para ? Array.from(para.parentNode.children).filter(function (n) { return n.tagName === "P"; }) : [];
		return para && paras[paras.length - 1] === para && paras.indexOf(para) > 1 ? "sample" : "title";
	}

	// Moves to the next highlighted spot of one kind (or any kind) in a table
	function flashHighlight(item, kind) {
		if (!state.highlights)
			setHighlights(true);
		const spots = Array.from(item.card.querySelectorAll(".paper [style*=\"#ffff00\"]"))
			.filter(function (s) { return !kind || spotKind(s) === kind; });
		if (spots.length === 0)
			return;
		item.spot = item.spotKind === kind ? ((item.spot === undefined ? -1 : item.spot) + 1) % spots.length : 0;
		item.spotKind = kind;
		const spot = spots[item.spot];
		// Scroll only if the spot is out of sight, and keep the help box above it in view
		const box = $id("tables");
		const view = box.getBoundingClientRect(), at = spot.getBoundingClientRect();
		if (at.top < view.top + 40 || at.bottom > view.bottom - 40)
			scrollTablesTo(box.scrollTop + at.top - view.top - box.clientHeight / 3);
		const tray = spot.closest(".tray");
		if (tray && tray.scrollWidth > tray.clientWidth)
			tray.scrollLeft += spot.getBoundingClientRect().left - tray.getBoundingClientRect().left - tray.clientWidth / 2;
		spot.classList.remove("flash");
		void spot.offsetWidth;
		spot.classList.add("flash");
	}

	// ---- Search and filter ----

	const filterNames = { all: "All", todo: "To copy", done: "Copied" };

	function applyFilter() {
		const query = state.query.trim().toLowerCase();
		const numberQuery = /^(table\s*)?(\d+)$/.exec(query);  // "table 1" or "1" means Table 1, not 10 and 11
		let shown = 0;
		for (const group of state.groups) {
			let groupShown = 0;
			for (const item of group.items) {
				const copied = copyState(item) === "ok";
				const inFilter = state.filter === "all" || (item.apa && !item.left && (state.filter === "done") === copied);
				// By number, by title, or (three letters or more) by a variable or label in the table ("adverts", "Welch")
				const inQuery = !query || (numberQuery ? item.number === +numberQuery[2]
					: (item.title + " " + item.rawTitle + " " + group.title).toLowerCase().indexOf(query) !== -1
					|| (query.length >= 3 && item.apa && searchText(item, group).indexOf(query) !== -1));
				const matches = inFilter && inQuery;
				if (matches && item.card.hidden) {
					replay(item.card, "enter");
					replay(item.link, "enter");
				}
				item.card.hidden = !matches;
				item.link.hidden = !matches;
				if (matches)
					groupShown++;
			}
			shown += groupShown;
			const details = group.items[0].link.parentNode;
			details.hidden = groupShown === 0;
			const heading = group.items[0].card.previousElementSibling;
			if (heading && heading.classList.contains("analysis-title"))
				heading.hidden = groupShown === 0;
		}
		let none = $id("noMatch");
		let sideNone = $id("sideNone");
		if (shown === 0 && state.groups.length > 0) {
			if (!none) {
				none = el("div", { class: "no-match", id: "noMatch" });
				$id("tables").appendChild(none);
			}
			none.textContent = "";
			const where = state.filter !== "all" ? " in " + filterNames[state.filter] : "";
			none.appendChild(el("p", { text: query ? "No table matches \u201c" + state.query.trim() + "\u201d" + where + "."
				: state.filter === "todo" ? "Every table is copied." : "No table copied yet. Copy one with its Copy APA table button." }));
			const buttons = [];
			if (query) {
				const clear = el("button", { type: "button", class: "btn", text: "Clear search" });
				clear.addEventListener("click", clearSearch);
				buttons.push(clear);
			}
			if (state.filter !== "all") {
				const all = el("button", { type: "button", class: "btn", text: "Show all tables" });
				all.addEventListener("click", function () { state.filter = "all"; applyFilter(); });
				buttons.push(all);
			}
			if (buttons.length)
				none.appendChild(el("div", { class: "no-match-actions" }, buttons));
			if (!sideNone) {
				sideNone = el("p", { class: "none", id: "sideNone" });
				$id("side").appendChild(sideNone);
			}
			sideNone.textContent = query ? "No table matches." : "No tables here.";
		}
		else {
			if (none) none.remove();
			if (sideNone) sideNone.remove();
		}
		for (const button of document.querySelectorAll("[data-filter]"))
			button.setAttribute("aria-checked", String(button.dataset.filter === state.filter));
		$id("searchClear").hidden = !state.query;
		rove();
		updateMenu();
	}

	// The words in a table (labels and headings, not numbers) and its analysis's variables, for search
	function searchText(item, group) {
		if (item.searchText === undefined)
			item.searchText = (item.apa.text.split("\n").slice(2).join(" ").replace(/[-−]?\d[\d.,]*/g, " ") + " " + (group.variables || []).join(" ")).toLowerCase();
		return item.searchText;
	}

	function clearSearch() {
		search.value = "";
		state.query = "";
		applyFilter();
	}

	function visibleItems() {
		const out = [];
		for (const group of state.groups)
			for (const item of group.items)
				if (!item.card.hidden)
					out.push(item);
		return out;
	}

	// ---- The current table (keyboard target), followed while scrolling ----

	let observer = null;
	function watchCurrent() {
		if (observer)
			observer.disconnect();
		if (!window.IntersectionObserver)
			return;
		let suppressUntil = 0;
		observer = new IntersectionObserver(function (entries) {
			if (Date.now() < suppressUntil)
				return;
			const top = entries.filter(function (e) { return e.isIntersecting; })
				.sort(function (a, b) { return a.boundingClientRect.top - b.boundingClientRect.top; })[0];
			if (top)
				setCurrent(top.target.id, true);
		}, { root: $id("tables"), rootMargin: "0px 0px -70% 0px", threshold: 0 });
		for (const group of state.groups)
			for (const item of group.items)
				observer.observe(item.card);
		watchCurrent.pause = function () { suppressUntil = Date.now() + 800; };
	}

	function itemById(id) {
		for (const group of state.groups)
			for (const item of group.items)
				if (item.id === id)
					return item;
		return null;
	}

	// Only the old and the new table change, so following the scroll costs almost nothing
	let shownCurrent = null;
	function setCurrent(id, fromScroll) {
		state.current = id;
		const item = itemById(id);
		if (shownCurrent === item)
			return;
		if (shownCurrent) {
			shownCurrent.card.classList.remove("current");
			shownCurrent.link.classList.remove("current");
		}
		shownCurrent = item;
		if (item) {
			item.card.classList.add("current");
			item.link.classList.add("current");
			if (fromScroll)
				keepLinkInView(item.link);
		}
	}

	// Scrolls the sidebar (not the page) just enough to show a link
	function keepLinkInView(link) {
		const list = $id("side");
		const top = link.offsetTop - list.offsetTop, bottom = top + link.offsetHeight;
		if (top < list.scrollTop + 8)
			list.scrollTop = top - 8;
		else if (bottom > list.scrollTop + list.clientHeight - 24)
			list.scrollTop = bottom - list.clientHeight + 24;
	}

	// Eased scrolling, one step per frame. The engine's own smooth scrolling is jumpy in WebKitGTK.
	let scrollAnimation = 0;
	function scrollTablesTo(target) {
		const box = $id("tables");
		target = Math.max(0, Math.min(target, box.scrollHeight - box.clientHeight));
		cancelAnimationFrame(scrollAnimation);
		const from = box.scrollTop, distance = target - from;
		if (state.reduced || Math.abs(distance) < 2) {
			box.scrollTop = target;
			return;
		}
		const duration = Math.min(560, 260 + Math.abs(distance) * 0.12);
		const start = performance.now();
		const ease = function (x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
		const frame = function (now) {
			const p = Math.min(1, (now - start) / duration);
			box.scrollTop = from + distance * ease(p);
			if (p < 1)
				scrollAnimation = requestAnimationFrame(frame);
		};
		scrollAnimation = requestAnimationFrame(frame);
	}

	function goTo(id) {
		const node = $id(id);
		if (!node)
			return;
		if (watchCurrent.pause)
			watchCurrent.pause();
		setCurrent(id);
		const box = $id("tables");
		scrollTablesTo(box.scrollTop + node.getBoundingClientRect().top - box.getBoundingClientRect().top - 4);
	}

	function step(delta) {
		const items = visibleItems();
		if (items.length === 0)
			return;
		const at = items.findIndex(function (i) { return i.id === state.current; });
		const next = items[Math.max(0, Math.min(items.length - 1, at + delta))];
		goTo(next.id);
		keepLinkInView(next.link);
	}

	function currentItem() {
		for (const group of state.groups)
			for (const item of group.items)
				if (item.id === state.current && !item.card.hidden)
					return item;
		return visibleItems()[0] || null;
	}

	// ---- Clipboard ----

	function copyRaw(html, text) {
		if (tauri)
			return html === null ? tauri.core.invoke("copy_text", { text: text }) : tauri.core.invoke("copy_apa", { html: html, text: text });
		// Browser: a copy event can carry both HTML and plain text
		return new Promise(function (resolve, reject) {
			let done = false;
			const handler = function (e) {
				if (html !== null)
					e.clipboardData.setData("text/html", html);
				e.clipboardData.setData("text/plain", text);
				e.preventDefault();
				done = true;
			};
			document.addEventListener("copy", handler);
			try { document.execCommand("copy"); } finally { document.removeEventListener("copy", handler); }
			done ? resolve() : reject(new Error("the browser refused"));
		});
	}

	function markCopied(item) {
		state.copied.set(item.key, { n: item.number, h: contentHash(item) });
		saveCopied();
		updateMark(item);
		replay(item.link.querySelector(".mark"), "pop-in");
		updateCardState(item);
		updateProgress();
		// In the "To copy" view, a copied table leaves the list once the button has said "Copied"
		if (state.filter === "todo") {
			clearTimeout(markCopied.refilter);
			markCopied.refilter = setTimeout(applyFilter, 1400);
		}
	}

	// Blurs the button's label out, swaps it, and blurs the new one in
	function swapLabel(button, content, during) {
		const label = button.querySelector(".swap");
		label.classList.add("out");
		setTimeout(function () {
			label.textContent = "";
			for (const part of content)
				label.appendChild(typeof part === "string" ? document.createTextNode(part) : part);
			if (during) during();
			label.classList.remove("out");
		}, 140);
	}

	function copyItem(item, asText) {
		if (!item || !item.apa)
			return;
		setCurrent(item.id);
		copyRaw(asText ? null : apaClipboardHTML(item.apa.html), item.apa.text).then(function () {
			markCopied(item);
			const button = item.button;
			if (!asText && button) {
				swapLabel(button, [tick(), "Copied"], function () { button.classList.remove("primary"); button.classList.add("done"); });
				clearTimeout(button.back);
				button.back = setTimeout(function () {
					swapLabel(button, ["Copy APA table"], function () { button.classList.add("primary"); button.classList.remove("done"); });
				}, 2200);
			}
			const left = item.apa.todo.length;
			const name = item.number ? "Table " + item.number : "The table";
			toast(name + " copied" + (asText ? " as plain text" : "") + ". " + (left > 0 ? "Paste it into your document, then finish the " + highlightedParts(left) + "." : "Paste it into your document."));
		}, function (e) {
			toast("Couldn't copy: " + (e && e.message || e), true);
		});
	}

	function copyAll(asText) {
		const items = visibleItems().filter(function (i) { return i.apa && !i.left; });
		if (items.length === 0)
			return;
		const html = items.map(function (i) { return i.apa.html; }).join("<p>&nbsp;</p>");
		const text = items.map(function (i) { return i.apa.text; }).join("\n\n");
		copyRaw(asText ? null : apaClipboardHTML(html), text).then(function () {
			items.forEach(markCopied);
			const left = items.reduce(function (n, i) { return n + i.apa.todo.length; }, 0);
			toast(plural(items.length, "table", "tables") + " copied" + (asText ? " as plain text" : "") + ". " + (left > 0 ? "Paste them, then finish the " + highlightedParts(left) + "." : "Paste them into your document."));
		}, function (e) {
			toast("Couldn't copy: " + (e && e.message || e), true);
		});
	}

	// ---- Preview settings ----

	function setZoom(z) {
		state.zoom = Math.round(Math.max(0.6, Math.min(1.8, z)) * 10) / 10;
		settings.write("zoom", state.zoom);
		root.style.setProperty("--zoom", String(state.zoom));
		$id("zoomLabel").textContent = Math.round(state.zoom * 100) + "%";
	}

	// ---- Credit and feedback ----

	const links = {
		profile: "https://github.com/onetrickpony1",
		newIssue: "https://github.com/onetrickpony1/jAPAsp/issues/new"
	};

	// The app asks the system to open the page in the browser (only these GitHub pages); a plain browser opens a tab
	function openLink(url) {
		if (tauri)
			tauri.core.invoke("open_link", { url: url }).catch(function (e) { toast("Couldn't open the browser: " + e, true); });
		else
			window.open(url, "_blank", "noopener");
	}

	// A new GitHub issue from the feedback form (.github/ISSUE_TEMPLATE/feedback.yml), with the version and system filled in
	function openFeedback() {
		const info = tauri ? tauri.core.invoke("app_info") : Promise.resolve({ version: "browser", os: navigator.platform || "" });
		info.catch(function () { return { version: "", os: "" }; }).then(function (about) {
			const params = new URLSearchParams({ template: "feedback.yml", version: about.version || "", system: about.os || "" });
			openLink(links.newIssue + "?" + params.toString());
		});
	}

	document.addEventListener("click", function (e) {
		const button = e.target.closest(".side-foot [data-link]");
		if (button && button.dataset.link === "feedback")
			openFeedback();
		else if (button && button.dataset.link === "credit")
			openLink(links.profile);
	});

	// Narrow windows show the table list as a drawer over the tables, opened with the same button and B
	const narrowQuery = window.matchMedia("(max-width: 760px)");
	function isNarrow() { return narrowQuery.matches; }
	function setDrawer(open) {
		// The drawer starts under the title bar, which can wrap onto two rows in a narrow window
		if (open)
			root.style.setProperty("--drawer-top", Math.round(document.querySelector(".titlebar").getBoundingClientRect().bottom + 10) + "px");
		$id("layout").classList.toggle("drawer-open", open);
		if (isNarrow()) {
			$id("sidePanel").inert = !open;
			$id("sideButton").setAttribute("aria-expanded", String(open));
		}
		else
			$id("sidePanel").inert = !state.sidebar;
	}
	document.addEventListener("pointerdown", function (e) {
		if (isNarrow() && $id("layout").classList.contains("drawer-open") && !e.target.closest("#sidePanel, #sideButton"))
			setDrawer(false);
	});
	function toggleSidebar() {
		if (isNarrow())
			setDrawer(!$id("layout").classList.contains("drawer-open"));
		else
			setSidebar(!state.sidebar);
	}

	// One tab stop per radio group: the chosen option (arrow keys move within the group)
	function rove() {
		for (const group of document.querySelectorAll("[role=radiogroup]")) {
			const radios = Array.from(group.querySelectorAll("[role=radio]"));
			const chosen = radios.find(function (r) { return r.getAttribute("aria-checked") === "true"; }) || radios[0];
			for (const r of radios)
				r.tabIndex = r === chosen ? 0 : -1;
		}
	}

	// The table list on the left: shown, or folded away so the tables get the whole width
	function setSidebar(on) {
		state.sidebar = on;
		settings.write("sidebar", on);
		$id("layout").classList.toggle("side-hidden", !on);
		$id("sidePanel").inert = isNarrow() ? !$id("layout").classList.contains("drawer-open") : !on;
		const button = $id("sideButton");
		const label = on ? "Hide the table list" : "Show the table list";
		button.setAttribute("aria-expanded", String(on));
		button.setAttribute("aria-label", label);
		button.title = label + " (B)";
		button.classList.toggle("off", !on);
		showBarProgress();
	}

	function setHighlights(on) {
		state.highlights = on;
		settings.write("highlights", on);
		document.body.classList.toggle("hide-highlights", !on);
		$id("showHighlights").checked = on;
	}

	function updateMenu() {
		const any = !!state.file && visibleItems().length > 0;
		for (const button of document.querySelectorAll(".needs-file"))
			button.disabled = !any;
		const live = !!(state.autoReload && state.path);
		const sync = $id("reloadButton");
		sync.classList.toggle("live", live);
		sync.title = live ? "Watching for saves in JASP: the tables update by themselves. Click to reload now (Ctrl+R)."
			: state.path ? "Not watching for saves. Turn it on in ⋯ › Reload when JASP saves. Click to reload now (Ctrl+R)."
			: "Reload the file (Ctrl+R)";
		sync.setAttribute("aria-label", live ? "Reload the file (watching for saves)" : "Reload the file");
	}

	// ---- Opening files ----

	function remember(path) {
		state.recent = [path].concat(state.recent.filter(function (p) { return p !== path; })).slice(0, 8);
		settings.write("recent", state.recent);
		drawRecent();
	}

	function forget(path) {
		state.recent = state.recent.filter(function (p) { return p !== path; });
		settings.write("recent", state.recent);
		drawRecent();
	}

	// Back to the start screen
	function closeFile() {
		state.file = null;
		state.path = null;
		state.name = "";
		state.groups = [];
		state.copied = new Map();
		$id("tables").textContent = "";
		$id("side").textContent = "";
		$id("empty").hidden = false;
		$id("layout").hidden = true;
		$id("filePill").hidden = true;
		$id("sideButton").hidden = true;
		$id("searchWrap").hidden = true;
		$id("barProgress").hidden = true;
		$id("closeFile").hidden = true;
		$id("fileRule").hidden = true;
		$id("startNumber").disabled = true;
		$id("openButton").classList.add("primary");
		document.title = "jAPAsp";
		if (tauri && tauri.window && tauri.window.getCurrentWindow)
			tauri.window.getCurrentWindow().setTitle("jAPAsp").catch(function () {});
		drawRecent();
		updateMenu();
	}

	function drawRecent() {
		// The menu's "Open recent" list: the other recent files, so they can be reached with a file open
		const menuList = $id("menuRecentList");
		menuList.textContent = "";
		const others = state.recent.filter(function (p) { return p !== state.path; }).slice(0, 5);
		$id("menuRecent").hidden = !tauri || others.length === 0;
		for (const path of others) {
			const open = el("button", { type: "button", title: path }, [el("span", { text: baseName(path) }), el("small", { text: folderOf(path) })]);
			open.addEventListener("click", function () { toggleMenu(false); openPath(path); });
			menuList.appendChild(open);
		}
		const list = $id("recentList");
		list.textContent = "";
		$id("recent").hidden = !tauri || state.recent.length === 0;
		for (const path of state.recent) {
			const open = el("button", { type: "button", class: "open-recent", title: path }, [el("strong", { text: baseName(path) }), el("span", { text: folderOf(path) })]);
			open.addEventListener("click", function () { openPath(path); });
			const remove = el("button", { type: "button", class: "icon-btn forget", title: "Remove from this list", "aria-label": "Remove " + baseName(path) + " from recent files" }, [svgIcon(["M6 6l8 8M14 6l-8 8"])]);
			remove.addEventListener("click", function () { forget(path); });
			list.appendChild(el("li", {}, [open, remove]));
		}
	}

	function openPath(path, quiet) {
		return tauri.core.invoke("open_jasp", { path: path }).then(function (file) {
			const same = state.path === path;
			state.path = path;
			if (same && state.file && quiet) {
				state.file = file;
				render();
			}
			else
				show(file, baseName(path));
			remember(path);
			return tauri.core.invoke("file_stamp", { path: path }).then(function (stamp) { state.stamp = stamp; });
		}, function (e) {
			if (quiet)
				throw e;  // reloads decide what to say, and must not report success
			if (state.recent.indexOf(path) !== -1 && !state.file) {
				forget(path);
				toast("Couldn't open " + baseName(path) + ": " + (e && e.message || e) + ". It's off your recent files.", true);
			}
			else
				toast("Couldn't open " + baseName(path) + ": " + (e && e.message || e), true);
		});
	}

	function spinSync() {
		const sync = $id("reloadButton");
		sync.classList.remove("spinning");
		void sync.offsetWidth;
		sync.classList.add("spinning");
		setTimeout(function () { sync.classList.remove("spinning"); }, 750);
	}

	function reload() {
		if (tauri && state.path)
			openPath(state.path, true).then(function () { spinSync(); toast("Reloaded " + state.name + "."); }, function (e) {
				toast("Couldn't reload " + state.name + ": " + (e && e.message || e) + ". The tables shown are from before.", true);
			});
		else if (state.file)
			toast("Reloading works in the app, where the file's location is known.");
	}

	let reloading = false, reloadFailures = 0;
	// Checks every 2 seconds whether JASP saved the file again
	setInterval(function () {
		if (!tauri || !state.path || !state.autoReload || document.hidden)
			return;
		if (reloading)
			return;
		tauri.core.invoke("file_stamp", { path: state.path }).then(function (stamp) {
			if (stamp && state.stamp && stamp !== state.stamp) {
				// JASP writes the file in steps: wait a moment so the reload reads the finished file. The stamp only
				// moves on after a good read (openPath sets it), so a failed read is tried again at the next check.
				reloading = true;
				setTimeout(function () {
					openPath(state.path, true).then(function () {
						reloadFailures = 0;
						spinSync();
						const stale = staleCount();
						toast("JASP saved " + state.name + ". Tables updated." + (stale > 0 ? " " + plural(stale, "copied table has", "copied tables have") + " changed: copy " + (stale === 1 ? "it" : "them") + " again." : ""));
					}, function (e) {
						reloadFailures++;
						if (reloadFailures === 3)
							toast("Couldn't read " + state.name + " after JASP saved it: " + (e && e.message || e) + ". The tables shown are from before. Still trying.", true);
					}).then(function () { reloading = false; });
				}, 600);
			}
		}, function () {});
	}, 2000);

	function openDialog() {
		if (tauri && tauri.dialog) {
			tauri.dialog.open({ multiple: false, filters: [{ name: "JASP files", extensions: ["jasp"] }] })
				.then(function (path) { if (path) openPath(path); }, function (e) { toast(String(e), true); });
			return;
		}
		$id("fileInput").click();
	}

	// Browser only: JSON dumps from `japasp --json`
	function openBrowserFile(file) {
		if (!/\.json$/i.test(file.name)) {
			toast("In a browser, open the JSON from `japasp --json FILE.jasp`. The app opens .jasp files directly.", true);
			return;
		}
		file.text().then(function (text) { state.path = null; show(JSON.parse(text), file.name); }).catch(function (e) { toast(String(e), true); });
	}

	// ---- Menu ----

	const menu = $id("menu");
	const menuButton = $id("menuButton");
	function toggleMenu(open) {
		const on = open === undefined ? !isShown(menu) : open;
		if (on)
			reveal(menu);
		else
			conceal(menu);
		menuButton.setAttribute("aria-expanded", String(on));
		if (on) {
			updateMenu();
			const first = menu.querySelector("button:not(:disabled), input");
			if (first)
				first.focus();
		}
	}
	menuButton.addEventListener("click", function (e) { e.stopPropagation(); toggleMenu(); });

	// The shortcuts window rises in (CSS) and sinks out: closing waits for the animation, then closes the dialog
	const keysDialog = $id("keys");
	function openKeys() {
		if (keysDialog.open)
			return;
		keysDialog.classList.remove("closing");
		keysDialog.showModal();
	}
	function closeKeys() {
		if (!keysDialog.open || keysDialog.classList.contains("closing"))
			return;
		if (state.reduced) {
			keysDialog.close();
			return;
		}
		keysDialog.classList.add("closing");
		let done = false;
		const finish = function () {
			if (done)
				return;
			done = true;
			keysDialog.classList.remove("closing");
			keysDialog.close();
		};
		keysDialog.addEventListener("animationend", finish, { once: true });
		setTimeout(finish, 260);  // in case no animation runs
	}
	keysDialog.addEventListener("cancel", function (e) { e.preventDefault(); closeKeys(); });  // Esc
	keysDialog.querySelector("form").addEventListener("submit", function (e) { e.preventDefault(); closeKeys(); });
	// A click on the dimmed backdrop closes it too
	keysDialog.addEventListener("click", function (e) { if (e.target === keysDialog) { const r = keysDialog.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) closeKeys(); } });
	// Tabbing out of the menu closes it, so it never stays open behind the focus
	menu.addEventListener("focusout", function (e) {
		if (e.relatedTarget && !menu.contains(e.relatedTarget) && e.relatedTarget !== menuButton)
			toggleMenu(false);
	});
	document.addEventListener("click", function (e) {
		if (isShown(menu) && !menu.contains(e.target))
			toggleMenu(false);
	});
	menu.addEventListener("click", function (e) {
		const action = e.target.closest("[data-action]");
		if (!action)
			return;
		const name = action.dataset.action;
		if (name === "copy-all") { copyAll(false); toggleMenu(false); }
		else if (name === "copy-all-text") { copyAll(true); toggleMenu(false); }
		else if (name === "zoom-in") setZoom(state.zoom + 0.1);
		else if (name === "zoom-out") setZoom(state.zoom - 0.1);
		else if (name === "shortcuts") { toggleMenu(false); openKeys(); }
		else if (name === "close-file") { toggleMenu(false); closeFile(); }
		else if (name === "feedback") { toggleMenu(false); openFeedback(); }
		else if (name === "credit") { toggleMenu(false); openLink(links.profile); }
	});
	$id("startNumber").addEventListener("change", function () {
		const n = Math.max(1, Math.min(999, parseInt(this.value, 10) || 1));
		this.value = String(n);
		saveFileSettings({ start: n });  // each file keeps its own first number
		if (state.file) {
			state.current = null;
			render();
			const stale = staleCount();
			toast("Tables now start at Table " + n + "." + (stale > 0 ? " " + plural(stale, "copied table has", "copied tables have") + " a new number: copy " + (stale === 1 ? "it" : "them") + " again." : ""));
		}
	});
	$id("showHighlights").addEventListener("change", function () { setHighlights(this.checked); });
	$id("singleKeys").addEventListener("change", function () { state.singleKeys = this.checked; settings.write("singleKeys", this.checked); });
	$id("reduceEffects").addEventListener("change", function () {
		state.reduced = this.checked;
		settings.write("reduced", this.checked);
		root.classList.toggle("reduced", this.checked);
	});
	$id("autoReload").addEventListener("change", function () {
		state.autoReload = this.checked;
		settings.write("autoReload", this.checked);
		updateMenu();
	});

	// ---- Wiring ----

	for (const button of document.querySelectorAll("[data-theme-choice]"))
		button.addEventListener("click", function () { setTheme(this.dataset.themeChoice); });
	for (const button of document.querySelectorAll("[data-icon-choice]"))
		button.addEventListener("click", function () {
			state.appIcon = this.dataset.iconChoice;
			settings.write("appIcon", state.appIcon);
			applyIcon();
		});
	for (const button of document.querySelectorAll("[data-filter]"))
		button.addEventListener("click", function () { state.filter = this.dataset.filter; applyFilter(); });

	const search = $id("search");
	search.addEventListener("input", function () { state.query = this.value; applyFilter(); });
	search.addEventListener("keydown", function (e) {
		if (e.key === "Enter") {
			const first = visibleItems()[0];
			if (first) goTo(first.id);
		}
	});

	$id("openButton").addEventListener("click", openDialog);
	$id("openButton2").addEventListener("click", openDialog);
	$id("reloadButton").addEventListener("click", reload);
	$id("fileInput").addEventListener("change", function () {
		if (this.files[0])
			openBrowserFile(this.files[0]);
		this.value = "";
	});

	document.addEventListener("keydown", function (e) {
		const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
		const mod = e.ctrlKey || e.metaKey;
		const key = e.key;

		if ($id("keys").open) {
			// F1 (or ?) again closes it, like Esc; the window handles its other keys
			if (key === "F1" || (key === "?" && state.singleKeys)) { e.preventDefault(); closeKeys(); }
			return;
		}
		if (key === "Escape") {
			if (isShown(menu)) { toggleMenu(false); menuButton.focus(); return; }
			if (isNarrow() && $id("layout").classList.contains("drawer-open")) { setDrawer(false); return; }
			if (state.query) { clearSearch(); search.blur(); return; }
			if (typing) e.target.blur();
			return;
		}
		if (mod && (key === "o" || key === "O")) { e.preventDefault(); openDialog(); return; }
		if ((mod && (key === "r" || key === "R")) || key === "F5") { e.preventDefault(); reload(); return; }
		if (mod && (key === "f" || key === "F")) { if (state.file) { e.preventDefault(); search.focus(); search.select(); } return; }
		if (mod && (key === "=" || key === "+")) { e.preventDefault(); setZoom(state.zoom + 0.1); return; }
		if (mod && (key === "-" || key === "_")) { e.preventDefault(); setZoom(state.zoom - 0.1); return; }
		if (mod && key === "0") { e.preventDefault(); setZoom(1); return; }
		// F1 works on every keyboard and even while typing; "?" (Shift and /) stays for those used to it
		if (key === "F1" || (key === "?" && !typing && !mod && state.singleKeys)) { e.preventDefault(); openKeys(); return; }
		if (typing || mod || e.altKey || !state.file || !state.singleKeys)
			return;
		if (key === "/") { e.preventDefault(); search.focus(); }
		else if (key === "j" || key === "J") step(-1);
		else if (key === "k" || key === "K") step(1);
		else if (key === "C" && e.shiftKey) copyAll(false);
		else if (key === "c" || key === "C") copyItem(currentItem(), false);  // C without Shift is Caps Lock
		else if (key === "t" || key === "T") copyItem(currentItem(), true);
		else if (key === "w" || key === "W") toggleChanges(currentItem(), undefined, true);
		else if (key === "b" || key === "B") toggleSidebar();
		else if (key === "h" || key === "H") { setHighlights(!state.highlights); toast(state.highlights ? "Highlights shown in the preview." : "Highlights hidden in the preview. Copies still have them."); }
	});

	// Dropping files
	if (tauri) {
		// Drag and drop gives file paths through Tauri
		tauri.webview.getCurrentWebview().onDragDropEvent(function (event) {
			const type = event.payload.type;
			document.body.classList.toggle("dragging", type === "enter" || type === "over");
			if (type === "drop" && event.payload.paths.length > 0) {
				const path = event.payload.paths.find(function (p) { return /\.jasp$/i.test(p); });
				if (path)
					openPath(path);
				else
					toast("That isn't a JASP file. Drop a file ending in .jasp.", true);
			}
		});
		tauri.core.invoke("initial_file").then(function (path) { if (path) openPath(path); }, function () {});
	}
	else {
		document.addEventListener("dragover", function (e) { e.preventDefault(); document.body.classList.add("dragging"); });
		document.addEventListener("dragleave", function (e) { if (!e.relatedTarget) document.body.classList.remove("dragging"); });
		document.addEventListener("drop", function (e) {
			e.preventDefault();
			document.body.classList.remove("dragging");
			if (e.dataTransfer.files[0])
				openBrowserFile(e.dataTransfer.files[0]);
		});
	}

	// Start-up
	applyTheme();
	setZoom(state.zoom);
	setHighlights(state.highlights);
	setSidebar(state.sidebar);
	$id("sideButton").addEventListener("click", toggleSidebar);
	$id("searchClear").addEventListener("click", function () { clearSearch(); search.focus(); });
	if (narrowQuery.addEventListener)
		narrowQuery.addEventListener("change", function () { setDrawer(false); });
	document.addEventListener("keydown", function (e) {
		// Arrow keys move between the choices of a radio group (themes, filters, app icon)
		const radio = e.target.closest && e.target.closest("[role=radio]");
		if (!radio || !/^Arrow(Left|Right|Up|Down)$/.test(e.key))
			return;
		const group = Array.from(radio.closest("[role=radiogroup]").querySelectorAll("[role=radio]"));
		const next = group[(group.indexOf(radio) + (/Left|Up/.test(e.key) ? -1 : 1) + group.length) % group.length];
		e.preventDefault();
		e.stopPropagation();
		next.click();
		next.focus();
	}, true);
	$id("autoReload").checked = state.autoReload;
	$id("singleKeys").checked = state.singleKeys;
	$id("barProgress").addEventListener("click", function () { if (isNarrow()) setDrawer(true); else setSidebar(true); });
	$id("reduceEffects").checked = state.reduced;
	$id("startNumber").value = String(fileSettings().start);
	drawRecent();
	updateMenu();
	requestAnimationFrame(function () { requestAnimationFrame(function () { root.classList.add("started"); }); });

	window.japasp = { build: build, show: show };
})();
