# Critique of RULES.md (APA 7 figure rules)

Checked on 2026-11-21 against the Publication Manual (7th ed., 2020). Pages are the book's page numbers.

Standards used: **requirement** = the Manual states it as how things are done (imperatives and plain "should"); **recommendation** = "consider", "when possible", "preferable", "best practice", "helpful"; **convention** = only in the examples. Note that RULES.md defines "should" as a recommendation. That clashes with this standard and is applied unevenly inside RULES.md itself (B2 and D1 rest partly on "should" and are called requirements; B13, C1, C7 and E2 rest on "should" and are called recommendations). Several fixes below follow from that.

## 1. Problems

| ID | Problem | What the Manual says | Fix |
|---|---|---|---|
| A1 | "Apart from tables" is not in 7.24. The appendix exception is missing. | 7.24 p. 227: number figures in the main text in order of first mention; appendix figures follow a different scheme (2.14). Separate numbering from tables is only implied by "Figure 1" vs "Table 1". | Add "main-text figures; appendix figures follow 2.14". Mark "apart from tables" as implied, not stated. |
| A6 | The exempt list reads as if everything in Table 6.5 is exempt. The grouping exception is missing. | 6.44 p. 182: statistic symbols and Greek-letter symbols need no definition, but other Table 6.5 abbreviations (CI, ANOVA, SEM, RMSEA) must be defined. 7.15 p. 205: define in order of appearance "except where it makes sense to group similar abbreviations". | Say that CI, ANOVA, RMSEA and similar still need defining. Add the grouping exception. |
| A7 | Overstated. The three thresholds are an example, not a set form. "No threshold below .001" drops "in general". Superscript formatting is missing. | 7.14 p. 204: use the same number of asterisks for the same *p* across tables or figures, "such as" \*p < .05 ...; "In general", no value below .001; asterisks and daggers are superscript; daggers are "sometimes used" for trends or one-tailed tests. | Make the requirement "defined in a probability note, consistent across the paper (E4)". Give .05/.01/.001 as the usual example. Add "in general" and superscript. |
| A11 | Missing exception. | 7.14 p. 204: lengthy specific notes may go on separate lines if this helps readability. | Add the exception. |
| A12 | Incomplete. | 7.14 p. 203: superscripts are ordered left to right, top to bottom, starting at top left with "a"; no specific notes on the title (use a general note); a superscript space before the letter in the body and after it in the note. 7.28 p. 229: place them near the element. | Add order, the no-title rule and the spacing. |
| B3 | "Every shown axis has a title" is a reading, not the text, but is not marked "applied". Figure 7.1 itself separates "axis title" from "axis labels". | 7.2 p. 196: "label the axes of a graph". 7.22 p. 225: axes clearly labelled. | Mark "requirement, applied". |
| B6 | Wrong basis. 7.26 and 6.17 require title case for "axis labels". Figure 7.1 (p. 226) uses "x-axis labels" and "y-axis labels" for the tick labels ("9 a.m.", "1" to "6") and "x-axis title" / "y-axis title" for the titles. So the literal requirement covers tick labels; title case for axis titles rests on the samples and on the heading guidance. | 7.26 p. 227: "Use title case for axis labels." 6.17 p. 167 lists "axis labels" too. Every sample (Figures 7.1 to 7.3, 7.15, 7.18) has title-case axis titles. 7.26 also says words that serve as headings are better in title case. | Reclassify as "convention (all samples) plus recommendation (7.26 headings); requirement only if 'axis labels' is read to include titles". Add a separate rule or to-do for title case on category tick labels, which is the literal requirement. |
| B7 | Fine as a rule, but the sample conflict (Q4) should be cited. Minus-sign spacing is missing. | 6.36 p. 180: no leading zero when the statistic cannot exceed 1. 6.45 pp. 187 to 188: a negative sign has a space before it and none after. Figure 7.18 p. 248 follows 6.36 (".00" to ".05", ".0" to "1.0"); Figure 7.2 p. 234 does not. | Add the spacing rule. Cite Figure 7.18 as the sample that follows 6.36. |
| B10 | The cited phrase is about letter spacing, not label overlap. | 7.26 p. 227: "enough space between letters to avoid crowding". | Keep as "applied", but base it on 7.22 (easy to read) and 7.2 (labels next to elements), with 7.26 as secondary. |
| B13 | Misclassified. Plain "should", plus a "must" in the same paragraph. | 7.26 p. 227: each element "must be large enough and sharp enough to be legible"; letters should be clear, sharp, uniformly dark and sized consistently. | Reclassify as requirement. |
| B14 | Mixed basis. The general part rests only on the 7.35 checklist, which calls itself an aid ("may be helpful") and speaks of "grid elements". For ERP plots 7.32 makes direction and scale essential. | 7.35 p. 232; 7.32 p. 231: direction of negativity and scale of the response must be shown. | Split: requirement for ERP plots (7.32); recommendation (checklist) for other plots. |
| B15 | Missing exceptions. "Most" is dropped. | 6.38 p. 180: commas "in most figures of 1,000 or more"; exceptions include page numbers, binary digits, serial numbers, degrees of temperature, acoustic frequency (2000 Hz) and degrees of freedom. | Add "most" and the exceptions, at least Hz, temperature and *df*. |
| B18 | Minor omission. | 7.26 p. 229: citations in figures follow 8.11, with "&". | Add "follow 8.11". |
| C1 | Misclassified. | 7.23 p. 226: a legend, if present, "should be positioned within the borders of the figure". | Reclassify as requirement. |
| C3 | Misclassified. "No legend for a single series" is a reading. | 7.27 p. 229: only figures with symbols, line styles or shadings needing definition should include legends. | Reclassify as requirement; mark the single-series check "applied". |
| C5 | The classification "contradicted as first written" describes the old draft, not the rule as it now stands. | 7.26 p. 229: labelling is optional; if labelled, capital letter at top left; the general note explains each panel. 7.28 p. 229: describe each panel. | Classify as "requirement (note describes each panel; letter form if labelled); labelling optional". Keep the history in the change log. |
| C6 | "Plot area" is not the Manual's word. The Manual says "image", meaning the whole graphic. | 7.27 p. 229: "When possible", legends go within or below the image, not to the side, to avoid empty space. 7.35 p. 232 asks the same. The samples (Figures 7.1, 7.2, 7.3) put the legend inside the axes. | Say "within or below the image, not to the side"; note that the samples place it inside the plot area. |
| C7 | Misclassified. | 7.27 p. 229: legend lettering should be of the same kind and proportion as the rest of the figure. | Reclassify as requirement. |
| D2 | One label covers two strengths. Left alignment is an imperative. | 7.6 p. 198: align all figures with the left margin (requirement); fit on one page "if possible" (recommendation). 7.22 p. 225: large enough to be discernible (requirement). | Split into a requirement (left margin, discernible) and a recommendation (one page). |
| D3 | The wording turns an option into a rule. The Manual gives colour plus pattern as "another strategy" for contrast, not as a standing recommendation. | 7.26 p. 228: pattern with colour is one strategy; direct labels "if possible" when many colours cannot all contrast. | Reword: "one way to meet D4: colour plus pattern; with many colours that cannot all contrast, label directly if possible". Classify as option/recommendation. |
| D4 | Small slips. The best practice is to use a contrast checker; the standard is "WCAG 2.0 AA or later". 7.30 is about photographs only. | 7.26 p. 228; 7.30 p. 230 (colour photographs). | Add "or later" and the checker. Mark 7.30 as photographs only. |
| D6 | Overstated. Open and solid for two sets is the Manual's "best option", an example. The requirement is to limit shadings and keep them distinct, with patterns past two. The Manual also lets online-only and student work use coloured bars instead (p. 228). | 7.26 pp. 227 to 228. | Requirement: limit and keep distinct; patterns when more than two are needed. Recommendation: open and solid for two. Do not apply it to coloured bars where D11 allows colour. |
| D11 | Misclassified and missing conditions. | 7.26 p. 228: authors seeking publication "should avoid the use of color" unless needed; if published in print and online and colour is not crucial, convert to greyscale or move online; if printed in greyscale, it must still be understood in greyscale; students may use colour if the format supports it. | Reclassify as requirement for publication work. Add the greyscale conditions. |
| E1 | Overstated scope. 7.22 speaks of similar figures in the same article. 7.31 is for biological data, says "as consistent as possible" and lets axis labels and scale units vary. Consistent letter size in 7.26 is within one figure. | 7.22 p. 225; 7.31 pp. 230 to 231; 7.26 p. 227. | Scope to "similar figures"; mark as "applied"; cite 7.31 as biological data only. |
| E2 | Misclassified, and "same layout" is not in 7.29. | 7.29 p. 230: similar figures or figures of equal importance "should be of equal size and scale". | Reclassify as requirement; drop "same layout" or mark it as Coralline's reading. |
| Sources | 7.36 runs to p. 250, not p. 248 (Figures 7.19 to 7.21 are on pp. 249 to 250). | 7.36 pp. 233 to 250. | Correct the range. |

