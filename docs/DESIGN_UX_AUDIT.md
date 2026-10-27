# CINEMA DNA — Design and UX Audit

> **Historical audit.** Synthetic evidence only. Application audited at `b7a732a`; file and line references are valid at that commit. Findings are not measurements of the owner's personal recommendation accuracy. This document ships no fixes. Current status and the adopted repair sequence: [AUDIT_STATUS.md](AUDIT_STATUS.md). Screenshots and PDFs are archived at tag [`audit-2026-10-26`](https://github.com/shaecodes-wilde/cinema-dna/tree/audit-2026-10-26/docs).

Audit target: `main`, `b7a732a5b076858f5cee92da0c9408dded0823a0` (26 October 2026). Source inspection covers every file under `src/`, the frontend-facing data types, tests/configuration, README and agent instructions. This report contains **source-confirmed findings, independent calculations and actual Chromium browser observations**. Runtime testing used only a deliberately synthetic 240-watched-film fixture, at desktop 1440×1000, tablet 768×1000 and mobile 390×1000 viewports; external browser requests were blocked. No private export, real-user dashboard or poster-enabled production installation was inspected. No application source was changed. Full runtime details and a screenshot manifest appear below.

## Assessment

The design foundation is unusually coherent for an initial analytics project. CINEMA DNA has an editorial visual identity, a deliberate typography system, baseline-relative chart colors, a consistent film dossier, evidence disclosure, and a useful quality/provenance chapter. It does more than decorate ordinary summary cards with posters. The strongest components already encourage the right interaction: see a finding, inspect its evidence, inspect a film, then explore its context.

It does not yet form a complete discovery product. There is a long, largely linear reading experience, many competing charts and statistical labels, a recommendation page that stops before the user can act or give feedback, and inconsistent handling of uncertainty on small screens. Several statements in the interface overstate the evidence. The most valuable redesign would preserve the visual vocabulary while giving users a much clearer route through three jobs: **understand a pattern, test the evidence, choose a film**.

There is no reason to begin with a new visual framework, a 3-D engine, a chatbot or more animation. Improve the semantics, accessibility and decision path first. More elaborate rendering should be earned by a demonstrably useful interaction.

## Evidence and verification boundaries

Evidence classes used here:

- **Source-confirmed**: behavior follows directly from audited code; runtime reproduction is still desirable.
- **Calculated**: a numeric result independently calculated from the implementation's values.
- **Browser-confirmed**: reproduced using local Chromium and synthetic data, with raw JSON, screenshots or rendered PDF evidence.
- **Not tested**: specifically identified gaps remain; these are not failures.
- **Design judgment**: an interpretation or proposed direction, not an experimentally proven usability result.

Browser scope and reproducible evidence are recorded in the runtime section below. All screenshots must be captioned **synthetic audit data**, not imply they represent the user's taste. The test environment is headless Chromium, not a physical phone or assistive-technology session.

## Major feature inventory

The following combines source inspection with the synthetic browser run. Every listed chapter rendered on desktop; all except Critical Analysis were also captured at tablet and mobile widths. The successful interactions and failures below qualify functional status. A rendered feature does not establish that a real personal import, metadata match or ranking is correct.

| Feature | What exists | Completion / qualification |
|---|---|---|
| Opening | Full-screen identity title, generated narrative, standouts, profile favorites, totals, film shelf | Substantial implementation. Counts depend on supplied bundle. Intro animation deliberately takes several seconds; title must fit long generated words. |
| Taste DNA | 12-axis exposure polygon, rating-lift ring, per-dimension evidence, confidence badges, influence forest plot | Substantial implementation; dimensional semantics and mixed scales need correction. Small-screen radar is information-dense. |
| Genre Universe | Exposure–rating scatter, minimum-n filter, genre/subgenre switch, pair matrix, genre evolution and film list | Substantial implementation. Good chart selection for frequency vs enjoyment. Some narrative and “synergy” language overstates what is measured. |
| Cinema Timeline | Calendar, viewings/rewatches by month, rolling rating, annual cards, watch-date/release-year scatter, genre drift | Substantial implementation; rolling-rating denominator wrong when rating coverage varies. Diary trust policy requires revision upstream. |
| Director's Gallery | Director/cast/writer/cinematographer/composer switches, ranking, consistency, loyalty scatter, per-film rating dots | Substantial implementation. Tie overplotting and low-n consistency need attention. “Most watched” actually reflects rated-film affinity rows. |
| Movie Constellation | Seeded map coordinates, SVG pan/zoom/reset, filtering, actor/title highlighting, cluster cards, methodology/weights | Substantial implementation. Keyboard alternative exists via cluster cards, but individual stars are mouse/touch-only; local neighborhoods are not guaranteed exact original-space similarities. |
| Five-Star Universe | Poster grid, review detail, rating history, linked favorites, arc diagram, top-vs-lower trait chart | Substantial implementation. Can use threshold below five stars; label must communicate that clearly. No pagination for large shelves. |
| Critical Analysis | Rating histogram, genre strips, director consistency, rating revisions, lexicon themes, distinctive words, review length, model exceptions and error panel | Substantial implementation. Model and semantic claims require statistical audit. Many marks have inconsistent keyboard support. |
| Recommendations | Source/mood/genre/runtime/decade/familiarity filters, adventure slider, uncertainty flag, reasons, liked-film references | Partial product loop. No save/dismiss/seen/feedback/shortlist persistence, no poster/overview in recommendation cards, discovery title normally opens Wikidata. |
| Identity report | Essay, in-page film shelves, HTML and Markdown download, print action | Partial: essay renders, but printing unvisited sections produces missing content and blank pages (browser/PDF confirmed). Markdown omits section film references. Download files were not independently opened in this frontend run. |
| Film Explorer | Search, compound filters, sortable responsive table, pagination, CSV download, film dossier | Useful implemented foundation. Drill-down semantics not always exact; no URL-backed filter state; CSV lacks internal film ID for documented match correction workflow. |
| Data quality | Import counts, per-file rows/linkage/missing fields, date quality, metadata coverage, unmatched titles, conflicts | Strong transparency foundation. Some categorical date interpretations are unjustified; metadata repair requires developer-file workflow. |
| Missing analysis state | Explicit instructions when fetch fails or missing file returns HTML | Implemented, but all loading failures are conflated with missing analysis. Valid JSON of wrong schema bypasses this state and can crash at app root. |
| Small-data state | A dedicated page below five rated films | Implemented; globally withholds otherwise useful explorer, watchlist, diary and quality features from sparse-rating users. |
| Import UI / progress | CLI documented, no upload/import process in frontend | Missing as a consumer-facing app; acceptable for a deliberate agent-first/local developer product. No false claim that browser import exists. |
| Background service / synchronization | Static bundle loaded once; no frontend refresh controls or background jobs | Absent by architecture, not inherently a bug. Surface generated timestamp and freshness clearly. |
| Accessibility | Focus styling, semantic headings, skip link, many labels, reduced-motion hook, keyboard SVG utility | Partial. Modal, mobile nav, faint text, radio behavior, graph marks and animation persistence need correction. |

