var utilsTestResults = [];
var utilsTestPassed = 0;
var utilsTestFailed = 0;

function _reset() {
	setCurrentLocaleID('en', true);
	window.globSet.decimals = "";
	window.globSet.pExact = false;
	window.globSet.normalizedNotation = true;
}

function _assertEq(actual, expected, name) {
	var passed = actual === expected;
	var result = { test: name, passed: passed, actual: actual, expected: expected };
	if (passed) utilsTestPassed++; else utilsTestFailed++;
	utilsTestResults.push(result);
}

function _colVals(vals) {
	return vals.map(function(v) { return { content: v }; });
}

function _fmtCol(vals, type, format, html, combine, footnotes) {
	if (html === undefined) html = true;
	if (combine === undefined) combine = false;
	if (footnotes === undefined) footnotes = null;
	return formatColumn(_colVals(vals), type, format, false, combine, footnotes, html);
}

function _fmtOne(val, type, format, html) {
	return _fmtCol([val], type, format, html)[0].content;
}

var _TS = "&thinsp;";
var _MIN = "&minus;";

// ========== formatFixed ==========
function test_formatFixed() {
	_reset();
	var t = _assertEq;

	t(formatFixed(1.234, 2), "1.23", "formatFixed: 1.234 to 2 decimals");
	t(formatFixed(1.5, 3), "1.500", "formatFixed: 1.5 to 3 decimals pads zeros");
	t(formatFixed(0, 2), "0.00", "formatFixed: zero to 2 decimals");
	t(formatFixed(0, 0), "0", "formatFixed: zero to 0 decimals");
	t(formatFixed(-5.678, 3), "-5.678", "formatFixed: negative to 3 decimals");
	t(formatFixed(1.999, 2), "2.00", "formatFixed: rounding up to 2 decimals");
	t(formatFixed(1.2349, 3), "1.235", "formatFixed: round up last digit");
	t(formatFixed(9.999, 2), "10.00", "formatFixed: rounding carries over decimal");
	t(formatFixed(999.9999, 0), "1000", "formatFixed: rounding to 0 decimals");

	t(formatFixed(12345.678, 2, false, true), "12,345.68", "formatFixed: with thousands grouping");
	t(formatFixed(123456789.1, 1, false, true), "123,456,789.1", "formatFixed: large number grouping");
	t(formatFixed(12345.678, 2, false, false), "12345.68", "formatFixed: without thousands grouping");

	t(formatFixed(0.0001, 4), "0.0001", "formatFixed: small number 4 decimals");
	t(formatFixed(0.001, 3), "0.001", "formatFixed: exactly 3 decimals");
	t(formatFixed(0.25, 4), "0.2500", "formatFixed: fractional pads zeros");

	t(formatFixed(0.5, 2, true), ".50", "formatFixed: noZeroLead strips leading 0");
	t(formatFixed(0.05, 3, true), ".050", "formatFixed: noZeroLead .05");
	t(formatFixed(0.9999, 2, true), "1.00", "formatFixed: noZeroLead with rounding to 1 leaves 1");
	t(formatFixed(0.999, 0, true), "1", "formatFixed: noZeroLead rounding to 1 at 0 decimals");
	t(formatFixed(1.5, 2, true), "1.50", "formatFixed: noZeroLead no effect for >= 1");

	t(formatFixed(1.5, NaN), "2", "formatFixed: NaN digits defaults to 0");

	t(formatFixed(Infinity, 2), "∞", "formatFixed: Infinity");
	t(formatFixed(-Infinity, 2), "-∞", "formatFixed: -Infinity");
}

// ========== formatPrecision ==========
function test_formatPrecision() {
	_reset();
	var t = _assertEq;

	t(formatPrecision(1.234, 2), "1.2", "formatPrecision: 2 sig digits");
	t(formatPrecision(9.876, 3), "9.88", "formatPrecision: 3 sig digits rounds");
	t(formatPrecision(12345, 4), "12350", "formatPrecision: large, 4 sig digits");
	t(formatPrecision(12345, 4, false, true), "12,350", "formatPrecision: large with thousands");
	t(formatPrecision(0.001234, 2), "0.0012", "formatPrecision: very small 2 sig");
	t(formatPrecision(0.001234, 3), "0.00123", "formatPrecision: very small 3 sig");
	t(formatPrecision(999.9, 4), "999.9", "formatPrecision: boundary at 4 sig");
	t(formatPrecision(999.99, 3), "1000", "formatPrecision: rounding up across boundary");
	t(formatPrecision(1e-7, 2), "0.00000010", "formatPrecision: extremely small");
	t(formatPrecision(1e8, 3), "100000000", "formatPrecision: extremely large");
	t(formatPrecision(0.5, 2, true), ".50", "formatPrecision: noZeroLead strips leading 0");
	t(formatPrecision(0.0999, 2, true), ".10", "formatPrecision: noZeroLead with rounding-up");
}

// ========== formatPrecisionWithRespectForFixedDecimals ==========
function test_formatPrecisionWRFD() {
	_reset();
	var f = formatPrecisionWithRespectForFixedDecimals;
	var t = _assertEq;

	t(f(1.23456, 3, 4), "1.23", "formatPrecisionWRFD: sf=3 dp=4, sf wins");
	t(f(100.456, 3, 5), "100", "formatPrecisionWRFD: sf=3 dp=5, sf wins on large");
	t(f(0.1234, 5, 2), "0.12", "formatPrecisionWRFD: sf=5 dp=2, dp wins");
	t(f(12.3456, 6, 3), "12.346", "formatPrecisionWRFD: sf=6 dp=3 balanced");
	t(f(0.05, 4, 3), "0.050", "formatPrecisionWRFD: sf=4 dp=3");
	t(f(0.05, 4, 3, true), ".050", "formatPrecisionWRFD: sf=4 dp=3 noZeroLead");
	t(f(123.456, 4, NaN), "123.5", "formatPrecisionWRFD: NaN dp uses precision only");
}

// ========== formatMoney ==========
function test_formatMoney() {
	_reset();
	var t = _assertEq;

	setCurrentLocaleID('en', true);
	t(formatMoney('EUR', 1234.56), "€1,234.56", "formatMoney: EUR with decimals");
	t(formatMoney('EUR', 1000), "€1,000", "formatMoney: EUR integer strips trailing zeros");
	t(formatMoney('EUR', 0), "€0", "formatMoney: EUR zero strips trailing zeros");
	t(formatMoney('EUR', 1234567.89), "€1,234,567.89", "formatMoney: EUR large with grouping");
	t(formatMoney('USD', 1234.56), "$1,234.56", "formatMoney: USD");
	t(formatMoney('EUR', 1234.56, false), "€1,234.56", "formatMoney: EUR thousands=false but global true overrides");

	setCurrentLocaleID('en', false);
	t(formatMoney('EUR', 1234, false), "€1234", "formatMoney: EUR no grouping when both off");
	t(formatMoney('EUR', 1234, true), "€1,234", "formatMoney: EUR thousands=true overrides global off");
	t(formatMoney('EUR', 0, true), "€0", "formatMoney: EUR zero returns €0");
}

// ========== formatNumber ==========
function test_formatNumber() {
	_reset();
	var t = _assertEq;

	t(formatNumber(1234567), "1234567", "formatNumber: default no grouping");
	t(formatNumber(1234567, true), "1,234,567", "formatNumber: thousands=true");
	t(formatNumber(-1234.56, true), "-1,234.56", "formatNumber: negative with grouping");
	t(formatNumber(0), "0", "formatNumber: zero");
	t(formatNumber(0.12345), "0.123", "formatNumber: small decimal (default digits)");
}

// ========== handleNoZeroLead ==========
function test_handleNoZeroLead() {
	_reset();
	var t = _assertEq;

	t(handleNoZeroLead(0.5, "0.50", true), ".50", "handleNoZeroLead: strips leading zero");
	t(handleNoZeroLead(0.05, "0.05", true), ".05", "handleNoZeroLead: .05");
	t(handleNoZeroLead(0, "0.00", true), ".00", "handleNoZeroLead: zero");
	t(handleNoZeroLead(1.5, "1.50", true), "1.50", "handleNoZeroLead: >=1 no strip");
	t(handleNoZeroLead(-0.5, "-0.50", true), "-0.50", "handleNoZeroLead: negative no strip");
	t(handleNoZeroLead(0.5, "0.50", false), "0.50", "handleNoZeroLead: flag off no strip");
	t(handleNoZeroLead(0.9999, "1.00", true), "1.00", "handleNoZeroLead: rounded to 1 starts with 1 no strip");
}

// ========== toExponential ==========
function test_toExponential() {
	_reset();
	var t = _assertEq;

	window.globSet.normalizedNotation = true;
	t(toExponential(123456, 3, 0, true), "1.235&times;10<sup>+5</sup>", "toExponential: normalized html positive");
	t(toExponential(0.000123, 2, 0, true), "1.23&times;10<sup>" + _MIN + "4</sup>", "toExponential: normalized html negative exp");
	t(toExponential(1.5, 3, 0, true), "1.500&times;10<sup>+0</sup>", "toExponential: zero exponent");

	window.globSet.normalizedNotation = false;
	t(toExponential(123456, 3, 0, true), "1.235e+5", "toExponential: non-normalized html");
	t(toExponential(0.000123, 2, 0, false), "1.23e-4", "toExponential: non-normalized non-html");

	window.globSet.normalizedNotation = true;
	t(toExponential(-1234, 2, 0, true), _MIN + "1.23&times;10<sup>+3</sup>", "toExponential: negative number html");
	t(toExponential(-5.678, 2, 0, true), _MIN + "5.68&times;10<sup>+0</sup>", "toExponential: negative small absolute value");
}

// ========== formatCellforLaTeX ==========
function test_formatCellforLaTeX() {
	_reset();
	var t = _assertEq;

	t(formatCellforLaTeX('&nbsp;'), '', "formatCellforLaTeX: nbsp to empty");
	t(formatCellforLaTeX('42'), '$42$', "formatCellforLaTeX: number in math block");
	t(formatCellforLaTeX('hello'), 'hello', "formatCellforLaTeX: plain text passes through");
	t(formatCellforLaTeX('a<b'), 'a$<$b', "formatCellforLaTeX: less-than sign wrapped");
	t(formatCellforLaTeX('x<sup>2</sup>'), 'x$^{2}$', "formatCellforLaTeX: superscript handled");
	t(formatCellforLaTeX('H<sub>0</sub>'), 'H$_{0}$', "formatCellforLaTeX: subscript handled");
	t(formatCellforLaTeX('<em>text</em>'), '\\textit{text}', "formatCellforLaTeX: emphasis");
	t(formatCellforLaTeX('_underscore'), '\\_underscore', "formatCellforLaTeX: underscore escaped");
}

