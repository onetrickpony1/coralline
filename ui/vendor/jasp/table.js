JASPWidgets.table = Backbone.Model.extend({

	defaults: {
		title:				"",
		subtitle:			null,
		variables:			[],
		data:				[],
		casesAcrossColumns:	false,
		overTitle:			false,
		formats:			null,
		footnotes:			[],
		citation:			null,
		error:				null,
		latexCode:			"",
		name:				"",
		showsStatus:		true
	}
});

JASPWidgets.tableView = JASPWidgets.objectView.extend({

	attachToolbar: function ($toolbar) {
		this.$el.addClass('jasp-display-item-flat');

		var $container = this.$el.find("div.toolbar"); // the table toolbar is nested within the table to ensure that the table header gets copied too
		$container.append($toolbar);
	},

	copyMenuClicked: function () {
		var exportParams				= new JASPWidgets.Exporter.params();
		exportParams.format				= JASPWidgets.ExportProperties.format.html;
		exportParams.process			= JASPWidgets.ExportProperties.process.copy;
		exportParams.htmlImageFormat	= JASPWidgets.ExportProperties.htmlImageFormat.temporary;
		exportParams.includeNotes		= false;

		this.exportBegin(exportParams);
		return true;
	},

	showDependenciesClicked: function() { this.model.trigger("ShowDependencies:clicked", this.model.get("name")); },

	hasLaTeXCode: function () {
	  var optLaTeXCode = this.model.get("latexCode");
	  return optLaTeXCode !== null
	},

	_generateLaTeXCode: function() {
		/**
		 * Generates the latex code for tables
		 */
		let optSchema = this.model.get("schema");
		let optData = this.model.get("data");
		let optCasesAcrossColumns = this.model.get("casesAcrossColumns");
		let optOvertitle = this.model.get("overTitle")
		let optFootnotes = this.model.get("footnotes");

		let columnsDict = createColumns(optSchema.fields, optData, optFootnotes);
		let columnHeaders = columnsDict['columnHeaders'];
		let columns = columnsDict['columns'];

		let columnDefs = optSchema.fields;
		let columnCount = columnDefs.length;

		let rowCount = optData.length > 1 ? optData.length : 1;
		let cells = Array(columnCount);

		for (let colNo = 0; colNo < columnCount; colNo++) {
			cells[colNo] = formatColumn(
				columns[colNo],
				columnDefs[colNo].type,
				columnDefs[colNo].format,
				!optCasesAcrossColumns,
				columnDefs[colNo].combine,
				optFootnotes,
				false
			);
		}

		let columnsInColumn = {};  // dictionary of counts
		let columnsInsertedInColumn = {};
		let maxColumnsInColumn = 0;
		let columnNames = [];

		for (let colNo = 0; colNo < columnCount; colNo++) {
			let columnName = optSchema.fields[colNo].name;
			let subRowPos = columnName.indexOf("[");

			if (subRowPos !== -1) {
				columnName = columnName.substr(0, subRowPos);
			}
			columnNames[colNo] = columnName;

			let cic = columnsInColumn[columnName];
			if (typeof cic == "undefined") {
				cic = 1;
			} else {
				cic++;
			}
			if (maxColumnsInColumn < cic) {
				maxColumnsInColumn = cic;
			}

			columnsInColumn[columnName] = cic;
		}

		if (maxColumnsInColumn > 1) {
			let foldedColumnNames = _.uniq(columnNames);
			let foldedCells = Array(foldedColumnNames.length);
			let foldedColumnHeaders = Array(foldedColumnNames.length);

			// fold the headers
			for (let colNo = 0; colNo < foldedColumnNames.length; colNo++) {
				let headerIndex = columnNames.indexOf(foldedColumnNames[colNo]);
				foldedColumnHeaders[colNo] = columnHeaders[headerIndex];
			}

			// fold the columns
			for (let colNo = 0; colNo < columnNames.length; colNo++) {

				let columnCells = cells[colNo];
				let columnName = columnNames[colNo];
				let targetIndex = foldedColumnNames.indexOf(columnName);
				let column = foldedCells[targetIndex];
				let cic = columnsInColumn[columnName];

				if (typeof column == "undefined") {
					column = Array(columnCells.length * cic);
				}

				let offset = columnsInsertedInColumn[columnName];
				if (typeof offset == "undefined") {
					offset = 0;
				}

				for (let rowNo = 0; rowNo < columnCells.length; rowNo++) {
					let cell = columnCells[rowNo];
					if (offset === 0) {
						cell.isStartOfGroup = true;
					}
					if (offset === cic - 1) {
						cell.isEndOfGroup = true;
					}
					cell.span = maxColumnsInColumn / cic;
					column[rowNo * cic + offset] = cell;
				}
				columnsInsertedInColumn[columnName] = offset + 1;
				foldedCells[targetIndex] = column;
			}

			cells = foldedCells;
			columnHeaders = foldedColumnHeaders;
			columnCount = foldedColumnHeaders.length;
			rowCount *= maxColumnsInColumn;
		}

		if (cells !== undefined && cells.length > 0 && optCasesAcrossColumns) {
			let swapped = swapRowsAndColumns(columnHeaders, cells, optOvertitle);
			cells = swapped.columns;
			columnHeaders = swapped.columnHeaders;
			rowCount = swapped.rowCount;
			columnCount = swapped.columnCount;
		}

		return {'headers': columnHeaders, 'cells': cells}
	},

	_getLaTeXCode: function() {
		/**
		 * Generates the latex code for the table
		 */

		let optSchema = this.model.get('schema');
		let optData = this.model.get('data');
		let optTitle = this.model.get('title');
		let optVariables = this.model.get('variables');
		let optOvertitle = this.model.get('overTitle')
		let optFootnotes = this.model.get('footnotes');

		let data = this._generateLaTeXCode();

		// TODO: footnotes formatting

		let variable = "";  // required to find out the first column
		for (let i = 0; i < optSchema.fields.length; ++i) {
			if (optSchema.fields[i].title === '') {
				variable = optSchema.fields[i].name;
				break;
			}
		}

		let latexCode = "";
		// title
		latexCode += "\\begin{table}[h]\n\t\\centering\n\t\\caption{" + formatCellforLaTeX(optTitle) + "}\n";

		// label
		latexCode += "\t\\label{tab:" + camelize(optTitle) + "}\n\t{\n";

		// alignments - {lrrr}
		let columns = data.headers.length;
		let alignments = '';

		for (let col = 0 ; col < columns; ++col) {
			if (col == 0 || data.headers[col].content === undefined || data.headers[col].content === '') {
				alignments += 'l';
			} else {
				alignments += 'r';
			}
		}

		latexCode += "\t\t\\begin{tabular}{" + alignments + "}\n\t\t\t\\toprule\n\t\t\t";
		// Check if there is overTitle
		let overTitleExists = false;
		for (let i = 0; i < columns; ++i) {
			if (data.headers[i]['overTitle'] !== undefined) {
				overTitleExists = true;
				break;
			}
		}
		let cline_text = '';
		if (overTitleExists) {
			let count = 0;
			let prev = undefined;

			for (let i = 0; i < columns; ++i) {
				let current = data.headers[i]['overTitle'];

				if (i === columns - 1) {
					if (current !== undefined) {
						if (prev === current) {
							count++;
							latexCode += ('\\multicolumn{' + count + '}{c}{'+ formatCellforLaTeX(prev) + '} ');
							cline_text += '\\cline{' + (i - count + 2) + '-' + (i + 1) + '}';
						  } else {
							latexCode += ('\\multicolumn{' + count + '}{c}{'+ formatCellforLaTeX(prev) + '} & ');
							cline_text += '\\cline{' + (i - count + 2) + '-' + (i + 1) + '}';
							latexCode += ('\\multicolumn{1}{c}{'+ current + '} ');
						}
						continue;
					}
				}

				if (current === undefined) {
					if (prev !== undefined) {
						latexCode += ('\\multicolumn{' + count + '}{c}{'+ formatCellforLaTeX(prev) + '} & ');
						cline_text += '\\cline{' + (i - count + 1) + '-' + i + '}';
					}

					count = 0;
					latexCode += ('\\multicolumn{1}{c}{} ');

					if (i < columns - 1) {
						latexCode += '& ';
					}
				} else {
					if (current !== prev && prev !== undefined) {
						latexCode += ('\\multicolumn{' + count + '}{c}{'+ formatCellforLaTeX(prev) + '} & ');
						cline_text += '\\cline{' + (i - count + 1) + '-' + i + '}';
						count = 1;
					} else {
						count++;
					}
				}

				prev = current;
			}

			latexCode += '\\\\\n\t\t\t';
			latexCode += cline_text + '\n\t\t\t';
		}

		for (let i = 0; i < columns; ++i) {
			latexCode += (formatCellforLaTeX(data.headers[i].content) + ' ');
			if (i !== columns - 1) {
				latexCode += '& ';
			}
		}
		latexCode += (' \\\\\n\t\t\t\\cmidrule[0.4pt]{1-' + columns + '}\n');

		// Find number of rows
		let maxRows = 0;
		for (let i = 0; i < columns ; ++i) {
			let rows = data.cells[i].length;
			if (rows > maxRows) {
				maxRows = rows;
			}
		}

		let firstColRow = 0;
		let incrementFirstCol = true;
		let previousContent = '-x-';
		for (let r = 0; r < maxRows; ++r) {

			latexCode += '\t\t\t';
			if (maxRows === data.cells[0].length) {
			content = formatCellforLaTeX(data.cells[0][r].content);
				if (previousContent !== content) {
					latexCode += content;
					previousContent = content;
				}
			} else if (incrementFirstCol) {
				latexCode += (formatCellforLaTeX(data.cells[0][firstColRow].content));
			}
			latexCode += (' & ');

			let isStartOfGroup = data.cells[0][firstColRow]['isStartOfGroup'];
			// incrementFirstCol = !isStartOfGroup;

			if (isStartOfGroup === undefined || isStartOfGroup === false) {
				incrementFirstCol = true;
			} else {
				incrementFirstCol = false;
			}

		  for (let c = 1; c < columns; ++c) {
			latexCode += (formatCellforLaTeX(data.cells[c][r].content) + ' ');
				if (c != columns - 1) {
					latexCode += ('& ');
				} else {
					latexCode += ' \\\\\n';
				}
			}

			if (!incrementFirstCol) {
				let isEndOfGroup = data.cells[columns - 1][r]['isEndOfGroup'];
				if (isEndOfGroup) {
					incrementFirstCol = true;
				}
			}

			if (incrementFirstCol) {
				firstColRow += 1;
			}
		}

		latexCode += '\t\t\t\\bottomrule\n';

		if (optFootnotes !== "" && optFootnotes !== null && optFootnotes.length !== 0) {
			latexCode += '\t\t\t% \\addlinespace[1ex]\n';

			for (let i = 0; i < optFootnotes.length; i++) {

				let sym = optFootnotes[i]['symbol'];
				if (Number.isInteger(sym)) {
					sym = '$^{' + sym + '}$';  // FIXME: This is a workaround for now. Use symbol(sym)
				}
				let footnoteText = (formatCellforLaTeX(sym) + ' ');
					footnoteText += formatCellforLaTeX(optFootnotes[i]['text'].replace(/(\r\n|\n|\r|\t)/gm, ''));  // remove line breaks, \n, \r, \r\n, \t

				latexCode += ('\t\t\t% \\multicolumn{' + columns + '}{p{\\linewidth}}{' + footnoteText + '} \\\\\n');
			}
		}

		latexCode += "\t\t\\end{tabular}\n\t}\n\\end{table}\n"

		// Add a comment
		latexCode = "%----- Requires booktabs package -----%\n\\usepackage{booktabs}\n\n" + latexCode;

		return latexCode;
	},

	latexCodeMenuClicked: function () {
		let exportParams = new JASPWidgets.Exporter.params();
		exportParams.format = JASPWidgets.ExportProperties.format.html;
		exportParams.process = JASPWidgets.ExportProperties.process.copy;
		exportParams.htmlImageFormat = JASPWidgets.ExportProperties.htmlImageFormat.temporary;
		exportParams.includeNotes = false;

		let latexCode = this._getLaTeXCode();

		let htmlCite = '<p>' + latexCode + '</p>';
		let exportContent = new JASPWidgets.Exporter.data(latexCode, htmlCite);
		pushTextToClipboard(exportContent, exportParams);

		return true;
	},

	hasAPATable: function () {
		return !this.model.get("error") && this.$el.find("table").length > 0;
	},

	apaTableMenuClicked: function () {
		// Tables are numbered by their order on the results page
		let $primitive = this.$el.find(".jasp-table-primitive").first();
		let tableNumber = $(".jasp-table-primitive").index($primitive) + 1;

		let apa = buildAPATable(apaRenderTable(this.model), {
			title:		this.model.get("title"),
			subtitle:	this.model.get("subtitle"),
			footnotes:	this.model.get("footnotes"),
			otherTables: this.$el.closest(".jasp-analysis").find(".jasp-table-primitive table").not(this.$el.find("table")).toArray()
		}, tableNumber);

		// Not wrapHTML: its <title> is pasted as text by Google Docs, and its table stylesheet fights the APA styles
		jasp.pushToClipboard("text/plain", apa.text, apaClipboardHTML(apa.html));
		this.apaTodo = apa.todo;

		return true;
	},

	indentChildren: false,

	menuName: "Table",

	events: {
		'mouseenter': '_hoveringStart',
		'mouseleave': '_hoveringEnd',
		'click': '_mouseClicked',
	},

	notePositionBottom: true,

	_hoveringStart: function (e) {
		this.toolbar.setVisibility(true);
	},

	_hoveringEnd: function (e) {
		this.toolbar.setVisibility(false);
	},

	_mouseClicked: function (e) {	},

	hasCollapse: function () {
		return false;
	},

	constructChildren: function (constructor, data) {

		var self = this;
		this.toolbar.selectionElement = function () {
			return self.$el.find('th, td:not(.squash-left)');
		};

		var tablePrimitive = new JASPWidgets.tablePrimitive({ model: this.model, className: "jasp-table-primitive jasp-display-primitive" });
		this.localViews.push(tablePrimitive);
		this.views.push(tablePrimitive);
	},

	titleFormatOverride: 'span',

	disableTitleExport: true,
});