## What the running interface actually showed

### Test conditions and limits

Browser inspection ran against the local development app at `http://127.0.0.1:5173`, using headless Chromium 134.0.6998.35 (Playwright browser revision 1161). Browser requests to destinations other than localhost/127.0.0.1 were blocked. The bundle was created specifically for this audit: **240 watched films, 210 ratings, 36 unwatched watchlist candidates, 74 reviews, 228 metadata-matched watched films and eight map clusters**. Film names, people, reviews and values are synthetic. There were no poster URLs in the ordinary fixture, so successful rendering of real poster assets was not established. A separate local broken-image fixture tested failure behavior.

All twelve rendered chapters—including the footer-only Data Quality chapter—were captured at **1440×1000**. Eleven were also captured at **768×1000** and **390×1000**; Critical Analysis was only captured on desktop. These are browser viewports, not physical-device tests. Ordinary chapter rendering, exploration and filtering produced no uncaught page errors. The invalid-schema test intentionally produced an uncaught error. The only recurring normal-data console warning observed was a duplicate React key in constellation traits, documented below.

The successful scenario evidence is in [interaction-evidence.json](audit-evidence/results/ux/interaction-evidence.json) and [responsive-evidence.json](audit-evidence/results/ux/responsive-evidence.json). The [screenshot/evidence manifest](audit-evidence/results/ux/screenshot-manifest.json) describes which captures were visually inspected and which only establish rendering. Harness timings included deliberate waits for motion, so they are **not page-load or responsiveness benchmarks**.

### Runtime feature results

| Test | Observed result | Interpretation |
|---|---|---|
| Desktop chapter navigation | All chapters rendered and anchors scrolled to their content; Quality was reached from its footer link | Functional navigation on the tested fixture. Quality's absence from the top rail is deliberate, not a missing-feature defect. |
| Explorer search | Searching `Amber Tide 01` returned exactly one matching row; a nonexistent title showed “No films match. Try clearing a filter.” | Search and its empty state work. |
| Genre selection | Selecting Drama exposed 57 rated films, a 3.41★ shrunk mean, raw mean, SD and confidence information | Useful evidence disclosure works. These are synthetic numbers, not user findings. |
| Genre → explorer | The drill-down displayed 86 watched Drama films; the explorer aligned below the header | Navigation and filter work, but the population changes from rated to watched. Name that denominator change; it is not automatically an incorrect count. The URL remained `#genres`, so filter state is not reflected in a shareable/back-navigation URL. |
| Recommendation mood | 36 candidates (24 shown) became 14 candidates (14 shown) after selecting Mind-bending; `aria-pressed` changed | The filter works. The genre-derived mood's semantic validity is a separate intelligence question. |
| Recommendation source keyboard | ArrowRight from “Everything” left focus and selection unchanged | Custom radio semantics are incomplete. |
| Film dossier | Initial focus moved inside; Shift+Tab escaped to the background footer; Escape closed and restored the launching row | Partial accessibility: entry and return work, containment does not. |
| Constellation controls | Zoom changed point positions/radius; Reset restored the exact initial values; a genre filter reported 86 of 228 matches | Zoom/reset/filter work. No individual film star had a keyboard tab stop. |
| Reduced motion | Shelf animation became `none`; duplicate poster groups disappeared | Preference is honored, but the static shelf remained clipped: 2 of 14 posters fully visible in a 390px container around 2,264px of content. |
| Normal-motion shelf | 14 focusable duplicate poster buttons were beneath `aria-hidden` wrappers | Confirmed focus/accessibility-tree inconsistency. |
| Missing bundle | Intercepted HTTP 404 showed local regeneration instructions without an uncaught page error | Useful missing-analysis recovery is present. |
| Wrong JSON shape | Intercepted valid JSON `{}` produced an empty page and a `ratedFilms` TypeError | Confirmed root-level failure; schema validation and a root fallback are needed. |
| Broken poster | A local nonexistent image URL completed with natural width 0 and no textual fallback | Missing-URL title cards work; failed-URL recovery does not. |
| Print before reading | Eight report sections remained transparent; rendered PDF contained missing essay text and blank pages | Confirmed output defect, not merely a screenshot suspicion. |
| Print after reading | The same eight sections were visible and appeared in the rendered PDF | Reveals, not absent report data, caused the difference. |

### Visual observations

**Desktop identity is a strength.** The opening, chapter headers and report use a distinctive editorial hierarchy: warm black, cream, restrained amber, fine borders and expressive serif titles. The title-only poster treatment is attractive enough to preserve as an intentional mode. The data-quality chapter is unusually well integrated into the visual system rather than appearing as a debugging afterthought. The Explorer is a legible, practical companion to the more expressive views. These judgments are based on actual rendered screenshots, not only CSS inspection.

