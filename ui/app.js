// jAPAsp: shows every table of a saved JASP file as an APA 7 table, with a copy button for each.
// The tables are drawn by JASP's own code (vendor/jasp), so they match what JASP shows, and the APA copy is
// JASP's "Copy APA Table" code. In the app, Rust reads the file and puts the copy on the clipboard. In a plain
// browser (for tests), a JSON dump from `japasp-tool --json` can be opened instead.
(function () {
	"use strict";

	window.globSet = { decimals: "", pExact: false, normalizedNotation: true };

	const tauri = window.__TAURI__;
	const $id = function (id) { return document.getElementById(id); };

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
	function build(file) {
		let number = 0;
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

	// ---- Showing them ----

	function el(tag, attrs, children) {
		const node = document.createElement(tag);
		for (const key in attrs || {}) {
			if (key === "text")
				node.textContent = attrs[key];
			else
				node.setAttribute(key, attrs[key]);
		}
		for (const child of children || [])
			node.appendChild(child);
		return node;
	}

	function show(file, name) {
		const groups = build(file);
		const side = $id("side");
		const tables = $id("tables");
		side.textContent = "";
		tables.textContent = "";
		$id("fileName").textContent = name || "";

		let count = 0;
		for (const group of groups) {
			side.appendChild(el("h2", { text: group.title }));
			tables.appendChild(el("h2", { class: "analysis-title", text: group.title }));
			for (const item of group.items) {
				count++;
				const id = "table-" + item.number;
				const todo = item.apa ? item.apa.todo : [];
				side.appendChild(el("a", { href: "#" + id }, [
					el("span", { class: "n", text: String(item.number) }),
					el("span", { class: "t", text: item.title }),
					el("span", { class: "dot" + (todo.length === 0 && !item.error ? " done" : ""), title: todo.length === 0 ? "Nothing to add" : todo.length + " to add" })
				]));
				tables.appendChild(card(item, id));
			}
		}
		if (count === 0) {
			tables.appendChild(el("p", { class: "error", text: "This file has no results tables. Run your analyses in JASP and save the file again." }));
			side.textContent = "";
		}
		$id("empty").hidden = true;
		$id("layout").hidden = false;
		tables.scrollTop = 0;
		return groups;
	}

	function card(item, id) {
		const button = el("button", { type: "button", class: "primary", text: "Copy APA table" });
		const head = el("div", { class: "card-head" }, [
			el("div", { class: "label" }, [document.createTextNode("Table " + item.number + " "), el("span", { text: item.title })]),
		]);
		const node = el("article", { class: "card", id: id }, [head]);
		if (item.error) {
			node.appendChild(el("div", { class: "error", text: "This table couldn't be converted: " + item.error }));
			return node;
		}
		head.appendChild(button);
		const paper = el("div", { class: "paper" });
		paper.innerHTML = item.apa.html;
		node.appendChild(paper);

		if (item.apa.todo.length > 0) {
			const list = el("ul");
			for (const thing of item.apa.todo)
				list.appendChild(el("li", { text: thing.charAt(0).toUpperCase() + thing.slice(1) }));
			node.appendChild(el("div", { class: "todo" }, [el("h3", { text: "Still to do (highlighted in the pasted table)" }), list]));
		}
		else
			node.appendChild(el("div", { class: "todo none", text: "Nothing to add. The table is ready to paste." }));

		button.addEventListener("click", function () {
			copy(item.apa).then(function () {
				button.textContent = "Copied";
				button.classList.add("copied");
				toast("Table " + item.number + " copied. Paste it into Word or Google Docs.");
				setTimeout(function () { button.textContent = "Copy APA table"; button.classList.remove("copied"); }, 2500);
			}, function (e) {
				toast("Couldn't copy: " + (e && e.message || e));
			});
		});
		return node;
	}

	let toastTimer = null;
	function toast(message) {
		const node = $id("toast");
		node.textContent = message;
		node.classList.add("show");
		clearTimeout(toastTimer);
		toastTimer = setTimeout(function () { node.classList.remove("show"); }, 3500);
	}

	// ---- Clipboard ----

	function copy(apa) {
		const html = apaClipboardHTML(apa.html);
		if (tauri)
			return tauri.core.invoke("copy_apa", { html: html, text: apa.text });
		// Browser: a copy event can carry both HTML and plain text
		return new Promise(function (resolve, reject) {
			let done = false;
			const handler = function (e) {
				e.clipboardData.setData("text/html", html);
				e.clipboardData.setData("text/plain", apa.text);
				e.preventDefault();
				done = true;
			};
			document.addEventListener("copy", handler);
			try { document.execCommand("copy"); } finally { document.removeEventListener("copy", handler); }
			done ? resolve() : reject(new Error("the browser refused"));
		});
	}

	// ---- Opening files ----

	function failed(e) {
		toast(String(e && e.message || e));
	}

	function baseName(path) {
		return String(path).split(/[\\/]/).pop();
	}

	function openPath(path) {
		return tauri.core.invoke("open_jasp", { path: path })
			.then(function (file) { show(file, baseName(path)); }, failed);
	}

	function openDialog() {
		if (tauri && tauri.dialog) {
			tauri.dialog.open({ multiple: false, filters: [{ name: "JASP files", extensions: ["jasp"] }] })
				.then(function (path) { if (path) openPath(path); }, failed);
			return;
		}
		$id("fileInput").click();
	}

	// Browser only: JSON dumps from `japasp-tool --json`
	function openBrowserFile(file) {
		if (!/\.json$/i.test(file.name)) {
			toast("In a browser, open the JSON from `japasp-tool --json FILE.jasp`. The app opens .jasp files directly.");
			return;
		}
		file.text().then(function (text) { show(JSON.parse(text), file.name); }).catch(failed);
	}

	$id("openButton").addEventListener("click", openDialog);
	$id("openButton2").addEventListener("click", openDialog);
	$id("fileInput").addEventListener("change", function () {
		if (this.files[0])
			openBrowserFile(this.files[0]);
		this.value = "";
	});

	if (tauri) {
		// Drag and drop gives file paths through Tauri
		tauri.webview.getCurrentWebview().onDragDropEvent(function (event) {
			const type = event.payload.type;
			document.body.classList.toggle("dragging", type === "enter" || type === "over");
			if (type === "drop" && event.payload.paths.length > 0)
				openPath(event.payload.paths[0]);
		});
		tauri.core.invoke("initial_file").then(function (path) { if (path) openPath(path); }, failed);
	}
	else {
		document.addEventListener("dragover", function (e) { e.preventDefault(); document.body.classList.add("dragging"); });
		document.addEventListener("dragleave", function () { document.body.classList.remove("dragging"); });
		document.addEventListener("drop", function (e) {
			e.preventDefault();
			document.body.classList.remove("dragging");
			if (e.dataTransfer.files[0])
				openBrowserFile(e.dataTransfer.files[0]);
		});
	}

	window.japasp = { build: build, show: show };
})();