// ========== formatColumn: string type and null format ==========
function test_formatColumn_string() {
	_reset();
	var f = _fmtCol;
	var t = _assertEq;

	t(f(["hello"], "string", null)[0].content, "hello", "fmtCol: string type pass-through");
	t(f(["hello"], "string", null)[0]["class"], "text", "fmtCol: string type class text");
	t(f(["johndoe"], null, null)[0].content, "johndoe", "fmtCol: null type, null format pass-through");
	t(f(["a\u273Bb"], "string", null)[0].content, "a<small>\u273B</small>b", "fmtCol: string type asterisk wrapped in small");

	// combine
	var cells = _fmtCol(["a", "a", "b"], "string", null, true, true);
	t(cells[0].content, "a", "fmtCol: combine first occurrence shown");
	t(cells[1].content, "&nbsp;", "fmtCol: combine duplicate collapsed to nbsp");
	t(cells[2].content, "b", "fmtCol: combine different value shown");

	cells = _fmtCol(["a", "a"], "string", null, false, true);
	t(cells[0].content, "a", "fmtCol: combine html=false first");
	t(cells[1].content, " ", "fmtCol: combine html=false collapsed to space");
}

// ========== formatColumn: significance (sf) ==========
// Note: sf:N with dp:M uses minLSD for decimal alignment, NOT sig-fig rounding
function test_formatColumn_sigFig() {
	_reset();
	var fm = _fmtOne;
	var fc = _fmtCol;
	var t = _assertEq;

	// Column alignment with sf:4;dp:3 — mixed scales share the same minLSD=-3
	// sf:4;dp:3 with !fixDecimals: values with abs >= 10^sf go exponential, others use formatPrecision(sf)
	var cells = fc([15606, 1.234, 0.00123, -0.5], "number", "sf:4;dp:3");
	t(cells[0].content, "1.561&times;10<sup>+4</sup>", "fmtCol sf: sf:4;dp:3 large integer exponential (>=10^sf)");
	t(cells[1].content, "1.234", "fmtCol sf: sf:4;dp:3 normal decimal precision");
	t(cells[2].content, "0.001230", "fmtCol sf: sf:4;dp:3 very small sig-fig preserved");
	t(cells[3].content, _MIN + "0.5000", "fmtCol sf: sf:4;dp:3 negative sig-fig expanded");
	t(cells[0]["class"], "number", "fmtCol sf: class number");

	// Single-cell sf:4;dp:3 — minLSD computed from one value only
	t(fm(0.5, "number", "sf:4;dp:3"), "0.5000", "fmtCol sf: sf:4;dp:3 single cell sig-fig expanded");

	// Zero
	t(fm(0, "number", "sf:4;dp:3"), "0.000", "fmtCol sf: zero sf:4;dp:3");
	t(fm(0, "number", "sf:3;dp:1"), "0.0", "fmtCol sf: zero sf:3;dp:1");

	// Large number -> exponential
	t(fm(123456789, "number", "sf:3;dp:3"), "1.23&times;10<sup>+8</sup>", "fmtCol sf: large number exponential");

	// Very small number -> exponential
	t(fm(0.00005, "number", "sf:4;dp:3"), "5.000&times;10<sup>" + _MIN + "5</sup>", "fmtCol sf: very small exponential");

	// Thousands token enabled
	t(fm(12345.678, "number", "sf:4;dp:3;thousands"), "1.235&times;10<sup>+4</sup>", "fmtCol sf: thousands in format (>=10^sf → exponential)");

	// fixDecimals=true (globSet.decimals set)
	window.globSet.decimals = 3;
	t(fm(15606, "number", "sf:4"), "15606.000", "fmtCol sf: fixDecimals forces dp alignment");
	t(fm(1.234, "number", "sf:4"), "1.234", "fmtCol sf: fixDecimals normal value");
	window.globSet.decimals = "";

	// Negative minus replacement
	t(fm(-1.5, "number", "sf:4;dp:3"), _MIN + "1.500", "fmtCol sf: negative html has &minus; (sig-fig pads)");

	// Non-number content
	t(fc(["abc"], "number", "sf:4;dp:3")[0].content, "abc", "fmtCol sf: non-number string passes through");
	t(fc(["abc"], "number", "sf:4;dp:3")[0]["class"], "number", "fmtCol sf: non-number gets number class");

	// Various scales from debug.csv data
	t(fm(8.38e98, "number", "sf:3;dp:3"), "8.38&times;10<sup>+98</sup>", "fmtCol sf: 8.38e98 exponential");
	t(fm(1.7e-20, "number", "sf:3;dp:3"), "1.70&times;10<sup>" + _MIN + "20</sup>", "fmtCol sf: 1.7e-20 exponential");
	t(fm(18858693.53, "number", "sf:3;dp:3"), "1.89&times;10<sup>+7</sup>", "fmtCol sf: 18858693.53 -> exponential");
	t(fm(0.99122228, "number", "sf:4;dp:3"), "0.9912", "fmtCol sf: 0.99122228 4sf");
	t(fm(-1.953344972, "number", "sf:4;dp:3"), _MIN + "1.953", "fmtCol sf: -1.953344972 4sf sig-fig");
	t(fm(3.356094448, "number", "sf:4;dp:3"), "3.356", "fmtCol sf: 3.356094448 4sf");
	t(fm(-9.96e-100, "number", "sf:3;dp:3"), _MIN + "9.96&times;10<sup>" + _MIN + "100</sup>", "fmtCol sf: -9.96e-100");
	t(fm(1.28e-100, "number", "sf:3;dp:3"), "1.28&times;10<sup>" + _MIN + "100</sup>", "fmtCol sf: 1.28e-100");
	t(fm(0.008650772, "number", "sf:3;dp:3"), "0.00865", "fmtCol sf: 0.008650772 sf sig-fig");
	t(fm(0.042666202, "number", "sf:3;dp:3"), "0.0427", "fmtCol sf: 0.042666202 sf sig-fig");
}

// ========== formatColumn: decimalPoints (dp) ==========
function test_formatColumn_decimals() {
	_reset();
	var fm = _fmtOne;
	var t = _assertEq;

	t(fm(1.234, "number", "dp:3"), "1.234", "fmtCol dp: 3 decimals");
	t(fm(1.5, "number", "dp:3"), "1.500", "fmtCol dp: pads to 3 decimals");
	t(fm(1.999, "number", "dp:2"), "2.00", "fmtCol dp: rounding 2 decimals");
	t(fm(-5.678, "number", "dp:2"), _MIN + "5.68", "fmtCol dp: negative value uses &minus;");
	t(fm(15606, "number", "dp:3"), "15606.000", "fmtCol dp: integer with 3 decimals");
	t(fm(15606, "number", "dp:3", false), "15606.000", "fmtCol dp: 15606 dp:3 html=false");
	t(fm(0.0005, "number", "dp:3"), "0.001", "fmtCol dp: very small rounds to 0.001");
	t(fm(0, "number", "dp:2"), "0.00", "fmtCol dp: zero 2 decimals");
	t(fm(1234567.89, "number", "dp:1;thousands"), "1,234,567.9", "fmtCol dp: large 1 decimal thousands enabled");

	// Very small number with p: threshold — p is set so small values show threshold
	// 0.0005 < 0.01, shows actual p threshold → "< .0100" with noZeroLead
	t(fm(0.0005, "number", "p:0.01;dp:4"), "<&nbsp;.0100", "fmtCol dp: very small with p threshold");
}

// ========== formatColumn: percentage (pc) ==========
function test_formatColumn_percentage() {
	_reset();
	var fm = _fmtOne;
	var t = _assertEq;

	t(fm(0.5, "number", "pc"), "50.00" + _TS + "%", "fmtCol pc: 50% basic");
	t(fm(0.01, "number", "pc"), "1.00" + _TS + "%", "fmtCol pc: 1%");
	t(fm(0.9999, "number", "pc"), "99.99" + _TS + "%", "fmtCol pc: 99.99% near 100");
	t(fm(1.01, "number", "pc"), "101.00" + _TS + "%", "fmtCol pc: 101% over 100");
	t(fm(0.001, "number", "pc"), "0.10" + _TS + "%", "fmtCol pc: 0.1% small");
	t(fm(0.1234, "number", "pc:3"), "12.340" + _TS + "%", "fmtCol pc: 12.34% 3dp");
	t(fm(0.5, "number", "pc:0"), "50" + _TS + "%", "fmtCol pc: 50% 0dp");
	t(fm(15.0, "number", "pc;thousands"), "1,500.00" + _TS + "%", "fmtCol pc: 1500% with thousands");
	t(fm(0, "number", "pc"), "0.00" + _TS + "%", "fmtCol pc: 0%");
}

// ========== formatColumn: monetary ==========
function test_formatColumn_monetary() {
	_reset();
	var fm = _fmtOne;
	var t = _assertEq;

	setCurrentLocaleID('en', true);
	t(fm(1234.56, "number", "monetary:EUR"), "€1,234.56", "fmtCol monetary: EUR with decimal");
	t(fm(1000, "number", "monetary:EUR"), "€1,000", "fmtCol monetary: EUR integer");
	t(fm(1000234, "number", "monetary:EUR"), "€1,000,234", "fmtCol monetary: EUR large");

	setCurrentLocaleID('en', false);
	t(fm(1000234, "number", "monetary:EUR;thousands"), "€1,000,234", "fmtCol monetary: EUR thousands overrides global false");
	t(fm(1234, "number", "monetary:USD"), "$1234", "fmtCol monetary: USD with grouping off");

	var col = _fmtCol([1234], "number", "monetary:EUR");
	t(col[0]["class"], "monetary", "fmtCol monetary: class monetary");
}

