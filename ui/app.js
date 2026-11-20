// jAPAsp: shows every table of a saved JASP file as an APA 7 table, with a copy button for each.
// The tables are drawn by JASP's own code (vendor/jasp), so they match what JASP shows, and the APA copy is
// JASP's "Copy APA Table" code. In the app, Rust reads the file and puts the copy on the clipboard. In a plain
// browser (for tests), a JSON dump from `japasp-tool --json` can be opened instead.
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
		copied: new Set(),   // table numbers copied this session
		theme: settings.read("theme", "system"),
		zoom: settings.read("zoom", 1),
		highlights: settings.read("highlights", true),
		autoReload: settings.read("autoReload", true),
		start: settings.read("start", 1),
		reduced: root.classList.contains("reduced"),   // set by theme-boot.js before the first paint
		recent: settings.read("recent", [])
	};

	// ---- Building the APA tables ----

	function tableModels(analysis) {
		return analysis.tables
			.filter(function (t) { return t && t.schema && t.data && t.status !== "error"; })
			.map(function (t) { return new JASPWidgets.table(t); });
	}

	function plainTable(model) {
		const view = new JASPWidgets.tablePrimitive({ model: model });
		view.render();
		return view.$el.find("table").get(0);
	}

	// Returns [{ title, items: [{ number, title, apa | error }] }], numbering tables across the whole file
	function build(file, firstNumber) {
		let number = (firstNumber || 1) - 1;
		return file.analyses.map(function (analysis) {
			const models = tableModels(analysis);
			const plain = models.map(plainTable);
			const items = models.map(function (model, i) {
				number++;
				const item = { number: number, title: _apaPlain(model.get("title") || ""), model: model, plain: plain[i] };
				try {
					item.apa = buildAPATable(apaRenderTable(model), {
						title: model.get("title"),
						subtitle: model.get("subtitle"),
						footnotes: model.get("footnotes"),
						otherTables: plain.map(function (table, j) { return { table: table, title: models[j].get("title") }; })
							.filter(function (_, j) { return j !== i; }),
						dataSampleSize: analysis.sampleSize,  // counted from the saved data, used when the tables don't say
						variableNames: analysis.variables     // lets the first column be headed "Variable" when it lists them
					}, number);
				} catch (e) {
					item.error = String(e && e.message || e);
				}
				return item;
			});
			return { title: analysis.title || analysis.name || "Analysis", name: analysis.name, sampleSize: analysis.sampleSize, items: items };
		}).filter(function (group) { return group.items.length > 0; });
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
		state.copied.clear();
		const groups = render();
		$id("empty").hidden = true;
		$id("layout").hidden = false;
		$id("filePill").hidden = false;
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

		const groups = build(state.file, state.start);
		state.groups = groups;
		shownCurrent = null;
		const side = $id("side");
		side.textContent = "";
		tables.textContent = "";

		let count = 0, ready = 0;
		for (const group of groups) {
			const list = el("details", { open: "" }, [el("summary", {}, [el("span", { text: group.title }), el("span", { class: "count", text: String(group.items.length) })])]);
			side.appendChild(list);
			tables.appendChild(el("h2", { class: "analysis-title", text: group.title }));
			for (const item of group.items) {
				count++;
				const id = "table-" + item.number;
				const todo = item.apa ? item.apa.todo : [];
				const isReady = !item.error && todo.length === 0;
				if (isReady)
					ready++;
				item.id = id;
				item.ready = isReady;
				const link = el("a", { href: "#" + id, "data-id": id }, [
					el("span", { class: "n", text: String(item.number) }),
					el("span", { class: "t", text: item.title }),
					el("span", { class: "state" + (item.error ? " error" : isReady ? " ready" : ""), title: item.error ? "Couldn't convert" : isReady ? "Ready to paste" : plural(todo.length, "thing", "things") + " to add" })
				]);
				link.addEventListener("click", function (e) {
					e.preventDefault();
					goTo(id);
				});
				item.link = link;
				list.appendChild(link);
				item.card = card(item, id);
				tables.appendChild(item.card);
			}
		}
		if (count === 0) {
			tables.appendChild(el("p", { class: "no-match", text: "This file has no results tables. Run your analyses in JASP, save, and open the file again." }));
		}

		// Ready count and ring
		$id("readyCount").textContent = ready + " of " + count;
		const circumference = 113.1;
		$id("ringDone").style.strokeDashoffset = String(count === 0 ? circumference : circumference * (1 - ready / count));

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

	function card(item, id) {
		const head = el("header", { class: "card-head" }, [
			el("div", { class: "label" }, [el("span", { class: "num", text: "Table " + item.number }), el("span", { class: "t", text: item.title, title: item.title })])
		]);
		const node = el("article", { class: "card glass", id: id, "aria-label": "Table " + item.number + ", " + item.title }, [head]);
		if (item.error) {
			node.appendChild(el("div", { class: "error", text: "This table couldn't be converted: " + item.error }));
			return node;
		}

		const textButton = el("button", { type: "button", class: "btn", title: "Copy as plain text, with tabs between columns (T)", text: "Copy text" });
		const button = el("button", { type: "button", class: "btn primary", title: "Copy for Word or Google Docs (C)" }, [el("span", { class: "swap", text: "Copy APA table" })]);
		head.appendChild(el("div", { class: "actions" }, [textButton, button]));

		const paper = el("div", { class: "paper" });
		paper.innerHTML = item.apa.html;
		node.appendChild(el("div", { class: "tray" }, [paper]));

		const todo = item.apa.todo;
		if (todo.length > 0) {
			const chips = el("div", { class: "todo" }, [el("span", { class: "lead", text: "Still to add:" })]);
			for (const thing of todo) {
				const chip = el("button", { type: "button", title: "Show where", text: thing.charAt(0).toUpperCase() + thing.slice(1) });
				chip.addEventListener("click", function () { showHighlight(item); });
				chips.appendChild(chip);
			}
			node.appendChild(chips);
		}
		else
			node.appendChild(el("div", { class: "todo ready", text: "Nothing to add. Ready to paste." }));

		button.addEventListener("click", function () { copyItem(item, false); });
		textButton.addEventListener("click", function () { copyItem(item, true); });
		node.addEventListener("pointerdown", function () { setCurrent(id); });
		item.button = button;
		return node;
	}

	// Each click on a to-do chip moves to the next highlighted spot in that table
	function showHighlight(item) {
		if (!state.highlights)
			setHighlights(true);
		const spots = item.card.querySelectorAll(".paper [style*=\"#ffff00\"]");
		if (spots.length === 0)
			return;
		item.spot = ((item.spot === undefined ? -1 : item.spot) + 1) % spots.length;
		const spot = spots[item.spot];
		const box = $id("tables");
		scrollTablesTo(box.scrollTop + spot.getBoundingClientRect().top - box.getBoundingClientRect().top - box.clientHeight / 2);
		const tray = spot.closest(".tray");
		if (tray && tray.scrollWidth > tray.clientWidth)
			tray.scrollLeft += spot.getBoundingClientRect().left - tray.getBoundingClientRect().left - tray.clientWidth / 2;
		spot.classList.remove("flash");
		void spot.offsetWidth;
		spot.classList.add("flash");
	}

	// ---- Search and filter ----

	function applyFilter() {
		const query = state.query.trim().toLowerCase();
		let shown = 0;
		for (const group of state.groups) {
			let groupShown = 0;
			for (const item of group.items) {
				const matches = (state.filter === "all" || (state.filter === "ready") === item.ready) &&
					(!query || (item.title + " " + group.title + " table " + item.number).toLowerCase().indexOf(query) !== -1);
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
		if (shown === 0 && state.groups.length > 0) {
			if (!none) {
				none = el("p", { class: "no-match", id: "noMatch" });
				$id("tables").appendChild(none);
			}
			none.textContent = query ? "No table matches “" + state.query.trim() + "”." : state.filter === "todo" ? "Every table is ready to paste." : "No table is ready yet. Check the highlights in each one.";
		}
		else if (none)
			none.remove();
		for (const button of document.querySelectorAll("[data-filter]"))
			button.setAttribute("aria-checked", String(button.dataset.filter === state.filter));
		updateMenu();
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
		state.copied.add(item.number);
		if (!item.link.querySelector(".copied")) {
			const mark = tick();
			mark.setAttribute("class", "copied");
			item.link.insertBefore(mark, item.link.lastChild);
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
			toast("Table " + item.number + " copied" + (asText ? " as plain text" : "") + "." + (left > 0 ? " Fill in the " + plural(left, "highlight", "highlights") + " after pasting." : ""));
		}, function (e) {
			toast("Couldn't copy: " + (e && e.message || e), true);
		});
	}

	function copyAll(asText) {
		const items = visibleItems().filter(function (i) { return i.apa; });
		if (items.length === 0)
			return;
		const html = items.map(function (i) { return i.apa.html; }).join("<p>&nbsp;</p>");
		const text = items.map(function (i) { return i.apa.text; }).join("\n\n");
		copyRaw(asText ? null : apaClipboardHTML(html), text).then(function () {
			items.forEach(markCopied);
			const left = items.reduce(function (n, i) { return n + i.apa.todo.length; }, 0);
			toast(plural(items.length, "table", "tables") + " copied" + (asText ? " as plain text" : "") + "." + (left > 0 ? " " + plural(left, "highlight", "highlights") + " to fill in." : ""));
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
		$id("liveDot").classList.toggle("off", !(state.autoReload && state.path));
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

	function drawRecent() {
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
			if (!quiet && state.recent.indexOf(path) !== -1 && !state.file) {
				forget(path);
				toast("Couldn't open " + baseName(path) + ": " + (e && e.message || e) + ". It's off your recent files.", true);
			}
			else if (!quiet)
				toast("Couldn't open " + baseName(path) + ": " + (e && e.message || e), true);
		});
	}

	function reload() {
		if (tauri && state.path)
			openPath(state.path, true).then(function () { toast("Reloaded " + state.name + "."); });
		else if (state.file)
			toast("Reloading works in the app, where the file's location is known.");
	}

	// Checks every 2 seconds whether JASP saved the file again
	setInterval(function () {
		if (!tauri || !state.path || !state.autoReload || document.hidden)
			return;
		tauri.core.invoke("file_stamp", { path: state.path }).then(function (stamp) {
			if (stamp && state.stamp && stamp !== state.stamp) {
				state.stamp = stamp;
				// JASP writes the file in steps: wait a moment so the reload reads the finished file
				setTimeout(function () {
					openPath(state.path, true).then(function () { toast("JASP saved " + state.name + ". Tables updated."); });
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

	// Browser only: JSON dumps from `japasp-tool --json`
	function openBrowserFile(file) {
		if (!/\.json$/i.test(file.name)) {
			toast("In a browser, open the JSON from `japasp-tool --json FILE.jasp`. The app opens .jasp files directly.", true);
			return;
		}
		file.text().then(function (text) { state.path = null; show(JSON.parse(text), file.name); }).catch(function (e) { toast(String(e), true); });
	}

	// ---- Menu ----

	const menu = $id("menu");
	const menuButton = $id("menuButton");
	function toggleMenu(open) {
		const on = open === undefined ? menu.hidden : open;
		menu.hidden = !on;
		menuButton.setAttribute("aria-expanded", String(on));
		if (on) {
			updateMenu();
			const first = menu.querySelector("button:not(:disabled), input");
			if (first)
				first.focus();
		}
	}
	menuButton.addEventListener("click", function (e) { e.stopPropagation(); toggleMenu(); });
	document.addEventListener("click", function (e) {
		if (!menu.hidden && !menu.contains(e.target))
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
		else if (name === "shortcuts") { toggleMenu(false); $id("keys").showModal(); }
	});
	$id("startNumber").addEventListener("change", function () {
		const n = Math.max(1, Math.min(999, parseInt(this.value, 10) || 1));
		this.value = String(n);
		state.start = n;
		settings.write("start", n);
		if (state.file) {
			state.current = null;
			render();
			toast("Tables now start at Table " + n + ".");
		}
	});
	$id("showHighlights").addEventListener("change", function () { setHighlights(this.checked); });
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

		if (key === "Escape") {
			if (!menu.hidden) { toggleMenu(false); menuButton.focus(); return; }
			if (state.query) { search.value = ""; state.query = ""; applyFilter(); search.blur(); return; }
			if (typing) e.target.blur();
			return;
		}
		if (mod && (key === "o" || key === "O")) { e.preventDefault(); openDialog(); return; }
		if ((mod && (key === "r" || key === "R")) || key === "F5") { e.preventDefault(); reload(); return; }
		if (mod && (key === "f" || key === "F")) { if (state.file) { e.preventDefault(); search.focus(); search.select(); } return; }
		if (mod && (key === "=" || key === "+")) { e.preventDefault(); setZoom(state.zoom + 0.1); return; }
		if (mod && (key === "-" || key === "_")) { e.preventDefault(); setZoom(state.zoom - 0.1); return; }
		if (mod && key === "0") { e.preventDefault(); setZoom(1); return; }
		if (typing || mod || e.altKey || !state.file)
			return;
		if (key === "/") { e.preventDefault(); search.focus(); }
		else if (key === "j" || key === "J") step(1);
		else if (key === "k" || key === "K") step(-1);
		else if (key === "C" && e.shiftKey) copyAll(false);
		else if (key === "c") copyItem(currentItem(), false);
		else if (key === "t" || key === "T") copyItem(currentItem(), true);
		else if (key === "h" || key === "H") { setHighlights(!state.highlights); toast(state.highlights ? "Highlights shown in the preview." : "Highlights hidden in the preview. Copies still have them."); }
		else if (key === "?") $id("keys").showModal();
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
	$id("autoReload").checked = state.autoReload;
	$id("reduceEffects").checked = state.reduced;
	$id("startNumber").value = String(state.start);
	drawRecent();
	updateMenu();
	requestAnimationFrame(function () { requestAnimationFrame(function () { root.classList.add("started"); }); });

	window.japasp = { build: build, show: show };
})();