Rules not listed above were found correct in citation, classification and wording.

## 2. Questions whose premise is wrong or incomplete

- **Q1 (level labels): premise correct but understated.** Figure 7.1 does call tick labels "axis labels", and 7.26 and 6.17 do require title case for axis labels. So title case on category tick labels is the literal requirement, not something that "may fall under the same choice". It is axis titles (B6) that rest on the weaker basis.
- **Q4 (leading zeros): premise correct, one detail off.** Figure 7.2 shows "0.1" to "0.4" (and "0"). The framing score is a difference between two proportions, not a proportion. It still cannot exceed 1, so the conflict with 6.36 is real. The question should also say that Figure 7.18 (p. 248) follows 6.36 (".00", ".0"), so the Manual's own samples disagree and 6.36 is the stated rule.
- **Q2 (colour): slightly wrong.** The Manual does not recommend colour plus pattern as such; it offers it as one strategy for the contrast requirement (D4). The requirement is enough contrast. Groups that rely on colour alone can pass if the colours contrast.
- **Q6 (legend position): premise slightly wrong.** The Manual's word is "image", not "plot area", and the rule is "when possible". A side legend inside the PNG is still "to the side", so the question stands, but it is a recommendation, while C1 (inside the figure's borders) is the firmer rule and JASP already meets it.
- **Q3, Q5, Q7, Q8:** premises correct. Panel labels are optional (7.26 p. 229). Exact *p* values are "preferable" (7.28). Students may use colour if the format supports it (7.26 p. 228). D8 and D9 are recommendations ("consider", "as a general guideline").