// ========== formatColumn: p-value ==========
function test_formatColumn_pvalue() {
	_reset();
	var fm = _fmtOne;
	var fc = _fmtCol;
	var t = _assertEq;

	// dp-based p:0.01;dp:3 — decimalPoints path
	t(fm(0.9999, "number", "p:0.01;dp:3"), "1.000", "fmtCol pval dp: >=p formatted normally");
	t(fm(0.9, "number", "p:0.01;dp:3"), ".900", "fmtCol pval dp: >=p with noZeroLead");

	// < p threshold — shows actual p value with noZeroLead
	t(fm(0.005, "number", "p:0.01;dp:3"), "<&nbsp;.010", "fmtCol pval dp: < p threshold shows p");
	t(fm(0.0005, "number", "p:0.001;dp:3"), "<&nbsp;.001", "fmtCol pval dp: < p threshold p:0.001");
	t(fm(0.042, "number", "p:0.05;dp:3"), "<&nbsp;.050", "fmtCol pval dp: < .05 threshold shows .050");
	t(fm(0.12, "number", "p:0.05;dp:3"), ".120", "fmtCol pval dp: >= .05 no zero lead");

	// pExact=true forces sf=4 → sf-based formatting with exponential
	window.globSet.pExact = true;
	t(fm(0.05, "number", "p:0.01;dp:3"), "5.000&times;10<sup>" + _MIN + "2</sup>", "fmtCol pval: pExact forces exponential");
	window.globSet.pExact = false;

	// pExact + fixDecimals → also exponential
	window.globSet.pExact = true;
	window.globSet.decimals = 3;
	t(fm(0.05, "number", "p:0.01;dp:3"), "5.000&times;10<sup>" + _MIN + "2</sup>", "fmtCol pval: pExact+fixDecimals exponential");
	window.globSet.pExact = false;
	window.globSet.decimals = "";

	// sf-based p-value: sf:4 → significance path
	// 0.005 < p=0.01 → threshold display using formatPrecisionWRFD(0.01, 4, noZeroLead=true, ...)
	// noZeroLead gets passed as dp param → treated as dp=1 → "0.0"
	t(fm(0.005, "number", "p:0.01;sf:4;dp:3"), "<&nbsp;0.0", "fmtCol pval sf: < p threshold with sf");
	t(fm(0.05, "number", "p:0.01;sf:4;dp:3"), ".050", "fmtCol pval sf: >= p significance");
	// 0 < p=0.01 → goes to < p branch (check comes before ==0 check)
	t(fm(0, "number", "p:0.01;sf:4;dp:3"), "<&nbsp;0.0", "fmtCol pval sf: zero < p shows threshold");

	// p-value class
	t(fc([0.005], "number", "p:0.01;dp:3")[0]["class"], "p-value", "fmtCol pval: class p-value");
}

// ========== formatColumn: mixed type ==========
function test_formatColumn_mixed() {
	_reset();
	var t = _assertEq;

	var col = [{
		content: { value: 1.234, type: "number", format: "sf:4" }
	}, {
		content: { value: "hello", type: "string", format: null }
	}, {
		content: { value: 0.5, type: "number", format: "pc" }
	}];
	var result = formatColumn(col, "mixed", null, false, false, null, true);
	t(result.length, 3, "fmtCol mixed: returns correct length");
	t(result[2].content, "50.00" + _TS + "%", "fmtCol mixed: sub-percentage formatted");

	var nested = [{
		content: { value: { value: 1, type: "number", format: "dp:2" }, type: "mixed", format: null }
	}];
	t(formatColumn(nested, "mixed", null, false, false, null, true, true), "Error: nested mixed columns are not supported!", "fmtCol mixed: nested mixed error");
}

// ========== formatColumn: edge cases ==========
function test_formatColumn_edges() {
	_reset();
	var fm = _fmtOne;
	var fc = _fmtCol;
	var t = _assertEq;

	t(fm(undefined, "number", "dp:2"), ".", "fmtCol edge: undefined -> dot");
	t(fm(undefined, "string", null), ".", "fmtCol edge: undefined string -> dot");

	t(fm("", "number", "dp:2"), "&nbsp;", "fmtCol edge: empty string number -> nbsp");
	// Empty string in string type: parsed, combine check, falls to !isNumber → passes through as ""
	t(fm("", "string", null), "", "fmtCol edge: empty string string type passes through");

	// Approx (~)
	t(fm(1.5, "number", "dp:2;~"), "~" + _TS + "1.50", "fmtCol edge: approx dp");
	t(fm(1.5, "number", "sf:4;dp:3;~"), "~" + _TS + "1.500", "fmtCol edge: approx sf sig-fig");

	// Group markers
	var colWithGroups = [
		{ content: 1.0, isStartOfGroup: true },
		{ content: 2.0 },
		{ content: 3.0, isEndOfGroup: true }
	];
	var res = formatColumn(colWithGroups, "number", "dp:1", false, false, null, true);
	t(res[0]["class"].indexOf("new-group-row") !== -1, true, "fmtCol edge: start of group class");
	t(res[2]["class"].indexOf("last-group-row") !== -1, true, "fmtCol edge: end of group class");

	var colWithSub = [{ content: 1.0, isStartOfSubGroup: true }];
	res = formatColumn(colWithSub, "number", "dp:1", false, false, null, true);
	t(res[0]["class"].indexOf("new-sub-group-row") !== -1, true, "fmtCol edge: sub group class");

	// Footnotes
	var colWithFootnotes = [{ content: 1.23, footnotes: [0] }];
	res = formatColumn(colWithFootnotes, "number", "dp:2", false, false, ["my footnote"], true);
	t(res[0].footnotes[0], "ᵃ", "fmtCol edge: footnote symbol attached");

	// html=false (LaTeX path)
	t(fm(1.234, "number", "dp:2", false), "1.23", "fmtCol edge: html=false basic");
	// Single-cell sf:4;dp:3 html=false: 15606 >= 10^4 → exponential
	t(fm(15606, "number", "sf:4;dp:3", false), "1.561×10<sup>+4</sup>", "fmtCol edge: html=false sf exponential");
	t(fm(0.5, "number", "pc", false), "50.00%", "fmtCol edge: pc html=false");
// 0.005 < 0.01 → shows actual p threshold
	t(fm(0.005, "number", "p:0.01;dp:3", false), "< .010", "fmtCol edge: p-value html=false");

	// NaN content — non-number cell falls through to non-number branch, content = NaN (or null)
	var nanCol = _fmtCol([NaN], "number", "dp:2");
	t(nanCol[0].content === null || nanCol[0].content === "NaN" || typeof nanCol[0].content === "number", true, "fmtCol edge: NaN content handled");
}

// ========== buildAPATable ==========
function _apaRender(attrs) {
	var model = new JASPWidgets.table(attrs);
	return buildAPATable(apaRenderTable(model), { title: attrs.title, subtitle: attrs.subtitle, footnotes: attrs.footnotes }, attrs._number || 1);
}

function _apaHasNot(haystack, needle) { return haystack.indexOf(needle) === -1; }

