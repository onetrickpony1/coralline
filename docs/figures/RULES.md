# APA 7 figure rules

The rules Coralline's figures must meet, each with its source, how it's checked, and where Coralline stands. Rules marked **auto** or **text** are meant for an automatic check, which isn't built yet. Rules marked **critic** need a person's judgement.

## Sources
The rules were first drawn from APA's own pages (read on 2026-11-21), then checked against the Publication Manual itself (7th ed., 2020) on the same day, and reviewed a second time against the Manual's pages.

The Manual, cited by section and page:
- **2.19** Font, p. 44. **2.21** Line spacing, p. 45. **2.22** Margins, p. 45.
- **6.17** Title case and sentence case, pp. 167 to 168.
- **6.36** Decimal fractions, p. 180. **6.38** Commas in numbers, p. 180.
- **6.43** Statistics in text (confidence interval format), pp. 181 to 182.
- **6.44** Statistical symbols and abbreviations, pp. 182 to 187 (Table 6.5 on pp. 183 to 186; symbols, percentages and type style on p. 187). **6.45** Spacing and punctuation for statistics, minus signs, pp. 187 to 188.
- **7.1 to 7.7** General guidance for tables and figures, pp. 195 to 199 (design principles 7.2, p. 196; file formats 7.4, p. 197; placement 7.6, p. 198).
- **7.14** Table notes, pp. 203 to 205 (general and specific p. 203; probability, post hoc subscripts and note format p. 204). **7.15** Standard abbreviations in tables and figures, p. 205.
- **7.22** Principles of figure construction, p. 225. **7.23** Figure components and Figure 7.1, pp. 225 to 226.
- **7.24** Numbers, **7.25** Titles, p. 227. **7.26** Images, pp. 227 to 229 (size and capitalisation p. 227, shading pp. 227 to 228, colour and gridlines p. 228, panels and citations p. 229).
- **7.27** Legends, **7.28** Notes, p. 229. **7.29** Relation between figures, **7.30** Photographs, p. 230. **7.31** Biological data, pp. 230 to 231. **7.32** Electrophysiological data, p. 231.
- **7.35** Figure checklist, p. 232. **7.36** Sample figures, pp. 233 to 250 (bar graph p. 234, line graph p. 235, SEM p. 239, path model p. 240, scatterplot p. 245, multipanel p. 248, ERP p. 249).

APA's web pages, kept where they agree with the Manual:
- **[Fig]** Figure setup, apastyle.apa.org/style-grammar-guidelines/tables-figures/figures.
- **[Tab]** Table setup, .../tables-figures/tables.
- **[Sam]** Sample figures, .../tables-figures/sample-figures.
- **[Col]** Accessible use of colour, .../tables-figures/colors.
- **[Num]** Number and statistics rules already used for Coralline's tables.

Each source cell starts with what the Manual makes of the rule:
- **requirement:** the Manual states it as how things are done: an imperative ("use", "write", "explain", "avoid") or a plain "should" or "must".
- **recommendation:** the Manual says "consider", "when possible", "preferable", "best practice", "helpful" or "as a general guideline", or offers it as one option among others.
- **convention:** only shown in the sample figures.
- **not in the Manual:** comes from the website or elsewhere.
- **contradicted:** the Manual says otherwise.

Where the Manual states a general principle and Coralline reads a concrete check into it, the cell says "applied".

Check types:
- **auto:** measured from the drawn plot (its facts, its theme, its pixels).
- **text:** checked in the figure number, title and note that the builder writes.
- **critic:** needs judgement; a person checks it.

Status:
- **done:** in place and tested.
- **partial:** in place for some plot kinds.
- **missing:** not done.
- **measure:** unknown until the checker runs.

## A. Frame: number, title, note

