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
		.replace(/<(em|i|b|strong)>[ \u00A0]+/g, "<$1>").replace(/[ \u00A0]+<\/(em|i|b|strong)>/g, "</$1>")  // "<em> Treat </em>" -> "<em>Treat</em>"
		.replace(/[ \u00A0]+([.,;:])(?=\s|$|<)/g, "$1")	// "group Treat ." -> "group Treat."
		.replace(/([A-Za-z>]) -(?=[A-Za-z])/g, "$1-")		// "p -value" -> "p-value"
		.replace(/,(?=[A-Za-z])/g, ", ");					// "p-value,the" -> "p-value, the"
	return /[.!?]$/.test(_apaPlain(text)) ? text : text + ".";
}

var apaCellPadding	= 4;	// pt, left and right
// Page text widths with 1 in margins. Portrait uses A4 (6.27 in), the narrower of A4 and Letter (6.5 in, 468 pt),
// so a table that fits A4 fits Letter too. Landscape uses Letter (9 in), the narrower of Letter and A4 (9.69 in).
var apaPageTextWidth		= 451;	// pt, portrait
var apaLandscapeTextWidth	= 648;	// pt, landscape (APA 7, 2.22)
// Pasted margins always carry a unit ("0pt", not "0"): LibreOffice reads "margin: 6pt 0 0 0" as 6 pt on every side.
// Tables are fitted a little under the text width, as a margin for word processors and font versions
var apaPageWidth			= apaPageTextWidth - 11;		// pt, 440
var apaLandscapePageWidth	= apaLandscapeTextWidth - 11;	// pt, 637
// Pasted text is Times New Roman. Each paragraph and cell names it inline, as Google Docs drops styles from some wrappers.
var apaFont			= "font-family: 'Times New Roman', Times, serif";
var apaTextStyle	= apaFont + "; font-size: 12pt; font-weight: normal; font-style: normal";
// The number, title and notes around a table or figure are double-spaced (APA 7, 2.21 and 7.14), with no extra space
// between paragraphs: the double spacing makes the gaps. 200% is line-height 2 in a form Word reads too.
var apaFrameParagraphStyle = "margin: 0pt; line-height: 200%";

var _apaCanvas = null;
function _apaTextWidth(text) {
	// Width in pt of the text at 12 pt in Times New Roman, the font of the pasted table, plus 3% for differences
	// between versions of the font. Falls back to an estimate when no canvas is available.
	if (!text)
		return 0;
	try {
		_apaCanvas = _apaCanvas || document.createElement("canvas");
		let ctx = _apaCanvas.getContext("2d");
		ctx.font = "12pt 'Times New Roman', Times, serif";
		let width = ctx.measureText(text).width * 0.75;  // px to pt
		if (width > 0)
			return width * 1.03;
	} catch (e) { }
	return text.length * 6.5;
}

