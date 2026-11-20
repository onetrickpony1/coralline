// Runs before the page is drawn, so the saved theme shows from the first frame (no light flash in dark mode).
// The CSP forbids inline scripts, hence this small file.
(function () {
	var theme = "system";
	try { theme = JSON.parse(localStorage.getItem("japasp.theme")) || "system"; } catch (e) { /* storage off */ }
	if (theme === "system")
		theme = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
	document.documentElement.setAttribute("data-theme", theme);
	// "Reduce effects": the saved choice, or the system's wish for less motion or transparency
	var reduced = null;
	try { reduced = JSON.parse(localStorage.getItem("japasp.reduced")); } catch (e) { /* storage off */ }
	if (reduced === null)
		reduced = !!(window.matchMedia && (window.matchMedia("(prefers-reduced-motion: reduce)").matches || window.matchMedia("(prefers-reduced-transparency: reduce)").matches));
	if (reduced)
		document.documentElement.classList.add("reduced");
})();