| ID | Rule | Source | Check | Status |
|---|---|---|---|---|
| A1 | "Figure N" in bold, flush left, above the title. Figures in the main text get Arabic numerals in the order they are first called out in the text. Appendix figures follow their own scheme (2.14). Figures are numbered apart from tables (implied by "Figure 1" and "Table 1", not stated) | requirement: 7.23 p. 225, 7.24 p. 227, 7.35 p. 232; [Fig] | text | done |
| A2 | Title one double-spaced line below the number, flush left, in italic title case | requirement: 7.23 p. 225, 7.25 p. 227, 6.17 p. 167, 7.35 p. 232; [Fig] | text | done |
| A3 | The title is brief but clear and explanatory: the figure's basic content can be inferred from it. Not overly general, not overly detailed | requirement: 7.25 p. 227; [Fig] | text + critic | partial: suggested titles for known kinds, a to-do otherwise |
| A4 | Notes only as needed, below the figure. The general note starts with *Note* in italics followed by a period. Notes are in sentence case | requirement: 7.14 p. 203, 7.23 p. 226, 7.28 p. 229, 6.17 p. 168; [Fig] [Tab] | text | done |
| A5 | Note order: general, then specific, then probability. Inside the general note, the definitions of abbreviations come last, followed only by a copyright attribution if there is one | requirement: 7.14 pp. 203 to 204, 7.28 p. 229, 7.35 p. 232; [Tab] | text | partial: only general notes so far |
| A6 | Abbreviations in the figure are defined, even when the paper's text defines them too. They can be defined in the title, the image, the legend or the note. No definition needed for symbols that stand for statistics (*M*, *SD*, *SE*, *F*, *df*, *n*, *p*, *r*), Greek-letter symbols, units of measurement, "no." and "%". Other abbreviations from Table 6.5 still need defining (CI, ANOVA, SEM, RMSEA). Define them in the order they appear, top left first, left to right, top to bottom, except where grouping similar abbreviations makes sense | requirement: 7.2 p. 196, 7.15 p. 205, 7.26 p. 227, 7.28 p. 229, 6.44 p. 182; [Fig] | text | partial: from a shared list; the list's coverage of figure terms is unknown |
| A7 | Asterisks or daggers that mark significance are superscript, and are defined in a probability note, with the symbol right before *p* and no space. The usual set is "\**p* < .05. \*\**p* < .01. \*\*\**p* < .001." (an example, not a fixed form). In general, no threshold below .001. Daggers are sometimes used for trends or one-tailed tests, and the note says which | requirement: 7.14 p. 204, 7.28 p. 229; [Fig] [Sam] | text | missing: no detection of asterisks in plots |
| A8 | Error bars and bands are defined in the image or the general note: standard deviation, standard error, confidence limits or range. For a confidence interval, its level (for example 95%) is given | requirement: 7.22 p. 225, 7.28 p. 229; [Sam] | text | partial: known plot kinds only |
| A9 | Every element that carries meaning is labelled or explained: symbols, line styles and shading in the legend; anything else (reference lines, colour, shading, dots, boxes) in the general note when the legend and image don't define it | requirement: 7.22 p. 225, 7.27 p. 229, 7.28 p. 229; [Fig] | text + critic | partial: known kinds only |
| A10 | The figure, with its legend and note, can be understood without the paper's text | requirement: 7.2 p. 196, 7.22 p. 225; [Fig] | critic | measure |
| A11 | Note format: each kind of note starts on a new line; further specific or probability notes follow on the same line, separated by a period and a space. Long specific notes may go on separate lines if that reads better. Notes are double-spaced, flush left with no indent, and in the same font as the paper's text | requirement: 7.14 p. 204, 7.28 p. 229, 2.21 p. 45, 7.35 p. 232 | text | measure |
| A12 | Specific notes are marked with superscript lowercase letters placed near the element they explain. Letters run left to right and top to bottom, starting at the top left with "a". No specific note on the title; use the general note instead. A superscript space goes before the letter in the image and after it in the note, and the note starts with the same letter | requirement: 7.14 p. 203, 7.28 p. 229 | auto + text | measure |
| A13 | Exact *p* values are preferred to asterisks where they fit (two or three decimals, or *p* < .001) | recommendation: 7.28 p. 229, 7.14 p. 204, 6.36 p. 180 | auto + text | measure |
| A14 | When a graph has error bars, sample sizes are given too (in the image or the note) | recommendation: 7.28 p. 229 | text | measure |
| A15 | A confidence interval written in the image or the note uses the form "95% CI [LL, UL]" and states its level. In a series of intervals with the same level and a clear meaning, "95% CI" isn't repeated | requirement, applied (6.43 sets the format for the paper's text): 6.43 p. 182, 7.22 p. 225 | auto + text | measure |
| A16 | A note belongs to one figure only: if the same information applies to two figures, it is repeated in each figure's note | requirement: 7.14 p. 203 (applied to figures through 7.28 p. 229) | text | measure |
| A17 | Units of measurement not given in the image or the legend are explained in the general note | requirement: 7.28 p. 229 | text + critic | measure |
| A18 | Lowercase subscript letters that mark post hoc differences between values are explained in the general note | requirement: 7.14 p. 204 (written for tables; applies if a figure marks differences this way) | text | measure |