function test_buildAPATable() {
	_reset();
	var t = _assertEq;

	// A t-test style table with a general note
	var tTest = _apaRender({
		title: "Independent Samples T-Test",
		_number: 3,
		schema: { fields: [
			{ name: "v",  title: "",          type: "string" },
			{ name: "t",  title: "t",         type: "number",  format: "dp:3" },
			{ name: "df", title: "df",        type: "integer" },
			{ name: "p",  title: "p",         type: "pvalue",  format: "dp:3;p:.001" },
			{ name: "d",  title: "Cohen's d", type: "number",  format: "dp:3" }
		] },
		data: [ { v: "Score", t: -2.341, df: 58, p: 0.0228, d: -0.61 } ],
		footnotes: [ { symbol: "<em>Note.</em>", text: "Student's t-test." } ]
	});
	var lines = tTest.text.split("\n");

	t(tTest.html.indexOf("<b>Table 3</b>") !== -1, true, "apa: bold table number");
	t(tTest.html.indexOf("<i>Independent Samples t Test <span") !== -1, true, "apa: italic title, t Test, placeholder asking for the variables");
	t(tTest.html.indexOf(">Cohen's <i>d</i><") !== -1, true, "apa: only the symbol is italic inside a heading");
	t(tTest.html.indexOf("<i>df</i>") !== -1 && tTest.html.indexOf("<i>t</i>") !== -1 && tTest.html.indexOf("<i>p</i>") !== -1, true, "apa: t, df and p headings italic");
	t(tTest.html.indexOf("<i>Note.</i> <i>N</i> = 60. Student's t-test.") !== -1, true, "apa: general note after italic Note., N from df + 2 first");
	t(_apaHasNot(tTest.html, "toolbar") && _apaHasNot(tTest.html, "squash-left") && _apaHasNot(tTest.html, "class="), true, "apa: no JASP classes or helpers left");
	t(/>-[\d.]/.test(tTest.html), false, "apa: no hyphens as minus signs in the copy");
	t(/<colgroup><col style="width: \d+pt" width="\d+">/.test(tTest.html), true, "apa: columns get explicit widths, as style and attribute");
	t(/white-space: nowrap[^>]*>&lt;&nbsp;\.001|white-space: nowrap[^>]*>\.023/.test(tTest.html), true, "apa: number cells don't wrap");
	t(/width: \d+pt;"><colgroup>/.test(tTest.html) || /<table style="[^"]*width: \d+pt;?"/.test(tTest.html), true, "apa: table gets a total width");
	t((tTest.html.match(/<t[dh] [^>]*>/g) || []).every(function (tag) { return /border-top: /.test(tag) && /border-bottom: /.test(tag) && /background: transparent/.test(tag); }), true, "apa: every cell sets its borders and background, overriding the clipboard stylesheet");
	t(/font-size: 12pt/.test(tTest.html), true, "apa: a narrow table keeps 12 pt type");
	var wideBody = [65, 65, 65, 65, 65, 65], wideHead = [0, 0, 0, 0, 0, 0];
	var wide = _apaColumnWidths(wideBody, wideHead);
	t(wide.fontSize < 12 && wide.widths.reduce(function (a, b) { return a + b; }, 0) <= apaPageWidth + wide.widths.length, true, "apa: a wide table steps down its type to fit the page");
	var longHeads = _apaColumnWidths([40, 40, 40, 40, 40, 40, 40, 40, 40], [100, 100, 100, 40, 40, 40, 40, 40, 40]);
	t(longHeads.fontSize < 12, true, "apa: long unbreakable heading words count towards the page width");
	t(lines[0], "Table 3", "apa text: number line");
	t(lines[1], "Independent Samples t Test [describe what was measured]", "apa text: title line with placeholder");
	t(lines[2], "[Add heading]\tt\tdf\tp\tCohen's d", "apa text: heading row, placeholder when the variables are unknown");
	t(lines[3], "Score\t-2.34\t58\t.023\t-0.61", "apa text: data row, 2 decimals, p with 3 and no leading zero, d keeps it");
	t(lines[4], "Note. N = 60. Student's t-test.", "apa text: note line with N");

	// Over-titles, Greek letters and R squared
	var over = _apaRender({
		title: "Model Summary",
		schema: { fields: [
			{ name: "m",  title: "Model", type: "string" },
			{ name: "r2", title: "R²",    type: "number", format: "dp:3" },
			{ name: "e2", title: "η²",    type: "number", format: "dp:3" },
			{ name: "lo", title: "Lower", type: "number", format: "dp:3", overTitle: "95% CI" },
			{ name: "up", title: "Upper", type: "number", format: "dp:3", overTitle: "95% CI" }
		] },
		data: [ { m: "M1", r2: 0.254, e2: 0.12, lo: 0.1, up: 1.4 } ],
		footnotes: []
	});
	var overLines = over.text.split("\n");
	t(over.html.indexOf("<i>R</i>²") !== -1, true, "apa: R² has italic R");
	t(_apaHasNot(over.html, "<i>η</i>"), true, "apa: Greek letters stay upright");
	t(/colspan="2"[^>]*border-bottom[^>]*>95% CI/.test(over.html), true, "apa: spanning heading has a line under it");
	t(overLines[2], "\t\t\t95% CI\t", "apa text: spanning heading row");
	t(overLines[4], "M1\t.25\t.12\t0.10\t1.40", "apa text: R² and η² lose the zero, CI bounds keep it");
	t(over.html.indexOf('<i>N</i> = <span style="background-color: #ffff00; mso-highlight: yellow">[add sample size]</span>.') !== -1, true, "apa: N placeholder when nothing gives the sample size");
	t(over.todo.indexOf("add the sample size") !== -1, true, "apa: missing N in the to-do list");

	// Correlation matrix: the statistic is a row label
	var cor = _apaRender({
		title: "Pearson's Correlations",
		schema: { fields: [
			{ name: "var",  title: "",  type: "string" },
			{ name: "stat", title: "",  type: "string" },
			{ name: "A",    title: "A", type: "number", format: "dp:3" }
		] },
		data: [
			{ var: "B", stat: "Pearson's r", A: -0.25 },
			{ var: "B", stat: "p-value",     A: 0.004 },
			{ var: "C", stat: "n",           A: 40 }
		],
		footnotes: [
			{ symbol: 0, text: "Specific." },
			{ symbol: "<em>Note.</em>", text: "General" },
			{ symbol: "<em>Note.</em>", text: "Second general." }
		]
	});
	var corLines = cor.text.split("\n");
	t(cor.html.indexOf("Pearson's <i>r</i>") !== -1, true, "apa: statistic row labels get italic symbols");
	t(/text-align: left[^>]*>Pearson's/.test(cor.html), true, "apa: text cells are left-aligned");
	t(/text-align: center[^>]*>\u2212\.25</.test(cor.html), true, "apa: numbers are centred, with a true minus sign");
	t(corLines[3], "B\tPearson's r\t-.25", "apa text: r row loses the zero, sign kept");
	// Correlation matrix with confidence intervals and JASP's significance flags
	var ciMatrix = _apaRender({
		title: "Pearson's Correlations",
		schema: { fields: [
			{ name: "var", title: "", type: "string" }, { name: "stat", title: "", type: "string" },
			{ name: "A", title: "A", type: "number", format: "sf:4;dp:3" }, { name: "B", title: "B", type: "number", format: "sf:4;dp:3" } ] },
		data: [
			{ var: "1. A", stat: "Pearson's r", A: "\u2014", B: "" }, { var: "", stat: "Lower 95% CI", A: "\u2014", B: "" }, { var: "", stat: "Upper 95% CI", A: "\u2014", B: "" },
			{ var: "2. B", stat: "Pearson's r", A: 0.2441, B: "\u2014" }, { var: "", stat: "Lower 95% CI", A: -0.1021, B: "\u2014" }, { var: "", stat: "Upper 95% CI", A: 0.5381, B: "\u2014" },
			{ var: "3. C", stat: "Pearson's r", A: 0.0702, B: -0.4703 }, { var: "", stat: "Lower 95% CI", A: -0.2751, B: -0.6972 }, { var: "", stat: "Upper 95% CI", A: 0.3991, B: -0.1561 }
		],
		footnotes: [ { symbol: "*", text: "p < .05, ** p < .01, *** p < .001" } ]
	});
	var ciLines = ciMatrix.text.split("\n");
	t(ciLines.slice(2).join("|"), "Variable\t1\t2|1. A\t—\t|2. B\t.24 [-.10, .54]\t—|3. C\t.07 [-.28, .40]\t-.47 [-.70, -.16]|Note. N = [add sample size]. Values in square brackets indicate the 95% confidence interval for each correlation.|*p < .05. **p < .01. ***p < .001.", "apa text: CIs in brackets under r, two decimals, one row per variable");
	t(ciMatrix.html.indexOf("[\u2212.10,&nbsp;.54]") !== -1 && ciMatrix.html.indexOf("[\u2212.70,&nbsp;\u2212.16]") !== -1, true, "apa: CI in brackets with true minus signs, kept on one line");

	var pRow = _apaRender({
		title: "P",
		schema: { fields: [ { name: "v", title: "", type: "string" }, { name: "p", title: "p", type: "pvalue", format: "dp:3;p:.001" } ] },
		data: [ { v: "x", p: 0.00001 } ],
		footnotes: []
	});
	t(pRow.html.indexOf("&lt;&nbsp;.001") !== -1, true, "apa: no line break inside \"< .001\"");
	t(pRow.text.split("\n")[3], "x\t< .001", "apa text: plain spaces in the text version");
	t(corLines[4], "B\tp\t.004", "apa text: p row is labelled p, 3 decimals, no leading zero");
	t(corLines[5], "C\tn\t40", "apa text: n rows as whole numbers");
	t(cor.html.indexOf("<i>Note.</i> General. Second general.<br>" + symbol(0) + " Specific.") !== -1, true, "apa: general note first, then specific notes");
	t(corLines[6] + "|" + corLines[7], "Note. General. Second general.|" + symbol(0) + " Specific.", "apa text: notes in order, each ending as a sentence");

	// Sentence-case headings, standard abbreviations, title case
	t(apaSentenceCase("Sum of Squares"), "Sum of squares", "apa: sentence case lowers later words");
	t(apaSentenceCase("Mean Difference"), "Mean difference", "apa: sentence case, two words");
	t(apaSentenceCase("Cohen's d"), "Cohen's d", "apa: sentence case keeps names");
	t(apaSentenceCase("Adjusted R²"), "Adjusted R²", "apa: sentence case keeps symbols");
	t(apaSentenceCase("Lower 95% CI"), "Lower 95% CI", "apa: sentence case keeps acronyms");
	t(apaSentenceCase("95% Confidence Interval"), "95% confidence interval", "apa: sentence case after a number");
	t(apaSentenceCase("Shapiro-Wilk Test"), "Shapiro-Wilk test", "apa: sentence case keeps hyphenated names");
	t(apaTitleCase("Test Of Equality Of Variances"), "Test of Equality of Variances", "apa: title case lowers short minor words");
	t(apaTitleCase("Of Mice And Men: A Study"), "Of Mice and Men: A Study", "apa: title case keeps the first word and the word after a colon");

	var anova = _apaRender({
		title: "ANOVA - Score",
		schema: { fields: [
			{ name: "c",  title: "Cases",          type: "string" },
			{ name: "ss", title: "Sum of Squares", type: "number", format: "sf:4;dp:3" },
			{ name: "df", title: "df",             type: "integer" },
			{ name: "m",  title: "Mean",           type: "number", format: "sf:4;dp:3" },
			{ name: "sd", title: "Std. Deviation", type: "number", format: "sf:4;dp:3" },
			{ name: "pc", title: "Share",          type: "number", format: "pc" },
			{ name: "sm", title: "Small",          type: "number", format: "sf:4;dp:3" }
		] },
		data: [ { c: "Group", ss: 433700, df: 1234, m: 12.345, sd: 2.5, pc: 0.2632, sm: 0.007 },
		        { c: "Residuals", ss: 1500.5, df: 2, m: 1, sd: 1, pc: 0.5, sm: 1.25 },
		        { c: "Total", ss: 1296000, df: 1236, m: 2, sd: 2, pc: 1, sm: 2 } ],
		footnotes: [ { symbol: "*", text: "p < .05" }, { symbol: 0, text: "Specific" }, { symbol: "<em>Note.</em>", text: "General" } ]
	});
	var anovaLines = anova.text.split("\n");
	t(anovaLines[2], "Cases\tSum of squares\tdf\tM\tSD\tShare\tSmall", "apa text: sentence-case headings and M, SD");
	t(anovaLines[3], "Group\t433,700.00\t1234\t12.35\t2.50\t26.32%\t0.007", "apa text: 2 decimals, commas in thousands but not df, % without a space, 3 decimals for a column of small values");
	t(anovaLines[4], "Residuals\t1,500.50\t2\t1.00\t1.00\t50.00%\t1.250", "apa text: second row");
	t(anova.html.indexOf("<i>M</i>") !== -1 && anova.html.indexOf("<i>SD</i>") !== -1, true, "apa: M and SD headings are italic");
	t(anovaLines[5], "Total\t1,296,000.00\t1236\t2.00\t2.00\t100.00%\t2.000", "apa text: large numbers written out with commas");
	t(anovaLines.slice(6).join("|"), "Note. N = 1,237. General.|" + symbol(0) + " Specific.|*p < .05.", "apa text: notes in APA order, probability notes last");

	t(apaTitleCase("Path coefficients"), "Path Coefficients", "apa: title case capitalises major words");
	t(apaTitleCase("Model Summary - sales"), "Model Summary - Sales", "apa: title case after a dash");
	t(apaTitleCase("Direct and indirect effects"), "Direct and Indirect Effects", "apa: title case keeps minor words low");

	var misc = _apaRender({
		title: "Chi-Squared tests",
		schema: { fields: [
			{ name: "c",  title: "",      type: "string" },
			{ name: "v",  title: "Value", type: "number", format: "sf:4;dp:3" },
			{ name: "df", title: "df",    type: "number", format: "sf:4;dp:3" },
			{ name: "a",  title: "Estimate", type: "number", format: "sf:4;dp:3", overTitle: "Cronbach's α (if item dropped)" }
		] },
		data: [ { c: "Χ²", v: 25.36, df: 1, a: 0.802 }, { c: "A ✻ B", v: 2, df: 42, a: 0.5 } ],
		footnotes: [ { symbol: "<em>Note.</em>", text: "Compared with group Treat ." } ]
	});
	var miscLines = misc.text.split("\n");
	t(miscLines[1], "Chi-Squared Tests [describe what was measured]", "apa text: title in title case");
	t(miscLines[4], "χ²\t25.36\t1\t.80", "apa text: lower-case chi, whole-number df without decimals, alpha under a spanning heading loses the zero");
	t(miscLines[5], "A × B\t2.00\t42\t.50", "apa text: × for interactions");
	t(miscLines[6], "Note. N = [add sample size]. Compared with group Treat.", "apa text: no space before a full stop in notes");

	// Variable-name labels in APA wording; abbreviations that can't be guessed are reported
	t(apaTidyLabel("FaceType", true).text, "Face type", "apa: PascalCase names split");
	t(apaTidyLabel("exam_score", true).text, "Exam score", "apa: underscores become spaces");
	t(apaTidyLabel("FramingClimate:Skepticism", true).text, "Framing climate × skepticism", "apa: colon interactions become ×");
	t(apaTidyLabel("Food as Reward", true).text, "Food as reward", "apa: row labels in sentence case");
	t(apaTidyLabel("1. sales", true).text, "1. Sales", "apa: numbered names capitalised");
	t(apaTidyLabel("McDonald's ω", true).text, "McDonald's ω", "apa: names left alone");
	t(apaTidyLabel("drp", true).unclear.join(), "drp", "apa: vowel-less abbreviations reported");
	t(apaTidyLabel("df", true).unclear.length + "|" + apaTidyLabel("df", true).text, "0|df", "apa: statistic symbols are not unclear names");
	t(apaTidyLabel("z-value", true).text, "z-value", "apa: a leading statistic stays lower case");
	t(_apaSentence("Maximum p -Ratio: based on a two-sided p -value,the odds"), "Maximum p-Ratio: based on a two-sided p-value, the odds.", "apa: note typos tidied");

	// p rows of a correlation matrix become asterisks; the lone statistic column goes
	var stars = _apaRender({
		title: "Pearson's Correlations",
		schema: { fields: [
			{ name: "v",  title: "Variable", type: "string" },
			{ name: "s",  title: "",         type: "string" },
			{ name: "a",  title: "sales",    type: "number", format: "dp:3" },
			{ name: "b",  title: "adverts",  type: "number", format: "dp:3" },
			{ name: "c",  title: "airplay",  type: "number", format: "dp:3" }
		] },
		data: [
			{ v: "1. sales",   s: "Pearson's r", a: "—", b: "", c: "" },
			{ v: "",           s: "p-value",     a: "—", b: "", c: "" },
			{ v: "2. adverts", s: "Pearson's r", a: 0.578, b: "—", c: "" },
			{ v: "",           s: "p-value",     a: 0.0001, b: "—", c: "" },
			{ v: "3. airplay", s: "Pearson's r", a: 0.102, b: 0.2, c: "—" },
			{ v: "",           s: "p-value",     a: 0.3, b: 0.02, c: "—" }
		],
		footnotes: []
	});
	var starLines = stars.text.split("\n");
	t(starLines[2], "Variable\t1\t2", "apa text: stars matrix headings, statistic column and last column gone");
	t(starLines[4], "2. Adverts\t.58***\t—", "apa text: r with asterisks instead of a p row");
	t(starLines[5], "3. Airplay\t.10\t.20*", "apa text: non-significant r without asterisks");
	t(starLines[7], "*p < .05. ***p < .001.", "apa text: probability note with the levels used");

	// Statistic heading for t tests, abbreviation note, to-do list
	var tt = _apaRender({
		title: "Independent Samples T-Test",
		schema: { fields: [
			{ name: "v",  title: "",          type: "string" },
			{ name: "tst", title: "Test",     type: "string" },
			{ name: "st", title: "Statistic", type: "number", format: "dp:3" },
			{ name: "lo", title: "Lower",     type: "number", format: "dp:3", overTitle: "95% CI" },
			{ name: "up", title: "Upper",     type: "number", format: "dp:3", overTitle: "95% CI" }
		] },
		data: [ { v: "drp", tst: "Student", st: -2.267, lo: -1, up: 1 }, { v: "", tst: "Welch", st: -2.311, lo: -1, up: 1 } ],
		footnotes: []
	});
	var ttLines = tt.text.split("\n");
	t(ttLines[3], "[Add heading]\tTest\tt\tLower\tUpper", "apa text: Statistic becomes t for Student and Welch rows");
	t(tt.html.indexOf("<i>t</i>") !== -1, true, "apa: t heading italic");
	t(ttLines[ttLines.length - 1], "Note. N = [add sample size]. CI = confidence interval.", "apa text: abbreviation explained in the note");
	t(tt.html.indexOf('background-color: #ffff00; mso-highlight: yellow">drp</span>') !== -1, true, "apa: unclear name highlighted");
	t(tt.todo.length, 4, "apa: to-do list has the unclear name, the missing heading, the title and N (no df given)");

	// Sample size from the analysis's other tables
	var mk = function (html) { var d = document.createElement("div"); d.innerHTML = html; return d.firstChild; };
	var groupDesc = mk("<table><thead><tr><th>Group Descriptives</th></tr><tr><th></th><th>Group</th><th>N</th><th>Mean</th></tr></thead><tbody><tr><td>drp</td><td>Control</td><td>23</td><td>41.5</td></tr><tr><td></td><td>Treat</td><td>21</td><td>51.5</td></tr></tbody></table>");
	var descr = mk("<table><thead><tr><th>Descriptive Statistics</th></tr><tr><th></th><th>sales</th><th>adverts</th></tr></thead><tbody><tr><td>Valid</td><td>200</td><td>200</td></tr><tr><td>Missing</td><td>0</td><td>0</td></tr></tbody></table>");
	var descrDiff = mk("<table><thead><tr><th>Descriptive Statistics</th></tr><tr><th></th><th>sales</th><th>adverts</th></tr></thead><tbody><tr><td>Valid</td><td>200</td><td>198</td></tr></tbody></table>");
	var lone = mk("<table><thead><tr><th>Coefficients</th></tr><tr><th>Model</th><th>t</th></tr></thead><tbody><tr><td>M1</td><td>2.1</td></tr></tbody></table>");
	t(apaSampleSize(lone, "Coefficients", [groupDesc]).n, 44, "apa: N summed over the groups of a descriptives table");
	t(apaSampleSize(lone, "Coefficients", [descr]).n, 200, "apa: N from the Valid row");
	var cellDesc = mk("<table><thead><tr><th>Descriptives - Attractiveness</th></tr><tr><th>FaceType</th><th>Alcohol</th><th>N</th></tr></thead><tbody><tr><td>0</td><td>Low</td><td>8</td></tr><tr><td></td><td>High</td><td>8</td></tr><tr><td>1</td><td>Low</td><td>8</td></tr><tr><td></td><td>High</td><td>8</td></tr></tbody></table>");
	t(apaSampleSize(lone, "ANOVA", [cellDesc]).n, 32, "apa: cells of one variable add up to N");
	t(apaSampleSize(lone, "Coefficients", [descrDiff]).varies, true, "apa: differing Ns are reported as differing");
	t(apaSampleSize(descr, "Descriptive Statistics", []).shown, true, "apa: no N note when the table shows it");
	t(JSON.stringify(apaSampleSize(lone, "Coefficients", [])), "{}", "apa: nothing known without sources");
	var untitled = mk("<table><thead><tr><th>Cases</th><th>df</th></tr></thead><tbody><tr><td>A</td><td>2</td></tr><tr><td>Residuals</td><td>45</td></tr></tbody></table>");
	t(apaSampleSize(lone, "Simple Main Effects", [{ table: untitled, title: "ANOVA - Score" }]).n, 48, "apa: other tables given with their titles");
	var fromData = buildAPATable(apaRenderTable(new JASPWidgets.table({ title: "Reliability", schema: { fields: [{ name: "a", title: "Estimate", type: "number", format: "dp:3" }] }, data: [{ a: 0.8 }], footnotes: [] })), { title: "Reliability", footnotes: [], dataSampleSize: { n: 2571 } }, 1);
	t(fromData.text.split("\n").pop(), "Note. N = 2,571.", "apa: N from the data when the tables don't say");
	var tbl1 = function (title, fields, rows, more) { return buildAPATable(apaRenderTable(new JASPWidgets.table({ title: title, schema: { fields: fields }, data: rows, footnotes: [] })), Object.assign({ title: title, footnotes: [] }, more || {}), 1); };
	var meta = tbl1("Meta-Analytic Estimates", [{ name: "a", title: "Estimate", type: "number", format: "dp:3" }], [{ a: 0.3 }], { dataSampleSize: { meta: { studies: 18, total: 2345 } } });
	t(meta.text.split("\n").pop(), "Note. Number of studies = 18, total N = 2,345.", "apa: meta-analysis counts studies, not people");
	var nothing = tbl1("Test results for x-bar chart", [{ name: "a", title: "Tests", type: "string" }], [{ a: "No test violations occurred." }]);
	t(nothing.todo.join("|").indexOf("sample size"), -1, "apa: a table without numbers needs no sample size");
	var coin = tbl1("Binomial Test", [{ name: "s", title: "Successes", type: "integer" }, { name: "f", title: "Failures", type: "integer" }], [{ s: 132, f: 868 }]);
	t(coin.text.split("\n").pop(), "Note. N = 1,000.", "apa: binomial summary N is successes plus failures");
	var shown = tbl1("Evaluation Summary", [{ name: "k", title: "", type: "string" }, { name: "v", title: "Value", type: "number", format: "dp:3" }], [{ k: "Sample size", v: 34 }]);
	t(shown.todo.join("|").indexOf("sample size"), -1, "apa: a Sample size row shows N");
	var ranged = buildAPATable(apaRenderTable(new JASPWidgets.table({ title: "T-Test", schema: { fields: [{ name: "a", title: "t", type: "number", format: "dp:3" }] }, data: [{ a: 0.8 }], footnotes: [] })), { title: "T-Test", footnotes: [], dataSampleSize: { range: { min: 8, max: 9 } } }, 1);
	t(ranged.text.split("\n").pop(), "Note. Ns range from 8 to 9 because of missing values.", "apa: a range of N when tests differ");
	t(ranged.todo.join("|").indexOf("sample size"), -1, "apa: a known range needs no to-do");
	var anovaTable = mk("<table><thead><tr><th>ANOVA - Attractiveness</th></tr><tr><th>Cases</th><th>df</th><th>F</th></tr></thead><tbody><tr><td>FaceType</td><td>1</td><td>15.6</td></tr><tr><td>Alcohol</td><td>2</td><td>6.0</td></tr><tr><td>FaceType ✻ Alcohol</td><td>2</td><td>5.1</td></tr><tr><td>Residuals</td><td>42</td><td></td></tr></tbody></table>");
	var levene = mk("<table><thead><tr><th>Test for Equality of Variances (Levene's)</th></tr><tr><th>F</th><th>df1</th><th>df2</th></tr></thead><tbody><tr><td>0.70</td><td>5</td><td>42</td></tr></tbody></table>");
	t(apaSampleSize(anovaTable, "ANOVA - Attractiveness", []).n, 48, "apa: N from the df of a between-subjects ANOVA");
	t(apaSampleSize(levene, "Test for Equality of Variances (Levene's)", []).n, 48, "apa: N from Levene's df1 + df2 + 1");

	// n rows of a correlation matrix: one N in the note when they agree
	var nMatrix = _apaRender({
		title: "Pearson's Correlations",
		schema: { fields: [
			{ name: "v", title: "Variable", type: "string" },
			{ name: "s", title: "",         type: "string" },
			{ name: "a", title: "liking",   type: "number", format: "dp:3" },
			{ name: "b", title: "threat",   type: "number", format: "dp:3" }
		] },
		data: [
			{ v: "1. liking", s: "n",           a: "—", b: "" },
			{ v: "",          s: "Pearson's r", a: "—", b: "" },
			{ v: "2. threat", s: "n",           a: 34, b: "—" },
			{ v: "",          s: "Pearson's r", a: 0.244, b: "—" }
		],
		footnotes: []
	});
	var nLines = nMatrix.text.split("\n");
	t(nLines.slice(2, 5).join("|"), "Variable\t1|1. Liking\t—|2. Threat\t.24", "apa text: equal n rows removed, names kept, statistic column gone");
	t(nLines[5], "Note. N = 34.", "apa text: N from the matrix n rows");

	// Descriptive statistics: variables in rows, statistics across the top
	var descr = function (validB, missingB) {
		return _apaRender({
			title: "Descriptive Statistics",
			schema: { fields: [
				{ name: "s", title: "",        type: "string" },
				{ name: "a", title: "liking",  type: "number", format: "dp:3" },
				{ name: "b", title: "threat",  type: "number", format: "dp:3" }
			] },
			data: [
				{ s: "Valid",          a: 34, b: validB },
				{ s: "Missing",        a: 0,  b: missingB },
				{ s: "Mean",           a: 3.541, b: 3.951 },
				{ s: "Std. Deviation", a: 1.461, b: 1.709 }
			],
			footnotes: []
		}).text.split("\n");
	};
	var dEqual = descr(34, 0);
	t(dEqual.slice(2, 5).join("|"), "Variable\tM\tSD|Liking\t3.54\t1.46|Threat\t3.95\t1.71", "apa text: descriptives turned, Valid and Missing gone when equal");
	t(dEqual[5], "Note. N = 34.", "apa text: descriptives N in the note");
	var dDiff = descr(30, 4);
	t(dDiff[2], "Variable\tn\tMissing\tM\tSD", "apa text: descriptives keep n and Missing when they differ");
	t(dDiff[4], "Threat\t30\t4\t3.95\t1.71", "apa text: descriptives turned row");

	// Pairs and paths over three unheaded columns become one stub column
	var pairs = _apaRender({
		title: "Pearson's Correlations",
		schema: { fields: [
			{ name: "a", title: "", type: "string" }, { name: "s", title: "", type: "separator" }, { name: "b", title: "", type: "string" },
			{ name: "r", title: "Pearson's r", type: "number", format: "dp:3" },
			{ name: "lo", title: "Lower", type: "number", format: "dp:3", overTitle: "95% CI" },
			{ name: "up", title: "Upper", type: "number", format: "dp:3", overTitle: "95% CI" }
		] },
		data: [ { a: "Revise", s: "-", b: "Exam", r: 0.397, lo: 0.22, up: 0.548 }, { a: "Revise", s: "-", b: "Anxiety", r: -0.709, lo: -0.794, up: -0.598 } ],
		footnotes: []
	});
	var pairLines = pairs.text.split("\n");
	t(pairLines.slice(2, 6).join("|"), "\t\t95% CI\t|Variables\tPearson's r\tLower\tUpper|Revise – Exam\t.40\t.22\t.55|Revise – Anxiety\t-.71\t-.79\t-.60", "apa text: pairs merged under Variables");
	t(pairs.todo.join("|").indexOf("missing column headings"), -1, "apa: no heading to add after merging pairs");
	var paths = _apaRender({
		title: "Path Coefficients",
		schema: { fields: [
			{ name: "a", title: "", type: "string" }, { name: "s", title: "", type: "string" }, { name: "b", title: "", type: "string" },
			{ name: "e", title: "Estimate", type: "number", format: "dp:3" }
		] },
		data: [ { a: "Framing", s: "→", b: "Justification", e: -0.562 } ],
		footnotes: []
	});
	t(paths.text.split("\n").slice(2, 4).join("|"), "Path\tEstimate|Framing → Justification\t-0.56", "apa text: paths merged under Path");

	// Contingency tables: a statistic column with one label goes, with several it is headed
	var cont = function (labels) {
		return _apaRender({
			title: "Contingency Tables",
			schema: { fields: [
				{ name: "t", title: "Training", type: "string" }, { name: "s", title: "", type: "string" },
				{ name: "n", title: "No", type: "integer", overTitle: "Dance" }, { name: "y", title: "Yes", type: "integer", overTitle: "Dance" }
			] },
			data: [ { t: "Food", s: labels[0], n: 10, y: 28 }, { t: "Affection", s: labels[1], n: 114, y: 48 } ],
			footnotes: []
		}).text.split("\n");
	};
	t(cont(["Count", "Count"]).slice(2, 5).join("|"), "\tDance\t|Training\tNo\tYes|Food\t10\t28", "apa text: a Count-only column goes");
	t(cont(["Count", "Expected count"])[3], "Training\tStatistic\tNo\tYes", "apa text: several statistics are headed Statistic");
	t(cont(["Count", "Expected count"])[4], "Food\tCount\t10\t28", "apa text: counts as whole numbers");

	// "Variable" only when the entries are known variables
	var withVars = function (names) {
		return buildAPATable(apaRenderTable(new JASPWidgets.table({ title: "Test of Normality", schema: { fields: [
			{ name: "v", title: "", type: "string" }, { name: "w", title: "W", type: "number", format: "dp:3" } ] },
			data: [ { v: "FaceType", w: 0.9 }, { v: "exam_score", w: 0.8 } ], footnotes: [] })),
			{ title: "Test of Normality", footnotes: [], variableNames: names }, 1).text.split("\n")[2];
	};
	t(withVars(["FaceType", "exam_score", "other"]), "Variable\tW", "apa text: Variable heading when the entries are the analysis's variables");
	t(withVars(["FaceType"]), "[Add heading]\tW", "apa text: placeholder when one entry isn't a known variable");
	t(withVars(undefined), "[Add heading]\tW", "apa text: placeholder without variable names");

	var sw = function (title) {
		return _apaRender({ title: title, schema: { fields: [ { name: "v", title: "", type: "string" }, { name: "w", title: "W", type: "number", format: "dp:3" } ] },
			data: [ { v: "drp", w: 0.973 } ], footnotes: [] }).text.split("\n")[3];
	};
	t(sw("Test of Normality (Shapiro-Wilk)"), "drp\t.97", "apa text: Shapiro-Wilk W loses the zero");
	t(sw("Mann-Whitney U Test"), "drp\t0.97", "apa text: other W keeps it");

	var ci = _apaRender({
		title: "Conditional independence tests",
		schema: { fields: [
			{ name: "a", title: "", type: "string" }, { name: "s", title: "", type: "string" }, { name: "b", title: "", type: "string" },
			{ name: "bar", title: "", type: "string" }, { name: "c", title: "", type: "string" },
			{ name: "e", title: "Estimate", type: "number", format: "dp:3" } ] },
		data: [ { a: "Age", s: "⫫", b: "MoodDisturb", bar: "", c: "", e: -0.305 }, { a: "Age", s: "⫫", b: "Fatigue", bar: "|", c: "Memory", e: 0.1 } ],
		footnotes: []
	}).text.split("\n");
	t(ci.slice(2, 5).join("|"), "Variables\tEstimate|Age ⫫ Mood disturb\t-0.31|Age ⫫ Fatigue | Memory\t0.10", "apa text: conditioning set joins the pair");
	var paired = _apaRender({ title: "Paired Samples T-Test", schema: { fields: [
			{ name: "a", title: "Measure 1", type: "string" }, { name: "s", title: "", type: "separator" }, { name: "b", title: "Measure 2", type: "string" },
			{ name: "t", title: "t", type: "number", format: "dp:3" } ] },
		data: [ { a: "Moon", s: "-", b: "Other", t: 6.452 } ], footnotes: [] }).text.split("\n");
	t(paired.slice(2, 4).join("|"), "Measures\tt|Moon – Other\t6.45", "apa text: headed pairs become Measures");

	// Post hoc comparisons and confusion matrices
	var ph = _apaRender({ title: "Post Hoc Comparisons - Drink", schema: { fields: [
			{ name: "a", title: "", type: "string", combine: true }, { name: "b", title: "", type: "string" },
			{ name: "d", title: "Mean Difference", type: "number", format: "dp:3" } ] },
		data: [ { a: "Beer", b: "Wine", d: 3.5 }, { a: "Beer", b: "Water", d: 8.3 }, { a: "Wine", b: "Water", d: 4.8 } ], footnotes: [] }).text.split("\n");
	t(ph.slice(2, 6).join("|"), "Comparison\tMean difference|Beer \u2013 Wine\t3.50|Beer \u2013 Water\t8.30|Wine \u2013 Water\t4.80", "apa text: post hoc levels become one Comparison column");
	var cm = _apaRender({ title: "Confusion Matrix", schema: { fields: [
			{ name: "o", title: "", type: "string" }, { name: "c", title: "", type: "string" },
			{ name: "x", title: "No", type: "integer", overTitle: "Predicted" }, { name: "y", title: "Yes", type: "integer", overTitle: "Predicted" } ] },
		data: [ { o: "Observed", c: "No", x: 50, y: 5 }, { o: "", c: "Yes", x: 4, y: 41 } ], footnotes: [] }).text.split("\n");
	t(cm.slice(3, 5).join("|"), "Observed\tNo\tYes|No\t50\t5", "apa text: confusion matrix headed Observed");
	var hyp = _apaRender({ title: "Bain ANOVA", schema: { fields: [ { name: "h", title: "", type: "string" }, { name: "b", title: "BF.u", type: "number", format: "dp:3" } ] },
		data: [ { h: "H1", b: 2 }, { h: "Hu", b: 1 } ], footnotes: [] }).text.split("\n");
	t(hyp[2].split("\t")[0], "Hypothesis", "apa text: hypothesis rows headed Hypothesis");

	// Correlation matrix: numbered column headings, no last column of only dashes, CI rows lose the zero
	var matrix = _apaRender({
		title: "Pearson's Correlations",
		schema: { fields: [
			{ name: "v",  title: "Variable", type: "string" },
			{ name: "s",  title: "",         type: "string" },
			{ name: "a",  title: "sales",    type: "number", format: "dp:3" },
			{ name: "b",  title: "adverts",  type: "number", format: "dp:3" }
		] },
		data: [
			{ v: "1. sales",   s: "Pearson's r",  a: "—", b: "" },
			{ v: "",           s: "Lower 95% CI", a: "—", b: "" },
			{ v: "2. adverts", s: "Pearson's r",  a: 0.578,    b: "—" },
			{ v: "",           s: "Lower 95% CI", a: 0.4,      b: "—" }
		],
		footnotes: []
	});
	var matrixLines = matrix.text.split("\n");
	t(matrixLines[2], "Variable\tStatistic\t1", "apa text: matrix headings are the variable numbers, last column dropped, statistic column headed");
	t(matrixLines[5], "2. Adverts\tPearson's r\t.58", "apa text: matrix r value, 2 decimals, no zero, name capitalised");
	t(matrixLines[6], "\tLower 95% CI\t.40", "apa text: correlation CI loses the zero");
}

function test_apaMixedDf() {
	_reset();
	var t = _assertEq;
	var apa = buildAPATable(apaRenderTable(new JASPWidgets.table({ title: "Independent Samples T-Test", schema: { fields: [
		{ name: "v", title: "", type: "string" }, { name: "test", title: "Test", type: "string" },
		{ name: "s", title: "Statistic", type: "number", format: "sf:4;dp:3" }, { name: "df", title: "df", type: "number", format: "sf:4;dp:3" },
		{ name: "p", title: "p", type: "pvalue", format: "dp:3;p:.001" } ] },
		data: [ { v: "drp", test: "Student", s: -2.267, df: 42, p: 0.028 }, { v: "", test: "Welch", s: -2.31, df: 37.855, p: 0.026 } ], footnotes: [] })),
		{ title: "Independent Samples T-Test", footnotes: [] }, 1);
	var lines = apa.text.split("\n");
	t(lines[3].split("\t")[3], "42", "apa: Student's whole df without decimals next to Welch's");
	t(lines[4].split("\t")[3], "37.86", "apa: Welch's df keeps its decimals");
}

function test_apaGroupsAndNotes() {
	_reset();
	var t = _assertEq;
	var apa = buildAPATable(apaRenderTable(new JASPWidgets.table({ title: "Group Descriptives", schema: { fields: [
		{ name: "v", title: "", type: "string" }, { name: "g", title: "Group", type: "string" }, { name: "n", title: "N", type: "integer" },
		{ name: "m", title: "Mean", type: "number", format: "sf:4;dp:3" } ] },
		data: [ { v: "drp", g: "Control", n: 23, m: 41.52 }, { v: "", g: "Treat", n: 21, m: 51.48 } ],
		footnotes: [ { symbol: "<em>Note.</em>", text: "For all tests, group <em> Control </em> is less than group <em> Treat </em>." } ] })),
		{ title: "Group Descriptives", footnotes: [ { symbol: "<em>Note.</em>", text: "For all tests, group <em> Control </em> is less than group <em> Treat </em>." } ] }, 1);
	var lines = apa.text.split("\n");
	t(lines[2].split("\t")[2], "n", "apa: group sizes are n");
	t(/group Treat\.$/.test(lines.filter(function (l) { return /^Note\./.test(l); })[0]), true, "apa: no space before the full stop after an italic word");
}

function test_apaChangeLog() {
	_reset();
	var t = _assertEq;
	var model = new JASPWidgets.table({
		title: "Descriptives",
		schema: { fields: [
			{ name: "v",  title: "",               type: "string" },
			{ name: "sd", title: "Std. Deviation", type: "number", format: "sf:4;dp:3" },
			{ name: "p",  title: "p",              type: "pvalue", format: "dp:3;p:.001" },
			{ name: "x",  title: "Sum of Squares", type: "number", format: "dp:3" },
			{ name: "r",  title: "r",              type: "number", format: "dp:3" }
		] },
		data: [ { v: "Score", sd: 1.23456, p: 0.0228, x: 12345.678, r: 0.452 } ],
		footnotes: [ "Some note" ]
	});
	var shown = new JASPWidgets.tablePrimitive({ model: model });
	shown.render();
	var apa = buildAPATable(apaRenderTable(model), { title: "Descriptives", footnotes: ["Some note"], shownTable: shown.$el.find("table").get(0) }, 1);
	var rule = function (name) { return apa.changes.find(function (c) { return c.rule === name; }); };
	var has = function (name, from, to) { var c = rule(name); return !!c && c.examples.some(function (e) { return e.from === from && e.to === to; }); };

	t(Array.isArray(apa.changes) && apa.changes.length > 0, true, "apa log: changes listed");
	t(apa.changes.every(function (c) { return c.rule && c.detail; }), true, "apa log: every change has a rule and a reason");
	t(has("Decimals", "1.235", "1.23"), true, "apa log: decimals against the table as shown");
	t(has("Abbreviations", "Std. Deviation", "SD"), true, "apa log: abbreviation from and to");
	t(has("Sentence case", "Sum of Squares", "Sum of squares"), true, "apa log: sentence case from and to");
	t(has("Italic symbols", "SD", "<i>SD</i>"), true, "apa log: italics show as markup");
	t(has("Leading zeros", "0.45", ".45"), true, "apa log: leading zero dropped");
	t(has("Number format", "12345.68", "12,345.68"), true, "apa log: thousands separator");
	t(has("Column headings", "", "<mark>[Add heading]</mark>"), true, "apa log: placeholder heading marked");
	t(!!rule("Title above the table") && !!rule("Lines and type") && !!rule("Title"), true, "apa log: fixed layout rules listed");
	t(rule("Note").examples[0].from, "Some note", "apa log: note from JASP's footnote");
	t(!rule("Correlation matrix") && !rule("Missing values"), true, "apa log: rules that changed nothing are left out");
	t(apa.changes.every(function (c) { return c.examples.every(function (e) { return !/style=|data-apa-todo|class=/.test(e.from + e.to); }); }), true, "apa log: examples carry no styles or helpers");
	t(rule("Abbreviations").cells, 1, "apa log: counts changed cells");
}

// ========== Run all tests ==========
// ========== buildAPAFigure ==========
function test_buildAPAFigure() {
	_reset();
	var t = _assertEq;
	var bars = { panels: 1, plots: [{ geoms: ["GeomErrorbar", "GeomLine", "GeomPoint"] }] };

	var anova = buildAPAFigure({ title: "", containerTitles: ["Descriptives Plots"], plotName: "anovaContainer_descriptivesContainer_containerDescriptivesPlots_", analysisName: "Anova",
		options: { descriptivePlotErrorBar: true, descriptivePlotErrorBarType: "ci", descriptivePlotCiLevel: 0.95, barPlotErrorBarType: "se" },
		facts: bars, variables: ["Attractiveness", "FaceType"], image: { src: "data:image/png;base64,AAAA", widthIn: 5, heightIn: 3.75 }, dataSampleSize: { n: 48 } }, 2);
	t(anova.html.indexOf("<b>Figure 2</b>") !== -1, true, "figure: bold figure number");
	t(anova.html.indexOf("Error bars represent 95% confidence intervals.") !== -1, true, "figure: CI error bars from the descriptives plot's own options, not the bar plot's");
	t(anova.html.indexOf("<i>N</i> = 48.") !== -1, true, "figure: N in the note");
	t(anova.html.indexOf('width="480"') !== -1 && anova.html.indexOf("width: 5.00in") !== -1, true, "figure: picture pasted at its APA size");
	t(anova.todo.length, 1, "figure: a title that names no variable asks for one");
	t(anova.text.split("\n")[0], "Figure 2", "figure: plain text starts with the number");

	var rm = buildAPAFigure({ title: "Gender: Male", plotName: "rmAnovaContainer_descriptivesContainer_containerDescriptivesPlots_gender", analysisName: "AnovaRepeatedMeasures",
		options: { descriptivePlotErrorBar: true, descriptivePlotErrorBarType: "se", normalizeErrorBarsDescriptives: true }, facts: bars, variables: ["Gender", "Looks"] }, 1);
	t(rm.html.indexOf("Error bars represent standard errors, adjusted for the within-subjects design.") !== -1, true, "figure: within-subjects standard errors");
	t(rm.todo.length, 0, "figure: a title naming a variable needs no reminder");

	var bayes = buildAPAFigure({ title: "Descriptives Plot", plotName: "descriptivesContainer_containerDescriptivesPlots_", analysisName: "AnovaBayesian",
		options: { descriptivePlotCi: true, descriptivePlotCiLevel: 0.9 }, facts: bars }, 1);
	t(bayes.html.indexOf("Error bars represent 90% credible intervals.") !== -1, true, "figure: Bayesian error bars are credible intervals at their level");

	var unknown = buildAPAFigure({ title: "Means", plotName: "customPlot", analysisName: "Something", options: {}, facts: bars }, 1);
	t(unknown.todo.indexOf("say what the error bars show") !== -1, true, "figure: unexplained error bars ask the user");

	var plain = buildAPAFigure({ title: "Q-Q Plot Standardized Residuals", plotName: "modelContainer_residualsQQPlot", analysisName: "RegressionLinear",
		options: { qqPlotCi: false, qqPlotCiLevel: 0.95 }, facts: { panels: 1, plots: [{ geoms: ["GeomLine", "GeomPoint"] }] } }, 3);
	t(plain.html.indexOf("Error bars") === -1 && plain.html.indexOf("<i>Note.</i>") === -1, true, "figure: no note when there is nothing to explain");
	t(plain.html.indexOf("<i><span") !== -1 && plain.text.split("\n")[1] === "Q-Q Plot of Standardized Residuals", true, "figure: a diagnostic plot's title is suggested in italics, marked to check");

	var robust = buildAPAFigure({ title: "Bayes Factor Robustness Check", plotName: "ttestContainer_inferentialPlots_drp_robustnessPlot", analysisName: "TTestBayesianIndependentSamples",
		options: {}, facts: { panels: 2, plots: [{ geoms: ["GeomLine", "GeomPoint"], x: "Cauchy prior width", y: "BF[10]", text: ["max BF[10]"] }] }, variables: ["drp"] }, 4);
	t(robust.html.indexOf("BF₁₀ = Bayes factor in favour of the alternative hypothesis.") !== -1, true, "figure: BF10 written as plotmath is explained in the note");
	var ci = buildAPAFigure({ title: "drp", plotName: "x", analysisName: "TTestIndependentSamples", options: {}, facts: { panels: 1, plots: [{ geoms: ["GeomPoint"], y: "Mean (95% CI)" }] }, variables: ["drp"] }, 1);
	t(ci.html.indexOf("CI = confidence interval.") !== -1, true, "figure: CI in an axis title is explained");

	var means = buildAPAFigure({ title: "", containerTitles: ["Descriptives", "Descriptives plots"], plotName: "p", analysisName: "Anova", options: {},
		facts: { panels: 1, plots: [{ geoms: ["GeomPoint"], x: "Group", y: "Heart Rate", colour: "Gender" }] }, variables: ["Heart Rate", "Group", "Gender"] }, 1);
	t(means.text.split("\n")[1], "Heart Rate by Group and Gender", "figure: a title suggested from the axes and legend");
	t(means.todo.indexOf("check the suggested title") !== -1, true, "figure: the suggested title is marked to check");
	var histogram = buildAPAFigure({ title: "", plotName: "p", analysisName: "Descriptives", options: {}, facts: { panels: 1, plots: [{ geoms: ["GeomBar"], x: "Sum Score", y: "Counts" }] }, variables: ["Sum Score"] }, 1);
	t(histogram.text.split("\n")[1], "Distribution of Sum Score", "figure: histograms suggest a distribution title");
	var qq = buildAPAFigure({ title: "Q-Q Plot", plotName: "p", analysisName: "Anova", options: {}, facts: { panels: 1, plots: [{ geoms: ["GeomPoint"], x: "Theoretical quantiles", y: "Standardized residuals" }] } }, 1);
	t(qq.todo.indexOf("make the title say what the figure shows") !== -1, true, "figure: diagnostic plots get no suggestion");
	var wide = buildAPAFigure({ title: "drp", plotName: "p", analysisName: "x", options: {}, variables: ["drp"], image: { src: "x", widthIn: 8.4, heightIn: 6 } }, 1);
	t(wide.html.indexOf("put this figure on a landscape page") !== -1 && wide.todo.length === 1, true, "figure: too wide for portrait asks for landscape");
	t(wide.html.indexOf("width: 8.40in") !== -1, true, "figure: a wide figure keeps its size");
	var narrow = buildAPAFigure({ title: "drp", plotName: "p", analysisName: "x", options: {}, variables: ["drp"], image: { src: "x", widthIn: 6.5, heightIn: 4 } }, 1);
	t(narrow.html.indexOf("landscape") === -1, true, "figure: a page-wide figure fits portrait");

	// Notes checked against APA 7 for the plots of t tests, descriptives, ANOVA and regression
	var note = function (f) { return f.text.split("\n").slice(3).join(" "); };
	var ttestDesc = buildAPAFigure({ title: "Mischief", containerTitles: ["Descriptives", "Descriptives Plots"], plotName: "ttestDescriptives_plots_Mischief", analysisName: "TTestIndependentSamples",
		options: { descriptivesPlot: true, descriptivesPlotCiLevel: 0.99 }, facts: { panels: 1, plots: [{ geoms: ["GeomErrorbar", "GeomPoint"], x: "Cloak", y: "Mischief" }] }, variables: ["Mischief", "Cloak"] }, 1);
	t(note(ttestDesc).indexOf("Error bars represent 99% confidence intervals.") !== -1, true, "figure: t test descriptives plots show confidence intervals at their level");
	t(ttestDesc.text.split("\n")[1], "Mischief by Cloak", "figure: a title of section names gets one from the axes");
	var oneSample = buildAPAFigure({ title: "", plotName: "ttestDescriptives_plots_Difference", analysisName: "TTestOneSample", options: { descriptivesPlotCiLevel: 0.95, testValue: 16 },
		facts: { panels: 1, plots: [{ geoms: ["GeomErrorbar", "GeomPoint", "GeomHline"], x: null, y: "Difference" }] }, variables: ["Difference"] }, 1);
	t(note(oneSample).indexOf("Error bars represent 95% confidence intervals. The dashed line shows the test value of 16.") !== -1, true, "figure: the one-sample test value line is explained");
	var paired = buildAPAFigure({ title: "Moon - Other", plotName: "ttestDescriptives_plots_Moon - Other", analysisName: "TTestPairedSamples", options: { descriptivesPlotCiLevel: 0.95 },
		facts: { panels: 1, plots: [{ geoms: ["GeomErrorbar", "GeomPoint", "GeomLine"], x: null, y: null }] }, variables: ["Moon", "Other"] }, 1);
	t(paired.todo.indexOf("say what the y axis shows") !== -1, true, "figure: an unlabelled y axis is explained in the note");
	var rain = buildAPAFigure({ title: "Mischief", plotName: "ttestDescriptives_plotsRainCloud_Mischief", analysisName: "TTestIndependentSamples", options: {},
		facts: { panels: 1, plots: [{ geoms: ["GeomFlatViolin", "GeomBoxplot", "GeomErrorbar", "GeomPoint"], x: "Cloak", y: "Mischief" }] }, variables: ["Mischief", "Cloak"] }, 1);
	t(note(rain).indexOf("Boxes show the middle 50% of scores") !== -1 && note(rain).indexOf("distribution of scores") !== -1 && rain.todo.indexOf("say what the error bars show") === -1, true, "figure: box plots explain the box, not error bars");
	var density = buildAPAFigure({ title: "sales", plotName: "densityPlot_sales", analysisName: "Descriptives", options: { scatterPlotRegressionLineCi: true, scatterPlotRegressionLineCiLevel: 0.95 },
		facts: { panels: 1, plots: [{ geoms: ["GeomRibbon", "GeomLine"], x: "sales", y: "Density" }] }, variables: ["sales"] }, 1);
	t(note(density).indexOf("band") === -1, true, "figure: a density's filled shape isn't a confidence band");
	var interval = buildAPAFigure({ title: "sales", plotName: "IntervalPlots_sales", analysisName: "Descriptives", options: {}, facts: { panels: 1, plots: [{ geoms: ["GeomPoint", "GeomErrorbar"], x: null, y: "sales" }] }, variables: ["sales"] }, 1);
	t(note(interval).indexOf("Points show means; error bars represent 95% confidence intervals.") !== -1, true, "figure: interval plots explained");
	var marginal = buildAPAFigure({ title: "adverts", plotName: "marginalPlotsContainer_adverts", analysisName: "RegressionLinear",
		options: { coefficientCi: true, coefficientCiLevel: 0.95, marginalPlotCi: true, marginalPlotCiLevel: 0.95, marginalPlotPredictionInterval: true, marginalPlotPredictionIntervalLevel: 0.9 },
		facts: { panels: 1, plots: [{ geoms: ["GeomRibbon", "GeomLine"], x: "adverts", y: "sales" }] }, variables: ["adverts", "sales"] }, 1);
	t(note(marginal).indexOf("The shaded band shows the 95% confidence interval and the dashed lines the 90% prediction interval.") !== -1, true, "figure: the confidence band and the dashed prediction lines both explained");
	var marginalRug = buildAPAFigure({ title: "adverts", plotName: "marginalPlotsContainer_adverts", analysisName: "RegressionLinear", options: { marginalPlotPredictionInterval: true, marginalPlotPredictionIntervalLevel: 0.95 },
		facts: { panels: 1, plots: [{ geoms: ["GeomLine", "GeomRug"], x: "adverts", y: "sales" }] }, variables: ["adverts", "sales"] }, 1);
	t(note(marginalRug).indexOf("The dashed lines show the 95% prediction interval. Tick marks along the x axis show the observed values.") !== -1, true, "figure: prediction lines alone, and rug marks, explained");
	var qqReg = buildAPAFigure({ title: "Q-Q Plot Standardized Residuals", plotName: "modelContainer_residualsQQPlot", analysisName: "RegressionLinear", options: { dependent: "sales" },
		facts: { panels: 1, plots: [{ geoms: ["GeomPoint", "GeomLine"], x: "Theoretical quantiles", y: "Observed quantiles" }] }, variables: ["sales", "adverts"] }, 1);
	t(qqReg.text.split("\n")[1], "Q-Q Plot of Standardized Residuals for sales", "figure: a regression Q-Q plot gets a title naming the outcome");
	var partial = buildAPAFigure({ title: "", plotName: "partialPlotContainer_adverts", analysisName: "RegressionLinear", options: { dependent: "sales" },
		facts: { panels: 1, plots: [{ geoms: ["GeomPoint", "GeomLine"], x: "Residuals adverts", y: "Residuals sales" }] }, variables: ["sales", "adverts"] }, 1);
	t(partial.text.split("\n")[1], "Partial Regression Plot for adverts", "figure: partial regression plots name their predictor");
	var jaspPicture = buildAPAFigure({ title: "Mischief", plotName: "ttestDescriptives_plots_Mischief", analysisName: "TTestIndependentSamples", options: { descriptivesPlot: true, descriptivesPlotCiLevel: 0.95 }, facts: null, variables: ["Mischief"] }, 1);
	t(note(jaspPicture).indexOf("Error bars represent 95% confidence intervals.") !== -1, true, "figure: JASP's own picture still gets its error bars explained");
	var dots = buildAPAFigure({ title: "sales", plotName: "DotPlots_sales", analysisName: "Descriptives", options: {}, facts: { panels: 1, plots: [{ geoms: ["GeomDotplot"], x: "sales", y: null, yHidden: true }] }, variables: ["sales"] }, 1);
	t(dots.todo.indexOf("say what the y axis shows"), -1, "figure: a hidden axis needs no title");
	var box = buildAPAFigure({ title: "sales", plotName: "boxPlot_sales", analysisName: "Descriptives", options: {}, facts: { panels: 1, plots: [{ geoms: ["GeomBoxplot", "GeomPoint"], x: "Total", y: "sales" }] }, variables: ["sales"] }, 1);
	t(box.text.split("\n")[1] + " | " + (note(box).indexOf("Dots show individual scores.") !== -1), "Distribution of sales | true", "figure: an ungrouped box plot is a distribution, its dots explained");
	var oneTitle = buildAPAFigure({ title: "", plotName: "ttestDescriptives_plots_Difference", analysisName: "TTestOneSample", options: { testValue: 16, descriptivesPlotCiLevel: 0.95 }, facts: { panels: 1, plots: [{ geoms: ["GeomPoint"], x: null, y: "Difference" }] }, variables: ["Difference"] }, 1);
	t(oneTitle.text.split("\n")[1], "Mean Difference Compared With the Test Value of 16", "figure: one-sample plot title");
	var pairTitle = buildAPAFigure({ title: "Moon - Other", containerTitles: ["Descriptives", "Descriptives Plots"], plotName: "ttestDescriptives_plots_Moon - Other", analysisName: "TTestPairedSamples", options: {}, facts: { panels: 1, plots: [{ geoms: ["GeomPoint"], x: null, y: null }] }, variables: ["Moon", "Other"] }, 1);
	t(pairTitle.text.split("\n")[1], "Means of Moon and Other", "figure: paired plot title names both measures");
	var matrix = buildAPAFigure({ title: "Correlation plot", plotName: "matrixPlot", analysisName: "Descriptives", options: {}, facts: { panels: 9, plots: [] }, variables: ["sales", "adverts", "airplay"] }, 1);
	t(matrix.text.split("\n")[1], "Correlations Among sales, adverts, and airplay", "figure: correlation matrix title lists the variables");
}

function runAllUtilTests() {
	utilsTestResults = [];
	utilsTestPassed = 0;
	utilsTestFailed = 0;

	test_formatFixed();
	test_formatPrecision();
	test_formatPrecisionWRFD();
	test_formatMoney();
	test_formatNumber();
	test_handleNoZeroLead();
	test_toExponential();
	test_formatCellforLaTeX();
	test_formatColumn_string();
	test_formatColumn_sigFig();
	test_formatColumn_decimals();
	test_formatColumn_percentage();
	test_formatColumn_monetary();
	test_formatColumn_pvalue();
	test_formatColumn_mixed();
	test_formatColumn_edges();
	test_buildAPATable();
	test_buildAPAFigure();
	test_apaChangeLog();
	test_apaMixedDf();
	test_apaGroupsAndNotes();

	return {
		passed: utilsTestPassed,
		failed: utilsTestFailed,
		total: utilsTestPassed + utilsTestFailed,
		results: utilsTestResults
	};
}