function _apaColumnWidths(bodyWidth, headWidth) {
	// Each column fits its widest number or label and its widest heading word (measured at 12 pt).
	// Google Docs ignores pasted column widths: it sizes each column to its longest unbreakable text and, when the
	// total is wider than the page, shrinks every column until numbers break. So a table too wide for a portrait
	// page at 12 pt steps down to 11, 10 or 9 pt type (APA allows smaller type in tables) until it fits. A table that
	// doesn't fit at 9 pt goes on a landscape page: its type is the largest size from 9 to 12 pt that fits there.
	// A table too wide even for a landscape page keeps 9 pt. Word uses the widths given here; if the table is still
	// too wide, long heading words give up their room first.
	// Returns { widths, fontSize, landscape, tooWideForLandscape }.
	let sum = function (list) { return list.reduce(function (a, b) { return a + b; }, 0); };
	let natural = bodyWidth.map(function (body, c) { return Math.max(body, headWidth[c]); });
	// Column widths at one type size, for one page (the fitted width, a little under the text width)
	let layout = function (fontSize, page) {
		let scale = fontSize / 12;
		// Spare room per column (padding plus room for font differences) shrinks, down to the padding, before a table runs past the page
		let room = (page - sum(natural) * scale) / natural.length;
		let extra = Math.max(2 * apaCellPadding + 3, Math.min(2 * apaCellPadding + 8, room));
		let widths = natural.map(function (w) { return w * scale + extra; });
		let total = sum(widths);
		if (total > page) {
			let slack = bodyWidth.map(function (body, c) { return Math.max(0, (headWidth[c] - Math.max(body, 24)) * scale); });
			let slackTotal = sum(slack);
			let cut = Math.min(total - page, slackTotal);
			if (slackTotal > 0)
				widths = widths.map(function (w, c) { return w - cut * slack[c] / slackTotal; });
		}
		return widths.map(function (w) { return Math.ceil(w); });
	};
	// A size fits when Docs's columns (text plus padding) fit the page and the rounded widths fit the text width
	let fits = function (size, page, textWidth) {
		return sum(natural) * size / 12 + (2 * apaCellPadding + 3) * natural.length <= page  // Docs adds only the padding
			&& sum(layout(size, page)) <= textWidth;
	};
	let sizes = [12, 11, 10, 9];
	let fontSize = sizes.find(function (size) { return fits(size, apaPageWidth, apaPageTextWidth); });
	if (fontSize !== undefined)
		return { widths: layout(fontSize, apaPageWidth), fontSize: fontSize, landscape: false, tooWideForLandscape: false };
	fontSize = sizes.find(function (size) { return fits(size, apaLandscapePageWidth, apaLandscapeTextWidth); });
	if (fontSize !== undefined)
		return { widths: layout(fontSize, apaLandscapePageWidth), fontSize: fontSize, landscape: true, tooWideForLandscape: false };
	return { widths: layout(9, apaLandscapePageWidth), fontSize: 9, landscape: true, tooWideForLandscape: true };
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
		else if (_.isString(sym) && /^[*\u2217\u2020\u2021]+$/.test(_apaPlain(sym))) {
			// JASP's flag note reads "* p < .05, ** p < .01, *** p < .001": APA writes "*p < .05. **p < .01. ***p < .001."
			let levels = (_apaPlain(sym) + " " + _apaPlain(footnote.text)).match(/(\*+)\s*p\s*<\s*(\.\d+)/g);
			if (levels && levels.length > 0 && _apaPlain(footnote.text).replace(/[\s*p<.,\d]/g, "") === "")
				probability.push({ symbol: "", text: levels.map(function (l) { let m = l.match(/(\*+)\s*p\s*<\s*(\.\d+)/); return m[1] + "<i>p</i> &lt; " + m[2] + "."; }).join(" ") });
			else if (text !== "")
				probability.push({ symbol: sym, text: text });
		}
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
		// statistical symbols keep their case: "r: Skill-Practice Correlation", not "R:"
		let core = word.replace(/^[("'\[]+|[)"'\].,:;]+$/g, "");
		if (apaItalicSymbols.indexOf(core) !== -1 && core.length <= 2 && core === core.toLowerCase())
			return word;
		// plain lower-case words only, also after an opening bracket ("(group 1)" -> "(Group 1)"): leaves symbols, codes and names alone
		if (/^[("'\u2018\u201C[]*[a-zà-ÿ]+([-'\u2019][a-zà-ÿ]+)*[.,:;)\]"'\u2019\u201D]*$/.test(word))
			return word.replace(/^([("'\u2018\u201C[]*)([a-zà-ÿ])|(-)([a-zà-ÿ])/g, function (all, open, letter, dash, after) {
				return dash ? dash + after.toUpperCase() : open + letter.toUpperCase();
			});
		// both halves of a hyphenated word whose first half is capitalised: "Log-normal" -> "Log-Normal"
		if (/^[("'\u2018\u201C[]*[A-Z][a-zà-ÿ]*(-[a-zà-ÿ]+)+[.,:;)\]"'\u2019\u201D]*$/.test(word))
			return word.replace(/-([a-zà-ÿ]+)/g, function (all, part) {
				return "-" + (apaTitleMinorWords.indexOf(part) !== -1 ? part : part.charAt(0).toUpperCase() + part.slice(1));
			});
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
	let saved = { decimals: window.globSet.decimals, pExact: window.globSet.pExact, exponentAbove: window.globSet.exponentAbove, smallExponents: window.globSet.smallExponents };
	let render = function (decimals, smallExponents) {
		window.globSet.decimals = String(decimals);
		window.globSet.pExact = false;
		window.globSet.exponentAbove = Infinity;  // APA writes large numbers out in full
		window.globSet.smallExponents = !!smallExponents;  // and small ones in its decimals (-0.001), not as 8.72×10⁻⁴
		let view = new JASPWidgets.tablePrimitive({ model: model });
		view.render();
		return view.$el.find("table").get(0);
	};
	let two, three, bayes;
	try {
		two = render(2);
		three = render(3);
		bayes = render(2, true);  // Bayes factors stay in scientific notation: 2.76×10⁻⁴³ would round to 0.00
	} finally {
		window.globSet.decimals = saved.decimals;
		window.globSet.pExact = saved.pExact;
		window.globSet.exponentAbove = saved.exponentAbove;
		window.globSet.smallExponents = saved.smallExponents;
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
		let flattened = /^[-\u2212]?0[.,]0\d$/.test(text) && /^[-\u2212]?0[.,]00[1-9]$/.test(otherText);  // 0.007, not 0.07
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
	// Bayes factor columns (BF₁₀, BF₀₁, log(BF), Error %) and rows keep JASP's scientific notation for extreme values
	let gridBayes = _apaGrid(rowsOf(bayes));
	let isBayesLabel = function (cell) { return !!cell && /^(BF|log\s*\(BF|Error\s*%|P\(M\|data\))/.test(_apaLabel(cell)); };
	for (let item of gridTwo.placed) {
		if (item.row <= headLast)
			continue;
		let bayesColumn = headLast >= 0 && isBayesLabel(gridTwo.grid[headLast][item.col]);
		let other = gridBayes.grid[item.row] && gridBayes.grid[item.row][item.col];
		let atThree = gridThree.grid[item.row] && gridThree.grid[item.row][item.col];
		let lostAtThree = !atThree || /^[-\u2212]?0[.,]000$/.test(_apaPlain(atThree.innerHTML));  // 3 decimals would show 0.000
		if (bayesColumn && other && /×10/.test(_apaPlain(other.innerHTML)) && (lostAtThree || Math.abs(parseFloat(_apaPlain(other.innerHTML))) >= 1 && /×10<sup>\+|×10\+|×10⁺/.test(other.innerHTML)))
			item.cell.innerHTML = other.innerHTML;
	}
	// A value that rounds to zero isn't negative: "-0.00" -> "0.00"
	for (let item of gridTwo.placed)
		if (item.row > headLast)
			_apaReplaceText(item.cell, function (text) { return text.replace(/^(\s*)[-\u2212](0[.,]0+)(\s*)$/, "$1$2$3"); });
	return two;
}

function _apaCorrelationMatrix(table) {
	// Correlation matrices number their variables in the rows ("1. sales"); APA repeats only the numbers as column
	// headings. The last column, when it holds nothing but the diagonal dash, is left out by _apaCorrelationLastColumn.
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
	// The numbered first column lists the variables (APA's sample heads it "Variable")
	let firstHead = headRow.cells[0];
	if (firstHead && firstHead.colSpan === 1 && _apaPlain(firstHead.innerHTML) === "")
		firstHead.textContent = "Variable";
	return true;
}

function _apaCorrelationLastColumn(table, remove) {
	/**
	 * The last column of a correlation matrix, when it only holds the diagonal dash (or nothing): APA's sample
	 * correlation table leaves it out, as every correlation of the last variable is in its own row. Returns the
	 * column's variable ({ number, name }) or null when the column holds more; removes it when `remove` is true.
	 */
	let $table = $(table);
	let headRows = $table.children("thead").children("tr").length;
	let rows = $table.children("thead, tbody").children("tr").toArray();
	let layout = _apaGrid(rows);
	let last = Math.max(0, ...layout.grid.map(function (row) { return row.length; })) - 1;
	let lastCells = layout.placed.filter(function (item) { return item.col + item.colSpan - 1 === last; });
	let onlyHead = lastCells.every(function (item) {
		return item.colSpan === 1 && (item.row < $table.children("thead").children("tr").length || /^[\s\u2014\u2013-]*$/.test(_apaPlain(item.cell.innerHTML)));
	});
	if (!onlyHead || lastCells.length === 0 || !lastCells.some(function (item) { return item.row >= headRows; }))
		return null;
	let headCell = lastCells.find(function (item) { return item.row === headRows - 1; });
	let number = headCell ? _apaPlain(headCell.cell.innerHTML).trim() : "";
	let name = "";
	$table.children("tbody").children("tr").each(function () {
		let match = this.cells[0] ? _apaPlain(this.cells[0].innerHTML).match(/^(\d+)\.\s+(.+)$/) : null;
		if (match && match[1] === number)
			name = match[2];
	});
	if (remove)
		lastCells.forEach(function (item) { item.cell.remove(); });
	return { number: number, name: name };
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
	"BF₀₁": "Bayes factor in favour of the null hypothesis", "LL": "lower limit", "UL": "upper limit", "MS": "mean square", "SS": "sum of squares",
	// terms that plots print (quality control, time series, meta-analysis, machine learning)
	"Q-Q": "quantile-quantile", "P-P": "probability-probability", "ANOVA": "analysis of variance", "CL": "centre line", "UCL": "upper control limit",
	"LCL": "lower control limit", "AOQ": "average outgoing quality", "AOQL": "average outgoing quality limit", "ATI": "average total inspection",
	"ASN": "average sample number", "LSL": "lower specification limit", "USL": "upper specification limit", "GRR": "gauge repeatability and reproducibility",
	"EWMA": "exponentially weighted moving average", "CUSUM": "cumulative sum", "ACF": "autocorrelation function", "PACF": "partial autocorrelation function",
	"MAPE": "mean absolute percentage error", "OOB": "out-of-bag", "ROC": "receiver operating characteristic", "AUC": "area under the curve",
	"IRT": "item response theory", "GRM": "graded response model", "PET-PEESE": "precision-effect test and precision-effect estimate with standard errors",
	"HDI": "highest density interval", "HPD": "highest posterior density", "RE": "random effects", "FE": "fixed effects",
	"PET": "precision-effect test", "PEESE": "precision-effect estimate with standard errors", "BMA": "Bayesian model averaging", "MCMC": "Markov chain Monte Carlo", "LB": "lower bound", "UB": "upper bound" };

// Figure-only meanings: the Bayes factors that plots write with signs or letters as subscripts (BF['+'][0] in plotmath),
// and a plain BF. Not shared with tables, whose headers name their Bayes factors in full.
var apaFigureAbbreviationMeanings = { "BF₊₀": "Bayes factor in favour of a positive effect over the null hypothesis",
	"BF₀₊": "Bayes factor in favour of the null hypothesis over a positive effect", "BF₋₀": "Bayes factor in favour of a negative effect over the null hypothesis",
	"BF₀₋": "Bayes factor in favour of the null hypothesis over a negative effect", "BF0u": "Bayes factor of the null hypothesis against the unconstrained hypothesis",
	"BFu0": "Bayes factor of the unconstrained hypothesis against the null hypothesis", "BF": "Bayes factor", "SEM": "structural equation modelling" };

function _apaFigureAbbreviationText(text) {
	// Plot text with R's plotmath turned into what the reader sees: BF[1][0], BF["10"] and BF[10] -> BF₁₀, BF['+'][0] -> BF₊₀;
	// other subscripts (BF[phantom() %in% ...]) leave a plain BF. Quotes and ~ (plotmath spacing) become spaces.
	let sub = { "0": "₀", "1": "₁", "+": "₊", "-": "₋" };
	let part = "\\[\\s*['\"]?([01+\\-]{1,2})['\"]?\\s*\\]";
	return text.replace(new RegExp("BF\\s*" + part + "(?:\\s*" + part + ")?", "g"), function (all, a, b) {
			return "BF" + (a + (b || "")).split("").map(function (ch) { return sub[ch]; }).join("");
		})
		.replace(/BF\s*\[[^\]]*\]/g, "BF ")
		.replace(/[~"]/g, " ");
}

function _apaStripMarkup(text) {
	// Markdown and HTML from ggtext labels ("*M*<sub>diff</sub>", "a<br>b") reduced to their text
	return String(text).replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "").replace(/&lt;br\s*\/?&gt;/gi, " ").replace(/&lt;\/?[a-z]+&gt;/gi, "")
		.replace(/\*\*([^*]+)\*\*|\*([^*\s][^*]*)\*/g, function (all, bold, italic) { return bold || italic; }).replace(/\s{2,}/g, " ");
}

function apaTidyLabel(text, isFirst, keep) {
	/**
	 * Turns a variable-name style label into APA wording, one text piece at a time:
	 * "exam_score" -> "Exam score", "FaceType" -> "Face type", "A:B" -> "A × B", "Food as Reward" -> "Food as reward",
	 * "sales" -> "Sales". Abbreviations written in lower case without vowels ("drp") can't be guessed and are returned
	 * in `unclear` so they can be highlighted. Names in `keep` (the data's variable names) are left exactly as written:
	 * "contBinom" isn't split into "cont Binom".
	 */
	if (keep && keep.length > 0) {
		let names = keep.filter(function (k) { return typeof k === "string" && k.length >= 2; }).sort(function (a, b) { return b.length - a.length; });
		let held = [];
		let marked = text;
		for (let name of names)
			marked = marked.replace(new RegExp("(^|[^\\p{L}\\p{N}_])" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?=$|[^\\p{L}\\p{N}_])", "gu"), function (all, before) {
				held.push(name);
				return before + "\uE000" + (held.length - 1) + "\uE001";
			});
		if (held.length > 0) {
			let tidy = apaTidyLabel(marked, isFirst);
			let restore = function (t) { return t.replace(/\uE000(\d+)\uE001/g, function (all, i) { return held[+i]; }); };
			return { text: restore(tidy.text), unclear: tidy.unclear.map(restore) };
		}
	}
	// Pairs and paths ("Revise – Exam", "Framing → Justification"): each side is a name of its own
	let pair = text.split(/( [\u2013\u2192\u2194\u2b64\u2aeb|\u2223] )/);
	if (pair.length > 1) {
		let parts = pair.map(function (part, i) { return i % 2 === 1 ? { text: part, unclear: [] } : apaTidyLabel(part, i === 0 ? isFirst : true); });
		return { text: parts.map(function (p) { return p.text; }).join(""), unclear: [].concat(...parts.map(function (p) { return p.unclear; })) };
	}
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

function _apaAreVariables(labels, variableNames) {
	// True when every label is one of the analysis's variables (compared without case, spaces or underscores,
	// so the tidied "Face type" still matches "FaceType")
	if (!variableNames || variableNames.length === 0 || labels.length === 0)
		return false;
	let key = function (name) { return String(name).toLowerCase().replace(/[^\p{L}\p{N}]/gu, ""); };
	let known = variableNames.map(key);
	return labels.every(function (label) { return known.indexOf(key(label)) !== -1; });
}

function _apaStatisticColumn(table) {
	// Contingency tables label each row's statistic in an unheaded column ("Count", "Expected count"). With one
	// statistic the column says nothing and goes; with several it is headed "Statistic".
	let $table = $(table);
	let headRows = $table.children("thead").children("tr").toArray();
	let bodyRows = $table.children("tbody").children("tr").toArray();
	if (headRows.length === 0 || bodyRows.length === 0)
		return;
	let layout = _apaGrid(headRows.concat(bodyRows));
	let headLast = headRows.length - 1;
	let width = Math.max(0, ...layout.grid.map(function (row) { return row.length; }));
	let isStatistic = /^(Count|Expected count|% within (row|column)|% of total|Residuals?|Standardized residuals?|Pearson residuals?)$/i;
	for (let c = 1; c < width; c++) {
		let head = layout.grid[headLast][c];
		if (!head || _apaPlain(head.innerHTML) !== "" || head.colSpan !== 1)
			continue;
		let column = layout.placed.filter(function (item) { return item.col <= c && c < item.col + item.colSpan; });
		// Empty headings above may span into the column; everything from the heading row down must be its own
		if (column.some(function (item) { return item.colSpan !== 1 && (item.row >= headLast || _apaPlain(item.cell.innerHTML) !== ""); }))
			continue;
		let labels = column.filter(function (item) { return item.row > headLast; }).map(function (item) { return _apaLabel(item.cell); });
		if (labels.length === 0 || !labels.every(function (label) { return isStatistic.test(label); }))
			continue;
		if (labels.every(function (label) { return label === labels[0]; }))
			column.forEach(function (item) {
				if (item.colSpan > 1)
					item.cell.colSpan = item.colSpan - 1;
				else
					item.cell.remove();
			});
		else
			head.textContent = "Statistic";
		return;
	}
}

function _apaPostHocPairs(table, title) {
	// Post hoc comparisons list the two levels in two unheaded columns ("Wine | Water"): one column, "Wine – Water",
	// headed "Comparison". The first level often spans several rows.
	if (!/^Post Hoc Comparisons/i.test(title))
		return;
	let $table = $(table);
	let headRows = $table.children("thead").children("tr").toArray();
	let rows = headRows.concat($table.children("tbody").children("tr").toArray());
	if (headRows.length === 0 || rows.length === headRows.length)
		return;
	let layout = _apaGrid(rows);
	let headLast = headRows.length - 1;
	let text = function (r, c) { let cell = layout.grid[r] && layout.grid[r][c]; return cell ? _apaPlain(cell.innerHTML) : ""; };
	if (text(headLast, 0) !== "" || text(headLast, 1) !== "")
		return;
	if (layout.placed.some(function (i) { return i.col < 2 && i.colSpan > 1; }))
		return;
	let level = "";
	for (let r = headRows.length; r < rows.length; r++) {
		level = text(r, 0) || level;  // JASP leaves a repeated first level blank
		let cell = document.createElement("td");
		cell.className = "text";
		cell.textContent = level + " \u2013 " + text(r, 1);
		let after = layout.placed.find(function (i) { return i.row === r && i.col > 1 && i.cell.parentNode === rows[r]; });
		for (let i of layout.placed)
			if (i.row === r && i.col < 2 && i.cell.parentNode)
				i.cell.remove();
		rows[r].insertBefore(cell, after ? after.cell : null);
	}
	for (let r = 0; r < headRows.length; r++) {
		let cells = layout.placed.filter(function (i) { return i.row === r && i.col < 2; });
		if (cells.length === 2) {
			cells[1].cell.remove();
			if (r === headLast)
				cells[0].cell.textContent = "Comparison";
		}
		else if (cells.length === 1 && cells[0].colSpan >= 2)
			cells[0].cell.colSpan = cells[0].colSpan - 1;
	}
}

function _apaConfusionMatrix(table, title) {
	// Confusion matrices label the rows with "Observed" in a column of its own: it goes, and heads the class column
	if (!/Confusion Matrix/i.test(title))
		return;
	let $table = $(table);
	let headRows = $table.children("thead").children("tr").toArray();
	let rows = headRows.concat($table.children("tbody").children("tr").toArray());
	let layout = _apaGrid(rows);
	let headLast = headRows.length - 1;
	if (headLast < 0)
		return;
	let column = layout.placed.filter(function (i) { return i.col === 0; });
	let body = column.filter(function (i) { return i.row > headLast; }).map(function (i) { return _apaPlain(i.cell.innerHTML); });
	let head = layout.grid[headLast][1];
	if (!body.some(function (v) { return v === "Observed"; }) || !body.every(function (v) { return v === "Observed" || v === ""; }))
		return;
	if (column.some(function (i) { return i.colSpan > 1 && (i.row >= headLast || _apaPlain(i.cell.innerHTML) !== ""); }) || !head || _apaPlain(head.innerHTML) !== "")
		return;
	column.forEach(function (i) {
		if (i.colSpan > 1)
			i.cell.colSpan = i.colSpan - 1;  // an empty heading above spans into the class column
		else if (i.cell.parentNode)
			i.cell.remove();
	});
	head.textContent = "Observed";
}

function _apaMergePairColumns(table) {
	// JASP shows pairs and paths over several columns: "Revise | - | Exam", "Framing | → | Justification",
	// "Visual | ↔ | Textual", sometimes after a label column ("Total | Age | → | Fatigue"). In an APA table a pair is
	// one entry: the columns become one, "Revise – Exam" under "Variables", "Framing → Justification" under "Path".
	// Returns true when it merged.
	let $table = $(table);
	let headRows = $table.children("thead").children("tr").toArray();
	let bodyRows = $table.children("tbody").children("tr").toArray();
	if (headRows.length === 0 || bodyRows.length === 0)
		return false;
	let rows = headRows.concat(bodyRows);
	let layout = _apaGrid(rows);
	let headLast = headRows.length - 1;
	let width = Math.max(0, ...layout.grid.map(function (row) { return row.length; }));
	let text = function (r, c) { let cell = layout.grid[r] && layout.grid[r][c]; return cell ? _apaPlain(cell.innerHTML) : ""; };
	let isSeparator = /^[-–−→↔⭤⫫]$/;
	let separatorColumn = function (c) {
		if (text(headLast, c) !== "")
			return null;
		let found = null;
		for (let r = headRows.length; r < rows.length; r++) {
			let value = text(r, c);
			if (value === "")
				continue;
			if (!isSeparator.test(value) || (found !== null && value !== found))
				return null;
			found = value;
		}
		return found;
	};

	let sepCol = -1, sep = null;
	for (let c = 1; c + 1 < width && sepCol === -1; c++) {
		sep = separatorColumn(c);
		if (sep !== null)
			sepCol = c;
	}
	if (sepCol === -1)
		return false;
	let first = sepCol - 1;
	let last = sepCol + 1;
	// Longer paths: more separator and name columns, empty on shorter rows
	while (last + 2 < width && separatorColumn(last + 1) === sep && text(headLast, last + 2) === "")
		last += 2;
	// A conditioning set after a bar: "Age ⫫ Mood | Memory"
	let given = -1;
	if (last + 2 < width && text(headLast, last + 1) === "" && text(headLast, last + 2) === "") {
		let bars = true;
		for (let r = headRows.length; r < rows.length; r++)
			if (!/^[|\u2223]?$/.test(text(r, last + 1)) || (text(r, last + 1) === "") !== (text(r, last + 2) === ""))
				bars = false;
		if (bars) {
			given = last + 2;
			last += 2;
		}
	}
	// Every body cell in the merged columns must be its own (no sideways spans)
	if (layout.placed.some(function (item) { return item.row >= headRows.length && item.col <= last && item.col + item.colSpan - 1 >= first && (item.colSpan > 1 || item.col < first); }))
		return false;

	let joiner = /^[-–−]$/.test(sep) ? " – " : " " + sep + " ";
	let namesHeading = [];
	for (let c = first; c <= (given === -1 ? last : given - 2); c += 2)
		if (text(headLast, c) !== "")
			namesHeading.push(text(headLast, c));
	let heading;
	if (namesHeading.length === 0)
		heading = sep === "→" ? "Path" : "Variables";
	else if (namesHeading.every(function (h) { return /^Measure \d+$/.test(h); }))
		heading = "Measures";
	else
		heading = namesHeading.join(joiner);

	// Body: one cell per row with the whole pair or path
	for (let r = headRows.length; r < rows.length; r++) {
		let names = [];
		for (let c = first; c <= (given === -1 ? last : given - 2); c += 2)
			if (text(r, c) !== "")
				names.push(text(r, c));
		let cell = document.createElement("td");
		cell.className = "text";
		cell.textContent = names.join(joiner) + (given !== -1 && text(r, given) !== "" ? " " + text(r, given - 1) + " " + text(r, given) : "");
		let after = layout.placed.find(function (item) { return item.row === r && item.col > last && item.cell.parentNode === rows[r]; });
		for (let item of layout.placed)
			if (item.row === r && item.col >= first && item.col <= last && item.cell.parentNode)
				item.cell.remove();
		rows[r].insertBefore(cell, after ? after.cell : null);
	}
	// Headings: cells over the merged columns shrink to one column
	for (let r = 0; r < headRows.length; r++) {
		let kept = null;
		for (let item of layout.placed.filter(function (i) { return i.row === r && i.col <= last && i.col + i.colSpan - 1 >= first; })) {
			let overlap = Math.min(last, item.col + item.colSpan - 1) - Math.max(first, item.col) + 1;
			let coversFirst = item.col <= first;
			if (kept === null && (coversFirst || item.col + item.colSpan - 1 >= first)) {
				kept = item;
				item.cell.colSpan = item.colSpan - overlap + 1;
			}
			else if (item.colSpan > overlap)
				item.cell.colSpan = item.colSpan - overlap;
			else
				item.cell.remove();
		}
		if (r === headLast && kept)
			kept.cell.textContent = heading;
	}
	return true;
}

function _apaDropEmptyColumns(table) {
	// APA tables have no empty columns: a column with nothing in its body goes (an operator column JASP leaves
	// blank, F and p columns with no tests in them)
	let $table = $(table);
	let headRows = $table.children("thead").children("tr").toArray();
	let bodyRows = $table.children("tbody").children("tr").toArray();
	if (bodyRows.length === 0)
		return;
	let layout = _apaGrid(headRows.concat(bodyRows));
	let width = Math.max(0, ...layout.grid.map(function (row) { return row.length; }));
	for (let c = width - 1; c >= 0; c--) {
		let body = layout.placed.filter(function (i) { return i.row >= headRows.length && i.col <= c && c < i.col + i.colSpan; });
		if (body.length === 0 || body.some(function (i) { return i.colSpan > 1 || _apaPlain(i.cell.innerHTML) !== ""; }))
			continue;
		for (let item of layout.placed.filter(function (i) { return i.col <= c && c < i.col + i.colSpan; })) {
			if (item.colSpan > 1)
				item.cell.colSpan = item.cell.colSpan - 1;
			else if (item.cell.parentNode)
				item.cell.remove();
		}
	}
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

function _apaCorrelationIntervals(table) {
	// APA puts a correlation's confidence interval in square brackets in the same cell, under r (".24 [−.10, .54]"),
	// instead of separate "Lower 95% CI" and "Upper 95% CI" rows. Returns the CI level ("95") when it merged any.
	let $table = $(table);
	let headCount = $table.children("thead").children("tr").length;
	let rows = $table.children("thead, tbody").children("tr").toArray();
	let layout = _apaGrid(rows);
	let labelAt = function (r) {
		let found = null;
		for (let item of layout.placed)
			if (item.row === r && item.rowSpan === 1 && found === null) {
				let label = _apaLabel(item.cell);
				if (/^(Pearson's r|Spearman's rho|Kendall's [Tt]au[ -]?[Bb]?|r|rho|tau)$/.test(label) || /^(Lower|Upper) \d+% CI$/.test(label))
					found = { label: label, col: item.col };
			}
		return found;
	};
	let groups = [];
	for (let r = headCount; r + 2 < rows.length; r++) {
		let est = labelAt(r), lower = labelAt(r + 1), upper = labelAt(r + 2);
		if (!est || !lower || !upper || /CI$/.test(est.label))
			continue;
		let lo = lower.label.match(/^Lower (\d+)% CI$/), hi = upper.label.match(/^Upper (\d+)% CI$/);
		if (!lo || !hi || lo[1] !== hi[1] || est.col !== lower.col || lower.col !== upper.col)
			continue;
		groups.push({ r: r, col: est.col, level: lo[1] });
		r += 2;
	}
	if (groups.length === 0 || groups.some(function (g) { return g.level !== groups[0].level; }))
		return null;
	// Values only: data cells must be one row high
	for (let g of groups)
		if (layout.placed.some(function (i) { return i.col > g.col && i.row >= g.r && i.row <= g.r + 2 && i.rowSpan > 1; }))
			return null;
	let isEmpty = function (cell) { return !cell || /^[\s\u2014\u2013-]*$/.test(_apaPlain(cell.innerHTML)); };
	for (let g of groups) {
		let width = layout.grid[g.r].length;
		for (let c = g.col + 1; c < width; c++) {
			let est = layout.grid[g.r][c], lo = layout.grid[g.r + 1][c], hi = layout.grid[g.r + 2][c];
			if (isEmpty(est) || isEmpty(lo) || isEmpty(hi))
				continue;
			// Limits of a correlation can't exceed 1 either: no leading zero
			let limit = function (cell) { return _apaPlain(cell.innerHTML).trim().replace(/^([-\u2212]?)0(?=[.,]\d)/, "$1"); };
			est.appendChild(document.createTextNode(" "));
			est.appendChild(document.createElement("br"));
			est.appendChild(document.createTextNode("[" + limit(lo) + ", " + limit(hi) + "]"));
		}
	}
	// Remove the limit rows; labels spanning into them get shorter
	for (let g of groups.slice().reverse())
		for (let r of [g.r + 2, g.r + 1]) {
			for (let item of layout.placed)
				if (item.row < r && item.row + item.rowSpan - 1 >= r)
					item.cell.rowSpan = Math.max(1, item.cell.rowSpan - 1);
			rows[r].remove();
		}
	return groups[0].level;
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
		if (labels.length === 0 || !labels.every(function (label) { return /^(Pearson's r|Spearman's rho|Kendall's [Tt]au[ -]?[Bb]?|r|rho|tau|p(-value)?|N|n|(Lower|Upper) \d+% (CI|Credible Interval)|Effect size.*|Fisher's z|SE effect size|BF.*|log\s*\(BF.*)$/.test(label); }))
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
	// Labels that give the sample size in the table itself ("Inspected" counts the parts of a quality study,
	// "Minimum sample size" is the planned sample of an audit)
	// ("No. items" / "Selected items" are the items an audit selected from its population)
	let isCount = /^(N|n|Valid|Count|Inspected|No\. items|Selected items|(Minimum )?[Ss]ample size( \(n\))?)[\u1D43-\u1D5B\u2070-\u209C]*$/;
	let own = _apaReadTable(tableElement);
	let ownLabels = own.heads.concat(own.body.map(function (row) { return row[0]; }), own.body.map(function (row) { return row[1] || ""; }));
	if (ownLabels.some(function (label) { return isCount.test(label); }))
		return { shown: true };
	// APA reports the sample of tables built on one. Tables without numbers (a message such as "No test violations
	// occurred.") and audit settings, where no sample has been drawn yet, have none.
	let numbers = own.body.some(function (row) { return row.some(function (v) { return /\d/.test(v); }); });
	if (!numbers || /^(Table \d+\. )?Default Settings/i.test(title.trim()))
		return { none: true };
	// Summary data of a binomial test: the trials are the successes and failures
	let successes = own.heads.indexOf("Successes"), failures = own.heads.indexOf("Failures");
	if (successes >= 0 && failures >= 0) {
		let totals = own.body.map(function (row) { return _apaCount(row[successes]) + _apaCount(row[failures]); });
		if (totals.length > 0 && totals.every(function (v) { return v === totals[0] && v > 0; }))
			return { n: totals[0] };
	}

	let found = [];
	let add = function (values) {
		values = values.filter(function (v) { return !isNaN(v) && v > 0; });
		if (values.length > 0)
			found.push(values);
	};

	// Counts in the analysis's other tables: an N column (summed over groups), or Valid / n rows
	for (let other of otherTables || []) {
		let t = _apaReadTable(tableOf(other));
		let nCol = t.heads.findIndex(function (h) { return /^(N|n|Inspected|Sample size \(n\))$/.test(h); });
		if (nCol >= 0) {
			// "Descriptives - Score" lists the cells of one variable: N is the sum of all rows. Otherwise each
			// variable starts a block in the first column and its groups add up.
			// Only these two layouts add up; elsewhere (repeated-measures cells hold the same people) N is read as is
			let oneVariable = /^Descriptives - /.test(titleOf(other).trim());
			let grouped = oneVariable || /^Group Descriptives/.test(titleOf(other).trim()) || t.heads.slice(0, nCol).indexOf("Group") !== -1;
			let sums = [];
			for (let row of t.body) {
				if (!grouped || (!oneVariable && row[0] !== "") || sums.length === 0)
					sums.push(0);
				sums[sums.length - 1] += _apaCount(row[nCol]);
			}
			add(sums);
		}
		for (let row of t.body)
			for (let c = 0; c < 2 && c < row.length; c++)
				if (/^(Valid|N|n|Sample size)$/.test(row[c]))
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

// ========== APA change log ==========
// buildAPATable records what it changes, rule by rule, so the reader can check every change against APA 7.

function _apaCellHtml(cell) {
	// A cell as the reader sees it: text plus italics, bold, sub- and superscripts; no styles or layout helpers
	let copy = cell.cloneNode(true);
	for (let node of Array.from(copy.querySelectorAll("*")).reverse()) {
		if (node.hasAttribute("data-apa-todo")) {
			let mark = document.createElement("mark");
			mark.append(...node.childNodes);
			node.replaceWith(mark);
		}
		else if (/^(I|EM|B|STRONG|SUP|SUB)$/.test(node.tagName))
			while (node.attributes.length > 0)
				node.removeAttribute(node.attributes[0].name);
		else
			node.replaceWith(...node.childNodes);
	}
	return copy.innerHTML.replace(/&nbsp;| | | /g, " ").replace(/\s+/g, " ").trim();
}

function _apaShape(table) {
	let rows = $(table).children("thead, tbody").children("tr").toArray();
	let layout = _apaGrid(rows);
	return { rows: rows.length, columns: Math.max(0, ...layout.grid.map(function (row) { return row.length; })) };
}

function _apaChangeLog(table) {
	/**
	 * @returns { changes, add(rule, detail), step(rule, detail, fn), compare(rule, detail, before, after) }
	 * Each change: { rule, detail, cells (changed table cells), examples: [{ from, to, times }], removed, added, shape }
	 */
	let changes = [];
	let snapshot = function () {
		let cells = new Map();
		for (let cell of table.querySelectorAll("th, td"))
			cells.set(cell, _apaCellHtml(cell));
		return cells;
	};
	let record = function (rule, detail, pairs, extra) {
		let examples = [];
		for (let pair of pairs) {
			let same = examples.find(function (e) { return e.from === pair.from && e.to === pair.to; });
			if (same)
				same.times++;
			else
				examples.push({ from: pair.from, to: pair.to, times: 1 });
		}
		let change = Object.assign({ rule: rule, detail: detail || "", cells: pairs.length, examples: examples, removed: 0, added: 0, shape: null }, extra || {});
		if (change.cells > 0 || change.removed > 0 || change.added > 0 || change.shape || change.always)
			changes.push(change);
		delete change.always;
		return change;
	};
	return {
		changes: changes,
		add: function (rule, detail, examples) {
			let change = record(rule, detail, (examples || []).filter(function (e) { return e.from !== e.to; }), { always: true });
			change.cells = 0;  // notes and titles, not cells
			return change;
		},
		step: function (rule, detail, fn) {
			let before = snapshot();
			let shapeBefore = _apaShape(table);
			let result = fn();
			let after = snapshot();
			let shapeAfter = _apaShape(table);
			let pairs = [];
			let removed = 0;
			let added = 0;
			for (let [cell, html] of before) {
				if (!after.has(cell))
					removed++;
				else if (after.get(cell) !== html)
					pairs.push({ from: html, to: after.get(cell) });
			}
			for (let cell of after.keys())
				if (!before.has(cell))
					added++;
			let shape = shapeBefore.rows !== shapeAfter.rows || shapeBefore.columns !== shapeAfter.columns ? { from: shapeBefore, to: shapeAfter } : null;
			record(rule, detail, pairs, { removed: removed, added: added, shape: shape });
			return result;
		},
		compare: function (rule, detail, shownTable, apaTable) {
			// Cell by cell, by position: the table as JASP shows it against the same table rendered for APA
			let rowsOf = function (t) { return $(t).children("thead, tbody").children("tr").toArray(); };
			let shown = _apaGrid(rowsOf(shownTable));
			let apa = _apaGrid(rowsOf(apaTable));
			let pairs = [];
			for (let item of apa.placed) {
				let other = shown.grid[item.row] && shown.grid[item.row][item.col];
				if (!other || (shown.grid[item.row - 1] || [])[item.col] === other || (item.col > 0 && shown.grid[item.row][item.col - 1] === other))
					continue;
				let from = _apaCellHtml(other);
				let to = _apaCellHtml(item.cell);
				if (from !== to)
					pairs.push({ from: from, to: to });
			}
			return record(rule, detail, pairs);
		}
	};
}

function apaClipboardHTML(html) {
	return "<html><head><meta charset=\"utf-8\"></head><body>" + html + "</body></html>";
}

function buildAPATable(tableElement, info, tableNumber) {
	/**
	 * Builds an APA 7 version of a rendered results table.
	 * @param tableElement	the <table> as drawn by JASPWidgets.tablePrimitive
	 * @param info			{ title, subtitle, footnotes } from the table model; shownTable, the table as JASP shows it,
	 *						lets the change log list the decimals changed by apaRenderTable
	 * @param tableNumber	number shown in "Table N"
	 * @returns { html, text, todo, changes } for the clipboard; changes lists what was changed and why (see _apaChangeLog)
	 */
	let table = tableElement.cloneNode(true);
	let $table = $(table);
	let log = _apaChangeLog(table);
	if (info.shownTable)
		log.compare(i18n("Decimals"), i18n("Two decimals for most statistics, three for p values and for columns whose small values two decimals would round away. Values under .001 become < .001. Large numbers are written out instead of as exponents, and a value that rounds to zero loses its minus sign (APA 7, 6.36)."), info.shownTable, tableElement);

	// Drop what isn't part of an APA table: the title and subtitle rows, the toolbar, layout helpers and the footer
	let theadRows = $table.children("thead").children("tr");
	theadRows.slice(0, info.subtitle ? 2 : 1).remove();
	$table.find("td.squash-left, .toolbar, .do-not-copy").remove();
	$table.children("tfoot").remove();
	$table.find("div.over-title-space").each(function () { $(this).replaceWith(this.childNodes); });
	log.add(i18n("Title above the table"), i18n("The table number in bold and the title in italics go on their own lines above the table (APA 7, 7.10). JASP's title row, buttons and footer are taken out of the table."));

	let titleText = _apaPlain(info.title);
	let turned = /^(Descriptive Statistics|Circular Descriptives)/i.test(titleText)
		? log.step(i18n("Variables in rows"), i18n("Descriptive statistics turned so the variables run down the side and the statistics across the top, as in APA's sample tables."), function () { return _apaTransposeDescriptives(table); })
		: { turned: false };
	log.step(i18n("Compared pairs"), i18n("The two columns naming the groups of a post hoc comparison become one column (A \u2013 B)."), function () { _apaPostHocPairs(table, titleText); });
	log.step(i18n("Confusion matrix"), i18n("Observed and predicted classes get their own headings."), function () { _apaConfusionMatrix(table, titleText); });
	log.step(i18n("Pairs and paths"), i18n("Pairs and paths split over several columns (A, -, B) become one column with one heading."), function () { _apaMergePairColumns(table); });
	log.step(i18n("Empty columns"), i18n("Columns with nothing in them are removed."), function () { _apaDropEmptyColumns(table); });
	log.step(i18n("Group sizes"), i18n("Counts for each group are n; N is the whole sample (APA 7, Table 6.5)."), function () {
		// A table with a Group column gives each group's size: n, as in the descriptives turned to APA orientation
		let heads = $table.children("thead").children("tr").last().children().toArray();
		if (heads.some(function (cell) { return _apaLabel(cell) === "Group"; }))
			heads.filter(function (cell) { return _apaLabel(cell) === "N"; }).forEach(function (cell) { cell.textContent = "n"; });
	});
	log.step(i18n("Statistic column"), i18n("A column naming the statistics in each row gets a heading."), function () { _apaStatisticColumn(table); });
	let isCorrelationMatrix = log.step(i18n("Correlation matrix"), i18n("Variables numbered in the rows and named by number across the top, with dashes on the diagonal, as in APA's sample correlation table."), function () { return _apaCorrelationMatrix(table); });
	let lastColumn = isCorrelationMatrix ? _apaCorrelationLastColumn(table, false) : null;
	if (lastColumn) {
		let which = lastColumn.number + (lastColumn.name ? " (" + lastColumn.name + ")" : "");
		let own = lastColumn.name || i18n("that variable");
		log.step(i18n("Last column left out"), i18n("Column") + " " + which + " " + i18n("is left out: it would only hold the dash for") + " " + own + " "
			+ i18n("against itself, because the part above the diagonal stays empty. Nothing is lost: its correlations with every other variable are in row") + " " + lastColumn.number
			+ ". " + i18n("APA's sample correlation table leaves this column out too."), function () { return _apaCorrelationLastColumn(table, true); });
	}
	let matrixOfCorrelations = isCorrelationMatrix && (/correlation/i.test(titleText) || /Pearson|Spearman|Kendall/.test(table.textContent));
	let starsNote = isCorrelationMatrix ? log.step(i18n("Significance stars"), i18n("Stars on the correlations instead of a row of p values; the note explains them."), function () { return _apaCorrelationStars(table); }) : null;
	let matrixN = isCorrelationMatrix ? log.step(i18n("Sample size rows"), i18n("Rows of n that are the same for every pair are removed; N goes in the note."), function () { return _apaCorrelationSampleRows(table); }) : null;
	let intervalLevel = isCorrelationMatrix ? log.step(i18n("Confidence intervals"), i18n("Confidence limits move into square brackets under each correlation."), function () { return _apaCorrelationIntervals(table); }) : null;
	if (isCorrelationMatrix)
		log.step(i18n("Variable column"), i18n("The column of variable names gets the heading Variable."), function () { _apaCorrelationLabelColumn(table); });
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
	if (headLast >= 0) log.step(i18n("t heading"), i18n("A Statistic column that only holds t tests (Student, Welch) is headed t."), function () {
		let statistic = layout.placed.find(function (item) { return item.row === headLast && /^Statistic$/.test(_apaLabel(item.cell)); });
		let testColumn = layout.placed.find(function (item) { return item.row === headLast && /^Test$/.test(_apaLabel(item.cell)); });
		if (statistic && testColumn) {
			let tests = layout.placed.filter(function (item) { return item.row > headLast && item.col === testColumn.col; }).map(function (item) { return _apaLabel(item.cell); });
			if (tests.length > 0 && tests.every(function (name) { return /^(Student|Welch)$/.test(name); }))
				statistic.cell.textContent = "t";
		}
	});

	// APA symbols: lower-case chi (χ², JASP writes a capital Χ) and × for interactions (JASP writes ✻)
	log.step(i18n("Symbols"), i18n("Lower-case chi for \u03C7\u00B2 (JASP writes a capital \u03A7) and \u00D7 for interactions (JASP writes \u273B)."), function () {
		for (let item of layout.placed)
			_apaReplaceText(item.cell, function (text) { return text.replace(/\u03A7(?=²|\u00B2|\s*<sup)/g, "\u03C7").replace(/\u03A7²/g, "\u03C7²").replace(/\s*\u273B\s*/g, " \u00D7 "); });
	});

	// Standard abbreviations for JASP's labels (Std. Deviation -> SD), in headings and row labels
	log.step(i18n("Abbreviations"), i18n("APA's standard abbreviations and symbols for JASP's labels, such as SD for Std. Deviation and SE for Standard Error (APA 7, 6.44)."), function () {
		for (let item of layout.placed) {
			let abbreviation = apaLabelAbbreviations[_apaLabel(item.cell)];
			if (abbreviation !== undefined && $(item.cell).find("sub").length === 0)
				_apaReplaceText(item.cell, function (text) { return text.trim() === "" ? text : text.replace(/\S.*\S|\S/, abbreviation); });
		}
	});

	// Leading zeros: by column heading (p, r, ...) and by row label (correlation matrices). Confidence limits of a
	// correlation are bounded too.
	let correlationLabels = ["r", "Pearson's r", "Spearman's rho", "Kendall's Tau B", "ρ", "τ", "rho", "tau"];
	let hasCorrelation = isCorrelationMatrix || layout.placed.some(function (item) { return correlationLabels.indexOf(_apaLabel(item.cell)) !== -1; });
	let isZeroLeadLabel = function (cell) {
		let label = _apaLabel(cell);
		return apaNoZeroLeadLabels.indexOf(label) !== -1
			|| /(^|\s)correlation(\s|$)/i.test(label)
			|| /^(Cronbach's α|McDonald's ω|Guttman's λ\S*|Pearson's r|Spearman's rho|Kendall's (tau|Tau)\S*)(\s|$)/.test(label)
			|| (hasCorrelation && /(^|\s)(CI|Lower|Upper)(\s|$)/i.test(label))
			|| (label === "W" && /Shapiro-Wilk/i.test(_apaPlain(info.title)));  // Shapiro-Wilk W can't exceed 1 (Mann-Whitney W can)
	};
	let headingRow = headRows.length > 0 ? headRows.length - 1 : -1;
	let zeroLeadColumns = {};
	for (let r = 0; r <= headingRow; r++)  // the heading or a spanning heading above it
		for (let c = 0; c < columnCount; c++)
			if (layout.grid[r][c] && isZeroLeadLabel(layout.grid[r][c]))
				zeroLeadColumns[c] = true;

	log.step(i18n("Leading zeros"), i18n("No zero before the decimal point for values that can't be greater than 1, such as p, correlations and reliability coefficients (APA 7, 6.36)."), function () {
		for (let r = headRows.length; r < allRows.length; r++) {
			let rowHasLabel = matrixOfCorrelations || layout.grid[r].some(function (cell) { return cell && isZeroLeadLabel(cell); });
			for (let c = 0; c < columnCount; c++) {
				let cell = layout.grid[r][c];
				if (cell && (zeroLeadColumns[c] || rowHasLabel) && (layout.grid[r - 1] === undefined || layout.grid[r - 1][c] !== cell))
					_apaDropZeroLead(cell);
			}
		}
	});

	// Headings and row labels in APA wording ("Sum of squares", "Face type", "Food as reward"), with abbreviations
	// that can't be guessed ("drp") highlighted; then italic symbols in headings. Row labels that are statistics
	// ("Pearson's r", "N") get italic symbols too.
	let unclearWords = [];
	log.step(i18n("Sentence case"), i18n("Headings and row labels in sentence case with words written out (Sum of Squares becomes Sum of squares, Face_type becomes Face type). Short names that can't be guessed are highlighted (APA 7, 7.12)."), function () {
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
	});
	if (unclearWords.length > 0)
		todo.push(i18n("write out or explain these names:") + " " + unclearWords.join(", "));
	log.step(i18n("Italic symbols"), i18n("Statistical symbols in italics (M, SD, t, F, p, r), Greek letters upright (APA 7, 6.45)."), function () {
		for (let row of headRows)
			for (let cell of row.cells)
				_apaItaliciseSymbols(cell);
		for (let row of bodyRows)
			for (let cell of row.cells) {
				let label = _apaLabel(cell);
				if (apaNoZeroLeadLabels.indexOf(label) !== -1 || apaItalicSymbols.indexOf(label) !== -1)
					_apaItaliciseSymbols(cell);
			}
	});

	// Every column needs a heading: empty ones over text get a placeholder (columns of only "-" or "→" belong to their
	// neighbours and stay empty)
	let missingHeadings = 0;
	log.step(i18n("Column headings"), i18n("Every column needs a heading (APA 7, 7.12). Empty headings get one from what the column holds, or a highlighted placeholder."), function () {
		for (let c = 0; c < columnCount; c++) {
			let headed = layout.placed.some(function (item) { return item.row < headRows.length && item.col <= c && c < item.col + item.colSpan && _apaPlain(item.cell.innerHTML) !== ""; });
			let hasText = layout.placed.some(function (item) { return item.row >= headRows.length && item.col === c && /[\p{L}\d]/u.test(_apaPlain(item.cell.innerHTML)); });
			let headCell = headLast >= 0 ? layout.grid[headLast][c] : null;
			if (!headed && hasText && headCell && headCell.colSpan === 1) {
				// A heading APA would use, from what the column holds; "Variable" is APA's default for the first column
				let labels = layout.placed.filter(function (item) { return item.row >= headRows.length && item.col === c; }).map(function (item) { return _apaLabel(item.cell); }).filter(function (l) { return l !== ""; });
				let heading = null;
				let all = function (re) { return labels.length > 0 && labels.every(function (l) { return re.test(l); }); };
				if (labels.some(function (l) { return /^\(?Intercept\)?$/.test(l); }))
					heading = "Predictor";
				else if (all(/^H([\d\u2080-\u2089]+|u|c)?(\s*\(.*\))?$/))
					heading = "Hypothesis";
				else if (all(/^Factor \d+$/))
					heading = "Factor";
				else if (all(/^Component \d+$/))
					heading = "Component";
				else if (all(/ \u2192 /))
					heading = "Path";
				else if (all(/^(Total( indirect)?|Direct|Indirect)( effects?)?$/i))
					heading = "Effect";
				else if (all(/^(Pooled effect|\u{1D70F}\u00B2?|\u03C4\u00B2?|I\u00B2|H\u00B2)$/u) && labels.some(function (l) { return l === "Pooled effect"; }))
					heading = "Parameter";
				else if (labels.some(function (l) { return /^(Residuals?|Within|Error)$/.test(l); }))
					heading = "Source";
				else if (labels.every(function (l) { return /^(Model(\s*\d+)?|M[\d₀-₉]+)$/.test(l); }))
					heading = "Model";
				else if (/\bTests\b/.test(_apaPlain(info.title)) && (c === 0 || labels.some(function (l) { return /^χ²/.test(l); })))
					heading = "Test";
				else if (/^Test of Sphericity/i.test(_apaPlain(info.title)) && c === 0)
					heading = "Effect";
				else if (c === 0 && _apaAreVariables(labels, info.variableNames))
					heading = "Variable";  // only when the caller knows the analysis's variables and these are them
				if (heading) {
					headCell.textContent = heading;
					continue;
				}
			}
			if (!headed && hasText && headCell && headCell.colSpan === 1) {
				headCell.innerHTML = _apaTodo(i18n("Add heading"));
				missingHeadings++;
			}
		}
	});
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
	log.step(i18n("Whole numbers"), i18n("Counts (N, n, df, Count) shown without decimals when every value is a whole number."), function () {
		for (let item of layout.placed)
			if (item.row === headRows.length - 1 && /^(n|N|Missing|Valid|Count)$/.test(_apaLabel(item.cell)))
				wholeColumns[item.col] = true;
		for (let c in wholeColumns) {
			let cells = layout.placed.filter(function (item) { return item.col === +c && item.row >= headRows.length; });
			if (cells.every(function (item) { return /^(\d+([.,]0+)?)?$/.test(_apaPlain(item.cell.innerHTML)); }))
				cells.forEach(function (item) { _apaReplaceText(item.cell, function (text) { return text.replace(/^(\s*\d+)[.,]0+/, "$1"); }); });
			else if (dfColumns[c])  // Student's df (42) next to Welch's (41.98): each whole df loses its decimals
				cells.forEach(function (item) { _apaReplaceText(item.cell, function (text) { return text.replace(/^(\s*\d+)[.,]0+(\s*)$/, "$1$2"); }); });
		}
		// Rows of counts too ("Count" in contingency tables): whole numbers when every value is one
		for (let r = headRows.length; r < allRows.length; r++) {
			if (!layout.grid[r].some(function (cell) { return cell && /^(Count|n|N)$/.test(_apaLabel(cell)); }))
				continue;
			let cells = layout.placed.filter(function (item) { return item.row === r && !isTextCell(item) && !/^(Count|n|N)$/.test(_apaLabel(item.cell)); });
			if (cells.every(function (item) { return /^(\d[\d,]*([.]0+)?)?$/.test(_apaPlain(item.cell.innerHTML)); }))
				cells.forEach(function (item) { _apaReplaceText(item.cell, function (text) { return text.replace(/^(\s*\d[\d,]*)[.]0+/, "$1"); }); });
		}
	});
	// Values JASP couldn't compute ("NaN") are shown with a dash, as APA does for empty cells
	log.step(i18n("Missing values"), i18n("Values JASP couldn't compute (NaN, Inf) are shown as a dash, as APA does for empty cells."), function () {
		for (let item of layout.placed)
			if (item.row >= headRows.length && /^(NaN|nan|-?Inf(inity)?|\.)$/.test(_apaPlain(item.cell.innerHTML)))
				item.cell.textContent = "\u2014";
	});
	let groupThousands = /^en/.test(typeof currentLocaleId === "string" ? currentLocaleId : "en");
	log.step(i18n("Number format"), i18n("Commas in numbers of 1,000 or more, except degrees of freedom, and no space before % (APA 7, 6.38)."), function () {
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
	});
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
		let style = [apaFont, "font-size: " + sizing.fontSize + "pt", "padding: 2pt " + apaCellPadding + "pt", "font-weight: normal", "font-style: normal", "background: transparent",
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
	table.setAttribute("style", "border-collapse: collapse; " + apaFont + "; font-size: " + sizing.fontSize + "pt; margin: 0pt; width: " + tableWidth + "pt;");
	table.setAttribute("width", Math.round(tableWidth * 4 / 3));
	let colgroup = document.createElement("colgroup");
	for (let width of columnWidths) {
		let col = document.createElement("col");
		col.setAttribute("style", "width: " + width + "pt");
		col.setAttribute("width", Math.round(width * 4 / 3));
		colgroup.appendChild(col);
	}
	table.insertBefore(colgroup, table.firstChild);
	log.add(i18n("Lines and type"), i18n("Horizontal lines only: above and below the headings, under spanning headings and at the bottom; no vertical lines, shading or bold (APA 7, 7.15). Text left-aligned, numbers centred, column widths set to fit, type %1 pt.").replace("%1", sizing.fontSize));

	let notes = _apaNotes(info.footnotes);
	let noteLabel = i18n("Note.");
	let footnoteTexts = (info.footnotes || []).map(function (f) { return _.isString(f) ? f : (f.symbol ? f.symbol + " " : "") + (f.text || ""); }).filter(function (t) { return _apaPlain(t).trim() !== ""; });
	if (footnoteTexts.length > 0)
		log.add(i18n("Note"), i18n("JASP's footnotes become one note under the table: general notes after Note. in italics, specific notes with their symbol, each as a full sentence (APA 7, 7.14)."),
			[{ from: footnoteTexts.join(" "), to: notes.general.concat(notes.specific.map(function (n) { return (n.symbol ? n.symbol + " " : "") + n.text; })).join(" ") }]);
	if (starsNote && starsNote.text) {
		notes.specific.push(starsNote);
		log.add(i18n("Probability note"), i18n("The note says what the stars mean."), [{ from: "", to: starsNote.text }]);
	}
	if (intervalLevel) {
		notes.general.push(_apaEscape(i18n("Values in square brackets indicate the %1% confidence interval for each correlation.").replace("%1", intervalLevel)));
		log.add(i18n("Interval note"), i18n("The note says what the brackets hold."), [{ from: "", to: notes.general[notes.general.length - 1] }]);
	}

	// Explain the abbreviations used in the table, unless the notes already do
	let tableText = $(table).find("th, td").map(function () { return _apaPlain(this.innerHTML); }).get().join(" ");  // cell by cell, so words don't run together
	let noteText = _apaPlain(notes.general.concat(notes.specific.map(function (n) { return n.text; })).join(" "));
	let explained = [];
	for (let abbreviation in apaAbbreviationMeanings) {
		let pattern = new RegExp("(^|[^\\p{L}\\p{N}-])" + abbreviation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?=$|[^\\p{L}\\p{N}-])", "u");
		let meaning = apaAbbreviationMeanings[abbreviation];
		if (pattern.test(tableText) && noteText.indexOf(abbreviation + " =") === -1 && noteText.toLowerCase().indexOf(meaning.toLowerCase()) === -1)
			explained.push(abbreviation + " = " + meaning);
	}
	if (explained.length > 0) {
		// APA 7, 7.14: the definitions come last in the general note (only a copyright line may follow)
		notes.general.push(_apaEscape(explained.join("; ")) + ".");
		log.add(i18n("Abbreviations explained"), i18n("Abbreviations in the table are written out at the end of the general note, unless JASP's notes already do (APA 7, 7.14)."), [{ from: "", to: notes.general[notes.general.length - 1] }]);
	}

	// Sample size in the note, unless the table shows it
	let sample = matrixN !== null ? { n: matrixN } : turned.n !== null && turned.n !== undefined ? { n: turned.n } : turned.turned ? { shown: true } : apaSampleSize(tableElement, _apaPlain(info.title), info.otherTables);
	// Last resort: a count from the data, when the caller has one ({ n } or { varies: true })
	// A count from the data (the external tool passes one) is exact for the rows the analysis used, so it wins
	// over numbers worked out from the tables; only N shown in the table itself stays
	// ({ n }, { range: { min, max } } when each test has its own N, or "varies")
	let fromData = info.dataSampleSize;
	if (fromData === "varies")
		fromData = { varies: true };
	if (!sample.shown && !sample.none && fromData && (fromData.n !== undefined || fromData.range || fromData.meta || (sample.n === undefined && !sample.varies)))
		sample = fromData;
	let count = function (n) { return n >= 1000 ? n.toLocaleString("en") : String(n); };
	let generalBefore = notes.general.length;
	if (sample.meta) {
		// Meta-analyses count studies, not people (APA: "Number of studies = 120, number of effects = 782, total N = 52,578.")
		let parts = [];
		if (sample.meta.studies !== undefined)
			parts.push(i18n("number of studies") + " = " + count(sample.meta.studies));
		if (sample.meta.effects !== undefined)
			parts.push(i18n("number of effects") + " = " + count(sample.meta.effects));
		if (sample.meta.total !== undefined)
			parts.push(i18n("total") + " <i>N</i> = " + count(sample.meta.total));
		let text = parts.join(", ");
		notes.general.unshift(text.charAt(0).toUpperCase() + text.slice(1) + ".");
	}
	else if (sample.none)
		;
	else if (sample.n !== undefined)
		notes.general.unshift("<i>N</i> = " + count(sample.n) + ".");
	else if (sample.range)
		notes.general.unshift("<i>N</i>s range from " + count(sample.range.min) + " to " + count(sample.range.max) + " because of missing values.");
	else if (!sample.shown) {
		notes.general.unshift("<i>N</i> = " + _apaTodo(sample.varies ? i18n("sample sizes differ, give each") : i18n("add sample size")) + ".");
		todo.push(sample.varies ? i18n("give the sample sizes, they differ between variables") : i18n("add the sample size"));
	}
	if (notes.general.length > generalBefore)
		log.add(i18n("Sample size"), i18n("The note gives the sample size, worked out from the analysis's own tables or the data, unless the table shows it."), [{ from: "", to: notes.general[0] }]);

	// Titles: APA wants a descriptive title; JASP's name the analysis but often not the variables
	let title = apaTitleCase(apaTidyLabel(_apaPlain(info.title), true).text).replace(/\bT-Test\b/g, "t Test");
	let titleHtml = _apaEscape(title);
	if (!/ [-\u2013\u2014] /.test(title)) {
		titleHtml += " " + _apaTodo(i18n("describe what was measured"));
		todo.push(i18n("make the title describe the variables"));
	}
	log.add(i18n("Title"), i18n("Title in title case and italics. APA wants it to describe the variables, so a title that doesn't gets a highlighted reminder (APA 7, 7.11)."), [{ from: _apaEscape(_apaPlain(info.title)), to: titleHtml }]);
	// Page width: the type size and page chosen by _apaColumnWidths
	let tooWide = sizing.landscape;
	let tooWideForLandscape = sizing.tooWideForLandscape;
	if (tooWideForLandscape)
		log.add(i18n("Page width"), i18n("The table is too wide for a portrait page and for a landscape page, even at 9 pt, so its type stays at 9 pt. Reminders ask for a landscape page and suggest splitting the table."));
	else if (tooWide)
		log.add(i18n("Page width"), i18n("The table is too wide for a portrait page, even at 9 pt, so a reminder asks for a landscape page. Its type is %1 pt, the largest size from 9 to 12 pt that fits a landscape page.").replace("%1", sizing.fontSize));
	else if (sizing.fontSize < 12)
		log.add(i18n("Page width"), i18n("The table is too wide for a portrait page at 12 pt, so its type is %1 pt, the largest size that fits. Tables go no smaller than 9 pt.").replace("%1", sizing.fontSize));
	if (tooWide)
		todo.push(i18n("put the table on a landscape page, it is too wide for a portrait page"));
	if (tooWideForLandscape)
		todo.push(i18n("split the table in two, it is too wide even for a landscape page"));

	// HTML version
	let html = '<div style="' + apaTextStyle + ';">';
	html += '<p style="' + apaFrameParagraphStyle + '; ' + apaTextStyle + ';"><b>' + _apaEscape(i18n("Table")) + " " + tableNumber + "</b></p>";
	html += '<p style="' + apaFrameParagraphStyle + '; ' + apaTextStyle + ';"><i>' + titleHtml + "</i></p>";
	if (tooWide)
		html += '<p style="' + apaFrameParagraphStyle + '; ' + apaTextStyle + ';">' + _apaTodo(i18n("Too wide for a portrait page: put this table on a landscape page")) + "</p>";
	if (tooWideForLandscape)
		html += '<p style="' + apaFrameParagraphStyle + '; ' + apaTextStyle + ';">' + _apaTodo(i18n("Too wide even for a landscape page: split this table in two")) + "</p>";
	html += table.outerHTML;  // APA uses a true minus sign (−.10); the plain text below keeps hyphens for spreadsheets
	if (notes.general.length > 0 || notes.specific.length > 0) {
		let parts = [];
		if (notes.general.length > 0)
			parts.push('<i>' + _apaEscape(noteLabel) + '</i> ' + notes.general.join(" "));
		for (let note of notes.specific)
			parts.push(note.symbol ? note.symbol + " " + note.text : note.text);
		html += '<p style="' + apaFrameParagraphStyle + '; ' + apaTextStyle + ';">' + parts.join("<br>") + "</p>";
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

	for (let change of log.changes)
		for (let example of change.examples) {
			let clean = function (h) { return h.replace(/<span data-apa-todo="1"[^>]*>([^<]*)<\/span>/g, "<mark>$1</mark>").replace(/ style="[^"]*"/g, ""); };
			example.from = clean(example.from);
			example.to = clean(example.to);
		}
	return { html: html, text: lines.join("\n"), todo: todo, changes: log.changes };
}

// ========== APA figures ==========

// A figure's info comes from outside JASP (an R rerun written by jsonlite), and its lists may not be arrays: a list
// of one can arrive as a bare value ("geoms": "GeomPoint") and a named list as an object ("plots": { "mainPlot": ... },
// from a jaspGraphsPlot's named subplots). Each list comes back as an array; anything else is left out.
function _apaAsList(value) {
	if (Array.isArray(value))
		return value;
	if (value === null || value === undefined)
		return [];
	if (typeof value === "object")
		return Object.keys(value).map(function (k) { return value[k]; });
	return [value];
}

function _apaFigureFacts(facts) {
	if (!facts || typeof facts !== "object" || Array.isArray(facts))
		return null;
	let plots = _apaAsList(facts.plots).filter(function (p) { return p && typeof p === "object" && !Array.isArray(p); }).map(function (p) {
		let plot = Object.assign({}, p);
		plot.geoms = _apaAsList(p.geoms).filter(function (g) { return typeof g === "string"; });
		if (p.text !== null && p.text !== undefined)
			plot.text = _apaAsList(p.text).filter(function (t) { return typeof t === "string"; });
		return plot;
	});
	return Object.assign({}, facts, { plots: plots });
}

function _apaFigureInfo(info) {
	info = Object.assign({}, info || {});
	info.facts = _apaFigureFacts(info.facts);
	info.containerTitles = _apaAsList(info.containerTitles).filter(function (t) { return typeof t === "string"; });
	info.variables = _apaAsList(info.variables).filter(function (v) { return typeof v === "string"; });
	if (!info.options || typeof info.options !== "object" || Array.isArray(info.options))
		info.options = {};
	return info;
}

// What a figure's lines, bands, colours and dots mean, by plot kind (APA 7, 7.27 to 7.28: everything that carries
// meaning is explained in the legend or the note). Each kind is matched on the facts: the analysis, the plot's name
// and the geoms it draws. A note states only what is certainly drawn: an element whose meaning isn't certain gets a
// to-do instead (c.todo), as a false sentence is worse than a question. `explains` lists what the note covers, so the
// general to-dos ("say what the error bars show", "say what the lines show") aren't asked again; `rug: false` drops
// the generic tick-mark sentence where the ticks mean something else.
// The context `c` holds: has(regex) for the geoms, options, bayes (a Bayesian figure), interval (the interval's name,
// "credible interval" for Bayesian figures), level(keys...) (its level, from the image's own "95% CI" first, then the
// first option of those keys that is a number), text (all text in the image), y (the y-axis titles), labels (the text
// layers), legend (a colour or line-type legend is
// drawn), analysis and name, and todo(text) (a to-do for the student). `noFacts` is the to-do for a kind whose note
// would be empty only because JASP's own picture comes without facts; a sentence that depends on how the plot is drawn
// (bars or lines, a map or a line) returns nothing without facts, so that to-do takes its place.
var apaJaspGraphsPriorPosterior = /^(TTestBayesian|BinomialTestBayesian|CorrelationBayesian|SummaryStats|EquivalenceBayesian|ContingencyTablesBayesian|bfpack)/;
var apaFigureKinds = [
	{	// jaspGraphs' prior and posterior plot: dashed prior, solid posterior, dots at the tested value, the interval as a bar on top
		name: /prior.?(and.?)?posterior|priorposterior|oddsRatioPlots|bfpackContainer_posteriorPlotContainer/i, when: function (c) { return !/oddsRatio/i.test(c.name) || c.bayes; }, explains: "bars lines bands",
		note: function (c) {
			let s = [];
			let jaspGraphs = apaJaspGraphsPriorPosterior.test(c.analysis) && !/^SummaryStatsGeneral/.test(c.analysis);
			if (c.has(/Line|Function|Density|Area/)) {
				if (jaspGraphs)
					s.push(i18n("The solid line shows the posterior distribution and the dashed line the prior distribution."));
				else {
					s.push(i18n("The lines show the prior and posterior distributions."));
					if (!c.legend)
						c.todo(i18n("say which line is the prior and which the posterior"));
				}
			}
			if (jaspGraphs && c.has(/^Geom(Jasp)?Point$/))
				s.push(i18n("Dots mark the height of both distributions at the value of the null hypothesis."));
			if (c.has(/Errorbar/))
				s.push(i18n("The horizontal bar shows the") + " " + c.level("ciLevel", "credibleIntervalLevel") + c.interval + " " + i18n("of the posterior") + ".");
			if (!jaspGraphs && c.has(/Segment/))
				c.todo(i18n("say what the arrows or bars show"));
			if (/Equivalence/.test(c.analysis) && c.has(/Ribbon/))
				s.push(i18n("The shaded area marks the equivalence region."));
			if (/data \| H/.test(c.text))
				s.push(i18n("The pie chart shows the posterior probability of each hypothesis, assuming equal prior odds."));
			return s;
		} },
	{	// a map of the Bayes factor over two prior settings (the A/B test), or a line over one
		name: /robustness/i, explains: "lines",
		note: function (c) {
			if (!c.facts && /^ABTest/.test(c.analysis))
				return [];
			if (c.has(/Contour|Tile|Raster/))
				return i18n("Colours show the Bayes factor for each combination of prior mean and prior standard deviation.");
			let widths = /width|scale/i.test(c.text) || /^(TTestBayesian|CorrelationBayesian|SummaryStatsTTest|SummaryStatsCorrelation)/.test(c.analysis);
			return [widths ? i18n("The line shows the Bayes factor for a range of prior widths.") : i18n("The line shows the Bayes factor for a range of prior settings.")]
				.concat(c.has(/^Geom(Jasp)?Point$/) ? [widths ? i18n("Dots mark the Bayes factor at selected prior widths.") : i18n("Dots mark the Bayes factor at selected prior settings.")] : []);
		} },
	{	name: /sequential/i, when: function (c) { return c.bayes; }, explains: "lines",
		note: function (c) {
			let y = c.y;
			if (/Posterior Probabilit/i.test(c.text))
				return [i18n("Lines show the posterior probability of each hypothesis as the data accumulate.")].concat(c.has(/Polygon/) ? [i18n("The pie charts show the prior and posterior probabilities.")] : []);
			if (/Conditional Probabilit/i.test(y))
				return i18n("Lines show the conditional probability of the data under each hypothesis as the data accumulate.");
			if (/Joint Probabilit/i.test(y))
				return i18n("Lines show the joint probability of the data and each hypothesis as the data accumulate.");
			// the t tests' and correlations' sequential plots always chart the Bayes factor, also in JASP's own picture
			if (/BF/.test(y) || (!y && /^(TTestBayesian|CorrelationBayesian|BinomialTestBayesian)/.test(c.analysis)))
				return i18n("The line shows the Bayes factor as the data accumulate.");
			c.todo(i18n("say what the lines show"));
			return [];
		} },
	{	name: /trace ?plot|plotContainerTP|_samples$/i, explains: "lines",
		note: function () { return i18n("Lines show the sampled values of each chain across iterations."); } },
	{	// a point prior is drawn as a spike topped by a dot; continuous ones as a curve
		analysis: /^SummaryStatsGeneralBayesianTests$/, name: /priorsPlot|posteriorsPlot|predictionsPlot/i, explains: "bars lines",
		note: function (c) {
			let s = [];
			if (c.has(/Function|Line$|Density/))
				s.push(/predictions/i.test(c.name) ? i18n("The curve shows the predicted distribution of the outcome.") : /posteriors/i.test(c.name) ? i18n("The curve shows the posterior distribution.") : i18n("The curve shows the prior distribution."));
			if (c.has(/Linerange/))
				s.push(i18n("A vertical line topped by a dot marks a point mass: all the probability at one value."));
			else if (c.has(/Point/))
				c.todo(i18n("say what the dots show"));
			return s;
		} },
	{	// reliability with each item dropped: a ridge of posteriors, one per dropped item
		analysis: /^reliability/, name: /plotContainerItem/i, explains: "lines",
		note: function (c) { c.todo(i18n("say what the vertical marks on each curve show")); return i18n("Each curve shows the posterior distribution of the coefficient when that item is dropped; the curve labelled original uses all items."); } },
	{	// the deprecated Bayesian meta-analysis draws several posteriors and a prior in one plot
		analysis: /^BayesianMetaAnalysisDeprecated$/, name: /^postContainer/i, explains: "bars lines",
		note: function (c) {
			let s = [i18n("The lines show the prior and posterior distributions.")];
			if (!c.legend)
				c.todo(i18n("say which line is the prior and which each posterior"));
			if (c.has(/Errorbar/))
				c.todo(i18n("say which posterior the horizontal bar belongs to"));
			if (c.has(/Area|Ribbon/))
				c.todo(i18n("say what the shaded area shows"));
			if (/data \| H/.test(c.text))
				s.push(i18n("The pie chart shows the posterior probability of each hypothesis, assuming equal prior odds."));
			return s;
		} },
	{	name: /posteriorPlot|postDist|ParameterPlotMarginal|posteriorPlots|stateContainer_plotContainer|^postContainer/i, when: function (c) { return c.bayes || /Prophet|reliability/.test(c.analysis); }, explains: "bars lines bands",
		note: function (c) {
			let s = [i18n("The curve shows the posterior distribution.")];
			if (c.options.posteriorPlotPriorDisplayed === true)
				s.push(i18n("The dashed line shows the prior distribution."));
			let level = c.level("credibleInterval", "posteriorSummaryPlotCiLevel", "scaleCiLevel", "ciLevel");
			if (c.has(/Errorbar/))
				s.push(i18n("The horizontal bar shows the") + " " + level + c.interval + ".");
			if (c.has(/Ribbon|Area/))
				c.todo(i18n("say what the shaded area shows"));
			// the spike is labelled with its probability beside the interval's two bounds; the intercept has none
			if (/^RegressionLinearBayesian$/.test(c.analysis) && /postDist/.test(c.name) && !/Intercept$/.test(c.name) && c.labels.length >= 3)
				s.push(i18n("The spike at zero shows the posterior probability that the predictor is excluded (its coefficient is zero)."));
			return s;
		} },
	{	name: /bainContainer_descriptivesPlots/i, when: function (c) { return c.has(/Errorbar/); }, explains: "bars",
		note: function (c) { return i18n("Points show means; error bars represent") + " " + c.level("credibleInterval") + c.interval + "s."; } },
	{	name: /postSumPlot/i, explains: "bars",
		note: function (c) { return i18n("Points show posterior means; error bars represent") + " " + c.level("posteriorSummaryPlotCiLevel", "credibleInterval") + c.interval + "s."; } },
	{	// Q-Q and P-P plots: the diagonal is where the points fall if the reference distribution fits
		name: /qq/i, explains: "lines",
		note: function (c) {
			if (/^LD/.test(c.analysis) || /compareContinuous/.test(c.analysis))
				return i18n("The diagonal line shows where the points would fall if the data followed the fitted distribution.");
			let residuals = /resid/i.test(c.name) || /Anova|Ancova|Regression|GeneralizedLinear|ARIMA|MixedModels/.test(c.analysis);
			return residuals ? i18n("The diagonal line shows where the points would fall if the residuals were normally distributed.")
				: i18n("The diagonal line shows where the points would fall if the scores were normally distributed.");
		} },
	{	// parametric survival: one fitted line per distribution, each with its band; the ticks aren't certain
		analysis: /Survival/, name: /(^|_)probabilityPlot/i, explains: "lines bands", rug: false, noFacts: "say what the dots, lines and bands show",
		note: function (c) {
			if (!c.facts)
				return [];
			let s = [i18n("Dots show the nonparametric estimates of the failure probability; each line shows a fitted distribution") + (c.has(/Ribbon/) ? i18n(", and the shaded band its") + " " + c.level("probabilityPlotConfidenceIntervalLevel") + i18n("confidence interval") : "") + "."];
			if (c.has(/Rug/))
				c.todo(i18n("say what the tick marks along the x axis show"));
			return s;
		} },
	{	name: /ppplot|_pp$|(^|_)probabilityPlot|probabilityContainer/i, explains: "lines",
		note: function (c) {
			return [i18n("The diagonal line shows where the points would fall if the data followed the fitted distribution.")]
				.concat(/processCapability/.test(c.analysis) ? [i18n("The dashed lines either side of it show its confidence bounds.")] : []);
		} },
	{	// Hotelling's T² chart: control limits and a split between training and test samples, no centre line
		name: /tsq/i, explains: "lines",
		note: function (c) {
			let s = [i18n("The dashed lines show the upper and lower control limits.")];
			if (c.has(/Vline/) && /Training/.test(c.text))
				s.push(i18n("The vertical line separates the training and test samples."));
			return s;
		} },
	{	// Shewhart, CUSUM and EWMA charts of quality control: a solid centre line and dashed control limits. Notes
		// name line types, not colours: the colours vary between charts and are lost in greyscale.
		name: /chart|xBar|xmr|EWMAPlot|Laney[PU]Plot|IPlotA/i, when: function (c) { return !/traffic|autocorrelation|report/i.test(c.name) && (/\b(U|L)?CL\b/.test(c.text) || /Charts|msaGauge|msaTestRetest|rareEvent|processCapability|multivariateControl/.test(c.analysis)); }, explains: "lines",
		note: function (c) {
			if (/\bCL\b/.test(c.text) && /\b(USL|LSL|Target|Tar\.)/.test(c.text))
				return i18n("The labelled solid lines show the centre line, the specification limits and the target; the dashed lines show the control limits.");
			if (/\bCL\b/.test(c.text))
				return i18n("The solid line shows the centre line and the dashed lines the control limits.");
			if (/\bUCL\b/.test(c.text))
				return i18n("The dashed lines show the control limits.");
			c.todo(i18n("say what the lines show"));
			return [];
		} },
	{	name: /acfPlot|pacfPlot|autocorrelationPlot/i, explains: "bars lines bands",
		noFacts: "say what the marks at each lag and the bounds show",
		note: function (c) {
			if (!c.facts)
				return [];  // bars or vertical lines, and a band or lines: only the drawing tells
			let partial = /pacf/i.test(c.name);
			let level = c.level(partial ? "pacfCiLevel" : "acfCiLevel", "residualAcfCiLevel");
			let s = [(c.has(/Col|Bar/) ? i18n("Bars show the") : i18n("Vertical lines show the")) + " " + (partial ? i18n("partial autocorrelation") : i18n("autocorrelation")) + " " + i18n("at each lag.")];
			if (c.has(/Ribbon/))
				s.push(i18n("The shaded band marks the") + " " + level + i18n("confidence bounds for zero autocorrelation."));
			else if (c.has(/Hline/))
				s.push(i18n("The horizontal lines mark the") + " " + level + i18n("confidence bounds for zero autocorrelation."));
			return s;
		} },
	// jaspDistributions: the chosen value or interval is marked on the curve; its marks aren't error bars
	{	analysis: /^LD/, name: /plotPDF|pdfPlot/i, explains: "bars lines",
		note: function (c) {
			let s = [i18n("The curve shows the probability density.")];
			if (c.has(/Area/))
				s.push(i18n("The shaded area shows the probability of the chosen interval."));
			if (c.has(/Linerange|Segment/))
				s.push(i18n("The vertical line marks the density at the chosen value."));
			return s;
		} },
	{	analysis: /^LD/, name: /plotCDF|cdfPlot/i, explains: "bars lines",
		note: function (c) {
			let s = [i18n("The curve shows the cumulative probability.")];
			if (c.has(/Linerange|Segment/))
				s.push(i18n("The dashed lines mark the chosen value and its cumulative probability."));
			if (c.has(/Abline/))
				s.push(i18n("The straight lines touch the curve at the chosen values; their slopes show the density there."));
			return s;
		} },
	{	analysis: /^LD/, name: /plotQF|qfPlot/i, explains: "lines",
		note: function () { return i18n("The curve shows the quantile for each cumulative probability."); } },
	{	analysis: /^LD/, name: /plotPMF|pmfPlot/i, explains: "bars lines",
		note: function () { return i18n("Bars show the probability of each value."); } },
	{	analysis: /^LD/, name: /plotCMF|cmfPlot/i, explains: "bars lines",
		note: function () { return i18n("Bars show the cumulative probability of each value."); } },
	{	analysis: /^LD/, name: /estPDF/i, explains: "lines",
		note: function () { return i18n("Bars show the distribution of the data and the curve the fitted distribution."); } },
	{	analysis: /^LD/, name: /estPMF/i, explains: "lines",
		note: function () { return i18n("Bars show the observed proportions and dots the fitted probabilities."); } },
	{	analysis: /^LD/, name: /estCDF/i, explains: "lines",
		note: function () { return i18n("The step line shows the cumulative distribution of the data and the curve the fitted distribution."); } },
	{	analysis: /^LD/, name: /ecdf/i, explains: "lines",
		note: function () { return i18n("The step line shows the cumulative distribution of the data."); } },
	{	// Meta-analysis. In a Bayesian forest plot the study rows are the studies' own estimates with confidence
		// intervals; only the pooled estimate is a posterior with a credible interval.
		name: /forest/i, explains: "bars lines", noFacts: "say what the rows, intervals and diamonds show",
		note: function (c) {
			let s = [];
			if (c.has(/Point|Errorbar/))
				s.push(i18n("Points show each study's observed effect size and horizontal lines its") + " " + (c.bayes ? "" : c.level("confidenceIntervalsLevel", "ciLevel")) + i18n("confidence interval") + ".");
			if (c.has(/Boxplot/))
				c.todo(i18n("say what the boxes show"));
			if (c.has(/Boxplot/) && c.has(/Segment/))
				c.todo(i18n("say what the bars under the diamonds show"));
			// several diamonds: the deprecated Bayesian meta-analysis (fixed, random, averaged) and grouped forest plots
			let several = /^BayesianMetaAnalysisDeprecated$/.test(c.analysis) || c.has(/Boxplot/);
			if (c.has(/Polygon|diamond/))
				s.push(several ? i18n("The diamonds show the pooled estimates and their") + " " + c.interval + "s." : i18n("The diamond shows the pooled estimate and its") + " " + c.interval + ".");
			if (c.has(/Vline/))
				s.push(i18n("The vertical line marks no effect."));
			if (/\bPI \[/.test(c.text))
				s.push(i18n("The PI row shows the prediction interval."));
			if (/^BayesianBinomialMetaAnalysis$/.test(c.analysis))
				c.todo(i18n("say what the second interval in each study row shows"));
			if (/PredictionPerformance/.test(c.analysis))
				c.todo(i18n("say what the prediction interval row shows, if drawn"));
			return s;
		} },
	{	// the prediction-performance funnels show an asymmetry test, not a pseudo-confidence funnel
		analysis: /PredictionPerformance/, name: /funnel/i, explains: "lines bands",
		note: function (c) { c.todo(i18n("say what the lines and the shaded band show")); return i18n("Each dot is a study."); } },
	{	analysis: /^FunnelPlot$/, name: /funnel/i, explains: "lines bands",
		note: function (c) { c.todo(i18n("say what the funnels and the coloured bands show")); return i18n("Each dot is a study."); } },
	{	name: /funnel/i, explains: "lines",
		note: function () { return i18n("Each dot is a study; the funnel's lines mark where studies would fall around the pooled estimate if there were no heterogeneity or publication bias."); } },
	{	// multilevel models draw their moderator levels as boxes: what the boxes hold isn't certain
		name: /bubble/i, when: function (c) { return c.has(/Boxplot/); }, explains: "bars lines bands",
		note: function (c) { c.todo(i18n("say what the boxes show")); return i18n("Each dot is a study."); } },
	{	name: /bubble/i, explains: "lines bands",
		note: function (c) {
			if (!c.facts && /Multilevel/.test(c.analysis))
				return [];  // boxes or bubbles: only the drawing tells
			let s = [i18n("Each bubble is a study, sized by its weight.")];
			if (c.has(/Line/))
				s.push(i18n("The line shows the meta-regression fit") + (c.has(/Polygon|Ribbon/) && c.options.bubblePlotConfidenceIntervals === true ? i18n(", and the shaded band its") + " " + c.level("confidenceIntervalsLevel") + c.interval : "") + ".");
			return s;
		} },
	{	// the proportional-hazards check: scaled Schoenfeld residuals and their smoothed coefficient
		analysis: /SurvivalAnalysis/, name: /proportionalHazards/i, when: function (c) { return /Beta/.test(c.text); }, explains: "lines bands",
		note: function (c) {
			return i18n("Dots show the scaled Schoenfeld residuals; the line shows the estimated coefficient over time") + (c.has(/Polygon|Ribbon/) ? i18n(", and the shaded band its confidence interval") : "") + ".";
		} },
	{	// Survival curves and their confidence bands
		analysis: /SurvivalAnalysis/, name: /survival|hazardPlot|surivalPlot|restrictedMean/i, when: function (c) { return c.has(/Line|Step/) && !/proportionalHazards/i.test(c.name); }, explains: "lines bands",
		note: function (c) {
			let what = /cumulativeHazard/i.test(c.name) ? i18n("the estimated cumulative hazard") : /hazard/i.test(c.name) ? i18n("the estimated hazard")
				: /restrictedMean/i.test(c.name) ? i18n("the restricted mean survival time") : /survivalTime/i.test(c.name) ? i18n("the estimated survival time") : i18n("the estimated survival probability");
			let band = c.has(/Ribbon/) ? i18n(", and the shaded band its") + " " + c.level("predictionsConfidenceIntervalLevel", "plotCiLevel", "ciLevel") + c.interval : "";
			return (c.has(/Step/) ? i18n("The step line shows") : i18n("The line shows")) + " " + what + band + ".";
		} },
	{	// Prophet's history plot: the observed series only
		analysis: /^Prophet$/, name: /historyPlot/i, explains: "lines",
		note: function () { return i18n("The line and dots show the observed series."); } },
	{	// Time series and forecasts
		name: /forecastPlot|OverallForecast|TrendForecast/i, explains: "lines bands",
		note: function (c) {
			let prophet = /Prophet/.test(c.analysis);
			let s = prophet ? [i18n("Dots show the observed values and the line the model's fit and forecast.")] : [i18n("The line shows the observed series and the forecast.")];
			if (c.has(/Ribbon/))
				s.push(i18n("The shaded band shows the") + " " + c.level("predictionIntervalLevel", "forecastCiLevel") + i18n("prediction interval") + ".");
			return s;
		} },
	{	analysis: /bayesianStateSpace/, name: /./, when: function (c) { return c.has(/Ribbon/); }, explains: "lines bands",
		note: function (c) {
			let s = [i18n("The line shows the posterior mean and the shaded band its") + " " + c.level("aggregatedStatesPlotCiLevel", "posteriorSummaryCiLevel") + c.interval + "."];
			if (/Prediction/i.test(c.name) && c.has(/Vline/))
				s.push(i18n("The vertical line marks the start of the forecast."));
			if (/Threshold/i.test(c.name) && c.has(/Hline/))
				s.push(i18n("The dashed lines mark the threshold."));
			return s;
		} },
	{	// Machine learning
		name: /roc(Curve|Plot)/i, explains: "lines",
		note: function () { return i18n("The diagonal line shows the performance of a classifier that guesses at random."); } },
	{	name: /predictedPerformance/i, explains: "lines",
		note: function () { return i18n("The diagonal line shows where the points would fall if the predictions were exact."); } },
	{	analysis: /^mlClassificationLda$/, name: /matrixPlot/i, explains: "lines",
		note: function () { return i18n("Curves on the diagonal show the density of each discriminant function by class; dots show the cases, coloured by class."); } },
	{	// Regression and correlation
		name: /partialPlot/i, explains: "lines",
		note: function () { return i18n("The line shows the least-squares regression fit."); } },
	{	name: /corrPlot|matrixPlot|pairsPlot|scatterPlot|lagPlot/i, when: function (c) { return !/^ml/.test(c.analysis) && c.has(/Line|Smooth/) && c.has(/Point/); }, explains: "lines",
		note: function (c) {
			let s = [];
			if (c.has(/Bar/) && /corrPlot|matrixPlot/i.test(c.name))
				s.push(i18n("Panels on the diagonal show the distribution of each variable."));
			let type = c.options.scatterPlotRegressionLineType || c.options.lagPlotRegressionType;
			s.push(type === "smooth" ? i18n("The curve shows a smoothed (loess) fit.") : i18n("The line shows the least-squares regression fit."));
			return s;
		} },
	{	name: /resid|glmPlot/i, when: function (c) { return c.has(/Smooth/); }, explains: "lines",
		note: function () { return i18n("The curve shows the smoothed trend of the points."); } },
	{	name: /pareto/i, when: function (c) { return c.has(/Line/); }, explains: "lines",
		note: function () { return i18n("The line shows the cumulative percentage."); } },
	{	analysis: /^Descriptives$/, name: /distributionPlots/i, when: function (c) { return c.has(/Line/); }, explains: "lines",
		note: function () { return i18n("The curve shows a smoothed estimate of the distribution."); } },
	{	name: /scree/i, explains: "lines",
		note: function (c) { return c.has(/Hline/) ? i18n("The horizontal line marks an eigenvalue of 1.") : []; } },
	{	name: /blandAltman/i, explains: "lines bands",
		note: function (c) {
			return [i18n("The horizontal lines show the mean difference and the limits of agreement.")].concat(c.has(/Rect/) ? [i18n("Shaded bands show the confidence intervals of these lines.")] : []);
		} },
	{	name: /aoqCurve/i, explains: "lines",
		note: function (c) { return c.has(/Hline/) ? i18n("The horizontal line marks the average outgoing quality limit.") : []; } },
	{	name: /capabilityPlot/i, explains: "lines",
		note: function () { return i18n("Bars show the distribution of the measurements and the curves the fitted distributions; the vertical lines mark the specification limits and the target."); } },
	{	analysis: /^processCapability/, name: /histogram/i, when: function (c) { return c.has(/Line/); }, explains: "lines",
		note: function () { return i18n("The curve shows the fitted distribution."); } },
	{	name: /equivalence\w*BoundsContainer/i, explains: "bars bands",
		note: function (c) {
			let alpha = typeof c.options.alpha === "number" ? c.options.alpha : null;
			return [i18n("The shaded region marks the equivalence bounds."), i18n("The point shows the mean difference and the error bar its") + " " + (alpha !== null ? Math.round((1 - 2 * alpha) * 1000) / 10 + "% " : "") + c.interval + "."];
		} },
];

function _apaFigureKind(info, geoms) {
	/**
	 * The note sentences for a figure from apaFigureKinds: { sentences, explains: { bars, lines, bands } }, or null when
	 * no kind matches. `geoms` are the geoms the plot draws.
	 */
	let options = info.options || {};
	let text = [];
	for (let plot of ((info.facts && info.facts.plots) || []))
		for (let key of ["x", "y", "colour", "fill", "text"])
			text = text.concat(plot[key] || []);
	text = text.filter(function (t) { return typeof t === "string"; }).join(" | ");
	let bayes = _apaFigureIsBayesian(info);
	let imageLevel = /(\d+(?:\.\d+)?)\s*%\s*(CI|HDI|credible|confidence)/i.exec(text);
	let todos = [];
	let legend = ((info.facts && info.facts.plots) || []).some(function (p) { return typeof p.colour === "string" || typeof p.linetype === "string"; });
	let c = {
		analysis: info.analysisName || "", name: info.plotName || "", options: options, text: text, bayes: bayes, legend: legend, facts: !!info.facts,
		todo: function (what) { if (todos.indexOf(what) === -1) todos.push(what); },
		y: ((info.facts && info.facts.plots) || []).map(function (p) { return typeof p.y === "string" ? p.y : ""; }).join(" | "),
		labels: [].concat(...((info.facts && info.facts.plots) || []).map(function (p) { return [].concat(p.text || []); })),
		has: function (re) { return geoms.some(function (g) { return re.test(g); }); },
		interval: bayes ? i18n("credible interval") : i18n("confidence interval"),
		level: function () {
			if (imageLevel)
				return imageLevel[1] + "% ";
			for (let key of arguments)
				if (typeof options[key] === "number")
					return Math.round(options[key] * 1000) / 10 + "% ";
			return "";
		},
	};
	for (let kind of apaFigureKinds) {
		if (kind.analysis && !kind.analysis.test(c.analysis))
			continue;
		if (!kind.name.test(c.name) || (kind.when && !kind.when(c)))
			continue;
		let sentences = [].concat(kind.note(c) || []);
		// JASP's own picture (no facts): what the kind draws can't be checked, so a to-do instead of an empty note
		if (!info.facts && sentences.length === 0 && todos.length === 0)
			c.todo(kind.noFacts ? i18n(kind.noFacts) : i18n("say what the lines and marks show"));
		return { sentences: sentences, todos: todos, rug: kind.rug !== false, explains: { bars: /bars/.test(kind.explains), lines: /lines/.test(kind.explains), bands: /bands/.test(kind.explains) } };
	}
	return null;
}

function _apaFigureIsBayesian(info) {
	// A Bayesian analysis, or a plot that prints Bayes factors: its intervals are credible intervals
	let text = [];
	for (let plot of ((info.facts && info.facts.plots) || []))
		for (let key of ["x", "y", "text"])
			text = text.concat(plot[key] || []);
	// Prophet estimates by MCMC (its "Credible interval level"), and every Learn Bayes analysis (LS...) is Bayesian
	let mcmc = /^Prophet$/.test(info.analysisName || "") && (!info.options || info.options.estimation !== "map");
	return mcmc || /Bayes|^bfpack|^Bain|^LS/i.test(info.analysisName || "") || /prior|posterior/i.test(info.plotName || "") || text.some(function (t) { return typeof t === "string" && /\bBF/.test(t); });
}

function _apaFigureUnexplained(info, explains, noteText) {
	/**
	 * To-dos for reference lines and bands that neither the plot kind nor the note explains: a horizontal, vertical or
	 * diagonal line, a smoother, or a shaded band. Lines labelled in the image (AOQL, LSL, UCL) and the zero line of bar
	 * charts need none; a filled density shape isn't a band.
	 */
	let todos = [];
	if (!info.facts)
		return todos;
	let lines = false, bands = false;
	for (let plot of (info.facts.plots || [])) {
		let geoms = plot.geoms || [];
		let labelled = [].concat(plot.text || []).some(function (t) { return typeof t === "string" && /\b(AOQL|LSL|USL|Target|U?CL|LCL|LSL)\b/.test(t); });
		let bars = geoms.some(function (g) { return /^Geom(Bar|Col)$/.test(g); });
		if (!labelled && geoms.some(function (g) { return /Vline|Abline|abline|Smooth/i.test(g) || (/Hline/.test(g) && !bars); }))
			lines = true;
		let density = /density/i.test(typeof plot.y === "string" ? plot.y : "") || geoms.some(function (g) { return /Violin|Density/.test(g); });
		if (!density && geoms.some(function (g) { return /Ribbon/.test(g); }))
			bands = true;
	}
	if (lines && !explains.lines && !/\b(lines?|curve)\b/i.test(noteText))
		todos.push(i18n("say what the lines show"));
	if (bands && !explains.bands && !/\b(band|shaded)\b/i.test(noteText))
		todos.push(i18n("say what the shaded band shows"));
	return todos;
}

// Error bars and bands: what they show comes from the analysis options, whether they are drawn from the plot itself
// (facts: the plot's layers, from the external tool's rerun; without facts the options alone decide)
function _apaFigureIntervalNote(info) {
	info = _apaFigureInfo(info);
	let options = info.options || {};
	let geoms = [];
	for (let plot of ((info.facts && info.facts.plots) || []))
		geoms = geoms.concat(plot.geoms || []);
	let known = !!info.facts;
	let hasBox = geoms.some(function (g) { return /Boxplot/.test(g); });
	// What this kind of plot draws (apaFigureKinds); its marks (a pdf plot's chosen value, an ACF plot's spikes) aren't error bars
	let kind = _apaFigureKind(info, geoms);
	let explains = kind ? kind.explains : { bars: false, lines: false, bands: false };
	// a box plot's whiskers are drawn as error bars: the box sentence explains them
	let hasBars = !hasBox && !explains.bars && geoms.some(function (g) { return /Errorbar|Linerange|Pointrange|Crossbar/.test(g); });
	let name = (info.plotName || "") + " " + (info.title || "");
	// Bands: only where an option of this plot asks for one (marginalPlotCi for marginal plots, qqPlotCi for Q-Q
	// plots); a density plot's filled shape is drawn as a ribbon too, and other plots' options don't count
	let lowerName = (info.plotName || "").toLowerCase();
	let ownOption = function (key) { let stem = key.replace(/[A-Z].*$/, "").toLowerCase(); return stem.length >= 2 && lowerName.indexOf(stem) !== -1; };
	let bandCi = Object.keys(options).filter(function (k) { return /(Ci|ConfidenceIntervals?)$/.test(k) && options[k] === true && ownOption(k) && typeof options[k + "Level"] === "number"; });
	let bandPi = Object.keys(options).filter(function (k) { return /PredictionInterval$/.test(k) && options[k] === true && ownOption(k); });
	let hasBand = !explains.bands && geoms.some(function (g) { return /Ribbon|Smooth/.test(g); }) && bandCi.length > 0;
	// Option families: bar plots, descriptives plots; their keys share a prefix (barPlotErrorBarType, descriptivePlotCiLevel)
	let prefix = /bar ?plot/i.test(name) ? /^barPlot/ : /descripti/i.test(name) ? /^descriptives?Plot/ : null;
	let pick = function (pattern) {
		let keys = Object.keys(options).filter(function (k) { return pattern.test(k) && (!prefix || prefix.test(k)); });
		return keys.length > 0 ? options[keys[0]] : undefined;
	};
	let level = pick(/(CiLevel|CiInterval)$/);
	let type = pick(/(ErrorBarType|ErrorType)$/);
	let switchedOff = pick(/(ErrorBars?|PlotCi)$/) === false;
	let percent = function (x) { return typeof x === "number" ? Math.round(x * 1000) / 10 + "%" : "95%"; };
	let bayes = _apaFigureIsBayesian(info);
	let intervalName = bayes ? i18n("credible interval") : i18n("confidence interval");
	// Within-subjects bars: the paired t test always adjusts them (.summarySEwithin); RM ANOVA when this plot's own option says so
	let normalize = /bar ?plot/i.test(name) ? options.normalizeErrorBarsBarplot : options.normalizeErrorBarsDescriptives;
	let within = /^TTestPaired/.test(info.analysisName || "") || (normalize === true && /RepeatedMeasures/.test(info.analysisName || ""));
	// descriptives plots draw each mean as a point
	let pointMeans = prefix && prefix.source.indexOf("descripti") !== -1 && geoms.some(function (g) { return /^Geom(Jasp)?Point$/.test(g); });
	let errorBars = function (what) { return (pointMeans ? i18n("Points show means; error bars represent") : i18n("Error bars represent")) + " " + what + (within ? i18n(", adjusted for the within-subjects design") : "") + "."; };

	let sentences = [];
	// (a bubble plot's boxes aren't a box plot of scores: its kind asks what they show)
	if (hasBox && !/bubble|forest/i.test(info.plotName || "")) {
		sentences.push(i18n("Boxes show the middle 50% of scores, with the median as a line; whiskers reach the most extreme scores within 1.5 times the box's length."));
		if (geoms.some(function (g) { return /Violin|Density|Flat|Polygon/i.test(g); }))
			sentences.push(i18n("The shaded shapes show the distribution of scores."));
		// JASP's Descriptives draws outliers as a point layer of their own: those dots aren't the scores
		let boxPlots = (info.facts && info.facts.plots) || [];
		let outliersOnly = boxPlots.length > 0 && boxPlots.every(function (p) { return ![].concat(p.geoms || []).some(function (g) { return /^Geom(Jasp)?Point$/.test(g); }) || p.boxOutliers === true; });
		if (geoms.some(function (g) { return /Jitter/.test(g); }) || (!outliersOnly && geoms.some(function (g) { return /^Geom(Jasp)?Point$/.test(g); })))
			sentences.push(i18n("Dots show individual scores."));
		else if (outliersOnly && geoms.some(function (g) { return /^Geom(Jasp)?Point$/.test(g); }))
			sentences.push(i18n("Dots show outliers, scores beyond the whiskers."));
	}
	// Lines that diagnostic and model plots draw, named from the plot (the same in JASP's own picture)
	let plotName = info.plotName || "";
	let dependent = typeof options.dependent === "string" && options.dependent ? options.dependent : null;
	if (kind)
		sentences = sentences.concat(kind.sentences);
	if (/residualsVs(Pred|Dep|Cov)/i.test(plotName))
		sentences.push(i18n("The horizontal line marks a residual of zero."));
	if (/residualsVsHist/i.test(plotName))
		sentences.push(i18n("The curve is a smoothed estimate of the distribution."));
	if (/marginalPlotsContainer_/.test(plotName) && dependent)
		sentences.push(i18n("The line shows predicted values of") + " " + dependent + i18n(", with the other predictors held at their means."));
	if (/^TTestPaired/.test(info.analysisName || "") && /rain/i.test(plotName) && !/Difference/i.test(plotName) && geoms.some(function (g) { return /Line|Path|Segment/.test(g); }))
		sentences.push(i18n("Lines join each participant's two scores."));
	// rug marks (regression marginal plots): one tick per observed value along the axis
	let rug = (!kind || kind.rug) && geoms.some(function (g) { return /Rug/.test(g); }) ? i18n("Tick marks along the x axis show the observed values.") : null;
	let joined = function (more) { return { text: sentences.concat(more ? [more] : [], rug ? [rug] : []).join(" ") }; };
	// JASP's Descriptives interval plot: the mean with mean ± 1.96 standard errors
	if (/IntervalPlot/.test(info.plotName || "") && /^Descriptives$/.test(info.analysisName || ""))
		return joined(i18n("Points show means; error bars represent 95% confidence intervals."));
	// t tests' descriptives plots have a level and no type: their bars are always confidence intervals
	if (prefix && type === undefined && level !== undefined && !switchedOff && (hasBars || !known))
		type = "ci";
	if (prefix && (hasBars || (!known && !switchedOff && type !== undefined))) {
		if (type === "se")
			return joined(errorBars(i18n("standard errors")));
		if (type === "ci" || (bayes && level !== undefined))
			return joined(errorBars(percent(level) + " " + (bayes ? i18n("credible intervals") : i18n("confidence intervals"))));
	}
	// the sentences so far stay with a to-do
	let withTodo = function (todo) { let r = sentences.length > 0 || rug ? joined() : {}; r.todo = todo; return r; };
	if (hasBars)
		return withTodo(i18n("say what the error bars show"));
	// JASP draws a confidence interval as a shaded band and a prediction interval as two dashed lines
	let ci = bandCi.length === 1 ? percent(options[bandCi[0] + "Level"]) : null;
	let pi = bandPi.length === 1 ? percent(options[bandPi[0] + "Level"]) : null;
	if (known && pi && geoms.some(function (g) { return /Line/.test(g); })) {
		if (hasBand && ci)
			return joined(i18n("The shaded band shows the") + " " + ci + " " + intervalName + " " + i18n("and the dashed lines the") + " " + pi + " " + i18n("prediction interval") + ".");
		if (!hasBand)
			return joined(i18n("The dashed lines show the") + " " + pi + " " + i18n("prediction interval") + ".");
	}
	if (hasBand) {
		if (ci && bandPi.length === 0)
			return joined(i18n("The shaded band shows the") + " " + ci + " " + intervalName + ".");
		return withTodo(i18n("say what the shaded band shows"));
	}
	return sentences.length > 0 ? joined() : null;
}

// Figures use the tables' page widths, in inches: A4 portrait (6.27 in) and Letter landscape (9 in)
const apaFigurePortraitWidth	= apaPageTextWidth / 72;
const apaFigureLandscapeWidth	= apaLandscapeTextWidth / 72;

function _apaPlotmathText(text) {
	// Simple plotmath as the reader sees it: 'paste("Effect Size", ~delta)' -> "Effect Size δ", '"Cronbach's" ~ alpha'
	// -> "Cronbach's α". Null for anything with operators or subscripts, which only R can draw.
	if (typeof text !== "string" || /\[|==|<=|>=|%|\^|\*|\bfrac\b|\{/.test(text))
		return null;
	let greek = { alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", eta: "η", theta: "θ", lambda: "λ", mu: "μ", rho: "ρ", sigma: "σ", tau: "τ", phi: "φ", omega: "ω" };
	let out = text.replace(/\b(paste0?|italic|bold|plain)\s*\(/g, "(").replace(/[()",~]/g, " ")
		.replace(/\b([a-z]+)\b/g, function (w) { return greek[w] || w; }).replace(/\s+/g, " ").trim();
	return out || null;
}

function _apaSuggestFigureTitle(facts, info) {
	/**
	 * A figure title from what the plot draws: "Heart Rate by Group and Gender" (y by x and the legend), or
	 * "Distribution of Sum Score" for histograms and densities. Null when the axes don't say enough.
	 */
	facts = _apaFigureFacts(facts);
	let plot = facts && facts.plots[0];
	if (!plot)
		return null;
	let word = function (v) {
		if (typeof v !== "string")
			return null;
		v = _apaStripMarkup(v).trim();
		return v && !/[\[\]~"]|^\(?\w\)?$/.test(v) ? v : null;  // no plotmath, no lone symbols
	};
	let x = word(plot.x), y = word(plot.y);
	let legend = word(plot.colour) || word(plot.fill) || word(plot.shape) || word(plot.linetype);
	let geoms = [];
	for (let p of facts.plots)
		geoms = geoms.concat(p.geoms || []);
	let has = function (re) { return geoms.some(function (g) { return re.test(g); }); };
	// "Distribution of" only where the plot draws a distribution: histograms, densities, box, violin and dot plots
	let drawsDistribution = has(/Histogram|Density|Boxplot|Violin|Dotplot|Dots$/);
	let countY = !!y && /^(density|counts?|frequency|proportion|percent(age)?)$/i.test(y);
	if (x && /^total$/i.test(x) && y && (drawsDistribution || geoms.length === 0))  // JASP's label when the scores aren't split into groups
		return apaTitleCase(i18n("Distribution of")) + " " + y;
	// Axis titles are mostly variable names: they keep the student's own spelling, only the joining words change
	if (x && ((countY && (geoms.length === 0 || has(/Bar|Col|Histogram|Density|Area|Ribbon|Dotplot|Dots$/))) || (!y && drawsDistribution)))
		return apaTitleCase(i18n("Distribution of")) + " " + x;
	// a means plot whose y axis has no title (the repeated measures' levels): its points are means
	if (x && !y && has(/Errorbar/) && has(/Point/) && info && /descripti/i.test(info.plotName || "")) {
		let dependent = info && typeof (info.options || {}).dependent === "string" && info.options.dependent ? info.options.dependent : null;
		return (dependent ? apaTitleCase(i18n("Mean")) + " " + dependent + " " + i18n("by") : apaTitleCase(i18n("Means by"))) + " " + x + (legend && legend !== x ? " " + i18n("and") + " " + legend : "");
	}
	if (!x || !y || countY || /quantile|residual|fitted|predicted|index|observation|theoretical|iteration/i.test(x + " " + y))
		return null;  // diagnostic plots: their JASP title says it better
	return y + " " + i18n("by") + " " + x + (legend && legend !== x && legend !== y ? " " + i18n("and") + " " + legend : "");
}

function _apaFigureTitleFromKind(info) {
	/**
	 * A title for diagnostic plots, whose axes don't make one: "Q-Q Plot of Standardized Residuals for Sales",
	 * "Partial Regression Plot for Adverts", "Residuals by Airplay". Null for other plots.
	 */
	info = _apaFigureInfo(info);
	let name = info.plotName || "";
	let variables = info.variables;
	let last = name.split("_").pop();
	let variable = variables.indexOf(last) !== -1 ? last : null;
	let dependent = typeof (info.options || {}).dependent === "string" && info.options.dependent ? info.options.dependent : null;
	let forDependent = dependent ? " " + i18n("for") + " " + dependent : "";
	let analysis = info.analysisName || "";
	let pair = /_([^_]+) - ([^_]+)$/.exec(name);
	if (/^TTestOneSample/.test(analysis) && /rain/i.test(name) && variable)
		return apaTitleCase(i18n("Distribution of")) + " " + variable;
	if (/^TTestOneSample/.test(analysis) && /descripti|barPlot/i.test(name) && variable)
		return apaTitleCase(i18n("Mean")) + " " + variable + (typeof (info.options || {}).testValue === "number" ? " " + apaTitleCase(i18n("compared with the test value of")) + " " + info.options.testValue : "");
	let marginal = /marginalPlotsContainer_(.+)$/.exec(name);
	if (marginal && dependent)
		return apaTitleCase(i18n("Predicted")) + " " + dependent + " " + i18n("by") + " " + marginal[1];
	if (/^TTestPaired/.test(analysis) && pair) {
		let both = pair[1] + " " + i18n("and") + " " + pair[2];
		if (/CloudDifference/i.test(name))
			return apaTitleCase(i18n("Distribution of the differences between")) + " " + both;
		return /rain/i.test(name) ? apaTitleCase(i18n("Distribution of")) + " " + both : apaTitleCase(i18n("Means of")) + " " + both;
	}
	if (/IntervalPlot/.test(name) && variable)
		return apaTitleCase(i18n("Mean of")) + " " + variable;
	// Plots named by their kind; "for" the variable the container names, so neighbouring figures differ
	let plot = info.facts && info.facts.plots && info.facts.plots[info.facts.plots.length - 1];
	let containerVariable = (info.containerTitles || []).map(function (t) { return t.trim(); }).filter(function (t) { return variables.indexOf(t) !== -1 || variables.indexOf(t.split(" - ")[0]) !== -1 || /^\S+ - \S+$/.test(t); }).pop();
	let forVariable = containerVariable ? " " + i18n("for") + " " + containerVariable : "";
	let axisX = plot ? _apaPlotmathText(_apaStripMarkup(plot.x || "")) : null;
	let axisY = plot ? _apaPlotmathText(_apaStripMarkup(plot.y || "")) : null;
	if (/prior.?(and.?)?posterior|priorposterior/i.test(name) && plot && /Line|Function|Density|Area/.test((plot.geoms || []).join(" ")))
		return apaTitleCase(i18n("Prior and posterior distributions")) + (axisX ? " " + i18n("of") + " " + axisX : "") + forVariable;
	if (/robustness/i.test(name) && /Bayes|BF/i.test(analysis + " " + ((plot && plot.y) || "")))
		return apaTitleCase(i18n("Bayes factor robustness check")) + forVariable;
	if (/sequential/i.test(name) && /Bayes|BF/i.test(analysis + " " + ((plot && plot.y) || "")))
		return apaTitleCase(i18n("Sequential analysis of the Bayes factor")) + forVariable;
	if (/trace ?plot|plotContainerTP/i.test(name)) {
		let what = axisY && axisY.length > 1 && !/^(x|y|value)$/i.test(axisY) ? axisY : last;
		return apaTitleCase(i18n("Trace plot of")) + " " + what;
	}
	if (/ppplot|_pp$/i.test(name))
		return apaTitleCase(i18n("P-P plot of the fitted distribution"));
	if (/qq/i.test(name) && /^LD|compareContinuous/.test(analysis))
		return apaTitleCase(i18n("Q-Q plot of the fitted distribution"));
	if (/^LD/.test(analysis) && /estCDF/.test(name))
		return apaTitleCase(i18n("Observed and fitted cumulative distributions"));
	if (/^LD/.test(analysis) && /ecdf/.test(name))
		return apaTitleCase(i18n("Cumulative distribution of the data"));
	if (/^LD/.test(analysis) && /estPDF|estPMF/.test(name))
		return apaTitleCase(i18n("Observed and fitted distributions"));
	if (/probabilityContainer|ProbabilityPlot/.test(name) && /processCapability/.test(analysis))
		return apaTitleCase(i18n("Probability plot of")) + " " + (axisX || i18n("the measurements"));
	// control charts without a title of their own: what they chart
	if (/chart/i.test(name) && !/traffic|report/i.test(name) && !(info.title || "").trim() && axisY && /Charts|msaGauge|msaTestRetest|rareEvent|processCapability/.test(analysis))
		return apaTitleCase(i18n("Control chart of")) + " " + axisY;
	// the matrix's own order (the analysis's variable list), not the sorted list of names in the file
	let listed = (info.options || {}).variables;
	listed = Array.isArray(listed) ? listed : listed && Array.isArray(listed.value) ? listed.value : variables;
	listed = listed.filter(function (v) { return typeof v === "string" && v; });
	if (/matrixPlot|corrPlot/.test(name) && listed.length >= 2) {
		if (listed.length === 2)
			return apaTitleCase(i18n("Correlation between")) + " " + listed[0] + " " + i18n("and") + " " + listed[1];
		return apaTitleCase(i18n("Correlations among")) + " " + listed.slice(0, -1).join(", ") + ", " + i18n("and") + " " + listed[listed.length - 1];
	}
	if (/qq/i.test(name))
		return variable && !/residual/i.test(name) ? apaTitleCase(i18n("Q-Q plot of")) + " " + variable : apaTitleCase(i18n("Q-Q plot of standardized residuals")) + forDependent;
	if (/partialPlot/i.test(name) && variable)
		return apaTitleCase(i18n("Partial regression plot for")) + " " + variable;
	if (/residualsVsCov/i.test(name) && variable)
		return apaTitleCase(i18n("Residuals by")) + " " + variable;
	if (/residualsVsPred/i.test(name))
		return apaTitleCase(i18n("Residuals by predicted values")) + forDependent;
	if (/residualsVsDep/i.test(name))
		return apaTitleCase(i18n("Residuals by observed values")) + forDependent;
	if (/residualsVsHist/i.test(name))
		return apaTitleCase(i18n("Distribution of standardized residuals")) + forDependent;
	return null;
}

// Panels: a figure of several panels describes each by its letter in the general note, in the form of the manual's
// multipanel figures (APA 7, 7.26 and 7.28, Figures 7.18 and 7.19): "Panel A: Strength. Panel B: Betweenness." The
// letters are the ones the external tool drew (facts.panelLetters); a panel's heading is used only where the facts
// give it (facts.panelHeadings, in the letters' order), in sentence case, and only when it reads as a description:
// a symbol or code ("mu", "tau", "Hu") or a phrase that isn't a noun phrase ("Excluding Hu and Hc") gets a to-do,
// as do panels without a heading. Nothing is made up.
function _apaPanelList(letters) {
	// "Panel B", "Panels A and B", "Panels A to D" (letters in a row), "Panels A, C, and D"
	if (letters.length === 1)
		return i18n("Panel") + " " + letters[0];
	let inRow = letters.length > 2 && letters.every(function (l, k) { return k === 0 || l.charCodeAt(0) === letters[k - 1].charCodeAt(0) + 1; });
	if (inRow)
		return i18n("Panels") + " " + letters[0] + " " + i18n("to") + " " + letters[letters.length - 1];
	if (letters.length === 2)
		return i18n("Panels") + " " + letters[0] + " " + i18n("and") + " " + letters[1];
	return i18n("Panels") + " " + letters.slice(0, -1).join(", ") + ", " + i18n("and") + " " + letters[letters.length - 1];
}

// A panel heading that names what the panel shows: not a symbol or a code, not a phrase that starts with a verb or a
// preposition (the heading of a condition, "Excluding Hu and Hc", which says what was left out, not what is shown)
function _apaPanelHeadingDescribes(h) {
	let words = h.split(/\s+/).filter(function (w) { return w; });
	if (!words.length)
		return false;
	let greek = /^(alpha|beta|gamma|delta|epsilon|zeta|eta|theta|iota|kappa|lambda|mu|nu|xi|omicron|pi|rho|sigma|tau|upsilon|phi|chi|psi|omega)$/i;
	// a code: one or two letters with digits or primes ("H1", "Hu", "x"), a Greek letter by name or sign, a lone number
	let code = function (w) { w = w.replace(/[(),.:;]/g, ""); return !w || /^[A-Za-z\u0370-\u03ff]{1,2}[0-9'\u2080-\u2089]*$/.test(w) || greek.test(w) || /^[0-9.\-\u2212]+$/.test(w); };
	if (words.every(function (w) { return code(w) || /^(and|or|of|vs\.?|versus|&)$/i.test(w); }))
		return false;
	if (/^(excluding|including|with|without|for|by|using|versus|vs\.?|and|or|of|in|at|to|from|given|when|if|after|before)$/i.test(words[0]))
		return false;
	return true;
}

// A heading in sentence case for the note: only the words the external tool itself capitalised are lowered. `jasp`
// is the heading as JASP wrote it (facts.panelHeadingsJasp); a word JASP wrote in lower case and the tool showed
// capitalised goes back to JASP's. Everything JASP capitalised (proper names, "United States", "Cohen", weekdays,
// its own title case) stays as JASP wrote it. Without JASP's heading the heading is used as it is.
function _apaPanelSentenceCase(h, jasp) {
	if (typeof jasp !== "string" || !jasp)
		return h;
	jasp = _apaStripMarkup(jasp).replace(/^\(?[a-z]\)\s+/, "").replace(/\s+/g, " ").trim();
	let shown = h.split(/(\s+|-)/), own = jasp.split(/(\s+|-)/);
	if (shown.length !== own.length)
		return h;
	return shown.map(function (w, k) {
		let o = own[k];
		if (o === w)
			return w;
		if (o.length && o.charAt(0) === o.charAt(0).toLowerCase() && o.charAt(0) !== o.charAt(0).toUpperCase() && o.charAt(0).toUpperCase() + o.slice(1) === w)
			return k === 0 ? w : o;
		return w;
	}).join("");
}

function _apaFigurePanelNote(facts) {
	/**
	 * @returns { html, todo, inline } for a figure with 2 or more panel letters, or null for a figure without letters.
	 * html: "Panel A: ... Panel B: ..." in letter order, a to-do in place of each panel whose heading doesn't describe
	 * it (inline: true), or "" when no heading does (the one to-do then covers every panel); todo: the to-do text for
	 * the panels left, or null
	 */
	if (!facts)
		return null;
	let letters = _apaAsList(facts.panelLetters).filter(function (l) { return typeof l === "string" && /^[A-Z]$/.test(l); });
	if (letters.length < 2 || letters.length !== _apaAsList(facts.panelLetters).length)
		return null;
	// headings only when there is one for every letter, in order; a blank or a repeated heading doesn't tell panels apart
	let headings = _apaAsList(facts.panelHeadings);
	if (headings.length !== letters.length)
		headings = [];
	let jasp = _apaAsList(facts.panelHeadingsJasp);
	if (jasp.length !== letters.length)
		jasp = [];
	headings = headings.map(function (h) { return typeof h === "string" ? _apaStripMarkup(h).replace(/^\(?[a-z]\)\s+/, "").replace(/\s+/g, " ").trim() : ""; });
	let parts = [], unknown = [];
	letters.forEach(function (l, k) {
		let h = headings[k] || "";
		if (h && headings.indexOf(h) === k && headings.lastIndexOf(h) === k && _apaPanelHeadingDescribes(h)) {
			let text = _apaPanelSentenceCase(h, jasp[k]);
			parts.push({ letter: l, html: i18n("Panel") + " " + l + ": " + _apaEscape(text) + (/[.!?]$/.test(text) ? "" : ".") });
		}
		else {
			unknown.push(l);
			parts.push({ letter: l, html: null });
		}
	});
	let todo = null;
	if (unknown.length > 0)
		todo = i18n("describe what") + " " + _apaPanelList(unknown) + " " + (unknown.length === 1 ? i18n("shows") : i18n("show"));
	if (unknown.length === letters.length)
		return { html: "", todo: todo, inline: false };
	// in letter order: each panel left gets its own to-do in its place
	let html = parts.map(function (p) {
		return p.html || (i18n("Panel") + " " + p.letter + ": " + _apaTodo(i18n("describe what this panel shows")) + ".");
	}).join(" ");
	return { html: html, todo: todo, inline: unknown.length > 0 };
}

function buildAPAFigure(info, figureNumber) {
	/**
	 * Builds an APA 7 figure: "Figure N" in bold, the title in italic title case, the picture at a size where its
	 * text lands at 8 to 14 pt, and a note (APA 7, 7.22 to 7.28).
	 * @param info	{ title, containerTitles, image: { src, widthIn, heightIn }, options, analysisName, plotName,
	 *				facts (what the plot draws, from the external tool), variables (the analysis's variable names),
	 *				dataSampleSize ({ n } or { range }) }
	 * @param figureNumber	number shown in "Figure N" (figures are numbered apart from tables)
	 * @returns { html, text, todo, changes }
	 */
	info = _apaFigureInfo(info);
	let log = _apaChangeLog(null);
	let todo = [];
	let notes = [];

	// Title: JASP's plot title, with the container's when the plot has none or only names a level ("Gender: Male").
	// Markup from ggtext titles ("*M*<sub>diff</sub>") is dropped: the title is plain italic text.
	let parts = (info.containerTitles || []).concat(info.title ? [info.title] : []).map(_apaStripMarkup).map(_apaPlain).filter(function (t) { return t.trim() !== ""; });
	let variables = info.variables || [];
	// A plot without a title of its own whose name ends in a label ("Plots_WindDirection_August"): the label tells it
	// apart from its neighbours, so it joins the title
	let lastName = (info.plotName || "").split("_").pop();
	if (!(info.title || "").trim() && /^[A-Z][a-z]+( [A-Za-z0-9]+)*$/.test(lastName) && variables.indexOf(lastName) === -1 && parts.join(" ").indexOf(lastName) === -1)
		parts.push(lastName);
	let raw = parts.join(": ");
	let title = apaTitleCase(apaTidyLabel(raw, true, variables).text).replace(/\bT-Test\b/g, "t Test");
	let titleHtml = _apaEscape(title);
	let namesVariable = variables.some(function (v) { return v && new RegExp("(^|\\W)" + v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(\\W|$)", "i").test(raw); });
	// Titles made of JASP's section names around a variable ("Descriptives: Descriptives Plots: Mischief") say little:
	// a title from the plot's axes says more, when there is one
	let generic = /^(descriptives?( plots?)?|assumption checks|inferential plots|plots?|descriptives plots?|bar plots?|raincloud plots?|q-q plots?)$/i;
	let meaningful = (info.containerTitles || []).concat(info.title ? [info.title] : []).map(_apaPlain).filter(function (t) { return t.trim() !== "" && !generic.test(t.trim()); });
	let onlyNames = meaningful.length > 0 && meaningful.every(function (t) { return variables.indexOf(t.trim()) !== -1 || /^\S+ - \S+$/.test(t.trim()); });
	let suggested = _apaFigureTitleFromKind(info) || _apaSuggestFigureTitle(info.facts, info);
	if (namesVariable && onlyNames && suggested)
		namesVariable = false;
	if (!namesVariable || raw.trim() === "") {
		// A title from what the plot draws ("Heart Rate by Group and Gender"), for the student to check
		if (suggested) {
			titleHtml = _apaTodo(suggested).replace(/>\[|\]</g, function (m) { return m[0] === ">" ? ">" : "<"; });
			todo.push(i18n("check the suggested title"));
		}
		else {
			titleHtml += (titleHtml ? " " : "") + _apaTodo(i18n("say what the figure shows"));
			todo.push(i18n("make the title say what the figure shows"));
		}
	}
	log.add(i18n("Title"), i18n("Figure number in bold, then the title in italic title case on the next line, both above the figure. APA wants the title to say what the figure shows (APA 7, 7.24)."), [{ from: _apaEscape(raw), to: titleHtml }]);

	// Note: what each panel shows, what the error bars, bands, lines and dots show, then the sample size, and the
	// abbreviations last (APA 7, 7.28)
	let panels = _apaFigurePanelNote(info.facts);
	if (panels && panels.html) {
		notes.push(panels.html);
		log.add(i18n("Panels"), i18n("The note describes each panel by its letter, as APA asks for figures of several panels (APA 7, 7.26 and 7.28)."), [{ from: "", to: panels.html }]);
	}
	if (panels && panels.todo) {
		if (!panels.inline)
			notes.push(_apaTodo(panels.todo) + ".");
		todo.push(panels.todo);
	}
	let interval = _apaFigureIntervalNote(info);
	if (interval && interval.text) {
		notes.push(interval.text);
		log.add(i18n("Error bars"), i18n("The note says what the error bars, bands and lines show, as APA asks (APA 7, 7.28)."), [{ from: "", to: interval.text }]);
	}
	if (interval && interval.todo) {
		notes.push(_apaTodo(interval.todo) + ".");
		todo.push(interval.todo);
	}
	// The one-sample t tests' descriptives, bar and raincloud plots draw the test value as a dashed line
	let options = info.options || {};
	let allGeoms = [];
	for (let plot of ((info.facts && info.facts.plots) || []))
		allGeoms = allGeoms.concat(plot.geoms || []);
	if (/^TTest(Bayesian)?OneSample/.test(info.analysisName || "") && /descripti|barPlot|RainCloud/i.test(info.plotName || "") && typeof options.testValue === "number"
		&& (!info.facts || allGeoms.some(function (g) { return /Hline/.test(g); }) || /descripti|barPlot/i.test(info.plotName || "")))
		notes.push(i18n("The dashed line shows the test value of") + " " + options.testValue + ".");
	// Reference lines and bands that no sentence explains: only the student knows what they show
	let kind = _apaFigureKind(info, allGeoms);
	for (let what of (kind ? kind.todos : [])) {
		notes.push(_apaTodo(what) + ".");
		todo.push(what);
	}
	// (panel headings don't explain lines: "Panel A shows Regression Line" says nothing about what the line means)
	let unexplained = _apaFigureUnexplained(info, kind ? kind.explains : {}, _apaPlain(notes.filter(function (n) { return !panels || n !== panels.html; }).join(" ")));
	for (let what of unexplained) {
		notes.push(_apaTodo(what) + ".");
		todo.push(what);
	}
	// A plot of data whose y axis has no title (the paired t test's plots): the note says what it shows. Not for plots
	// whose y axis lists labels (heatmaps, matrices, forest plots) or bar charts turned on their side.
	let firstPlot = info.facts && info.facts.plots && info.facts.plots[0];
	let noYTitleNeeded = /heatmap|matrix|forest|pie|path|network|tree|dendrogram|traffic|Objectives|posteriorProbability/i.test(info.plotName || "")
		|| allGeoms.some(function (g) { return /Tile|Raster|diamond/.test(g); })
		|| (firstPlot && !firstPlot.x && (firstPlot.geoms || []).every(function (g) { return /Bar|Col|Text|Label|Blank|RangeFrame/.test(g); }));
	if (firstPlot && !noYTitleNeeded && !firstPlot.yHidden && (firstPlot.y === null || (typeof firstPlot.y === "string" && firstPlot.y.trim() === "")) && info.facts.panels === 1
		&& (firstPlot.geoms || []).some(function (g) { return !/Text|Label|Blank|RangeFrame/.test(g); })) {
		notes.push(_apaTodo(i18n("say what the y axis shows")) + ".");
		todo.push(i18n("say what the y axis shows"));
	}
	let sample = info.dataSampleSize;
	let count = function (n) { return n >= 1000 ? n.toLocaleString("en") : String(n); };
	if (sample && sample.n !== undefined)
		notes.push("<i>N</i> = " + count(sample.n) + ".");
	else if (sample && sample.range)
		notes.push("<i>N</i>s range from " + count(sample.range.min) + " to " + count(sample.range.max) + " because of missing values.");
	// Abbreviations in the figure (axis titles, legends, text in the plot) written out, as for tables (APA 7, 7.28), last in the general note (7.14),
	// in the order they first appear
	let words = [_apaPlain(titleHtml)];
	for (let plot of ((info.facts && info.facts.plots) || []))
		for (let key of ["x", "y", "colour", "fill", "shape", "linetype", "text"])
			words = words.concat(plot[key] || []);
	words = words.concat(info.facts ? _apaAsList(info.facts.panelHeadings) : []);
	let figureText = words.filter(function (w) { return typeof w === "string"; }).map(_apaFigureAbbreviationText).join(" | ");
	let noteSoFar = _apaPlain(notes.join(" "));
	let meanings = Object.assign({}, apaAbbreviationMeanings, apaFigureAbbreviationMeanings);
	if (_apaFigureIsBayesian(info))
		meanings["CI"] = i18n("credible interval");
	if (/standardErrorOfMeasurement/.test(info.analysisName || ""))
		meanings["SEM"] = i18n("standard error of measurement");
	let explained = [];
	for (let abbreviation in meanings) {
		// subscripts (₊, ₋) belong to the abbreviation: BF₋₀ isn't a plain BF
		let pattern = new RegExp("(^|[^\\p{L}\\p{N}₀-₎-])" + abbreviation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?=$|[^\\p{L}\\p{N}₀-₎-])", "u");
		let match = pattern.exec(figureText);
		// already defined in the note ("CI = ...", "(CI)"): a meaning written out without its abbreviation doesn't count
		let defined = noteSoFar.indexOf(abbreviation + " =") !== -1 || noteSoFar.indexOf("(" + abbreviation + ")") !== -1;
		if (match && !defined)
			explained.push({ at: match.index, text: abbreviation + " = " + meanings[abbreviation] });
	}
	explained.sort(function (a, b) { return a.at - b.at; });
	if (explained.length > 0) {
		notes.push(_apaEscape(explained.map(function (e) { return e.text; }).join("; ")) + ".");
		log.add(i18n("Abbreviations explained"), i18n("Abbreviations in the figure are written out in the note, in the order they appear (APA 7, 7.28)."), [{ from: "", to: notes[notes.length - 1] }]);
	}

	// The picture: its own size in inches, so Word and Docs paste it with its text at 8 to 14 pt
	let image = info.image || {};
	let w = image.widthIn || 5, h = image.heightIn || 3.75;
	let px = function (inches) { return Math.round(inches * 96); };
	let img = '<img src="' + _apaEscape(image.src || "") + '" width="' + px(w) + '" height="' + px(h) + '" style="width: ' + w.toFixed(2) + 'in; height: ' + h.toFixed(2) + 'in;" alt="' + _apaEscape(title) + '">';

	// Wider than a portrait page's text (6.27 in): the figure keeps its size, so its text stays readable, and a
	// reminder asks for a landscape page, as for tables. Wider than a landscape page's text (9 in): a reminder
	// asks for a smaller figure too.
	let tooWideForLandscape = w > apaFigureLandscapeWidth + 0.01;
	let tooWide = w > apaFigurePortraitWidth + 0.01 || image.landscape === true || tooWideForLandscape;
	if (tooWideForLandscape)
		log.add(i18n("Page width"), i18n("The figure is wider than a landscape page, so reminders ask for a landscape page and a smaller figure."));
	else if (tooWide)
		log.add(i18n("Page width"), i18n("The figure is wider than a portrait page, so a reminder asks for a landscape page instead of shrinking its text below 8 pt."));
	if (tooWide)
		todo.push(i18n("put the figure on a landscape page, it is too wide for a portrait page"));
	if (tooWideForLandscape)
		todo.push(i18n("make the figure smaller, it is too wide even for a landscape page"));

	let noteLabel = i18n("Note.");
	let html = '<div style="' + apaTextStyle + ';">';
	html += '<p style="' + apaFrameParagraphStyle + '; ' + apaTextStyle + ';"><b>' + _apaEscape(i18n("Figure")) + " " + figureNumber + "</b></p>";
	html += '<p style="' + apaFrameParagraphStyle + '; ' + apaTextStyle + ';"><i>' + titleHtml + "</i></p>";
	if (tooWide)
		html += '<p style="' + apaFrameParagraphStyle + '; ' + apaTextStyle + ';">' + _apaTodo(i18n("Too wide for a portrait page: put this figure on a landscape page")) + "</p>";
	if (tooWideForLandscape)
		html += '<p style="' + apaFrameParagraphStyle + '; ' + apaTextStyle + ';">' + _apaTodo(i18n("Too wide even for a landscape page: make this figure smaller")) + "</p>";
	html += '<p style="margin: 0pt 0pt 6pt 0pt; ' + apaTextStyle + ';">' + img + "</p>";
	if (notes.length > 0)
		html += '<p style="' + apaFrameParagraphStyle + '; ' + apaTextStyle + ';"><i>' + _apaEscape(noteLabel) + "</i> " + notes.join(" ") + "</p>";
	html += "</div>";
	html = html.replace(/ data-apa-todo="1"/g, "");

	let lines = [i18n("Figure") + " " + figureNumber, _apaPlain(titleHtml), "[" + i18n("figure") + "]"];
	if (notes.length > 0)
		lines.push(noteLabel + " " + _apaPlain(notes.join(" ")));
	for (let change of log.changes)
		for (let example of change.examples) {
			let clean = function (s) { return s.replace(/<span data-apa-todo="1"[^>]*>([^<]*)<\/span>/g, "<mark>$1</mark>").replace(/ style="[^"]*"/g, ""); };
			example.from = clean(example.from);
			example.to = clean(example.to);
		}
	return { html: html, text: lines.join("\n"), todo: todo, changes: log.changes };
}