## B. Text inside the image

| ID | Rule | Source | Check | Status |
|---|---|---|---|---|
| B1 | A simple sans-serif font (for example Arial, Calibri, Lucida Sans Unicode) for all text in the image | requirement: 2.19 p. 44, 7.2 p. 196, 7.26 p. 227, 7.35 p. 232; [Fig] | auto | done for ggplot; partial for base graphics and grob plots (qgraph, recorded plots) |
| B2 | Text between 8 and 14 pt at the printed size | requirement: 2.19 p. 44, 7.26 p. 227, 7.35 p. 232; [Fig] | auto | done for theme text and text layers in ggplot; measure for other plots |
| B3 | All elements labelled; every shown axis has a title | requirement, applied: 7.2 p. 196 (label the axes of a graph), 7.22 p. 225, 7.35 p. 232; [Fig] | auto | partial: a to-do when y has no title; x titles like "Total" not handled |
| B4 | Axis titles name the variable, not a code or an R name ("Residuals sales", "JaspColumn_2"), and use the same terms as the text | requirement, applied: 7.22 p. 225 (axes clearly labelled), 7.28 p. 229 (terminology matches the text); [Fig] | auto + critic | partial |
| B5 | Units of measurement given where there are units (in the image, the legend or the note; see A17) | requirement: 7.22 p. 225, 7.28 p. 229; [Fig] | critic | missing: Coralline can't know units, so this becomes a to-do at most |
| B6 | Axis titles in title case | convention: every sample (Figures 7.1 to 7.3, 7.15, 7.18) has title-case axis titles; recommendation: 7.26 p. 227 (words that act as headings are better in title case). A requirement only if "axis labels" in 7.26 is read to include titles; Figure 7.1 p. 226 uses "axis title" for these; [Sam] | auto | done |
| B7 | Numbers in the image: true minus signs (not hyphens), with no space between a negative sign and its number; no leading zero where values can't exceed 1 (*r*, *p*, proportions); a leading zero where they can | requirement: 7.26 p. 227 (numbers follow 6.32 to 6.39), 6.36 p. 180, 6.45 pp. 187 to 188; Figure 7.18 p. 248 follows 6.36, Figure 7.2 p. 234 does not; [Num] | auto | partial: text layers done; tick labels to measure |
| B8 | Statistical symbols in italics (*M*, *SD*, *p*, *r*, *N*), with the same type style in the image, the note and the text. Greek letters, identifier subscripts and non-variable abbreviations (ANOVA, log) stay upright; vectors and matrices are bold | requirement: 6.44 p. 187; [Num] | auto + text | partial: *N* in the note; image text to measure |
| B9 | No text cut off at the image edges (for example "13.5" shown as ".3.5") | requirement, applied: 7.22 p. 225 (easy to read, discernible), 7.26 p. 227 (legible); [Fig] | auto | missing: seen in JASP's own paired descriptives plot |
| B10 | No overlapping or crowded labels | requirement, applied: 7.22 p. 225 (easy to read), 7.2 p. 196 (labels next to their elements); 7.26 p. 227 (letter spacing) as secondary; [Fig] | auto + critic | missing |
| B11 | No title inside the image: number and title sit above it (panel headings are fine) | convention: 7.23 p. 225 places number and title above the image; every sample in 7.36 keeps the image free of a title; [Fig] [Sam] | auto | measure |
| B12 | Significance asterisks or daggers in the image are superscript and follow the value with no space (".02\*") | requirement: 7.14 p. 204 (applies to figures) | auto | measure |
| B13 | Every element large and sharp enough to be legible; letters clear, sharp, evenly dark and sized consistently across the figure | requirement: 7.26 p. 227 | auto | measure |
| B14 | ERP (event-related potential) plots show the direction of negativity (negative up or down) and the scale of the response | requirement: 7.32 p. 231; Figure 7.19 p. 249 | auto | measure |
| B15 | Commas between groups of three digits in most numbers of 1,000 or more (tick labels such as "1,000 2,000"). Exceptions include page numbers, binary digits, serial numbers, degrees of temperature, acoustic frequencies (2000 Hz) and degrees of freedom | requirement: 7.26 p. 227, 6.38 p. 180; convention in Figure 7.18 p. 248 | auto | measure |
| B16 | In the image, "percentage" is written "%" and "number" is written "no." ("No. of *p* Values") | requirement: 7.26 p. 227, 6.44 p. 187 | auto | measure |
| B17 | Other words in the image: labels that act as headings (panel headings, node names) in title case; descriptive phrases and sentences in sentence case | recommendation: 7.26 p. 227, 6.17 p. 168 | auto + critic | measure |
| B18 | Citations inside a figure follow the in-text citation format (8.11) and use "&" for "and" | requirement: 7.26 p. 229 | auto | measure |
| B19 | Reported values in the image (path coefficients, values on bars, annotations), not tick labels: correlations, proportions and *t*, *F* and chi-square to two decimals; means and *SD*s of integer scales to one decimal | requirement: 6.36 p. 180; 7.26 p. 227. Tick labels are scale marks: Figure 7.18 p. 248 uses ".0" to "1.0" | auto | measure |
| B24 | Other reported values in the image are rounded as far as precision allows; two decimals is usually better than more. Not tick labels | requirement, applied: 6.36 p. 180 (round as far as precision allows); recommendation: two decimals "usually better" | auto | measure |
| B20 | Spaces around operators in image text ("*p* = .03", "BF10 = 3.2", not "p=.03") | requirement: 6.45 p. 187 | auto | measure |
| B21 | Image: the % sign appears only with a numeral, except in figure labels and legends, where it may stand alone to save space. Note sentences: a statistical term is written as a word ("the means were"), and as a symbol only with a value or operator. Symbols in axis titles, such as "No. of *p* Values" in Figure 7.18, pass | requirement for note sentences; the % rule for the image: 6.44 p. 187 | auto + text | measure |
| B22 | On other plots, the magnitude, scale and direction of each axis are labelled (tick values present, direction clear) | recommendation: 7.35 p. 232 (the checklist is an aid) | auto | measure |
| B23 | Axis labels in title case. Figure 7.1 uses "axis labels" for the tick labels, so this covers category tick labels (for example "Young Adult") | requirement: 7.26 p. 227, 6.17 p. 167, Figure 7.1 p. 226 | auto | measure: level labels are data; see question 1 |