![Desktop opening, synthetic audit data](https://github.com/shaecodes-wilde/cinema-dna/raw/audit-2026-10-26/docs/audit-evidence/screenshots/desktop-opening.png)

**Taste DNA scales down visually more than it adapts conceptually.** At tablet width the radar remains coherent and the chapter has a clear hierarchy. At 390px the twelve axes, central values and affinity labels become dense miniature text, while the long explanatory paragraph consumes much of the first view. The image still looks like an identity object, but precise comparison requires a larger chart or a concise dimension list. Replace mobile radar detail with selected-dimension focus and a comparable table/forest plot; retain the small radar as a recognizable overview.

![Taste DNA on mobile, synthetic audit data](https://github.com/shaecodes-wilde/cinema-dna/raw/audit-2026-10-26/docs/audit-evidence/screenshots/mobile-dna.png)

**The recommendation entry point asks for too much work before showing a film.** At 768px, the first recommendation cards begin near the bottom of the viewport. At 390px and 1,000px viewport height, the screen is still inside the filter form and no recommendation is visible. Collapse advanced filters, show three initial picks immediately, then let visitors refine. Preserve precise controls for deliberate exploration. There is no need to remove capability to improve the first decision.

![Recommendations on mobile, synthetic audit data](https://github.com/shaecodes-wilde/cinema-dna/raw/audit-2026-10-26/docs/audit-evidence/screenshots/mobile-next.png)

**The constellation's atmosphere works better than its small-screen information density.** Desktop spatial clusters are visually inviting. Mobile headers, filters and legend consume much of the approach to the map, and cluster labels occupy substantial space among the plotted points. A deliberate expanded map workspace with one persistent selection panel and an accessible neighbor list would give the visualization room to function. Point clustering in this fixture reflects deliberately repeated synthetic metadata and cannot establish the shape of the real library.

![Movie constellation on desktop, synthetic audit data](https://github.com/shaecodes-wilde/cinema-dna/raw/audit-2026-10-26/docs/audit-evidence/screenshots/desktop-constellation.png)

**The page is a long exhibition.** After all visited sections mounted, the synthetic document measured 52,176px tall at 768px and 71,623px at 390px, with no document-level horizontal overflow at either size. Height is not a speed benchmark or an accessibility failure by itself; it does show why persistent navigation, progressive disclosure and three clear entry jobs matter. On the mobile opening, the first roughly half viewport is largely atmosphere/space before the identity title. That can work for a first visit but should not delay a returning user's route to discovery.

### Additional confirmed rendering defect: repeated constellation traits

The synthetic cluster trait list included `Documentary (51%)` twice. React emitted a duplicate-key warning. This is caused by distinct model feature IDs—`genre:Documentary` and `form:documentary` in `pipeline/analyze/constellation.ts:155–165`—collapsing to the same presentation string in `pipeline/analyze/constellation.ts:168–174`, then being used as the key in `src/chapters/Constellation.tsx:191–192`. No crash was observed. Keep typed trait IDs for identity, and avoid displaying duplicate semantic claims. Merely appending an array index would silence the warning without fixing the redundant explanation. Complexity is small; acceptance is a documentary cluster with unique keys and a nonredundant trait list.


## Findings ordered by impact

### UX-01 — The film dossier behaves less modally than it declares (P1)

**Evidence, source-confirmed:** `src/ui/FilmDrawer.tsx:15–25` places focus on Close and handles Escape/restoration. `src/ui/FilmDrawer.tsx:67–76` declares `role="dialog" aria-modal="true"`, but no Tab/Shift+Tab trap, background `inert`, native `<dialog>` behavior or body scroll lock exists. The scrim at `src/ui/FilmDrawer.tsx:59–65` handles pointer dismissal only.

**Why it matters:** Keyboard focus can enter visually obscured content; screen-reader modal semantics and actual keyboard behavior disagree. Scrolling may move the background while inspecting a film. A drawer is a central interaction used by almost every chapter, so this affects the product as a whole.

**Browser-confirmed:** Opening an explorer film focused Close inside the dialog. One Shift+Tab moved focus to the background “data quality & provenance” footer link while the dialog remained open. Escape closed it and restored the launching explorer row, which is a working behavior worth preserving. The exact checks are in [interaction-evidence.json](audit-evidence/results/ux/interaction-evidence.json) (`drawerInitialFocus`, `drawerShiftTab`, `drawerEscape`). Physical-touch background scrolling and nested-neighbor focus restoration remain untested.

**Fix and benefit:** Use a well-tested accessible dialog primitive or native dialog with deliberate focus management, inert background, constrained scroll and safe focus restoration. Keep the current visual drawer. Benefits all drill-down flows without redesigning every chapter.

**Complexity/dependencies:** Small–medium; shared UI primitive; coordinate with navigation/tooltip work. Acceptance: all focus stays inside while open, Escape closes, launcher regains focus, nested film changes keep an appropriate return target, background cannot be operated.

Primary reference: [W3C Modal Dialog Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).

### UX-02 — Essential text uses a noncompliant faint color (P1)

**Calculated:** From `src/styles.css:20–34`, `#5d5850` (“faint”) has contrast **2.734:1** on `#0f0e0d`, **2.605:1** on `#161412`, and **2.430:1** on `#1e1b18`. Calculation saved in [contrast.json](audit-evidence/results/ux/contrast.json); uses sRGB linearization and WCAG relative luminance, not a screenshot estimate. These are below 4.5:1 for normal text and 3:1 for large text. The “muted” token itself performs much better: 5.413, 5.157 and 4.811 respectively, so the criticism must not be generalized to all subdued typography.

**Evidence:** Faint communicates real information in mobile chapter numbers (`src/App.tsx:154–155`), director rank (`src/chapters/Directors.tsx:183`), explorer genres (`src/chapters/Explorer.tsx:216`), model explanation (`src/chapters/Explorer.tsx:249`), recommendation rank score/source/moods (`src/chapters/next/RecCard.tsx:50,87–88`), and chart axes (`src/chapters/directors/DotStrip.tsx:30–33`). Many labels are 9–12px.

**Fix:** Reserve faint for noninformative decoration. Use at least muted for meaningful small text; validate each chart-color/text combination, including neutral rating-chip backgrounds and disabled controls. Keep cream, amber and blue identity. Increase small-screen axis/legend sizes and simplify charts rather than shrinking labels.

**Complexity:** Small token/text audit plus medium chart-layout work. Acceptance: all meaningful text passes the relevant WCAG contrast threshold; 200% zoom and 320 CSS-pixel reflow remain usable.

Primary reference: [W3C Contrast Minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html). This is a focused finding, not a declaration of whole-product WCAG conformance/nonconformance.

### UX-03 — Mobile navigation hides meaning; chart touch support is uneven (P1)

**Evidence, source-confirmed:** `src/App.tsx:146–159` creates horizontally scrolling chapter links; `src/App.tsx:155` hides each chapter name below `sm`. Links have no compensating `aria-label`; small-screen users see and hear `01`, `02`, `∞` rather than destination names. Quality is intentionally a footer link rather than a top-nav chapter. `src/chapters/constellation/StarMap.tsx:116` uses `touch-none` across a map at least 380px tall. The map supports pan/zoom buttons, but scrolling through it on a phone may be a trap unless the user starts outside the surface. Stars at `src/chapters/constellation/StarMap.tsx:135–162` and timeline lag points at `src/chapters/timeline/LagScatter.tsx:82–106` have click but no keyboard actions. Shared hover tooltips (`src/ui/primitives.tsx:79–100`) receive only pointer positions, not a persistent tap/focus presentation.

**Fix:** Mobile chapter selector with visible current title and a labeled chapter menu; preserve desktop rail. Give charts a standard selected-point card on tap/click/keyboard, with an optional compact table/list. Make map gestures explicitly opt in or use a clearly bounded “Explore map” mode; do not hijack ordinary page scroll. Use an alternative list for every meaningful interactive chart outcome, not only decorative marks.

**Browser-confirmed:** At 390px, rendered nav names are only `01` through `10` and `∞`, with no `aria-label`; links are 32px wide (26px for ∞). At 768px the chapter names appear. Document scroll width equaled viewport width at both tested sizes, so full-page horizontal overflow was not observed. The map had zero keyboard-focusable film stars. Physical-touch swipe behavior, 320px, calendar tap targets, screen-reader exposure and 200% zoom remain untested; do not claim their failure from this run.

**Complexity:** Medium shared navigation + chart interaction contract. Acceptance: every chapter name is available to sighted and assistive-tech users; all film selections and supporting evidence work without hover; no full-page horizontal overflow; scrolling remains possible through the map region.

### UX-04 — UI calculations and narrative can contradict the data (P1; coordinated with intelligence work)

**Source-confirmed examples:**

1. `src/chapters/timeline/Monthly.tsx:31–37` weights each monthly mean by **all viewings**, not rated viewings. A month with 1 rated viewing and 99 unrated viewings dominates a month with 10 rated viewings. Month aggregates need rated-count or rating-sum fields. This is a displayed numerical error, not simply a chart-choice disagreement.
2. `src/chapters/Genres.tsx:51–55` always calls the span between the highest and lowest qualified genre means “a narrow band,” regardless of the difference. Test a 2★ vs 4.5★ fixture.
3. `src/chapters/Timeline.tsx:51–52` asserts that pre-account dates “were logged from memory” and that “one” date is 1 January. The code does not count that case or know the user's provenance. `src/chapters/Quality.tsx:10–11` repeats categorical memory/placeholder assumptions.
4. `src/chapters/Dna.tsx:41–47` calls all dimensional scores exposure and the highest-affinity dimension “the biggest gap between habit and love.” The selection sorts by affinity only (`src/chapters/Dna.tsx:31`), not a defined exposure–preference contrast; transformed/behavior scores are not necessarily raw viewing percentages. Audit with the actual `dna.ts` definitions.
5. `src/chapters/Opening.tsx:14–18,157–160` calls the most numerous **rated-film affinity** decade “most watched.” `src/chapters/Directors.tsx:35–38,90–92` does the same for “Most watched.” Unrated viewing is omitted from these affinity counts.
6. `src/chapters/FiveStar.tsx:45,48` selects the lower middle item as “median” for even-sized runtime lists rather than averaging the middle pair. `[90,150]` displays 90, not 120.

**Fix:** Move all analytical aggregations into tested pipeline selectors. Feed rendering components typed values, denominators, coverage and claim status. Conditional copy should be generated from the same typed claim, with a neutral fallback if not warranted. Name rated-film exposure accurately.

**Complexity:** Medium; requires pipeline/shared-schema/frontend coordination. Acceptance: independently recomputed fixture means match every display; sparse, one-sided and wide-spread fixtures produce truthful prose. Coordinate these with the intelligence audit’s source-of-truth corrections, avoiding duplicate roadmap items.

### UX-05 — Print omits unvisited report sections (P1; browser/PDF confirmed)

**Confirmed failure grounded in code:** Every report section is wrapped in `Reveal` (`src/chapters/Report.tsx:94–130`). `Reveal` starts at `opacity:0` and animates only while in view (`src/ui/primitives.tsx:56–65`). The print media rules (`src/chapters/Report.tsx:59–68`) do not reset opacity/transform or force unseen sections into view. The print handler (`src/chapters/Report.tsx:38–46`) adds a class and calls `window.print()` immediately.

**Reproduction and evidence:** In a fresh page, load `/#report`, wait for the chapter and print before scrolling the eight essay sections. The test invoked the actual Print button, replaced only the native `window.print()` call with a no-op, emulated print media and exported with Chromium `page.pdf()`. All eight essay Reveal wrappers remained at opacity 0. The resulting five-page unvisited-report PDF showed a title-only first page and a completely blank second page when rendered with `pdftoppm`. After scrolling all eight sections into view and waiting for their reveal animations, a second five-page visited-report PDF contained essay text on those same pages. Both first two pages were visually inspected, not merely text-extracted. The two rendered page-two images below show the difference; all content is synthetic. The native OS print dialog and generated HTML-download file were not tested.

![Unvisited report page 2, synthetic audit data: blank](https://github.com/shaecodes-wilde/cinema-dna/raw/audit-2026-10-26/docs/audit-evidence/screenshots/print-unvisited-2.png)

![After scrolling the report, page 2 contains its text; synthetic audit data](https://github.com/shaecodes-wilde/cinema-dna/raw/audit-2026-10-26/docs/audit-evidence/screenshots/print-visited-2.png)

**Fix:** Render print content deterministically without reveal animations; `@media print` must force visible opacity/transform and remove temporary viewport constraints. Prefer the existing generated print HTML as the print source if it contains all report sections. Acceptance: before/after scrolling produce the same complete content and readable page breaks.

### UX-06 — The shelf animation has no persistent pause and has hidden focusable duplicates (P1 accessibility / P2 motion polish)

**Source-confirmed:** `src/chapters/Opening.tsx:186–196` runs an infinite 80-second marquee. Hover/focus pause ends when hover/focus leaves. Duplicated posters sit under `aria-hidden` wrappers (`src/chapters/Opening.tsx:188–190`) but remain focusable buttons. Reduced motion removes animation and duplicates, but keeps `overflow-hidden` and `w-max`, leaving no explicit swipe/scroll mechanism for the entire shelf.

**Browser-confirmed:** Normal-motion DOM contained 14 focusable poster buttons beneath `aria-hidden` wrappers. At 390px with reduced motion, animation was `none` and duplicates were removed, which is correct; however, the 390px container retained `overflow-x:hidden` around 2,264px of content, with only 2 of 14 posters fully visible and no scrolling controls. Keyboard focus may still cause hidden-overflow scrolling, so this is not evidence that every offscreen film is unreachable by keyboard.

**Fix:** Use a horizontally scrollable shelf with snap points and explicit previous/next controls. If automatic drift remains, make it optional and provide persistent Pause/Play. Remove duplicate controls from the focus order and accessibility tree. Reduced-motion mode should present the same accessible films in a static scrollable list.

**Acceptance:** Keyboard reaches each original poster exactly once; no focused element is inside an aria-hidden subtree; users can pause and operate the rest of the page; every shelf film is reachable on touch with motion disabled.

Primary reference: [W3C Pause, Stop, Hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html), which explicitly explains that focus-only pause does not constitute a persistent pause mechanism.

### UX-07 — Dense charts silently lose information or imply excessive precision (P1/P2)

**Evidence:** `src/chapters/directors/DotStrip.tsx:22,41` caps the stack at six rows and clamps every later index to five. Seven or more films with the same rating share identical positions; the last is the only directly clickable one at that location. `src/chapters/dna/Radar.tsx:74–76` clamps affinity radius to ±0.65★ without a visual overflow indicator, while displayed labels can show the unclamped value. `src/chapters/genres/GenreScatter.tsx:35–36` uses a square-root horizontal scale without naming that transformation in visible axis text (`src/chapters/genres/GenreScatter.tsx:96–98`). `src/chapters/fivestar/FormulaChart.tsx:10–11` parses percentages out of display prose instead of reading numerical data.

**Fix:** For tied director dots, expand the strip, use a count badge/group popover, or switch to an exact histogram; test ties above six. Make radar lift scale explicit or replace the lift ring with a small aligned forest plot. Use a linear exposure axis by default or clearly disclose the transformation. Supply typed numerator/denominator fields to the formula chart.

**Benefit:** The artwork stops hiding evidence. Users can verify every film and understand magnitude rather than relying on tooltip decoding.

**Acceptance:** Every data record is accessible; no two unequal encoded magnitudes are visually identical without an overflow cue; formula chart remains correct after copy/locale changes.

### UX-08 — Recommendations stop before the decision and learning loop (P1 product)

**Evidence:** `src/chapters/Next.tsx:34–42` stores filters only in component state. `src/chapters/next/RecCard.tsx:15–90` renders rank, source, predicted stars, novelty, reasons and known-film links. It has no save/dismiss/seen/not-for-me/tonight action or feedback persistence. Discoveries without film IDs link to a Wikidata record (`src/chapters/next/RecCard.tsx:30–33`). No poster, synopsis or viewing availability is displayed. The global error caveat is hidden on mobile (`src/chapters/Next.tsx:211`, `hidden ... md:block`), while predicted ratings remain prominent (`src/chapters/next/RecCard.tsx:39–43`).

**Fix:** Present a deliberately short recommended set: one strong fit, one adjacent discovery, one credible stretch. Each card should include a poster/title-card fallback, a short spoiler-safe premise, two traceable bridges to loved films, one meaningful caveat and one local action. Persist “seen,” “not tonight,” “not for me,” and “why” separately. A temporary mood should not become permanent dislike. Keep prediction error/low-confidence context visible at all screen sizes; do not present cross-validation MAE as a calibrated per-film interval.

**Trade-off:** Persistence introduces a user-events schema; availability creates external-service dependencies and geographic ambiguity. Ship local feedback first, with explicit manual availability notes if necessary. Do not require cloud accounts for the current single-user product.

**Acceptance:** User can choose or reject a film from the page, the action survives reload, watched/rejected distinctions remain correct, and subsequent rankings honor feedback with reversible controls. Measure choice rate, time to decision, later satisfaction and discovery coverage rather than card clicks alone.

### UX-09 — Documented metadata repair is not discoverable from the UI (P2, data-quality leverage)

**Evidence:** README says the `lb:<code>` override key is shown in explorer/dossier. `src/ui/FilmDrawer.tsx:159–165` shows Wikidata ID and confidence, but not the film's internal `f.id`; Explorer columns at `src/chapters/Explorer.tsx:9–17,196–231` and exported CSV at `src/chapters/explorer/filtering.ts:102–105` omit it. Quality (`src/chapters/Quality.tsx:217–218`) instructs users to edit `data/overrides.json` with no direct record-to-key workflow. Unmatched titles are plain text with a hover reason (`src/chapters/Quality.tsx:155–164`).

**Fix:** Dossier “Metadata evidence” disclosure containing source identity, match method, confidence reason and a copyable override key. Add a “This is the wrong film” action that generates a local pending correction with candidate comparison; do not auto-accept uncertain alternatives. Make unmatched rows open the same dossier and explain what an unresolved match excludes.

**Complexity:** Small for read-only copy/export; medium for actual correction persistence and candidate confirmation. Acceptance: user can identify and correct a deliberately wrong match without opening raw JSON or accidentally overriding a different film.

### UX-10 — Images and loading/error states need a recovery contract (P1/P2)

**Source-confirmed:** `src/ui/primitives.tsx:240–242` distinguishes absent poster URL from present URL but has no load-error fallback. Broken URLs leave broken images instead of the otherwise excellent typographic card. `src/lib/data.tsx:110–117` validates HTTP status/content type but casts arbitrary parsed JSON as `AppData`. `src/App.tsx:31` dereferences `state.data.totals.ratedFilms` outside chapter boundaries. Chapter error UI has no retry action (`src/ui/ErrorBoundary.tsx:15–23`); navigation anchors may disappear because boundary fallbacks do not preserve section IDs (`src/ui/ErrorBoundary.tsx:18`).

**Browser-confirmed:** An intercepted HTTP 404 produced the informative “No analysis found yet” state without a page exception. Returning valid JSON `{}` instead produced an empty body and uncaught `TypeError: Cannot read properties of undefined (reading 'ratedFilms')`. A locally missing poster URL produced a complete image with `naturalWidth:0` and no title-card fallback. Browser routes were intercepted locally; no source data or server files were changed.

**Fix:** Runtime schema/version validation before entering ready state; differentiated “not imported,” “invalid/incompatible analysis,” “read failed” messages with safe regeneration guidance; an app-root fallback; poster onError fallback using a stable same-size title card; preserved chapter anchor and reload/retry affordance. On malformed data, never interpolate private review content into telemetry/error reporting.

**Acceptance:** 404, HTML fallback, malformed JSON, valid JSON wrong shape, old schema version and failed image all yield an informative usable state, without uncaught exceptions or personal-data upload.

### UX-11 — Keyboard semantics are partially implemented and internally inconsistent (P2, related to P1 accessibility)

**Evidence:** `Segmented` uses `role="radiogroup"` and `role="radio"` but all choices are ordinary tab stops and no arrow-key management exists (`src/ui/primitives.tsx:268–273`). Some SVG buttons use the correct `onActivate` Enter/Space helper, others handle Enter only (`src/chapters/critic/Language.tsx:54`, `src/chapters/critic/Charts.tsx:104,184,311`, `src/chapters/critic/Motion.tsx:46`). Some SVG roots use `role="img"` while containing purported interactive controls (`src/chapters/critic/Charts.tsx:59,95–104`; `src/chapters/fivestar/ArcDiagram.tsx:27,65–78`), potentially flattening them in accessibility trees. Some focus outlines are removed with no replacement (`src/chapters/timeline/Monthly.tsx:94`; `src/chapters/critic/Language.tsx:52`).

**Browser-confirmed:** Focusing the recommendation Source radio “Everything” and pressing ArrowRight left focus and selection unchanged. Pointer mood selection worked: 36 candidates became 14 for “Mind-bending.” This is a keyboard-pattern defect, not a failure of the underlying filter.

**Fix:** One documented chart/control interaction pattern; use native radios or roving tabindex/arrow behavior; prefer buttons and semantic tables for critical interactions. Confirm accessibility-tree behavior with actual assistive technology rather than assuming SVG roles suffice.

**Acceptance:** Role, name, selected state, focus appearance and keyboard operation work consistently; no hundreds-of-mark tab chain; chart outcome available through a concise linked table/list. [W3C Radio Group Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/radio/) documents expected behavior.

### UX-12 — Repeated filtering and graph work are plausible responsiveness risks (measure before refactor)

**Evidence, plausible bottleneck only:** `DataProvider` bundles immutable data, lookup function, drawer state and explorer state (`src/lib/data.tsx:45–62`); opening a dossier or typing a global filter changes context for all subscribers. `TooltipProvider` creates a new context value on every pointer update (`src/ui/primitives.tsx:82–86`), potentially rerendering all consumers. `StarMap` updates React state on every zoom event (`src/chapters/constellation/StarMap.tsx:47–48`) and computes layout labels with fresh `x`/`y` functions as dependencies (`src/chapters/constellation/StarMap.tsx:34–35,77–100`), weakening memoization. FiveStar maps all top films with no pagination (`src/chapters/FiveStar.tsx:76–89`). All chapters are statically imported in App even though children mount near the viewport (`src/App.tsx:3–14`, `src/ui/primitives.tsx:25–50`).

**Fix only if measured:** Split immutable data/context actions/selection, keep tooltip position updates local or imperative, memoize stable scales, coalesce pan/zoom to animation frames, render graph marks in Canvas only if SVG actually misses budget. Consider dynamic chapter imports after bundle-size measurement. Retain HTML controls/text alternatives. Do not rewrite every chart as a speculative optimization.

**Acceptance:** Record production-build timings on representative 500/2,000/4,000-film synthetic fixtures and a real phone; measure long tasks, interaction latency, dropped frames and memory after repeated drawer/zoom cycles. Use the technical audit’s measured evidence, and do not infer a benchmark from README claims.

## Visualization-by-visualization direction

| Exhibit | What is valuable | Main interpretive/interaction issue | Practical improvement |
|---|---|---|---|
| Taste DNA radar | Recognizable personal emblem; selectable definitions/evidence | Mixes exposure, normalized behavior and preference in one shape; 12 axes and dual scales; interval uncertainty invisible | Keep as an optional emblem. Primary view: aligned exposure bars plus lift/uncertainty dots, grouped into observed behavior vs inferred affinity. Unknown distinct from zero. |
| Influence forest plot | Correct visual grammar for estimates and uncertainty | “Strongest influences” may read causally; labels and kind labels compete; mixed selection thresholds | “Associated with higher/lower ratings,” show denominators/coverage and exact adjusted estimate; shorter rank list with expandable evidence. |
| Genre scatter | The right two questions—what is rated often and what is enjoyed | X is rated-film share, square-root scaled, sometimes described as viewing; many overlapping marks | Name denominators, disclose/nonlinear option, add reliable/uncertain toggles, selected card and equivalent table. |
| Pair matrix | Finds combinations and supports direct evidence | “Synergy” is descriptive contrast vs better parent, not isolated interaction; color×opacity mixes magnitude/n | Show pair count plus explicit contrast/interval; disclose overlap, compare to single-only cohorts in science layer; use selected ranked-pair list on phones. |
| Genre evolution | Shared-scale small multiples are readable and appropriate | Missing metadata and changing coverage can mimic taste drift; no uncertainty/n displayed | Per-year known/total coverage and rated counts, stable taxonomy, gray unknown periods; same film-level denominator across years. |
| Timeline calendar | Excellent diary navigation and activity pattern | Tiny cells, horizontally scrolls, excludes presumed-backfilled genuine dates | Let user choose inclusion policy, add month/list view on phone, selected day shows every viewing with its date provenance. |
| Monthly viewing/rating | Separate vertically aligned charts avoid dual-axis confusion | Rolling-rating weights wrong denominator, precision over sparse months | Sum rated stars / rated-view count; gap and uncertainty for low n; explicit current vs historical rating semantics. |
| Release vs viewing scatter | Clearly separates two clocks | Per-view marks not keyboard accessible; overlap and future-release edge cases | Selected-day/year drilldown, a lag-distribution companion, data-quality annotation for negative lag. |
| Directors gallery | Per-film records expose consistency better than a single rank | Rated-count called loyalty; tied dot cap; low-n SD can look “consistent” | Separate count/mean/credible-range, low-n label, exact dot/histogram representation, deliberate complete filmography view later. |
| Movie constellation | Memorable exploration with methodology surfaced | UMAP local geometry is approximate; cluster selection not model semantics; pan/zoom/touch and hover cost | Display top verified shared attributes for a selected pair; original-space nearest neighbors; view/list modes; stability and coverage explanation; no decorative 3-D upgrade. |
| Five-Star Universe | Personal connection through the user's own words and connected favorites | Threshold may include 4.5★; all-film grid and hairball arcs scale poorly | Label shelf threshold prominently; focus on one selected film and its strongest creative links; relationship legend, expandable exact list. |
| Formula chart | Directly compares prevalence in top vs lower groups | Numeric values parsed from strings, no group sample counts/intervals in marks, z≈2 “reliable” wording | Structured prevalence data, denominators, effect uncertainty, multiple-testing-aware exploratory label. |
| Recommendations | Real sources, evidence and adventure control are unusually useful | Prediction dominates while choice/action and feedback are absent; discovery links leave for Wikidata | Three deliberate picks, synopsis and bridges, explicit exploration control, visible caveat, save/dismiss/seen plus later rating check-in. |
| Review language | Shows phrases from user's own writing, explicit lexicons | Keyword presence is not praise; quote snippets may contradict assigned interpretation | Aspect-level positive/negative/ambiguous evidence, keep quotes and provenance; opt-in semantic processing only. |
| Identity essay | Makes statistics emotionally legible, printable/shareable artifact potential | A confident essay can launder heuristic claims; film references absent from Markdown | Evidence links and claim badges alongside evocative language; separate observed, inferred and speculative statements; versioned private export. |

## Toward an interactive film museum

### Retain the identity; change the visitor journey

The current near-black, cream, Instrument Serif, Inter Tight and amber system is an asset. Film-strip perforations and grain are restrained enough to work without expensive imagery. Typographic poster cards make missing metadata look intentional. Preserve that system while shifting from a twelve-chapter statistical marathon to a guided journey with three entry points:

1. **Your current portrait:** a concise, evidence-qualified opening with three strong findings and three representative films. Show coverage and uncertainty without forcing the visitor to read methodology first.
2. **Explore the collection:** genre/director/neighborhood/time views share one persistent selection panel and the same drill-down language. A visitor should not relearn interaction in each chapter.
3. **Choose the next film:** a practical short list that can be acted on, revisited and improved by feedback.

The longer essay and full diagnostics remain valuable as deeper layers. They should be reachable from the same narrative, not compete with every decision screen. “Museum” means a thoughtful sequence, contextual labels, inspectable artifacts and room to pause—not a constant stream of motion.

### Interaction contract

Every chart should answer four questions consistently: **What is one mark? What does position/color mean? How uncertain is this? What happens when I select it?** A selected object should yield a stable card with exact values, sample count, missing-data coverage, evidence films and an explorer link. Hover adds convenience, not exclusive information. A field-level confidence label must not be conflated with uncertainty in whether the user will like a film.

### Layout and motion

Use larger, simpler mobile visualizations rather than scaled-down desktop plots. Dense matrix and constellation views get an explicit expanded workspace with an accessible list option. Keep whitespace for editorial hierarchy but avoid repeated 20–24-spacing gaps before every subsection on phone. Retain limited entrance motion, honor changes to reduced-motion preferences, and provide a persistent motion switch if continuous motion remains. Don't animate the arrival of critical facts or force the user to wait for a title sequence on every visit.

### Poster and image behavior

Keep title-card fallback as a first-class presentation, with stable aspect ratio and deterministic color. Add failure fallback, consistent image sizing, decoding policy and proper asset provenance. Recommendation images should help recognize and choose a movie, not merely repeat an existing film shelf. Avoid loading trailers or streaming embeds automatically; they add cost, tracking and spoilers without proven value.

### Accessibility and usability release gate

Before declaring the product polished, manually verify keyboard-only navigation, a screen reader, 320/390px mobile, a tablet viewport, 200% zoom, reduced motion, failed images, sparse/no diary, low metadata coverage and long multilingual titles. Automated rules are useful for contrast/name/role errors but cannot determine whether a graph teaches anything or whether claims are scientifically justified. Use task-based checks: find a particular rating, explain why a recommendation appears, correct a metadata mismatch, and choose a film within a reasonable session.

## Original product features beyond the supplied idea list

These are candidates, not an instruction to build all of them. The current evidence/identity foundation and recommendation feedback are prerequisites. Complexity is relative; ongoing cost assumes local computation and optional, explicitly authorized metadata sources.

| Original feature | User problem and differentiator | Benefit / expected quality gain | Complexity / ongoing cost | Decision and objective test |
|---|---|---|---|---|
| **Tonight contract** | A film can be a strong taste match and still be wrong for tonight. User specifies available time, attention level, company, subtitles and content boundaries separately from permanent taste. | Makes recommendation choices usable; avoids training permanent dislike from temporary constraints. | Medium; local rules and short-list reranking, negligible remote cost without availability API. Needs persistent sessions and honest unknown metadata. | Build after feedback schema. Measure time-to-choice, filter dead ends, later satisfaction and proportion of missing constraints. |
| **Double-bill composer** | Single-film rankings cannot design a satisfying two-film evening. Propose complementary pairs with total runtime and a specific artistic bridge or deliberate contrast. | Creates a curatorial artifact and highlights lesser-known works beside familiar anchors. | Medium; bounded pair ranking over top candidates (avoid all-catalog quadratic search); local cost. | Prototype later. Blind compare pairs against two top independent picks; require a verifiable bridge and feasible combined length. |
| **Expectation notebook** | Ratings alone cannot separate overhyped disappointment from disliked craft. Before watching, save one sentence about expectations; afterwards, compare optional impression notes. | Captures richer user evidence without pretending metadata infers emotional state; improves explanations over time. | Small–medium local event schema and UI; optional semantic processing later with privacy consent. | High-value small experiment after action loop. Track completion burden and whether explicit aspect feedback improves held-out ranking/calibration. |
| **Rewatch wager** | A recommendation system usually ignores a known film even when revisiting it could be the best experience. Offer an explicitly separate rewatch lane with a hypothesis about why it is timely. | Turns changed taste into an enjoyable experiment; preserves watched exclusion in ordinary discovery. | Medium; local temporal/evidence logic; low ongoing cost. | Experimental. Never claim a changed rating is predicted reliably until measured. Compare optional anticipated and post-rewatch ratings; log counterexamples. |
| **A finite personal season** | Infinite discovery creates indecision. Curate a six-film program with a beginning, a thematic turn and a finale, with substitutions for time/availability. | Completes an intentional experience and connects familiar preferences to new cinema without endless feed scrolling. | Medium–large; constrained sequence optimization, explicit evidence, local candidate metadata. | Later pilot. Measure program completion, satisfaction and diversity without overloading the user; don't auto-schedule or notify. |
| **Blind discovery cards** | Names, posters and acclaim may cause premature rejection or hype. Optionally reveal only a spoiler-safe premise and two evidence-backed taste bridges, then reveal title/crew. | Makes novelty a user-controlled experience and tests whether explanations help independently of prestige. | Small UX layer; need accurate spoiler-safe synopsis and no fabricated anonymized descriptors. | Low-cost experiment after trustworthy cards. Compare interest before/after identity reveal; never use it to conceal warnings or availability. |
| **Watchlist intention ledger** | A watchlist says that a title was saved, not why or whether interest is current. Let user tag “friend suggestion,” “director exploration,” “for a mood,” and “still interested / let go.” | Distinguishes intention from enjoyment, cleans stale queues, enriches decisions without guessing motivation. | Small–medium local persistence, no external inference cost. | Strong candidate after basic feedback. Measure queue completion and voluntary stale-item resolution; user intent remains editable. |

Recommended sequencing: **Tonight contract** and **watchlist intention** follow a correct local feedback model; **expectation notebook** is a small learning experiment. **Double bills** and **finite seasons** are stronger differentiation than another decorative plot but should wait for candidate quality. **Rewatch wagers** need longitudinal evidence. **Blind cards** are optional experimentation, not a new default flow.

## Workstream boundaries

- **Accessible shell:** `src/App.tsx`, `src/lib/data.tsx`, `src/ui/primitives.tsx`, `src/ui/FilmDrawer.tsx`, `src/styles.css`. Single owner; almost every frontend stream depends on these. Agree component interfaces before parallel edits.
- **Truthful chart contract:** `shared/app-types.ts`, pipeline aggregates, `src/chapters/Timeline.tsx`, `src/chapters/Dna.tsx`, `src/chapters/Genres.tsx`, `src/chapters/FiveStar.tsx` and their chart submodules. Shared schema owner must define denominators/coverage/typed numerical fields before feature branches consume them.
- **Recommendation decision loop:** `src/chapters/Next.tsx`, `src/chapters/next/RecCard.tsx`, recommendation types and new local feedback persistence. Coordinate with the ranking workstream; avoid UI reimplementing scoring policy separately.
- **Chart accessibility and density:** independent subfolders after shell contract stabilizes: `src/chapters/genres/`, `src/chapters/timeline/`, `src/chapters/directors/`, `src/chapters/constellation/`, `src/chapters/fivestar/`, `src/chapters/critic/`. Don't have multiple agents edit primitives/styles simultaneously.
- **Report/export:** `src/chapters/Report.tsx`, pipeline report generator, print tests. Keep separate from source data/normalization changes except agreed claim links.
- **Validation:** browser scenario suite using only synthetic bundles, target-viewport screenshots, keyboard/motion/error tests, semantic assertions. Test primary user tasks rather than merely mirroring rendered markup.

## Evidence-based design scores

**Visualization quality: 6/10.** Actual desktop renderings show a coherent chart vocabulary, useful confidence encodings, clear comparison to personal baseline and successful genre/map drill-downs. Deductions reflect semantic bugs, dense small-screen radar/map labels, silent tie/clamp behavior and incomplete non-pointer access. This score evaluates implementation with synthetic data, not the truth of the user’s real taste profile.

**UI/UX and visual identity: 6/10.** The warm-black/cream/amber system, typography, chapter headers, restrained film details and typographic posters are a substantial asset. Actual browser testing shows a functional explorer, contextual dossier, filter feedback and no full-page horizontal overflow at tested widths. Confirmed modal focus escape, number-only mobile navigation, blank malformed-data state, missing print content, broken-image handling and a recommendation page whose mobile first viewport is consumed by controls prevent a higher combined UX score. Visual identity alone is stronger than interaction completion.

**Performance/responsiveness: insufficient frontend measurement for an independent score.** Ordinary synthetic interactions completed and no general page exceptions occurred; build size and pipeline benchmarks are covered in the technical audit. Browser harness timestamps include intentional animation waits and must not be reported as page-load benchmarks. Real-device and larger-library frame/interaction measurements remain untested.

## Remaining validation checklist (future acceptance, not current failures)

1. Physical-phone touch scroll through the constellation, target sizes and tooltip alternatives.
2. 320px, 200% zoom, long multilingual titles and actual screen-reader operation.
3. Nested film changes in the dossier, focus containment after fixes and background scrolling.
4. Sparse/no-diary, under-five ratings and very low metadata coverage states.
5. Exact-bucket drill-down semantics for all secondary charts; controlled 7+ equal-rating director fixture.
6. Generated HTML and Markdown downloads, native OS print dialog and reduced-motion print after fixes.
7. Real poster CDN behavior, licenses, loading and image-error recovery with approved public assets.
8. Production-build large-library interaction latency, long tasks, memory and physical-device frame budgets.



## Recommended first design implementation phase

Authorize a bounded **truthful, accessible interface** phase alongside the data-contract fixes: validate the loaded bundle and preserve a root recovery screen; correct displayed denominators/copy and print visibility; repair the shared dossier, mobile chapter naming, radio keyboard behavior, text contrast and failed-image fallback. Add a synthetic browser acceptance suite for those concrete failures. Keep the current visual identity and chart library.

After those shared contracts are stable, run independent workstreams for chart interaction/density and the recommendation decision loop. The first product milestone should be a user who can inspect the evidence for a claim, choose an unfamiliar film, record why the choice was made, and revisit the result—without a misleading number or an inaccessible interaction in that path. No implementation was performed during this audit.
