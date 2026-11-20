// Runs before the page is drawn, so the saved theme shows from the first frame (no light flash in dark mode).
// The CSP forbids inline scripts, hence this small file.
(function () {
	var theme = "system";
	try { theme = JSON.parse(localStorage.getItem("japasp.theme")) || "system"; } catch (e) { /* storage off */ }
	if (theme === "system")
		theme = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
	document.documentElement.setAttribute("data-theme", theme);
})();