## C. Legend and panels

| ID | Rule | Source | Check | Status |
|---|---|---|---|---|
| C1 | A legend, if present, sits within the figure's borders | requirement: 7.23 p. 226 ("should be positioned within the borders of the figure"), 7.35 p. 232; [Fig] | auto | measure: JASP puts legends inside the image, usually beside the panel |
| C2 | Words in the legend in title case | requirement: 7.27 p. 229, 6.17 p. 167, 7.35 p. 232; [Fig] | auto | partial: legend titles done; level labels are data, so a to-do rather than a silent change |
| C3 | Legends only when symbols, line styles or shadings need defining: no legend for a single series, and no stray legends | requirement: 7.27 p. 229; the single-series check is applied; [Fig] [Sam] | auto | partial: the hidden-legend fix for JASP 0.99 is done |
| C4 | Group levels shown as codes (0/1, 1/2) are explained or labelled | requirement, applied: 7.2 p. 196, 7.22 p. 225, 7.15 p. 205; [Fig] | auto + text | missing |
| C5 | Multi-panel figures: the general note describes each panel ("Panel A: ..." or by position). Labelling panels is optional; if they are labelled, each gets a capital letter (A, B) at its top left | requirement, with labelling optional: 7.26 p. 229 ("it is optional to label them"), 7.28 p. 229; Figure 7.18 p. 248; [Sam] | auto + text | missing |
| C6 | The legend sits within or below the image rather than to the side, when possible. The samples place it inside the plot area | recommendation: 7.27 p. 229, 7.35 p. 232; convention: Figures 7.1 to 7.3, 7.15 | auto | measure |
| C7 | Legend lettering matches the rest of the figure in kind and proportion | requirement: 7.27 p. 229 | auto | measure |
| C8 | Labels sit next to the elements they label, and items to be compared sit next to each other | requirement: 7.2 p. 196 | critic | measure |

## D. Image quality and colour