On the specific points asked:
- Figure 7.1 calls tick labels "axis labels": **yes** (p. 226).
- Figure 7.2 shows "0.1": **yes**; it is a difference of proportions, so 6.36 applies and the conflict is real.
- Panel labelling optional per 7.26 p. 229: **yes**.
- Title case for axis labels is a requirement on p. 227: **yes for "axis labels"**, which by Figure 7.1 means tick labels. For axis titles it is convention plus recommendation.
- Legend placement: 7.23 p. 226 says a legend, if present, should sit within the borders of the figure (requirement by plain "should"). 7.27 p. 229 says, when possible, within or below the image rather than to the side, to avoid empty space (recommendation). 7.35 p. 232 repeats both checks.

## 3. Missed rules

1. **Decimal places in image text** (6.36 p. 180): round as far as precision allows; correlations, proportions and *t*, *F*, chi-square to two decimals; means and *SD*s of integer scales to one decimal. Applies to coefficients on path diagrams, values on bars and annotations. Requirement for the two-decimal cases.
2. **Spacing around operators** (6.45 p. 187): "a + b = c", not "a+b=c". Applies to annotations such as "BF10=3.2" or "p=.03" in the image. Requirement.
3. **Confidence interval format** (6.43 p. 182): "95% CI [LL, UL]" when a CI is written in the image or note; every CI states its level. Requirement.
4. **Notes belong to one figure** (7.14 p. 203, applied to figures via 7.28): if a note applies to two figures, repeat it in both. Requirement.
5. **Symbol only with a value** (6.44 p. 187): use the % sign and statistical symbols with a numeral or operator; % is allowed in figure labels and legends. B16 covers part of it.
6. **Canonical form** (7.2 p. 196): "when possible", use a standard form of the figure. Recommendation; critic check.
7. **Units in the note, not only the image** (7.28 p. 229): the general note explains units not given in the legend or image. B5 could cite this.
8. **Lowercase subscript letters for post hoc differences** (7.14 p. 204) are written for tables. If Coralline marks group differences in figures this way, the subscripts must be explained in the general note. Low priority.

## 4. Verdict

**Accept with fixes.** The citations are accurate: every cited section and page says what it is cited for, apart from small slips (A1, B10, E1, D4, the 7.36 page range). The main faults are classification, mostly from treating plain "should" as a recommendation (B13, C1, C3, C7, D11, E2), one rule on the wrong basis (B6), and a few rules that drop conditions or exceptions (A6, A7, A12, B15, D6). No rule needs to be removed.

Rules checked: 55 (the 33 original rules plus the 22 added in the first pass). Read closely on the page, with its layout and sample figures: 25 (A1, A2, A3, A8, A9, A13, A14, B2, B6, B7, B11, B13, B15, B16, B17, B18, C1, C2, C3, C5, C6, C7, D8, D9, E3; pages 226, 227, 229, 234, 235, 248 and 249). Against the text only: 30.

## 5. Re-check (66 rules)

Re-checked on 2026-11-21 against the revised RULES.md. Every item in sections 1 to 3 was looked up in the new text. The new rules (A15 to A18, B19 to B23, D12, D13, the B14/B22 split) were checked against the Manual; pp. 180 and 187 were read closely for B19 to B21, and p. 248 (Figure 7.18) was used again for B21.