JASPWidgets.tablePrimitive = JASPWidgets.View.extend({

	render: function () {
		var optSchema				= this.model.get("schema");
		var optData					= this.model.get("data");
		var optTitle				= this.model.get("title");
		var optSubtitle				= this.model.get("subtitle");
		var optCasesAcrossColumns	= this.model.get("casesAcrossColumns");
		var optOvertitle			= this.model.get("overTitle")
		var optFootnotes			= this.model.get("footnotes");
		var optCitation				= this.model.get("citation");
		var optStatus				= this.model.get("status");
		var optError				= this.model.get("error");

		var columnDefs		= optSchema.fields
		var columnCount		= columnDefs.length

		let rowData			= optData;
		let rowCount		= rowData.length > 1 ? rowData.length : 1;

		let columnsDict		= createColumns(columnDefs, rowData, optFootnotes);
		let columnHeaders	= columnsDict['columnHeaders'];
		let columns			= columnsDict['columns'];

		var cells			= Array(columnCount);

		for (var colNo = 0; colNo < columnCount; colNo++) {

			var column			= columns[colNo]
			var name			= columnDefs[colNo].name
			var type			= columnDefs[colNo].type
			var format			= columnDefs[colNo].format
			var alignNumbers	= !optCasesAcrossColumns  // numbers can't be aligned across rows
			var combine			= columnDefs[colNo].combine

			cells[colNo]		= formatColumn(column, type, format, alignNumbers, combine, optFootnotes, true)
		}

		var columnsInColumn			= {}  // dictionary of counts
		var columnsInsertedInColumn = {}
		var maxColumnsInColumn		= 0
		var columnNames				= []

		for (var colNo = 0; colNo < columnCount; colNo++)
		{
			var columnName = optSchema.fields[colNo].name
			var subRowPos  = columnName.indexOf("[")

			if (subRowPos != -1)
				columnName = columnName.substr(0, subRowPos)

			columnNames[colNo] = columnName

			var cic = columnsInColumn[columnName]

			cic = (typeof cic == "undefined") ? 1 : cic + 1;

			if (maxColumnsInColumn < cic)
				maxColumnsInColumn = cic

			columnsInColumn[columnName] = cic
		}

		if (maxColumnsInColumn > 1) {  // do columns need to be folded

			var foldedColumnNames	= _.uniq(columnNames)
			var foldedCells			= Array(foldedColumnNames.length)
			var foldedColumnHeaders	= Array(foldedColumnNames.length)

			// fold the headers
			for (var colNo = 0; colNo < foldedColumnNames.length; colNo++)
			{
				var headerIndex				= columnNames.indexOf(foldedColumnNames[colNo])
				foldedColumnHeaders[colNo]	= columnHeaders[headerIndex]
			}


			// fold the columns

			for (var colNo = 0; colNo < columnNames.length; colNo++) {

				var columnCells	= cells[colNo]
				var columnName	= columnNames[colNo]
				var targetIndex = foldedColumnNames.indexOf(columnName)
				var column		= foldedCells[targetIndex]
				var cic			= columnsInColumn[columnName]

				if (typeof column == "undefined")
					column = Array(columnCells.length * cic)

				var offset = columnsInsertedInColumn[columnName]
				if (typeof offset == "undefined")
					offset = 0

				for (var rowNo = 0; rowNo < columnCells.length; rowNo++) {

					var cell = columnCells[rowNo]

					if (offset == 0)
						cell.isStartOfGroup = true
					if (offset == cic - 1)
						cell.isEndOfGroup = true

					cell.span = maxColumnsInColumn / cic
					column[rowNo * cic + offset] = cell

				}

				columnsInsertedInColumn[columnName] = offset + 1
				foldedCells[targetIndex] = column
			}

			cells			 = foldedCells

			columnHeaders	 = foldedColumnHeaders
			columnCount		 = foldedColumnHeaders.length
			rowCount		*= maxColumnsInColumn
		}

		if (cells !== undefined && cells.length > 0 && optCasesAcrossColumns) {

			var swapped		= swapRowsAndColumns(columnHeaders, cells, optOvertitle)
			cells			= swapped.columns
			columnHeaders	= swapped.columnHeaders;
			rowCount		= swapped.rowCount
			columnCount		= swapped.columnCount
		}

		var chunks = []

		if (optError) {
			chunks.push('<table class="error-state jasp-no-select">')
		}
		else {
			chunks.push('<table class="jasp-no-select">')
		}

		chunks.push('<thead>')
		chunks.push('<tr>')
		chunks.push('<th colspan="' + columnCount + '"><div class="toolbar"></div>')

		if (optError && optError.errorMessage) {

			chunks.push('<div  class="error-message-positioner">')
			chunks.push('<div  class="error-message-box ui-state-error">')
			chunks.push('<span class="error-message-symbol ui-icon ui-icon-alert"></span>')
			chunks.push('<div  class="error-message-message">' + optError.errorMessage + '</div>')
			chunks.push('</div>')
			chunks.push('</div>')
		}

		chunks.push('</th>')
		chunks.push('</tr>')

		if (optSubtitle) {
			chunks.push('<tr>')
			chunks.push('<th colspan="' + columnCount + '"></th>')
			chunks.push('</tr>')
		}

		if (columnHeaders.length > 0) {

			var hasOvertitles = false;
			var hasAdjacentOvertitles = false;

			// If we have multiple adjacent overtitles, we should make small
			// breaks in the line under the overTitle to indicate end of old and
			// start of new overTitle. NB: with this option, the line is not copied
			// to text processor.
			var lastOvertitle = "";
			for (var i = 0; i < columnHeaders.length; i++) {
				if (typeof columnHeaders[i].overTitle != "undefined") {
					hasOvertitles = true;
					var overtitle = columnHeaders[i].overTitle;
					if (lastOvertitle != "" && lastOvertitle != overtitle) {
						hasAdjacentOvertitles = true;
						break;
					}
					lastOvertitle = overtitle;
				} else {
					lastOvertitle = "";
				}
			}

			if (hasOvertitles) {

				if (hasAdjacentOvertitles)
					chunks.push('<tr class="over-title-space">')
				else
					chunks.push('<tr class="over-title">')


				var span = 1;
				var oldTitle = columnHeaders[0].overTitle
				var newTitle = ""

				if (!oldTitle)
					oldTitle = ""

				for (var colNo = 1; colNo < columnHeaders.length; colNo++) {

					newTitle = columnHeaders[colNo].overTitle
					if (!newTitle)
						newTitle = ""

					if (newTitle == oldTitle) {
						span++
					}
					else {
						if (hasAdjacentOvertitles)
							chunks.push('<th colspan="' + span + '"><div class="over-title-space">' + oldTitle + '</div></th>');
						else
							chunks.push('<th colspan="' + span + '">' + oldTitle + '</th>');

						oldTitle = newTitle
						span = 1
					}
				}

				if (newTitle == oldTitle) {
					if (hasAdjacentOvertitles)
						chunks.push('<th colspan="' + span + '"><div class="over-title-space">' + newTitle + '</div></th>')
					else
						chunks.push('<th colspan="' + span + '">' + newTitle + '</th>')
				}


				chunks.push('</tr>')
			}
		}

		chunks.push('<tr>')


		for (var colNo = 0; colNo < columnHeaders.length; colNo++) {

			var cell = columnHeaders[colNo]

			if (cell.content == "\u03B7\u00B2\u209A")
				cell.content = '&eta;&sup2;<small><sub style="position: relative; left: -1ex;">p</sub></small>'

			var span = cell.span
			if (typeof span == "undefined")
				span = 1

			if (span) {
				chunks.push('<th colspan="' + span + '" class="' + cell.type + '">' + cell.content)
				if (cell.footnotes)
					chunks.push(cell.footnotes.join(' '))
				chunks.push('</th>')
			}

		}

		chunks.push('</tr>')
		chunks.push('</thead>')
		chunks.push('<tbody>')

		var tableProgress = Array(columnCount)
		for (var i = 0; i < columnCount; i++) {

			tableProgress[i] = { from: 0, to: 0 }
		}

		for (var rowNo = 0; rowNo < rowCount; rowNo++) {

			chunks.push('<tr>')

			for (var colNo = 0; colNo < columnCount; colNo++) {

				if (tableProgress[colNo].to == rowNo) {

					var fromIndex = tableProgress[colNo].from
					var cell = cells[colNo][fromIndex]
					var cellHtml = ''

					var cellClass = cell.class
					cellClass += (cell.isStartOfGroup ? " new-group-row" : "")
					cellClass += (cell.isStartOfSubGroup ? " new-sub-group-row" : "")
					cellClass += (cell.isEndOfGroup ? " last-group-row" : "")
					cellClass += (cell.span > 1 ? " row-span" : "")

					cellHtml += (cell.header ? '<th' : '<td')
					cellHtml += ' class="' + cellClass + '"' 
					cellHtml += (cell.span ? ' rowspan="' + cell.span + '"' : '')
					cellHtml += '>'
					cellHtml += (typeof cell.content != "undefined" ? cell.content : '')

					if (typeof cell.footnotes != "undefined")
						cellHtml += cell.footnotes.join(' ')

					cellHtml += (cell.header ? '</th>' : '</td>')

					tableProgress[colNo].from += 1

					if (cell.span) {

						tableProgress[colNo].to += cell.span

					}
					else {

						tableProgress[colNo].to += 1
					}

					chunks.push(cellHtml)
				}

			}

			if (rowNo == 0) // squashes the table to the left
				chunks.push('<td class="squash-left" rowspan="' + rowCount + '"></td>')

			chunks.push('</tr>')
		}

		chunks.push('</tbody>')

		if (optFootnotes) {

			chunks.push('<tfoot>')

			for (var i = 0; i < optFootnotes.length; i++)
				if(optFootnotes[i].text !== "")
				{

					chunks.push('<tr><td colspan="' + columnCount + '">')

					var footnote = optFootnotes[i]

					if (_.isString(footnote)) {
					  chunks.push(symbol(i) + '&nbsp;')
					  chunks.push(footnote)
					}

					if (_.has(footnote, "symbol")) {
					  if (_.isNumber(footnote.symbol))
						chunks.push(symbol(footnote.symbol) + '&nbsp;')
					  else
						chunks.push(footnote.symbol + '&nbsp;')

						chunks.push(footnote.text)
					}

					chunks.push('</td></tr>')
				}

			chunks.push('</tfoot>');
		}

		chunks.push('</table>');


		var html = chunks.join("");

		this.$el.append(html);
	},

	getExportAttributes: function (element, exportParams) {
		var attrs = ""
		var style = ""

		var $elObj = $(element)
		var tag = $elObj.prop("tagName").toLowerCase()

		if (tag === "td" || tag === "th") {
			style = JASPWidgets.Exporter.getTableContentStyles($elObj, exportParams);
		}
		else if (tag === "table") {
			style = JASPWidgets.Exporter.getTableStyles($elObj, exportParams);
		}
		else if (tag === "span" || tag === "h1" || tag === "h2" || tag === "h3") {
			style = JASPWidgets.Exporter.getHeaderStyles($elObj, exportParams);
		}
		else if ($elObj.is('.error-message-positioner')) {
			style = JASPWidgets.Exporter.getErrorStyles($elObj, 'error-message-positioner');
		}
		else if ($elObj.is('.error-message-box')) {
			style = JASPWidgets.Exporter.getErrorStyles($elObj, 'error-message-box');
		}
		else if ($elObj.is('.error-message-symbol')) {
			style = JASPWidgets.Exporter.getErrorStyles($elObj, 'error-message-symbol');
		}
		else if ($elObj.is('.error-message-message')) {
			style = JASPWidgets.Exporter.getErrorStyles($elObj, 'error-message-message');
		}

		let attrObj = $elObj.prop("attributes");
		$.each(attrObj, function() {
			attrs += this.name + '="' + this.value + '" ';
		});

		if (style)
			attrs = attrs + style

		return attrs;
	},

	exportHTML: function (exportParams, element, tabs) {
		if (element == null)
			element = this.$el;

		tabs = tabs || ""

		var text = ""
		var $elObj = $(element)

		if ($elObj.hasClass("do-not-copy") || $elObj.is("td.squash-left"))
			return text

		var tag = $elObj.prop("tagName").toLowerCase()

		var attrs = this.getExportAttributes(element, exportParams);

		if (attrs)
			text = tabs + '<' + tag + ' ' + attrs + '>'
		else
			text = tabs + '<' + tag + '>'

		var contents = $elObj.contents()

		if (contents.length > 0) {

			for (var i = 0; i < contents.length; i++) {
				var node = contents[i]
				if (node.nodeType === 3) { //is text node
					var value = $(node).text()
					if (value) {

						value = value
							.replace(/&/g, '&amp;')
							.replace(/"/g, '&quot;')
							.replace(/'/g, '&#39;')
							.replace(/</g, '&lt;')
							.replace(/>/g, '&gt;')
							.replace(/\u2212/g, '-')

						text += "" + value + ""
					}
				}
				else {
					text += "" + this.exportHTML(exportParams, contents[i], "");
				}
			}

			text += '</' + tag + '>\n'
		}
		else {

			text += '</' + tag + '>\n'
		}

		return text;
	},

	exportBegin: function (exportParams, completedCallback) {

		if (exportParams == undefined)
			exportParams = new JASPWidgets.Exporter.params();
		else if (exportParams.error)
			return false;

		var callback = this.exportComplete;
		if (completedCallback !== undefined)
			callback = completedCallback;

		if (exportParams.includeNotes && this.noteBox !== undefined && this.noteBox.visible && this.noteBox.isTextboxEmpty() === false) {
			var exportObject = {
				views: [this, this.noteBox],
				getStyleAttr: function () {
					return "style='display: block;'";
				}
			};
			var newParams = exportParams.clone();
			newParams.includeNotes = false;

			JASPWidgets.Exporter.begin(exportObject, newParams, callback, true);
		}
		else
			callback.call(this, exportParams, new JASPWidgets.Exporter.data(null, this.exportHTML(exportParams)));

		return true;
	},

	exportComplete: function (exportParams, exportContent) {
		if (!exportParams.error)
			pushHTMLToClipboard(exportContent, exportParams);
	},
});

// ---------- APA table export ----------

// Latin-letter statistical symbols that APA 7 sets in italics (Greek letters stay upright)
var apaItalicSymbols = ["t", "F", "p", "df", "M", "SD", "SE", "N", "n", "r", "R", "d", "z", "W", "U", "B", "b", "g", "Mdn", "H", "Q", "V"];

// Statistics that can't exceed 1, so APA drops their leading zero (".05", not "0.05")
var apaNoZeroLeadLabels = ["p", "r", "R", "R²", "Adjusted R²", "ρ", "τ", "η²", "η²p", "ω²", "α", "Pearson's r", "Spearman's rho", "Kendall's Tau B", "Cronbach's α", "McDonald's ω", "p-value"];

function _apaEscape(text) {
	return String(text)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

function _apaPlain(html) {
	// HTML fragment to plain text, keeping subscripts glued to their symbol (p<sub>bonf</sub> -> pbonf)
	let div = document.createElement("div");
	div.innerHTML = html === undefined || html === null ? "" : String(html);
	return div.textContent.replace(/ /g, " ").replace(/\s+/g, " ").trim();
}

function _apaLabel(cell) {
	// Text of a cell without footnote markers or subscripts, used to recognise statistics
	let clone = cell.cloneNode(true);
	$(clone).find("sub, sup").remove();
	return clone.textContent.replace(/[ᵃ-ᶻʰ-ˣⁱⁿ]/g, "").replace(/ /g, " ").trim();
}

function _apaItaliciseSymbols(cell) {
	// Wrap statistical symbols in <i>, only where the symbol stands on its own ("Cohen's d", "R²")
	let pattern = new RegExp("(^|[^\\p{L}])(" + apaItalicSymbols.join("|") + ")(?=$|[^\\p{L}])", "gu");
	let walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
	let textNodes = [];
	while (walker.nextNode())
		textNodes.push(walker.currentNode);

	for (let node of textNodes) {
		if ($(node).closest("sub, sup", cell).length > 0)
			continue;
		let text = node.nodeValue;
		if (!pattern.test(text))
			continue;
		pattern.lastIndex = 0;
		let html = _apaEscape(text).replace(pattern, "$1<i>$2</i>");
		let span = document.createElement("span");
		span.innerHTML = html;
		node.replaceWith(...span.childNodes);
	}
}

function _apaDropZeroLead(cell) {
	// "0.123" -> ".123", "-0.5" -> "-.5"; leaves anything else alone
	let walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
	while (walker.nextNode()) {
		let node = walker.currentNode;
		let text = node.nodeValue;
		if (text.trim() === "")
			continue;
		node.nodeValue = text.replace(/^(\s*[-−]?)0(?=[.,]\d)/, "$1");
		return;
	}
}

function _apaGrid(rows) {
	// Map every cell to its grid position, following rowspan and colspan
	let grid = [];
	let placed = [];
	for (let r = 0; r < rows.length; r++) {
		grid[r] = grid[r] || [];
		let c = 0;
		for (let cell of rows[r].cells) {
			while (grid[r][c])
				c++;
			let rowSpan = Math.max(1, cell.rowSpan || 1);
			let colSpan = Math.max(1, cell.colSpan || 1);
			for (let dr = 0; dr < rowSpan && r + dr < rows.length; dr++) {
				grid[r + dr] = grid[r + dr] || [];
				for (let dc = 0; dc < colSpan; dc++)
					grid[r + dr][c + dc] = cell;
			}
			placed.push({ cell: cell, row: r, col: c, rowSpan: rowSpan, colSpan: colSpan });
			c += colSpan;
		}
	}
	return { grid: grid, placed: placed };
}

function _apaSentence(text) {
	// Notes are joined into one paragraph, so each must end like a sentence. Also drops stray spaces before punctuation.
	text = String(text).trim()
		.replace(/[ \u00A0]+([.,;:])(?=\s|$|<)/g, "$1")	// "group Treat ." -> "group Treat."
		.replace(/([A-Za-z>]) -(?=[A-Za-z])/g, "$1-")		// "p -value" -> "p-value"
		.replace(/,(?=[A-Za-z])/g, ", ");					// "p-value,the" -> "p-value, the"
	return /[.!?]$/.test(_apaPlain(text)) ? text : text + ".";
}

var apaCellPadding	= 4;	// pt, left and right
var apaPageTextWidth = 451;	// pt, text width of an A4 page with 1-inch margins (Letter: 468)
var apaPageWidth	= 440;	// pt, a little under the text width of an A4 or Letter page with 1-inch margins (about 451)

var _apaCanvas = null;
function _apaTextWidth(text) {
	// Width in pt of the text at the table's 12 pt in the common paper fonts (Arial, Google Docs' default, and Times New Roman),
	// whichever is wider. Falls back to an estimate when no canvas is available.
	if (!text)
		return 0;
	try {
		_apaCanvas = _apaCanvas || document.createElement("canvas");
		let ctx = _apaCanvas.getContext("2d");
		let widest = 0;
		for (let font of ["12pt Arial, Helvetica, sans-serif", "12pt 'Times New Roman', Times, serif"]) {
			ctx.font = font;
			widest = Math.max(widest, ctx.measureText(text).width * 0.75);  // px to pt
		}
		if (widest > 0)
			return widest;
	} catch (e) { }
	return text.length * 6.5;
}

function _apaColumnWidths(bodyWidth, headWidth) {
	// Each column fits its widest number or label and its widest heading word (measured at 12 pt).
	// Google Docs ignores pasted column widths: it sizes each column to its longest unbreakable text and, when the
	// total is wider than the page, shrinks every column until numbers break. So a table too wide for the page at
	// 12 pt steps down to 11, 10 or 9 pt type (APA allows smaller type in tables) until it fits. Word uses the
	// widths given here; if the table is still too wide, long heading words give up their room first.
	let extra = 2 * apaCellPadding + 8;  // padding plus room for font differences
	let sum = function (list) { return list.reduce(function (a, b) { return a + b; }, 0); };
	let natural = bodyWidth.map(function (body, c) { return Math.max(body, headWidth[c]); });
	let fontSize = 12;
	for (let size of [12, 11, 10, 9]) {
		fontSize = size;
		if (sum(natural) * size / 12 + (2 * apaCellPadding + 3) * natural.length <= apaPageWidth)  // Docs adds only the padding
			break;
	}
	let scale = fontSize / 12;
	// Spare room per column shrinks (down to the padding) before a table runs past the page
	let room = (apaPageWidth - sum(natural) * scale) / natural.length;
	extra = Math.max(2 * apaCellPadding + 3, Math.min(extra, room));
	let widths = natural.map(function (w) { return w * scale + extra; });
	let total = sum(widths);
	if (total > apaPageWidth) {
		let slack = bodyWidth.map(function (body, c) { return Math.max(0, (headWidth[c] - Math.max(body, 24)) * scale); });
		let slackTotal = sum(slack);
		let cut = Math.min(total - apaPageWidth, slackTotal);
		if (slackTotal > 0)
			widths = widths.map(function (w, c) { return w - cut * slack[c] / slackTotal; });
	}
	return { widths: widths.map(function (w) { return Math.ceil(w); }), fontSize: fontSize };
}

function _apaNotes(footnotes) {
	// APA order: general notes ("Note." symbol), then specific notes (superscript letters), then probability notes (asterisks)
	let general = [];
	let specific = [];
	let probability = [];
	if (!footnotes)
		return { general: general, specific: specific };

	for (let i = 0; i < footnotes.length; i++) {
		let footnote = footnotes[i];
		if (_.isString(footnote)) {
			if (footnote !== "")
				specific.push({ symbol: symbol(i), text: _apaSentence(footnote) });
			continue;
		}
		if (!footnote || !footnote.text)
			continue;
		let sym = footnote.symbol;
		let text = _apaSentence(footnote.text);
		if (_.isNumber(sym))
			specific.push({ symbol: symbol(sym), text: text });
		else if (_.isString(sym) && /^\s*<em>/i.test(sym))  // jaspBase marks general notes with "<em>Note.</em>"
			general.push(text);
		else if (_.isString(sym) && /^[*\u2217\u2020\u2021]+$/.test(_apaPlain(sym)))
			probability.push({ symbol: sym, text: text });
		else
			specific.push({ symbol: sym || "", text: text });
	}
	return { general: general, specific: specific.concat(probability) };
}

// Words that keep their capital in sentence-case headings (names of people and methods)
var apaProperNouns = ["Student", "Welch", "Bayes", "Bayesian", "Levene", "Wilcoxon", "Fisher", "Bonferroni", "Holm", "Tukey",
	"Scheffé", "Mauchly", "Friedman", "Akaike", "Wald", "Pearson", "Spearman", "Kendall", "Cohen", "Hedges", "Glass", "Cronbach",
	"McDonald", "Guttman", "Kaiser", "Bartlett", "Box", "Nagelkerke", "Cox", "Snell", "McFadden", "Tjur", "Poisson", "Gaussian",
	"Monte", "Carlo", "Markov", "Jeffreys", "Cauchy", "Mann", "Whitney", "Kruskal", "Wallis", "Shapiro", "Wilk", "Brown", "Forsythe",
	"Hosmer", "Lemeshow", "Durbin", "Watson", "Sidak", "Šidák", "Dunn", "Games", "Howell", "Greenhouse", "Geisser", "Huynh", "Feldt"];

// Short words that APA title case leaves in lower case
var apaTitleMinorWords = ["a", "an", "the", "and", "but", "or", "for", "nor", "as", "at", "by", "in", "of", "off", "on", "per", "to", "up", "via", "so", "yet", "vs", "vs."];

// JASP labels that APA tables write as standard abbreviations
var apaLabelAbbreviations = { "Mean": "M", "Mean (arithmetic)": "M", "Std. Deviation": "SD", "Standard Deviation": "SD", "Std. Error": "SE",
	"Standard Error": "SE", "Std. Error of Mean": "SE", "Median": "Mdn", "p-value": "p" };

function _apaReplaceText(cell, replace) {
	// Applies replace() to each text node that isn't inside a subscript or superscript
	let walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
	let nodes = [];
	while (walker.nextNode())
		nodes.push(walker.currentNode);
	let first = true;
	for (let node of nodes) {
		if ($(node).closest("sub, sup", cell).length > 0)
			continue;
		node.nodeValue = replace(node.nodeValue, first);
		if (node.nodeValue.trim() !== "")
			first = false;
	}
}

function apaSentenceCase(text, startsHeading) {
	// "Sum of Squares" -> "Sum of squares". Only plain capitalised words change: acronyms (RMSE, CI), symbols (R², t),
	// names (Cohen's, Welch) and words with digits or inner capitals stay as they are.
	let firstWord = startsHeading !== false;
	return text.replace(/[^\s]+/g, function (word) {
		let isFirst = firstWord;
		firstWord = false;
		let core = word.replace(/^[("'\u2018\u201C]+|[)"'\u2019\u201D.,:;]+$/g, "");
		if (isFirst || !/^[A-Z][a-zà-ÿ]+$/.test(core) || apaProperNouns.indexOf(core) !== -1 || /['\u2019]s?$/.test(word.replace(/[).,:;]+$/, "")))
			return word;
		return word.replace(core, core.toLowerCase());
	});
}

function apaTitleCase(text) {
	// APA title case: major words capitalised, short minor words in lower case unless they start the title or follow a colon or dash
	let words = text.split(" ");
	return words.map(function (word, i) {
		let previous = i > 0 ? words[i - 1] : "";
		let afterBreak = i === 0 || /[:\u2013\u2014-]$/.test(previous) || previous === "-";
		if (!afterBreak && apaTitleMinorWords.indexOf(word.toLowerCase()) !== -1 && /^[A-Za-z]+\.?$/.test(word))
			return word.toLowerCase();
		if (/^[a-zà-ÿ]+([-'\u2019][a-zà-ÿ]+)*[.,:;)]?$/.test(word))  // plain lower-case words only: leaves symbols, codes and names alone
			return word.replace(/(^|-)([a-zà-ÿ])/g, function (all, dash, letter) { return dash + letter.toUpperCase(); });
		return word;
	}).join(" ");
}

function apaRenderTable(model) {
	/**
	 * Renders the table with APA decimals: 2 for most statistics, 3 for p values and for columns where 2 decimals
	 * would flatten small values (0.007 -> 0.01). JASP's own decimal settings and exact p-value setting are ignored,
	 * and large numbers are written out in full instead of as exponents.
	 * @returns a <table> element, laid out exactly as JASP draws it
	 */
	let saved = { decimals: window.globSet.decimals, pExact: window.globSet.pExact, exponentAbove: window.globSet.exponentAbove };
	let render = function (decimals) {
		window.globSet.decimals = String(decimals);
		window.globSet.pExact = false;
		window.globSet.exponentAbove = Infinity;  // APA writes large numbers out in full
		let view = new JASPWidgets.tablePrimitive({ model: model });
		view.render();
		return view.$el.find("table").get(0);
	};
	let two, three;
	try {
		two = render(2);
		three = render(3);
	} finally {
		window.globSet.decimals = saved.decimals;
		window.globSet.pExact = saved.pExact;
		window.globSet.exponentAbove = saved.exponentAbove;
	}

	let rowsOf = function (table) { return $(table).children("thead, tbody").children("tr").toArray(); };
	let gridTwo = _apaGrid(rowsOf(two));
	let gridThree = _apaGrid(rowsOf(three));
	// p values: cells under a p heading (p, p-value, p with a subscript) or in a row labelled as one
	let isPLabel = function (cell) { return !!cell && /^p(-value)?(\s*\(.*\))?$/.test(_apaLabel(cell)); };
	let headLast = $(two).children("thead").children("tr").length - 1;
	let isPCell = function (item) {
		let pColumn = headLast >= 0 && isPLabel(gridTwo.grid[headLast][item.col]);
		let pRow = gridTwo.grid[item.row].some(function (cell) { return cell !== item.cell && isPLabel(cell); });
		return pColumn || pRow || /(^|\s)p-value(\s|$)/.test(item.cell.className);
	};

	// Columns where 2 decimals would flatten small values (p values don't count: they always get 3)
	let needsThree = {};
	for (let item of gridTwo.placed) {
		if (item.row <= headLast || isPCell(item))
			continue;
		let text = _apaPlain(item.cell.innerHTML);
		let other = gridThree.grid[item.row] && gridThree.grid[item.row][item.col];
		let otherText = other ? _apaPlain(other.innerHTML) : "";
		let flattened = /^[-\u2212]?0[.,]0\d$/.test(text) && !/^[-\u2212]?0[.,]000$/.test(otherText);
		let exponentOnlyAtTwo = /×10/.test(text) && !/×10/.test(otherText);  // JASP writes values under 0.01 as 7.00×10⁻³
		if (other && (flattened || exponentOnlyAtTwo))
			needsThree[item.col] = true;
	}
	for (let item of gridTwo.placed) {
		let other = gridThree.grid[item.row] && gridThree.grid[item.row][item.col];
		if (!other || item.row <= headLast || other === (gridThree.grid[item.row - 1] || [])[item.col])
			continue;
		if (isPCell(item) || (needsThree[item.col] && item.cell.tagName === other.tagName))
			item.cell.innerHTML = other.innerHTML;
	}
	return two;
}

function _apaCorrelationMatrix(table) {
	// Correlation matrices number their variables in the rows ("1. sales"); APA repeats only the numbers as column
	// headings and leaves out the last column when it holds nothing but the diagonal dash.
	let $table = $(table);
	let numbers = {};
	$table.children("tbody").children("tr").each(function () {
		let first = this.cells[0];
		let match = first ? _apaPlain(first.innerHTML).match(/^(\d+)\.\s+(.+)$/) : null;
		if (match)
			numbers[match[2]] = match[1];
	});
	let headRow = $table.children("thead").children("tr").last().get(0);
	if (!headRow)
		return false;
	let renamed = 0;
	for (let cell of headRow.cells) {
		let number = numbers[_apaPlain(cell.innerHTML)];
		if (number !== undefined) {
			cell.textContent = number;
			renamed++;
		}
	}
	if (renamed < 2)
		return false;

	// Drop the last column if it only holds dashes or nothing (no row or column spans reach into it)
	let rows = $table.children("thead, tbody").children("tr").toArray();
	let layout = _apaGrid(rows);
	let last = Math.max(0, ...layout.grid.map(function (row) { return row.length; })) - 1;
	let lastCells = layout.placed.filter(function (item) { return item.col + item.colSpan - 1 === last; });
	let onlyHead = lastCells.every(function (item) {
		return item.colSpan === 1 && (item.row < $table.children("thead").children("tr").length || /^[\s\u2014\u2013-]*$/.test(_apaPlain(item.cell.innerHTML)));
	});
	if (onlyHead && lastCells.length > 0 && lastCells.some(function (item) { return item.row >= $table.children("thead").children("tr").length; }))
		lastCells.forEach(function (item) { item.cell.remove(); });
	return true;
}

// Placeholders for what only the user can fill in: highlighted so they can't be missed in the document
var apaTodoStyle = "background-color: #ffff00; mso-highlight: yellow";	// Docs reads background-color, Word mso-highlight
function _apaTodo(text) {
	return '<span data-apa-todo="1" style="' + apaTodoStyle + '">[' + _apaEscape(text) + "]</span>";
}

// Abbreviations APA wants explained in the table note (standard statistical symbols such as M, SD, df need none)
var apaAbbreviationMeanings = { "CI": "confidence interval", "RMSE": "root mean square error", "AIC": "Akaike information criterion",
	"BIC": "Bayesian information criterion", "VS-MPR": "Vovk-Sellke maximum p-ratio", "VIF": "variance inflation factor",
	"RMSEA": "root mean square error of approximation", "CFI": "comparative fit index", "TLI": "Tucker-Lewis index",
	"SRMR": "standardized root mean square residual", "ICC": "intraclass correlation coefficient", "OR": "odds ratio",
	"MSE": "mean squared error", "IQR": "interquartile range", "MAD": "median absolute deviation", "BF₁₀": "Bayes factor in favour of the alternative hypothesis",
	"BF₀₁": "Bayes factor in favour of the null hypothesis", "LL": "lower limit", "UL": "upper limit", "MS": "mean square", "SS": "sum of squares" };

function apaTidyLabel(text, isFirst) {
	/**
	 * Turns a variable-name style label into APA wording, one text piece at a time:
	 * "exam_score" -> "Exam score", "FaceType" -> "Face type", "A:B" -> "A × B", "Food as Reward" -> "Food as reward",
	 * "sales" -> "Sales". Abbreviations written in lower case without vowels ("drp") can't be guessed and are returned
	 * in `unclear` so they can be highlighted.
	 */
	let unclear = [];
	let prefix = "";
	let numbered = text.match(/^(\s*\d+\.\s+)([\s\S]*)$/);  // "1. sales" in correlation matrices
	if (numbered) {
		prefix = numbered[1];
		text = numbered[2];
	}
	// Interaction terms written with a colon, and identifiers with underscores or dots
	text = text.replace(/([A-Za-z][\w.]*):(?=[A-Za-z])/g, "$1 × ");
	text = text.replace(/\b([A-Za-z][A-Za-z0-9]*)([_.][A-Za-z0-9]+)+\b/g, function (word) { return /^[A-Za-z]\.$|\.\d/.test(word) ? word : word.replace(/[_.]+/g, " "); });
	// camelCase and PascalCase identifiers, but not names such as McDonald
	text = text.replace(/\b[A-Za-z][a-z]+(?:[A-Z][a-z]+)+\b/g, function (word) {
		if (apaProperNouns.indexOf(word) !== -1 || /^Mc|^Mac/.test(word))
			return word;
		return word.replace(/([a-z])([A-Z])/g, "$1 $2");
	});
	text = apaSentenceCase(text, isFirst);
	if (isFirst !== false)
		text = text.replace(/^(\s*)([a-zà-ÿ][a-zà-ÿ'-]*)/, function (all, space, word) {
			let lead = word.split("-")[0];
			if (apaItalicSymbols.indexOf(lead) !== -1 || apaItalicSymbols.indexOf(word) !== -1)  // statistics stay as they are: t, df, z-value
				return all;
			if (!/[aeiouyà-ÿ]/.test(word) && word.length <= 5) {  // likely an abbreviation: only the user knows how to write it
				unclear.push(word);
				return all;
			}
			return space + word.charAt(0).toUpperCase() + word.slice(1);
		});
	return { text: prefix + text, unclear: unclear };
}

function _apaHighlightWords(cell, words) {
	if (words.length === 0)
		return;
	let pattern = new RegExp("(^|[^\\p{L}])(" + words.map(function (w) { return w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }).join("|") + ")(?=$|[^\\p{L}])", "gu");
	let walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
	let nodes = [];
	while (walker.nextNode())
		nodes.push(walker.currentNode);
	for (let node of nodes) {
		if (!pattern.test(node.nodeValue))
			continue;
		pattern.lastIndex = 0;
		let span = document.createElement("span");
		span.innerHTML = _apaEscape(node.nodeValue).replace(pattern, '$1<span data-apa-todo="1" style="' + apaTodoStyle + '">$2</span>');
		node.replaceWith(...span.childNodes);
	}
}

function _apaCorrelationStars(table) {
	// APA correlation matrices mark significance with asterisks instead of separate p-value rows. Returns the
	// probability note, or null when the table has no p rows (or a layout this can't safely change).
	let $table = $(table);
	let headCount = $table.children("thead").children("tr").length;
	let rows = $table.children("thead, tbody").children("tr").toArray();
	let layout = _apaGrid(rows);
	let rowLabel = function (r, pattern) {
		return layout.placed.some(function (item) { return item.row === r && pattern.test(_apaLabel(item.cell)); });
	};
	let isR = /^(Pearson's r|Spearman's rho|Kendall's [Tt]au[ -]?[Bb]?|r|rho|tau)$/;
	let isP = /^p(-value)?$/;
	let pRows = [];
	for (let r = headCount; r < rows.length; r++)
		if (rowLabel(r, isP)) {
			let rRow = -1;
			for (let back = r - 1; back >= headCount && rRow === -1; back--)
				if (rowLabel(back, isR))
					rRow = back;
			if (rRow === -1)
				return null;
			if (layout.placed.some(function (item) { return item.row === r && item.rowSpan > 1; }))
				return null;  // a label spanning down from the p row: leave the table as it is
			pRows.push({ p: r, r: rRow });
		}
	if (pRows.length === 0)
		return null;

	let used = {};
	for (let pair of pRows)
		for (let item of layout.placed) {
			if (item.row !== pair.p)
				continue;
			let text = _apaPlain(item.cell.innerHTML).replace(/\s/g, "");
			let below = text.charAt(0) === "<";
			let value = parseFloat(text.replace(/^</, "").replace(/^\./, "0.").replace(/^-\./, "-0."));
			if (isNaN(value))
				continue;
			if (below)
				value = value / 2;
			let stars = value < .001 ? "***" : value < .01 ? "**" : value < .05 ? "*" : "";
			let rCell = layout.grid[pair.r][item.col];
			if (stars === "" || !rCell || /\*/.test(rCell.textContent))
				continue;
			rCell.appendChild(document.createTextNode(stars));
			used[stars] = true;
		}
	// Remove the p rows; labels spanning into them from above get shorter
	for (let pair of pRows.slice().reverse()) {
		for (let item of layout.placed)
			if (item.row < pair.p && item.row + item.rowSpan - 1 >= pair.p)
				item.cell.rowSpan = Math.max(1, item.cell.rowSpan - 1);
		rows[pair.p].remove();
	}
	let levels = [["*", ".05"], ["**", ".01"], ["***", ".001"]].filter(function (level) { return used[level[0]]; });
	if (levels.length === 0)
		return { symbol: "", text: "" };
	return { symbol: "", text: levels.map(function (level) { return level[0] + "<i>p</i> &lt; " + level[1] + "."; }).join(" ") };
}

function _apaTransposeDescriptives(table) {
	// JASP's Descriptive Statistics has the variables as columns; APA puts them in rows, statistics across the top.
	// Split tables (a second heading row with the groups) get a Group column. Missing goes when it is 0 everywhere;
	// without groups, Valid goes too when every variable has the same n, and that N is returned for the note.
	// Only plain tables are turned (statistics in the first column, no spanning cells in the body). Returns { turned, n }.
	let $table = $(table);
	let headRows = $table.children("thead").children("tr").toArray();
	let bodyRows = $table.children("tbody").children("tr").toArray();
	if (headRows.length < 1 || headRows.length > 2 || bodyRows.length < 2)
		return { turned: false };
	if (bodyRows.some(function (row) { return Array.from(row.cells).some(function (c) { return c.rowSpan > 1 || c.colSpan > 1; }); }))
		return { turned: false };
	let heads = _apaGrid(headRows).grid;
	let width = heads[heads.length - 1].length;
	if (width < 2 || bodyRows.some(function (row) { return row.cells.length !== width; }))
		return { turned: false };
	let grouped = headRows.length === 2;
	let stats = bodyRows.map(function (row) { return _apaLabel(row.cells[0]); });
	let known = /^(Valid|Missing|Mean.*|Std\. Deviation|Std\. Error.*|Median|Mode|Minimum|Maximum|Range|Variance|Skewness|Kurtosis|Sum|IQR|.*percentile|.*quartile|Shapiro-Wilk|P-value of Shapiro-Wilk|Coefficient of variation)$/i;
	if (stats.filter(function (label) { return known.test(label); }).length < 2)
		return { turned: false };

	let rowOf = function (name) { return bodyRows.find(function (row) { return _apaLabel(row.cells[0]) === name; }); };
	let counts = function (row) { return Array.from(row.cells).slice(1).map(function (c) { return _apaCount(_apaPlain(c.innerHTML)); }); };
	let valid = rowOf("Valid"), missing = rowOf("Missing");
	let noneMissing = !missing || counts(missing).every(function (v) { return v === 0; });
	if (missing && noneMissing)
		bodyRows = bodyRows.filter(function (row) { return row !== missing; });
	let n = null;
	if (valid) {
		let v = counts(valid);
		if (!grouped && noneMissing && v.length > 0 && v.every(function (x) { return x === v[0]; })) {
			n = v[0];
			bodyRows = bodyRows.filter(function (row) { return row !== valid; });
		}
		else
			valid.cells[0].textContent = "n";
	}

	let head = document.createElement("tr");
	let addHead = function (html) { let th = document.createElement("th"); th.innerHTML = html; head.appendChild(th); };
	addHead("Variable");
	if (grouped)
		addHead("Group");
	for (let row of bodyRows)
		addHead(row.cells[0].innerHTML);
	let body = [];
	let lastVariable = null;
	for (let c = 1; c < width; c++) {
		let tr = document.createElement("tr");
		let variable = heads[0][c];
		let name = document.createElement("td");
		name.className = "text";
		name.innerHTML = variable && variable !== lastVariable ? variable.innerHTML : "";
		lastVariable = variable;
		tr.appendChild(name);
		if (grouped) {
			let group = document.createElement("td");
			group.className = "text";
			group.innerHTML = heads[1][c] ? heads[1][c].innerHTML : "";
			tr.appendChild(group);
		}
		for (let row of bodyRows)
			tr.appendChild(row.cells[c].cloneNode(true));
		body.push(tr);
	}
	$table.children("thead").empty().append(head);
	$table.children("tbody").empty().append(body);
	return { turned: true, n: n };
}

function _apaCorrelationSampleRows(table) {
	// When every pair in a correlation matrix has the same n, APA gives N once in the note: the n rows go.
	// Returns that N, or null (sizes differ, or no n rows), leaving the table as it was.
	let $table = $(table);
	let headCount = $table.children("thead").children("tr").length;
	let rows = $table.children("thead, tbody").children("tr").toArray();
	let layout = _apaGrid(rows);
	let nRows = [];
	for (let r = headCount; r < rows.length; r++)
		if (layout.placed.some(function (item) { return item.row === r && item.colSpan === 1 && /^(n|N)$/.test(_apaLabel(item.cell)); }))
			nRows.push(r);
	if (nRows.length === 0)
		return null;
	let values = [];
	for (let r of nRows)
		for (let item of layout.placed)
			if (item.row === r) {
				let value = _apaCount(_apaPlain(item.cell.innerHTML));
				if (!isNaN(value))
					values.push(value);
			}
	if (values.length === 0 || !values.every(function (v) { return v === values[0]; }))
		return null;

	for (let r of nRows.slice().reverse()) {
		let next = rows[r + 1] && rows[r + 1].parentNode === rows[r].parentNode ? r + 1 : -1;
		for (let item of layout.placed) {
			if (item.row < r && item.row + item.rowSpan - 1 >= r)
				item.cell.rowSpan = Math.max(1, item.cell.rowSpan - 1);  // a label spanning into the n row
			else if (item.row === r && item.rowSpan > 1) {
				// A label starting on the n row moves down to the next row
				let cell = item.cell;
				cell.rowSpan = item.rowSpan - 1;
				let anchor = layout.placed.find(function (o) { return o.row === r + 1 && o.col > item.col; });
				rows[r + 1].insertBefore(cell, anchor ? anchor.cell : null);
			}
			else if (item.row === r && item.col === 0 && _apaPlain(item.cell.innerHTML) !== "" && next !== -1) {
				// The variable name sits on the n row only: carry it to the row below if that one is empty there
				let below = layout.grid[next][0];
				if (below && below !== item.cell && _apaPlain(below.innerHTML) === "")
					below.innerHTML = item.cell.innerHTML;
			}
		}
		rows[r].remove();
	}
	return values[0];
}

function _apaCorrelationLabelColumn(table) {
	// The statistic column of a correlation matrix ("Pearson's r" on every row) says nothing once the p rows are gone:
	// drop it. If it names more than one statistic (r and confidence limits), head it "Statistic".
	let $table = $(table);
	let headCount = $table.children("thead").children("tr").length;
	let rows = $table.children("thead, tbody").children("tr").toArray();
	let layout = _apaGrid(rows);
	let columns = Math.max(0, ...layout.grid.map(function (row) { return row.length; }));
	for (let c = 1; c < columns; c++) {
		let body = layout.placed.filter(function (item) { return item.row >= headCount && item.col === c; });
		let labels = body.map(function (item) { return _apaLabel(item.cell); }).filter(function (label) { return label !== ""; });
		if (labels.length === 0 || !labels.every(function (label) { return /^(Pearson's r|Spearman's rho|Kendall's [Tt]au[ -]?[Bb]?|r|rho|tau|p(-value)?|N|n|(Lower|Upper) \d+% CI|Effect size.*|Fisher's z|SE effect size)$/.test(label); }))
			continue;
		let column = layout.placed.filter(function (item) { return item.col <= c && c < item.col + item.colSpan; });
		if (column.some(function (item) { return item.colSpan > 1 || item.col !== c; }))
			return;
		let distinct = labels.filter(function (label, i) { return labels.indexOf(label) === i; });
		if (distinct.length === 1)
			column.forEach(function (item) { item.cell.remove(); });
		else {
			let head = layout.grid[headCount - 1] && layout.grid[headCount - 1][c];
			if (head && _apaPlain(head.innerHTML) === "")
				head.textContent = "Statistic";
		}
		return;
	}
}

function _apaReadTable(tableElement) {
	// Headings (last heading row) and body text of a results table, by grid column
	let $t = $(tableElement);
	let headRows = $t.children("thead").children("tr").toArray();
	let bodyRows = $t.children("tbody").children("tr").toArray();
	let layout = _apaGrid(headRows.concat(bodyRows));
	let width = Math.max(0, ...layout.grid.map(function (row) { return row.length; }));
	let text = function (r, c) { let cell = layout.grid[r] && layout.grid[r][c]; return cell ? _apaLabel(cell) : ""; };
	let heads = [];
	for (let c = 0; c < width; c++)
		heads.push(headRows.length > 0 ? text(headRows.length - 1, c) : "");
	let body = [];
	for (let r = headRows.length; r < layout.grid.length; r++) {
		let row = [];
		for (let c = 0; c < width; c++)
			row.push(text(r, c));
		body.push(row);
	}
	return { heads: heads, body: body };
}

function _apaCount(text) {
	// "1,296" -> 1296; anything that isn't a whole number -> NaN
	let clean = String(text).replace(/[,\s   ]/g, "");
	return /^\d+([.]0+)?$/.test(clean) ? Math.round(parseFloat(clean)) : NaN;
}

function apaSampleSize(tableElement, title, otherTables) {
	/**
	 * The sample size for the table note ("N = 200"), from what the analysis itself reports, so missing values and
	 * filters are already accounted for. Returns { shown: true } when the table already shows it, { n: 200 } when
	 * every source agrees, { varies: true } when the variables have different sizes, or {} when nothing says.
	 * otherTables are <table> elements whose first heading row is the title, or { table, title } objects.
	 */
	let tableOf = function (other) { return other && other.table ? other.table : other; };
	let titleOf = function (other) { return other && other.table ? _apaPlain(other.title || "") : $(other).children("thead").children("tr").first().text(); };
	let isCount = /^(N|n|Valid|Count)$/;
	let own = _apaReadTable(tableElement);
	let ownLabels = own.heads.concat(own.body.map(function (row) { return row[0]; }), own.body.map(function (row) { return row[1] || ""; }));
	if (ownLabels.some(function (label) { return isCount.test(label); }))
		return { shown: true };

	let found = [];
	let add = function (values) {
		values = values.filter(function (v) { return !isNaN(v) && v > 0; });
		if (values.length > 0)
			found.push(values);
	};

	// Counts in the analysis's other tables: an N column (summed over groups), or Valid / n rows
	for (let other of otherTables || []) {
		let t = _apaReadTable(tableOf(other));
		let nCol = t.heads.findIndex(function (h) { return /^(N|n)$/.test(h); });
		if (nCol >= 0) {
			let grouped = t.heads.some(function (h, c) { return c > 0 && c < nCol && h !== ""; });
			let sums = [];
			for (let row of t.body) {
				if (!grouped || row[0] !== "" || sums.length === 0)
					sums.push(0);
				sums[sums.length - 1] += _apaCount(row[nCol]);
			}
			add(sums);
		}
		for (let row of t.body)
			for (let c = 0; c < 2 && c < row.length; c++)
				if (/^(Valid|N|n)$/.test(row[c]))
					add(row.slice(c + 1).map(_apaCount));
	}

	// Degrees of freedom of tests whose N follows from them
	let dfFrom = function (t, name) {
		let dfCol = t.heads.indexOf("df");
		if (dfCol < 0)
			return;
		let testCol = t.heads.indexOf("Test");
		let rows = t.body.filter(function (row) { return testCol < 0 || row[testCol] === "Student"; });
		if (/Independent Samples T-Test/i.test(name))
			add(rows.map(function (row) { return _apaCount(row[dfCol]) + 2; }));
		else if (/(Paired Samples|One Sample) T-Test/i.test(name))
			add(rows.map(function (row) { return _apaCount(row[dfCol]) + 1; }));
		else {
			let total = t.body.find(function (row) { return row[0] === "Total" || row[1] === "Total"; });
			let residuals = t.body.some(function (row) { return row[0] === "Residuals"; });
			if (total)
				add([_apaCount(total[dfCol]) + 1]);
			else if (residuals && /^ANOVA/.test(name.trim()) && !/Repeated|Within/i.test(name)) {
				// Between-subjects ANOVA: the df of every row (Residuals too) add up to N - 1
				let sum = 0;
				for (let row of t.body)
					sum += row[dfCol] === "" ? 0 : _apaCount(row[dfCol]);
				add([sum + 1]);
			}
		}
	};
	let dfPair = function (t, name) {
		// Tests of equal variances (Levene, Brown-Forsythe): df1 = groups - 1, df2 = N - groups
		let df1 = t.heads.indexOf("df1"), df2 = t.heads.indexOf("df2");
		if (df1 >= 0 && df2 >= 0 && /Equality of Variances|Levene|Brown-Forsythe/i.test(name))
			add(t.body.map(function (row) { return _apaCount(row[df1]) + _apaCount(row[df2]) + 1; }));
	};
	dfFrom(own, title);
	dfPair(own, title);
	for (let other of otherTables || []) {
		let titleCell = titleOf(other);
		dfFrom(_apaReadTable(tableOf(other)), titleCell);
		dfPair(_apaReadTable(tableOf(other)), titleCell);
	}

	let all = [].concat(...found);
	if (all.length === 0)
		return {};
	if (all.every(function (v) { return v === all[0]; }))
		return { n: all[0] };
	return { varies: true };
}

function apaClipboardHTML(html) {
	return "<html><head><meta charset=\"utf-8\"></head><body>" + html + "</body></html>";
}

function buildAPATable(tableElement, info, tableNumber) {
	/**
	 * Builds an APA 7 version of a rendered results table.
	 * @param tableElement	the <table> as drawn by JASPWidgets.tablePrimitive
	 * @param info			{ title, subtitle, footnotes } from the table model
	 * @param tableNumber	number shown in "Table N"
	 * @returns { html, text } for the clipboard
	 */
	let table = tableElement.cloneNode(true);
	let $table = $(table);

	// Drop what isn't part of an APA table: the title and subtitle rows, the toolbar, layout helpers and the footer
	let theadRows = $table.children("thead").children("tr");
	theadRows.slice(0, info.subtitle ? 2 : 1).remove();
	$table.find("td.squash-left, .toolbar, .do-not-copy").remove();
	$table.children("tfoot").remove();
	$table.find("div.over-title-space").each(function () { $(this).replaceWith(this.childNodes); });

	let turned = /^Descriptive Statistics/i.test(_apaPlain(info.title)) ? _apaTransposeDescriptives(table) : { turned: false };
	let isCorrelationMatrix = _apaCorrelationMatrix(table);
	let matrixOfCorrelations = isCorrelationMatrix && (/correlation/i.test(_apaPlain(info.title)) || /Pearson|Spearman|Kendall/.test(table.textContent));
	let starsNote = isCorrelationMatrix ? _apaCorrelationStars(table) : null;
	let matrixN = isCorrelationMatrix ? _apaCorrelationSampleRows(table) : null;
	if (isCorrelationMatrix)
		_apaCorrelationLabelColumn(table);
	let todo = [];

	let headRows = $table.children("thead").children("tr").toArray();
	let bodyRows = $table.children("tbody").children("tr").toArray();
	let allRows = headRows.concat(bodyRows);
	let layout = _apaGrid(allRows);
	let columnCount = Math.max(0, ...layout.grid.map(function (row) { return row.length; }));

	let isTextCell = function (item) {
		return item.col === 0 || /(^|\s)(text|string)(\s|$)/.test(item.cell.getAttribute("class") || "");
	};

	// A "Statistic" column that only holds t tests (Student, Welch) is headed t
	let headLast = headRows.length - 1;
	if (headLast >= 0) {
		let statistic = layout.placed.find(function (item) { return item.row === headLast && /^Statistic$/.test(_apaLabel(item.cell)); });
		let testColumn = layout.placed.find(function (item) { return item.row === headLast && /^Test$/.test(_apaLabel(item.cell)); });
		if (statistic && testColumn) {
			let tests = layout.placed.filter(function (item) { return item.row > headLast && item.col === testColumn.col; }).map(function (item) { return _apaLabel(item.cell); });
			if (tests.length > 0 && tests.every(function (name) { return /^(Student|Welch)$/.test(name); }))
				statistic.cell.textContent = "t";
		}
	}

	// APA symbols: lower-case chi (χ², JASP writes a capital Χ) and × for interactions (JASP writes ✻)
	for (let item of layout.placed)
		_apaReplaceText(item.cell, function (text) { return text.replace(/\u03A7(?=²|\u00B2|\s*<sup)/g, "\u03C7").replace(/\u03A7²/g, "\u03C7²").replace(/\s*\u273B\s*/g, " \u00D7 "); });

	// Standard abbreviations for JASP's labels (Std. Deviation -> SD), in headings and row labels
	for (let item of layout.placed) {
		let abbreviation = apaLabelAbbreviations[_apaLabel(item.cell)];
		if (abbreviation !== undefined && $(item.cell).find("sub").length === 0)
			_apaReplaceText(item.cell, function (text) { return text.trim() === "" ? text : text.replace(/\S.*\S|\S/, abbreviation); });
	}

	// Leading zeros: by column heading (p, r, ...) and by row label (correlation matrices). Confidence limits of a
	// correlation are bounded too.
	let correlationLabels = ["r", "Pearson's r", "Spearman's rho", "Kendall's Tau B", "ρ", "τ", "rho", "tau"];
	let hasCorrelation = isCorrelationMatrix || layout.placed.some(function (item) { return correlationLabels.indexOf(_apaLabel(item.cell)) !== -1; });
	let isZeroLeadLabel = function (cell) {
		let label = _apaLabel(cell);
		return apaNoZeroLeadLabels.indexOf(label) !== -1
			|| /(^|\s)correlation(\s|$)/i.test(label)
			|| /^(Cronbach's α|McDonald's ω|Guttman's λ\S*|Pearson's r|Spearman's rho|Kendall's (tau|Tau)\S*)(\s|$)/.test(label)
			|| (hasCorrelation && /(^|\s)(CI|Lower|Upper)(\s|$)/i.test(label));
	};
	let headingRow = headRows.length > 0 ? headRows.length - 1 : -1;
	let zeroLeadColumns = {};
	for (let r = 0; r <= headingRow; r++)  // the heading or a spanning heading above it
		for (let c = 0; c < columnCount; c++)
			if (layout.grid[r][c] && isZeroLeadLabel(layout.grid[r][c]))
				zeroLeadColumns[c] = true;

	for (let r = headRows.length; r < allRows.length; r++) {
		let rowHasLabel = matrixOfCorrelations || layout.grid[r].some(function (cell) { return cell && isZeroLeadLabel(cell); });
		for (let c = 0; c < columnCount; c++) {
			let cell = layout.grid[r][c];
			if (cell && (zeroLeadColumns[c] || rowHasLabel) && (layout.grid[r - 1] === undefined || layout.grid[r - 1][c] !== cell))
				_apaDropZeroLead(cell);
		}
	}

	// Headings and row labels in APA wording ("Sum of squares", "Face type", "Food as reward"), with abbreviations
	// that can't be guessed ("drp") highlighted; then italic symbols in headings. Row labels that are statistics
	// ("Pearson's r", "N") get italic symbols too.
	let unclearWords = [];
	for (let item of layout.placed) {
		if (item.row >= headRows.length && !isTextCell(item))
			continue;
		let unclear = [];
		_apaReplaceText(item.cell, function (text, first) {
			let tidy = apaTidyLabel(text, first);
			unclear = unclear.concat(tidy.unclear);
			return tidy.text;
		});
		_apaHighlightWords(item.cell, unclear);
		unclearWords = unclearWords.concat(unclear.filter(function (w) { return unclearWords.indexOf(w) === -1; }));
	}
	if (unclearWords.length > 0)
		todo.push(i18n("write out or explain these names:") + " " + unclearWords.join(", "));
	for (let row of headRows)
		for (let cell of row.cells)
			_apaItaliciseSymbols(cell);
	for (let row of bodyRows)
		for (let cell of row.cells) {
			let label = _apaLabel(cell);
			if (apaNoZeroLeadLabels.indexOf(label) !== -1 || apaItalicSymbols.indexOf(label) !== -1)
				_apaItaliciseSymbols(cell);
		}

	// Every column needs a heading: empty ones over text get a placeholder (columns of only "-" or "→" belong to their
	// neighbours and stay empty)
	let missingHeadings = 0;
	for (let c = 0; c < columnCount; c++) {
		let headed = layout.placed.some(function (item) { return item.row < headRows.length && item.col <= c && c < item.col + item.colSpan && _apaPlain(item.cell.innerHTML) !== ""; });
		let hasText = layout.placed.some(function (item) { return item.row >= headRows.length && item.col === c && /[\p{L}\d]/u.test(_apaPlain(item.cell.innerHTML)); });
		let headCell = headLast >= 0 ? layout.grid[headLast][c] : null;
		if (!headed && hasText && headCell && headCell.colSpan === 1 && c === 0 && /Descriptives|Descriptive Statistics/i.test(_apaPlain(info.title))) {
			headCell.textContent = "Variable";  // descriptives list variables in the first column
			continue;
		}
		if (!headed && hasText && headCell && headCell.colSpan === 1) {
			headCell.innerHTML = _apaTodo(i18n("Add heading"));
			missingHeadings++;
		}
	}
	if (missingHeadings > 0)
		todo.push(i18n("add the missing column headings"));

	// Column widths: word processors (Google Docs especially) squeeze columns until numbers break,
	// so give each column room for its longest number or label and its longest heading word
	let bodyWidth = Array(columnCount).fill(0);
	let headWidth = Array(columnCount).fill(0);
	for (let item of layout.placed) {
		if (item.colSpan !== 1 || $(item.cell).find("[data-apa-todo]").length > 0)  // placeholders wrap, they don't size columns
			continue;
		let text = _apaPlain(item.cell.innerHTML);
		if (item.row < headRows.length)  // headings may wrap between words
			headWidth[item.col] = Math.max(headWidth[item.col], ...text.split(" ").map(_apaTextWidth));
		else
			bodyWidth[item.col] = Math.max(bodyWidth[item.col], _apaTextWidth(text));
	}
	let sizing = _apaColumnWidths(bodyWidth, headWidth);
	let columnWidths = sizing.widths;

	// Numbers: no space before %, commas in numbers of 1,000 or more (not in df columns, as APA says),
	// and no line breaks at inner spaces ("< .001")
	let dfColumns = {};
	for (let item of layout.placed)
		if (item.row === headRows.length - 1 && /^df\d*$/.test(_apaLabel(item.cell)))
			dfColumns[item.col] = true;
	let wholeColumns = Object.assign({}, dfColumns);
	for (let item of layout.placed)
		if (item.row === headRows.length - 1 && /^(n|N|Missing|Valid|Count)$/.test(_apaLabel(item.cell)))
			wholeColumns[item.col] = true;
	for (let c in wholeColumns) {
		let cells = layout.placed.filter(function (item) { return item.col === +c && item.row >= headRows.length; });
		if (cells.every(function (item) { return /^(\d+([.,]0+)?)?$/.test(_apaPlain(item.cell.innerHTML)); }))
			cells.forEach(function (item) { _apaReplaceText(item.cell, function (text) { return text.replace(/^(\s*\d+)[.,]0+/, "$1"); }); });
	}
	let groupThousands = /^en/.test(typeof currentLocaleId === "string" ? currentLocaleId : "en");
	for (let item of layout.placed) {
		if (item.row < headRows.length || isTextCell(item))
			continue;
		_apaReplaceText(item.cell, function (text) {
			text = text.replace(/(\d)[ \u00A0\u2009\u202F]+%/g, "$1%");
			if (groupThousands && !dfColumns[item.col])
				text = text.replace(/(^|[^\d.,])(\d{4,})/g, function (all, before, digits) { return before + digits.replace(/\B(?=(\d{3})+$)/g, ","); });
			return text;
		});
	}
	for (let item of layout.placed) {
		if (item.row < headRows.length || isTextCell(item))
			continue;
		let walker = document.createTreeWalker(item.cell, NodeFilter.SHOW_TEXT);
		while (walker.nextNode())
			walker.currentNode.nodeValue = walker.currentNode.nodeValue.replace(/[ \u2009]/g, "\u00A0");
	}

	// Clean every cell and apply APA rules (horizontal lines only)
	let rule = "1px solid #000";
	let lastRow = allRows.length - 1;
	for (let item of layout.placed) {
		let cell = item.cell;
		let isHead = item.row < headRows.length;
		// Every border and background is set explicitly: the clipboard wrapper (wrapHTML) carries JASP's
		// own table stylesheet, with row shading and a line under every heading cell
		let style = ["font-size: " + sizing.fontSize + "pt", "padding: 2pt " + apaCellPadding + "pt", "font-weight: normal", "font-style: normal", "background: transparent",
			"border-left: none", "border-right: none", "vertical-align: " + (isHead ? "bottom" : "top")];
		let top = "none";
		let bottom = "none";
		// Text (labels, and headings over text columns) is left-aligned, numbers are centred
		style.push("text-align: " + (isTextCell(item) ? "left" : "center"));
		if (item.colSpan === 1) {
			// Google Docs reads the width attribute (px), Word the style
			style.push("width: " + columnWidths[item.col] + "pt");
			cell.setAttribute("width", Math.round(columnWidths[item.col] * 4 / 3));
		}
		if (!isHead && !isTextCell(item))
			style.push("white-space: nowrap");
		if (item.row === 0)
			top = rule;
		if (item.row === headRows.length - 1 || item.row + item.rowSpan - 1 === lastRow)
			bottom = rule;
		else if (isHead && item.row < headRows.length - 1 && _apaPlain(cell.innerHTML) !== "")
			bottom = rule;  // line under a spanning heading
		style.push("border-top: " + top, "border-bottom: " + bottom);
		cell.removeAttribute("class");
		cell.setAttribute("style", style.join("; "));
		$(cell).find("[style]:not([data-apa-todo])").removeAttr("style");
		$(cell).find("[class]").removeAttr("class");
		$(cell).find("[data-apa-todo]").removeAttr("data-apa-todo");
	}
	table.removeAttribute("class");
	let tableWidth = columnWidths.reduce(function (a, b) { return a + b; }, 0);
	table.setAttribute("style", "border-collapse: collapse; font-size: " + sizing.fontSize + "pt; margin: 0; width: " + tableWidth + "pt;");
	table.setAttribute("width", Math.round(tableWidth * 4 / 3));
	let colgroup = document.createElement("colgroup");
	for (let width of columnWidths) {
		let col = document.createElement("col");
		col.setAttribute("style", "width: " + width + "pt");
		col.setAttribute("width", Math.round(width * 4 / 3));
		colgroup.appendChild(col);
	}
	table.insertBefore(colgroup, table.firstChild);

	let notes = _apaNotes(info.footnotes);
	let noteLabel = i18n("Note.");
	if (starsNote && starsNote.text)
		notes.specific.push(starsNote);

	// Explain the abbreviations used in the table, unless the notes already do
	let tableText = _apaPlain(table.innerHTML);
	let noteText = _apaPlain(notes.general.concat(notes.specific.map(function (n) { return n.text; })).join(" "));
	let explained = [];
	for (let abbreviation in apaAbbreviationMeanings) {
		let pattern = new RegExp("(^|[^\\p{L}\\p{N}-])" + abbreviation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?=$|[^\\p{L}\\p{N}-])", "u");
		let meaning = apaAbbreviationMeanings[abbreviation];
		if (pattern.test(tableText) && noteText.indexOf(abbreviation + " =") === -1 && noteText.toLowerCase().indexOf(meaning.toLowerCase()) === -1)
			explained.push(abbreviation + " = " + meaning);
	}
	if (explained.length > 0)
		notes.general.unshift(_apaEscape(explained.join("; ")) + ".");

	// Sample size in the note, unless the table shows it
	let sample = matrixN !== null ? { n: matrixN } : turned.n !== null && turned.n !== undefined ? { n: turned.n } : turned.turned ? { shown: true } : apaSampleSize(tableElement, _apaPlain(info.title), info.otherTables);
	// Last resort: a count from the data, when the caller has one ({ n } or { varies: true })
	if (!sample.shown && sample.n === undefined && !sample.varies && info.dataSampleSize)
		sample = info.dataSampleSize;
	if (sample.n !== undefined)
		notes.general.unshift("<i>N</i> = " + (sample.n >= 1000 ? sample.n.toLocaleString("en") : sample.n) + ".");
	else if (!sample.shown) {
		notes.general.unshift("<i>N</i> = " + _apaTodo(sample.varies ? i18n("sample sizes differ, give each") : i18n("add sample size")) + ".");
		todo.push(sample.varies ? i18n("give the sample sizes, they differ between variables") : i18n("add the sample size"));
	}

	// Titles: APA wants a descriptive title; JASP's name the analysis but often not the variables
	let title = apaTitleCase(apaTidyLabel(_apaPlain(info.title), true).text).replace(/\bT-Test\b/g, "t Test");
	let titleHtml = _apaEscape(title);
	if (!/ [-\u2013\u2014] /.test(title)) {
		titleHtml += " " + _apaTodo(i18n("describe what was measured"));
		todo.push(i18n("make the title describe the variables"));
	}
	let tooWide = columnWidths.reduce(function (a, b) { return a + b; }, 0) > apaPageTextWidth;
	if (tooWide)
		todo.push(i18n("put the table on a landscape page, it is too wide for a portrait page"));

	// HTML version
	let html = '<div style="font-size: 12pt; font-weight: normal; font-style: normal;">';
	html += '<p style="margin: 0 0 6pt 0; font-weight: normal;"><b>' + _apaEscape(i18n("Table")) + " " + tableNumber + "</b></p>";
	html += '<p style="margin: 0 0 6pt 0; font-weight: normal;"><i>' + titleHtml + "</i></p>";
	if (tooWide)
		html += '<p style="margin: 0 0 6pt 0; font-weight: normal;">' + _apaTodo(i18n("Too wide for a portrait page: put this table on a landscape page")) + "</p>";
	html += table.outerHTML.replace(/−/g, "-");
	if (notes.general.length > 0 || notes.specific.length > 0) {
		let parts = [];
		if (notes.general.length > 0)
			parts.push('<i>' + _apaEscape(noteLabel) + '</i> ' + notes.general.join(" "));
		for (let note of notes.specific)
			parts.push(note.symbol + " " + note.text);
		html += '<p style="margin: 6pt 0 0 0; font-weight: normal;">' + parts.join("<br>") + "</p>";
	}
	html += "</div>";
	html = html.replace(/ data-apa-todo="1"/g, "");

	// Plain-text version, tab-separated
	let lines = [i18n("Table") + " " + tableNumber, _apaPlain(titleHtml)];
	for (let r = 0; r < allRows.length; r++) {
		let fields = [];
		for (let c = 0; c < columnCount; c++) {
			let cell = layout.grid[r][c];
			let first = cell && (c === 0 || layout.grid[r][c - 1] !== cell) && (r === 0 || layout.grid[r - 1][c] !== cell);
			fields.push(first ? _apaPlain(cell.innerHTML) : "");
		}
		lines.push(fields.join("\t").replace(/−/g, "-"));
	}
	if (notes.general.length > 0)
		lines.push(noteLabel + " " + _apaPlain(notes.general.join(" ")));
	for (let note of notes.specific)
		lines.push(_apaPlain(note.symbol + " " + note.text));

	return { html: html, text: lines.join("\n"), todo: todo };
}