| ID | Rule | Source | Check | Status |
|---|---|---|---|---|
| D1 | Resolution high enough for clear printing and viewing, with smooth, sharp lines. Coralline's threshold is 300 dpi at the printed size; the Manual gives no number | requirement: 7.4 p. 197, 7.22 p. 225, 7.26 p. 227, 7.35 p. 232; 300 dpi not in the Manual; [Fig] | auto | done (300 dpi) |
| D2 | Aligned with the left margin, and large enough for its elements to be seen. Coralline uses 6.26 in wide (an A4 page with the 1 in margins of 2.22, the narrower of A4 and Letter), or a landscape to-do; this width is derived, not stated | requirement: 7.6 p. 198, 7.22 p. 225, 2.22 p. 45; [Fig] | auto | done |
| D3 | One way to meet D4: colour plus pattern, shape or line style. When many colours can't all contrast, label groups directly on the image instead of in a legend, if possible | recommendation (one strategy among others): 7.26 p. 228; [Col] [Sam] | auto | missing: JASP uses colour alone |
| D4 | Plenty of contrast between colours, so readers with colour-vision deficiency, and greyscale prints, can still tell them apart. Best practice: a contrast checker, passing WCAG 2.0 AA or later | requirement: 7.26 p. 228, 7.22 p. 225 (symbols easy to differentiate); 7.30 p. 230 says the same for photographs only; [Col] | auto | missing |
| D5 | No decoration: no gridlines unless they substantially help (for example many points compared across the x-axis), no 3-D effects for decoration. Coralline also keeps a plain white background, its reading of "omits visually distracting detail" | requirement: 7.2 p. 196, 7.22 p. 225, 7.26 p. 228; [Fig] | auto | measure: JASP's default passes; some modules may not |
| D6 | Where shading tells bars or segments apart: few shadings, each clearly distinct, and patterns when more than two are needed (for example open, solid, stripes). For two sets, open and solid is the Manual's best option. Doesn't apply to coloured bars where D11 allows colour | requirement: 7.26 pp. 227 to 228 (limit and distinct, patterns past two); recommendation: open and solid for two | auto | measure |
| D7 | Error bars or other marks that overlap shaded areas stay clearly visible against the shading | requirement: 7.26 p. 228 | auto | measure |
| D8 | The most important elements are the most prominent: data lines and bar outlines bolder than axis labels, which are bolder than axes and tick marks | recommendation: 7.26 p. 227 | auto | measure |
| D9 | Plot symbols about the size of the lowercase letters in the figure's labels | recommendation: 7.26 p. 227 | auto | measure |
| D10 | File format: TIFF or EPS for journal submission; PNG or JPG are fine for student work | recommendation: 7.4 p. 197 | auto | measure |
| D11 | Work seeking publication avoids colour unless it is needed to understand the figure. If published in print and online and colour isn't crucial, the figure is converted to greyscale or moved online. A figure printed in greyscale must still be understood in greyscale. Online-only work, and student work in a format that shows colour, may use colour freely | requirement: 7.26 p. 228 | auto | measure |
| D12 | A standard (canonical) form for the kind of figure, when possible | recommendation: 7.2 p. 196 | critic | measure |
| D13 | The figure fits on one page if possible | recommendation: 7.6 p. 198 | auto | measure |

## E. Consistency across a paper

| ID | Rule | Source | Check | Status |
|---|---|---|---|---|
| E1 | Similar figures in one file share a font, a text size and a style | requirement, applied: 7.22 p. 225 (consistent with similar figures in the same article); 7.31 pp. 230 to 231 says the same for biological data only, and lets axis labels and scale units vary; [Fig] | auto | done: one scale for all figures in a file |
| E2 | Similar figures, or figures of equal importance, have the same size and scale | requirement: 7.29 p. 230, 7.35 p. 232; [Sam] | auto + critic | measure |
| E3 | Symbols, abbreviations and terms are the same in the image, legend and note, across figures and in the text | requirement: 7.28 p. 229, 6.44 p. 186 (one notation system per paper) | text + critic | measure |
| E4 | The same number of asterisks means the same *p* threshold in every figure and table of the paper | requirement: 7.14 p. 204 | text | measure |

## Not automated
These stay with the student: whether a figure is needed and doesn't repeat the text (7.1, 7.3, 7.22), what it means, the real title when only a generic one can be built, units, calling out every figure in the text (7.5), placement in the paper (7.6), combining alike figures (7.29), photographs and their changes (7.30), the special rules for biological data, including a general note on how the images were processed or enhanced (7.31), and for imaging and genetic data (7.33 to 7.34), and copyright notes for reprinted figures (7.7).