Applied correctly: A1, A6, A11, A12, B3, B6 (with B23), B7, B10, B13, B14/B22, B15, B18, C1, C3, C5, C6, C7, D2/D13, D3, D4, D6, D11, E1, E2, the 7.36 page range, and questions 1, 2, 4 and 6. The classification is now consistent: every rule resting on a plain "should" or "must" is a requirement, and the recommendations all rest on "consider", "when possible", "preferable", "helpful", "as a general guideline", the checklist or an offered option.

Remaining problems:

| ID | Problem | What the Manual says | Fix |
|---|---|---|---|
| A7 | The change log says superscript symbols were added, but the rule text still doesn't say so. | 7.14 p. 204: asterisks and daggers take superscript formatting. | Add "superscript" to the rule text. |
| B21 | Overstated, and my own missed-rule item 5 caused it. The symbol-versus-word rule covers narrative text only. Figure 7.18 uses "p" with no number in axis titles ("No. of *p* Values", "Significant *p* Values"), so the rule as written would flag the Manual's own sample. | 6.44 p. 187: use the term, not the symbol, "in narrative text"; % only with a numeral, but allowed in figure labels and legends. | Limit the image check to the % sign. Apply the symbol part only to sentences in the note. Change "requirement" to "requirement (note sentences); % rule for the image". |
| A15 | 6.43 sets the CI format for text, so using it in the image is a reading. The exception for repeated intervals is missing. | 6.43 p. 182: every CI states its level, but in a series with the same level and a clear meaning, "95% CI" is not repeated. | Mark "requirement, applied" and add the series exception. |
| B19 | Scope is open to tick labels. The samples use one decimal on probability ticks (".0" to "1.0", Figure 7.18) and two on others. Tick values are scale marks, not reported statistics. The general rounding advice is "usually better", a recommendation. | 6.36 p. 180: two decimals for correlations, proportions, *t*, *F*, chi-square; one decimal for integer-scale means and *SD*s; rounding to two is "usually better". | Say "reported values only, not tick labels". Mark the general rounding line as a recommendation. |
| Not automated | 7.31 dropped out of the list when 7.32 moved to B14. Its processing note is now covered nowhere. | 7.31 p. 230: the general note must say how biological images were processed or enhanced. | Restore 7.31 to the list (7.31, 7.33 to 7.34). |

No other new errors were found. C1 now also cites 7.35, which asks "within or below the image" rather than "within the borders"; this is close enough and needs no change.

### Re-check verdict

**Fix.** Five small fixes: A7 (add superscript), B21 (limit to %; symbol rule for note sentences only), A15 (mark applied, add series exception), B19 (exclude tick labels; general rounding is a recommendation), and restore 7.31 to "Not automated". None changes a status or an open question. After these the rulebook passes.

Rules re-checked: 66. Read closely on the page: B6, B19, B20, B21, B23 and C6 (pp. 180, 187, 226, 234, 235, 248); the other 60 against the text and the earlier close reading.

## 6. Final check (67 rules)

Checked on 2026-11-21 against the revised RULES.md, with p. 180 read again.

1. **B19 split: right.** On p. 180 the two-decimal cases (correlations, proportions, *t*, *F*, chi-square) and the one-decimal case (means and *SD*s of integer scales) are imperatives ("Report ... to two decimals"). B19 as a requirement for reported values, with tick labels excluded, is correct. My re-check suggestion to make it a recommendation was wrong on this point.
2. **A7, B21, A15 and the 7.31 entry: correct.** A7 now says superscript. B21 checks only the % sign in the image and applies the word-not-symbol rule to note sentences, so Figure 7.18 passes. A15 is marked "applied" and has the series exception. 7.31 is back under "Not automated" with its processing note.
3. **New errors:** one, in B24.

| ID | Problem | What the Manual says | Fix |
|---|---|---|---|
| B24 | Under-classified in part. The rounding principle sits under a plain "should", which the rulebook now counts as a requirement. Only the two-decimal preference is "usually better". | 6.36 p. 180: decimal places "should be governed by" the principle of rounding as much as possible given use and precision; rounding to two places is "usually better". | Classify as "requirement, applied (round as far as precision allows); recommendation (two decimals usually better)". |
| Change log | Cosmetic. The "Added" list still describes B21 as "% and symbols only with a number", which no longer matches its narrower scope. | 6.44 p. 187. | Reword to "% in the image; symbols in note sentences". |

### Final verdict

**Fix**, for B24's classification only. The change-log wording is cosmetic. Everything else passes.