## Open questions for the owner
1. **Level labels (B23, C2, C4):** the Manual's Figure 7.1 (p. 226) calls tick labels "axis labels", and 7.26 and 6.17 require title case for axis labels. So title case on category tick labels (for example "Young Adult") is the literal requirement, as for legend words. Change data labels to title case and spell out codes ourselves, or leave them as a to-do for the student?
2. **Colour (D3, D4):** the requirement is enough contrast (D4). Groups shown by colour alone can pass if their colours contrast; colour plus pattern or line style is one strategy the Manual offers, not a rule. Add shapes or line styles to JASP's plots anyway, or only fix contrast? Adding them changes the plot's look more than any other rule.
3. **Panel labels (C5):** the Manual makes panel labels optional, and if used they are capital letters at the top left. Add letters to every multi-panel figure, or leave panels unlabelled and describe them by position in the note?
4. **Leading zeros (B7):** the Manual's sample bar graph (Figure 7.2, p. 234) shows "0.1" to "0.4" on a framing score, a difference of two proportions that can't exceed 1. Its multipanel sample (Figure 7.18, p. 248) does follow 6.36 (".00", ".0"). The samples disagree and 6.36 is the stated rule. Follow 6.36, as B7 does now?
5. **Asterisks or exact *p* (A13):** the Manual prefers exact *p* values. Where JASP draws asterisks, replace them with exact values, or keep them and add the probability note?
6. **Legend position (C6):** C1 (inside the figure's borders) is the firm rule, and JASP already meets it. C6 asks, when possible, for the legend within or below the image rather than to the side; a side legend inside the PNG is still to the side. Move JASP's side legends inside or below? It changes the layout of most grouped plots.
7. **Colour default (D11):** Coralline's users are mostly students, for whom colour is fine. Keep colour by default, or offer a greyscale option for journal submissions?
8. **Line weights and symbol size (D8, D9):** set these in the APA theme, or only report them? They are recommendations, not requirements.

## Owner decisions (2026-11-21)
The owner chose the suggested answer for all eight questions:
1. **Level labels:** Coralline puts category tick labels and legend words in title case itself. Coded levels (0/1) without value labels in the file become a to-do for the student.
2. **Colour:** fix contrast only (D4). No added shapes or line styles.
3. **Panel labels:** add capital letters at each panel's top left, and describe the panels by letter in the note.
4. **Leading zeros:** follow 6.36 (B7), not the Figure 7.2 sample.
5. **Asterisks:** keep JASP's asterisks and add the probability note (A7).
6. **Legend position:** leave JASP's side legends where they are. C1 is met; C6 is reported only.
7. **Colour default:** keep colour. A greyscale option may come later.
8. **Line weights and symbol size (D8, D9):** report only; don't change the theme.

## Changes from the Manual check
Checked on 2026-11-21 against the Manual's sections 2.19 to 2.22, 6.17, 6.36 to 6.38, 6.43 to 6.45, 7.1 to 7.7, 7.14 to 7.15 and 7.22 to 7.36, then revised after a second review; all its points were applied. Changes are listed against the rulebook as it stood before the check (33 rules).

Classification: plain "should" now counts as a requirement, as it already did for B2 and D1. This makes B13, C1, C3, C7, D11 and E2 requirements.

Reworded:
- **A1:** added Arabic numerals, flush left, order of first callout and the appendix exception (7.24). Separate numbering from tables is marked as implied.
- **A2:** "one double-spaced line" below the number, and flush left (7.23, 7.35).
- **A3:** added "not overly general or detailed" (7.25).
- **A4:** added the period after *Note* and sentence case (7.14, 6.17).
- **A5:** added the order inside the general note: abbreviations, then copyright (7.14, 7.28).
- **A6:** added where abbreviations may be defined, which ones need no definition, that other Table 6.5 abbreviations still do, their order and the grouping exception (7.15, 6.44).
- **A7:** added the probability note's format, superscript symbols and daggers. The thresholds are an example; "in general" no threshold below .001 (7.14).
- **A8:** error bars may be defined in the image or the note, and ranges count too (7.28).
- **A9:** split the work between legend and note, and added colour and shading (7.27, 7.28).
- **B1:** example fonts from 7.26.
- **B3:** marked "applied": the Manual says to label the axes, and "every axis has a title" is Coralline's reading.
- **B4:** added that terms match the text (7.28).
- **B5:** points to A17 for units in the note.
- **B6:** the Manual's "axis labels" are the tick labels (Figure 7.1), so title-case axis titles rest on the samples and the heading advice in 7.26. The literal requirement moved to the new B23.
- **B7:** added that a leading zero is kept where values can exceed 1, that a minus is not a hyphen and takes no space after it (6.36, 6.45), and which samples follow 6.36.
- **B8:** added upright Greek letters and identifiers, bold vectors (6.44).
- **B10:** based on 7.22 and 7.2; the letter-spacing line in 7.26 is secondary.
- **B13 (added in the first pass):** now a requirement, with the "must be legible" sentence.
- **C1:** now a requirement (plain "should", 7.23).
- **C3:** scope set to "symbols, line styles or shadings needing definition" (7.27); now a requirement, with the single-series check marked "applied".
- **C5:** the rule had required panel labels; the Manual makes them optional and sets their form (capital letter, top left). The requirement is that the note describes each panel.
- **D1:** 300 dpi kept as Coralline's threshold, marked as not a Manual number.
- **D2:** split. Left-margin alignment and a discernible size stay here as a requirement (7.6, 7.22); fitting on one page is the new D13. 6.26 in marked as derived.
- **D3:** colour plus pattern is one strategy for meeting D4, not a rule of its own (7.26).
- **D4:** contrast is the requirement; a contrast checker and WCAG 2.0 AA or later are best practice (7.26). 7.30 marked as photographs only.
- **D5:** gridline exception from 7.26; white background marked as Coralline's own reading.
- **E1:** scoped to similar figures (7.22) and marked "applied"; 7.31 marked as biological data only.
- **E2:** now based on 7.29 (same size and scale) and a requirement; "same layout" dropped; check widened to auto + critic. Matching wording moved to E3.

Added:
- **A11** note format (7.14, 2.21). **A12** specific notes, their order and spacing, none on the title (7.14, 7.28). **A13** exact *p* preferred (7.28). **A14** sample sizes with error bars (7.28). **A15** confidence interval format (6.43). **A16** a note repeated in each figure it applies to (7.14). **A17** units in the general note (7.28). **A18** post hoc subscripts (7.14).
- **B12** asterisk placement in the image (7.14). **B13** legible, even, consistent lettering (7.26). **B14** direction and scale on ERP plots (7.32). **B15** thousands commas and their exceptions (6.38). **B16** "%" and "no." (7.26). **B17** case of other words in the image (7.26). **B18** citations in figures (7.26). **B19** decimals in the image (6.36). **B20** spaces around operators (6.45). **B21** % only with a number in the image, except labels and legends; terms as words in note sentences (6.44). **B22** axis scale and direction on other plots (7.35). **B23** title case for axis labels, which includes tick labels (7.26, Figure 7.1). **B24** rounding of other reported values (6.36).
- **C6** legend within or below the image (7.27). **C7** legend lettering (7.27). **C8** labels next to elements (7.2).
- **D6** shading (7.26). **D7** error bars over shading (7.26). **D8** line weights (7.26). **D9** symbol size (7.26). **D10** file format (7.4). **D11** colour for publication (7.26). **D12** standard form (7.2). **D13** one page if possible (7.6).
- **E3** matching terms (7.28, 6.44). **E4** asterisk thresholds across the paper (7.14).

Removed: none.

Re-check fixes (second review):
- **A7:** superscript asterisks and daggers now in the rule text (7.14 p. 204).
- **A15:** marked "applied", since 6.43 sets the format for the paper's text; added the exception for a series with the same level.
- **B19:** limited to reported values, not tick labels (Figure 7.18 uses ".0" to "1.0"). The general rounding advice is "usually better", so it moved to a new rule, **B24**: a requirement, applied (the rounding principle is a plain "should"), with "two decimals usually better" as its recommendation part. B19 keeps the two-decimal and one-decimal cases as a requirement, because 6.36 states them as imperatives ("Report correlations ... to two decimals"); that part was checked again on p. 180.
- **B21:** in the image only the % sign is checked; the word-not-symbol rule covers narrative text, so it applies to note sentences only. Figure 7.18's "No. of *p* Values" passes.
- **Not automated:** 7.31 restored (the note says how biological images were processed).

Also corrected: the 7.36 page range runs to p. 250. Open questions 1 to 3 were updated with what the Manual says; questions 4 to 8 are new.
