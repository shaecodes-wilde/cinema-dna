# CINEMA DNA — Technical Audit

**Audit date:** 2026-10-26. **Audited source:** `main` at `b7a732a5b076858f5cee92da0c9408dded0823a0`. **Documentation branch:** `audit/cinema-dna-2026-10-26`.

The audit used a fresh clone whose initial working tree was clean. The owner's original workstation, uncommitted changes, private export, cached metadata and previously generated dashboard were not available. The documentation branch was created from the audited commit; application source and the source `main` branch were left unchanged. Only audit documentation and synthetic evidence are added.

All executable probes use invented synthetic records. They do not establish how frequently a defect affects the owner's actual library. No personal export, credentials or review text was uploaded, and no live movie-metadata lookup was performed. External technical references and GitHub repository/CI state were checked separately.

**Environment:** Linux `6.18.55`, x86_64; Node `24.22.1`, npm `11.9.0`, Python `3.12.14`. The performance process reported an AMD EPYC 9V74, 9 logical CPUs available, and approximately 10 GiB host memory. Browser inspection used headless Chromium 134 because the newer bundled binary was unavailable; screenshots and viewport details are documented in [DESIGN_UX_AUDIT.md](DESIGN_UX_AUDIT.md).

**Evidence convention:** “Confirmed” means an executed counterexample or directly verified code path, identified below. “Risk” means a consequence not deliberately induced. Personal-data prevalence and unseen deployment behavior remain unverified. Source line references are pinned to the audited commit, not to a future implementation. [Portable reproduction instructions](audit-evidence/reproduction/engineering/README.md) run synthetic probes against an isolated temporary source copy; captured results are in `docs/audit-evidence/results/`.

## Assessment and evidence boundaries

The architecture is appropriately small for a private, single-user, offline-generated film atlas. The backend is a batch pipeline, not an API server or database service. Explicit normalized types, record provenance, diary-versus-watched semantics, metadata confidence, cached network requests, and a static React consumer form a sensible foundation. Replacing this with a distributed backend would add cost before solving the actual defects.

The highest-leverage engineering problems are incorrect edge-case reconciliation, inconsistent runtime validation, metadata survival across refreshes, and pipeline failures that appear successful. Passing tests establish a useful baseline but do not cover these contracts. The absence of the user's private export means none of the synthetic defects establishes how often the user's actual library encounters them.

### Verification results

| Check | Observed result | Evidence |
|---|---|---|
| Install | `npm ci --ignore-scripts` succeeded, 332 packages installed | Locked dependencies installed locally; install scripts disabled |
| Type checks | Pass | [typecheck log](audit-evidence/results/runtime/typecheck.txt) |
| ESLint | Pass | [lint log](audit-evidence/results/runtime/lint.txt) |
| Existing tests | 47 passing tests in 4 files, reported duration 1.03 seconds | [test log](audit-evidence/results/runtime/tests.txt) |
| Production build | Pass, Vite 8.3.5, 1,042 modules, reported build 394 ms | [build log](audit-evidence/results/runtime/build.txt) |
| Dependency audit | Zero advisories reported for the locked dependency graph; 403 dependency entries | [advisory response](audit-evidence/results/runtime/npm-audit.json) |
| JavaScript output | 623.03 kB raw / 191.43 kB gzip | [build log](audit-evidence/results/runtime/build.txt) |
| CSS output | 55.09 kB raw / 12.72 kB gzip | [build log](audit-evidence/results/runtime/build.txt) |
| Synthetic realistic pipeline | 240 watched, 210 rated, 36 watchlist, 74 reviews; 228/240 watched films matched; bundle 572,121 bytes; analysis approximately 634 ms | [synthetic fixture summary](audit-evidence/results/runtime/fixture-summary.json); not personal data |
| Actual offline CLI import | Pass: original synthetic ZIP copied unchanged; ingestion→enrichment→analysis produced seven expected output files; network guard recorded zero calls | [CLI results](audit-evidence/results/engineering/cli-import-results.json), [success log](audit-evidence/results/engineering/cli-import-valid.txt) |
| Actual malformed-CSV CLI import | Exits 1; previous generated files unchanged; original ZIP unchanged; network guard recorded zero calls. Error is cryptic `.trim is not a function` | [CLI results](audit-evidence/results/engineering/cli-import-results.json), [failure log](audit-evidence/results/engineering/cli-import-invalid.txt) |
| Constellation scale probe | Measured 1,000 films in 2,382 ms and 4,000 in 10,518 ms; 4,000 finite positions; RSS approximately 311 MiB | [scale results](audit-evidence/results/runtime/performance.json); repeated synthetic attributes, single warm process, map only |

The isolated CLI used a copy of `pipeline/`, `shared/` and a minimal package manifest, with `node_modules` linked to the installed dependencies. Its `ROOT` is derived from that copy's module path, not from the original checkout. Source ZIP counts independently agree with normalized and application output: 7 films, 5 watched, 5 rated, 5 viewings including 1 rewatch, 2 reviews, 2 watchlist, 2 detached records; ratings `[5,3,1.5,2.5,4]` average **3.2**, median **3**, sample SD **1.35**. This establishes real CLI behavior for a small synthetic export, not personal-data accuracy or live enrichment quality.

Times are single-run environment observations, not a benchmark distribution or evidence of mobile responsiveness. A zero-advisory audit is not a guarantee against vulnerabilities. No failing build was found. Interaction, accessibility and render findings are detailed in [DESIGN_UX_AUDIT.md](DESIGN_UX_AUDIT.md).

## Architecture map

| Layer | Current implementation | Main contract |
|---|---|---|
| Input | `pipeline/ingest/archive.ts:12–55`, `pipeline/ingest/csv.ts:5–47` | ZIP or extracted directory into named CSV strings |
| Reconciliation | `pipeline/ingest/normalize.ts` | Stable film identities, viewings, reviews, lists, detached records and file audit |
| Metadata | `pipeline/enrich/index.ts:29–139`, `pipeline/enrich/http.ts:23–108`, `pipeline/enrich/wikidata.ts:92–227`, `pipeline/enrich/match.ts:47–79`, `pipeline/enrich/tmdb.ts:37–106` | Wikidata matches plus optional TMDB overlay; JSON disk caches |
| Analysis | `pipeline/analyze/` | Joined records, affinities, model, timeline, constellation, insights, recommendation candidates |
| Serialization | `pipeline/analyze/index.ts:27–40` | JSON bundle and HTML/Markdown report files |
| Shared interfaces | `shared/types.ts`, `shared/app-types.ts` | Compile-time TypeScript shapes; no runtime schema validation |
| Browser | `src/App.tsx`, `src/chapters/`, `src/lib/data.tsx` | Fetch one generated bundle, local exploration and file download |
| Persistence | `pipeline/paths.ts` | Flat files at fixed locations, no DB, no transactions, no server sessions |
| CI | `.github/workflows/ci.yml:9–21` | Node 24, npm ci, types, lint, tests, build |

This design does not need a database for its current one-user workflow. It does need snapshot IDs and atomic manifests so a dataset, metadata file and analysis bundle cannot silently belong to different generations.

## Highest-priority confirmed findings

### ENG-01 — Invalid CSV values can create impossible metrics; parser errors can crash or disappear

**Priority:** P1. Validation must be corrected before accepting damaged or hand-edited imports. **Status:** confirmed with synthetic execution.

**Code:** `pipeline/ingest/csv.ts:5–11,40–47`; `pipeline/ingest/normalize.ts:134–157,169–194`; downstream `pipeline/analyze/index.ts:161–170,184–200`; `pipeline/analyze/timeline.ts:10–39`.

`num()` accepts every finite JavaScript number rather than validating rating range and half-star increments. `isoDate()` only checks the textual shape. PapaParse's `errors` are ignored. Its extra-column array is treated as a string and `.trim()` is called on it.

**Reproductions:** Run `ingest-probes.mts` and `downstream-probes.mts` using the [isolated reproduction guide](audit-evidence/reproduction/engineering/README.md). See [ingestion results](audit-evidence/results/engineering/ingest-results.json) and [downstream results](audit-evidence/results/engineering/downstream-results.json).

- Ratings `[99,4,4,4,4]` produce **5 rated films and a 23-star mean**, while the fixed 0.5–5 histogram counts **4**. No rating conflict or invalid-field audit is emitted.
- `2024-99-99` survives into a viewing marked `live`, then into a timeline bucket `2024-99`.
- The impossible date `2023-02-29` is accepted. A future watch date `2030-01-01` logged in 2024 is also marked `live` because a negative lag does not exceed seven days.
- `Date,Name\n2024-01-01,A,B\n` throws `(v ?? "").trim is not a function`.
- An unterminated quoted field is silently accepted rather than surfaced as malformed CSV.

**Why it matters:** These are failures of the trust boundary, not failures of TypeScript. A damaged or hand-edited export can make the UI contradict itself or prevent import, while the data-quality panel appears clean. Genuine Letterboxd exports are expected to use valid ratings; actual occurrence in the user's file is unknown.

**Fix:** Separate parsers for rating, year, integer count and calendar date. Validate headers and PapaParse errors with row/file references. Quarantine invalid rows or fields with explicit policy; do not silently clamp ratings or invent dates. Validate normalized JSON and AppData on read using the same schema contracts.

**Benefit / complexity:** High trust gain; medium implementation effort. Requires ownership of ingestion types and audit schema. All ingestion and analysis consumers must agree on how rejected fields affect totals.

**Acceptance:** Invalid ratings never enter aggregates; histogram totals equal the number of valid rated records; malformed CSV produces an actionable file/row message; invalid/future dates are not labeled trustworthy; normal, quoted multiline, BOM and non-Latin cases still pass.

### ENG-02 — Identity ambiguity is recorded but still resolved arbitrarily; late list identities can duplicate films

**Priority:** P1; escalate an affected personal record to a release blocker until its identity is resolved. **Status:** confirmed synthetic behavior.

**Code:** `pipeline/ingest/normalize.ts:89–131,169–172,249–275`.

The title/year index stores one film. When another URI has the same title and year, a conflict is recorded, but `byKey` retains the first film. Diary and review resolution then uses that first identity without marking the affected entry unresolved. List film URIs are processed after diary/review fallback identities have been created, so they cannot repair those fallback records.

**Reproduction:** Two watched rows for `Duplicate (2020)` with URIs `A` and `B` plus one diary row produce a viewing linked to `lb:A`. Reversing watched-row order links it to `lb:B`. In both cases the diary audit says one linked and zero unlinked. A diary film with no earlier film-level row, but a valid list URI later, produces both `ty:duplicate:2020` (watched) and `lb:F1` (unwatched list member).

**Why it matters:** Reordering an input file must not change the meaning of a viewing. Both cases can attach reviews or repeated viewings to the wrong entity and split evidence across duplicate identities. The conflict log is useful but does not make the chosen relationship correct.

**Fix:** Index title/year to candidate sets; build the full film-level identity graph including lists before resolving entries. Keep ambiguous joins unresolved with candidates and an override path. Reconcile a unique fallback identity to a later stable URI; retain original source references.

**Benefit / complexity:** High foundational accuracy gain; medium to high effort because the identity contract feeds every chart. Coordinate with recommendation exclusion and schema migration work.

**Acceptance:** Normalization is invariant to film-file row ordering; ambiguity never becomes a confident diary assignment; the late-list fixture produces one merged film; two actual same-title/year works remain separate; reviews and viewings retain referential integrity.

### ENG-03 — An incremental offline refresh can erase known metadata despite a populated cache

**Priority:** P0 for the advertised offline-refresh contract. Only derived metadata coverage is overwritten; the original export remains unchanged. **Status:** confirmed end-to-end enrichment using a mocked transport and actual disk caches.

**Code:** `pipeline/enrich/index.ts:37–85,88–97,131–137`; `pipeline/enrich/wikidata.ts:119–157`; `pipeline/enrich/http.ts:42–50`.

Matching is rebuilt every run. The lookup-response cache is keyed by an entire batched query, while stable film-to-entity mappings in the existing metadata file are not reused. Adding or reordering films changes a batch key. An offline cache miss returns no matches, and `enrich()` writes that degraded result over the prior metadata.

**Reproduction:** Run `cache-probes.mts` using the [isolated reproduction guide](audit-evidence/reproduction/engineering/README.md); see [cache results](audit-evidence/results/engineering/cache-results.json).

1. Mock the three normal Wikidata responses for a one-film dataset. Alpha matches `lb:F1 → Q1` and `Q1.json` exists.
2. Add Beta, run the actual enrichment function with `offline:true` and network forbidden.
3. Both films are unmatched and the metadata file contains zero matched films.
4. Run the original one-film dataset offline: Alpha matches again because the original batch cache key exists.

**Why it matters:** The user's previous metadata remains on disk but becomes unreachable through the changed lookup. Genre, people and recommendation intelligence can collapse on a routine offline incremental import. This directly contradicts the intended cache-only degradation behavior.

**Fix:** Persist per-film match decisions keyed by stable film ID and identity fingerprint, including manual overrides, source version and fetch status. Reuse known valid matches before batched lookup. Distinguish unknown, fetch failure, cache miss and confirmed no match. Write the next snapshot only after merge and consistency checks; preserve prior successful fields when an offline refresh cannot improve them.

**Benefit / complexity:** High reliability and speed gain; medium effort. Shared ownership touches enrichment, persistence, source IDs and data-quality reporting. A TTL/refresh policy must not overwrite deliberate `null` overrides.

**Acceptance:** Adding one uncached film offline preserves all existing matches and marks only the new film unavailable. Reordering inputs has no effect. Explicit refresh and override changes work; a partial failure cannot replace a complete previous snapshot with an empty one.

### ENG-04 — Enrichment errors return exit code zero and may claim partial metadata when none exists

**Priority:** P1. **Status:** confirmed with an isolated copy of the CLI and a synthetic HTTP response.

**Code:** `pipeline/cli.ts:50–59,66–71`; `pipeline/enrich/index.ts:29–137`; `pipeline/paths.ts:27–34`; `pipeline/analyze/index.ts:27–40`.

The CLI catches all enrichment errors, logs that it is continuing with cached/partial metadata, and does not rethrow or set a failing status even for the standalone `enrich` command. Enrichment writes metadata once at the end; an early failure does not automatically materialize what may already be in entity caches. The JSON/report writers use direct overwrite operations without a snapshot transaction.

**Reproduction:** An isolated pipeline copy is given one synthetic film and a preloaded `fetch` stub returning HTTP 401. Its standalone `enrich` invocation exits **0**, prints “continuing with cached/partial metadata,” and creates **no metadata file**. No request leaves the process. See the [captured failure log](audit-evidence/results/engineering/cli-failure.txt). The portable `cli-probes.mts` reproduces the same exit contract after first exercising a successful synthetic import.

**Why it matters:** Agents and automation cannot tell failure from success by exit status. A full import may display a degraded or older dataset while claiming success. An interrupted direct write could corrupt a generated file; that interruption risk is inferred from the write strategy, not reproduced destructively.

**Fix:** Give stages structured statuses (`complete`, `degraded`, `failed`), clear exit semantics and a machine-readable summary. A standalone failure should fail. For an explicitly allowed degraded full run, identify exactly which snapshot and fields are being used. Use atomic writes and one manifest switch when all output files validate. Checkpoint expensive enrichment by bounded batches.

**Benefit / complexity:** High operational clarity; medium effort. Coordinate with ENG-03 so failure semantics and snapshot publication use one shared contract.

**Acceptance:** Standalone enrichment failure exits nonzero; full imports either finish coherently or retain the previous usable bundle; no “Done” message without a validated output; injected failure after any stage cannot publish a mixed generation.

### ENG-05 — Metadata matching confidence is stronger than the evidence in several edge cases

**Priority:** P1. **Status:** rules and synthetic outcomes confirmed; real-world false-match rate unmeasured.

**Code:** `pipeline/enrich/match.ts:17–30,47–79`; `pipeline/enrich/index.ts:37–59,64–81`; `pipeline/enrich/tmdb.ts:58–71`; `pipeline/analyze/features.ts:103–105`.

- The “Letterboxd ID” branch is based on guessed title slugs, not a canonical slug resolved from the film's boxd.it code. `viaLetterboxdId` bypasses title disagreement and film-class checks. A same-year entity with a completely different label is assigned `high` confidence and no mismatch note in a direct scorer probe.
- A missing input year is treated as year distance zero; exact-title search therefore receives `high` confidence despite lacking year agreement.
- TMDB accepts the first of multiple title matches whenever a year exists. A mocked search with a 2021 hit first and the exact 2020 hit second returns the first ID for a 2020 query.
- `pickBest([candidate,candidate])` downgrades a match as ambiguous with itself because candidates are not deduplicated by entity ID before near-tie comparison.
- Medium-confidence ambiguous matches are allowed to drive analysis (`pipeline/analyze/features.ts:105`); only low-confidence matches are excluded.

**Why it matters:** A wrong match contaminates every downstream feature while the UI can display confident evidence. The current mechanism correctly rejects many title/year mismatches and supports manual overrides; those protections should be preserved, then made more precise.

**Fix:** Distinguish canonical verified IDs from guessed slugs. Deduplicate candidates, record all candidates and reasons, make missing years unknown rather than perfect agreement, prefer exact year within a ranked comparison, and abstain on genuine collisions. Route uncertain matches to a review queue. Add field/source provenance so an overlay cannot silently inherit stronger confidence from another source.

**Benefit / complexity:** High accuracy gain; medium effort. Requires a stable matching schema and explicit UX for uncertain records. Network verification of a canonical slug must remain optional and disclose what is queried.

**Acceptance:** The four probes above pass with conservative outcomes; a labeled matching fixture corpus reports precision/coverage by method; ambiguous entries do not silently feed high-confidence taste claims; overrides remain authoritative.

### ENG-06 — Generated prose can contradict model availability and emit non-finite text

**Priority:** P0 analytical release blocker. See INT-01 and INT-11 in [TASTE_INTELLIGENCE_AUDIT.md](TASTE_INTELLIGENCE_AUDIT.md). **Status:** confirmed.

**Code:** `pipeline/analyze/report.ts:129–151`.

The long Markdown report always calculates `1 - cvRmse/baselineRmse` and says “That is a modest but real signal.” An unavailable model has zero values for both metrics, yielding `NaN% better`. The sentence also has no condition for a model that performs worse than baseline. The statement that unmatched titles are “mostly documentaries, TV and shorts” is fixed copy, not a computed composition result.

**Evidence:** [Downstream results](audit-evidence/results/engineering/downstream-results.json) contain a run with five ratings, unavailable model, and the exact `0★ vs 0★ (NaN% better)` paragraph. The unavailable-model branch is independent of the invalid-rating example's magnitude; any ordinary five-rating run reaches this reporting branch after analysis.

The subsequent complete CLI import using five valid ratings independently reproduced the same `NaN% better` and “modest but real signal” paragraph in its generated `reports/taste-analysis.md`.

**Fix:** Use the same model-availability and evidence-gating helpers for UI, Markdown and HTML output; emit evidence status before interpretation. Avoid dividing by zero. Derive unmatched composition or remove the assertion. Add report-contract tests for insufficient data, constant ratings, worse-than-baseline performance and absent metadata.

**Benefit / complexity:** High trust improvement at low effort. Coordinate with intelligence work defining valid model evaluation; do not simply hide an invalid evaluation behind better prose.

**Acceptance:** No output contains NaN/Infinity; unavailable or non-improving models never claim predictive signal; every report statement has the same evidence rules as the corresponding UI claim.

### ENG-07 — Bounded archive handling is absent; directory imports follow symlinks

**Priority:** P2 for the current trusted local workflow; P1 prerequisite before accepting uploads or third-party archives. **Status:** bounded expansion and symlink behavior confirmed; OOM and recursion exhaustion are plausible unexecuted risks.

**Code:** `pipeline/ingest/archive.ts:13–35`.

`unzipSync()` expands the full archive before filtering for CSV. There are no compressed-size, decompressed-size, file-count or per-file limits. Directory traversal uses `statSync`, which follows symbolic links, with no realpath containment or visited-directory set.

**Reproduction:** Run `archive-probes.mts` with `--expose-gc` following the [reproduction guide](audit-evidence/reproduction/engineering/README.md); see [archive results](audit-evidence/results/engineering/archive-results.json).

- A **16,634-byte** synthetic ZIP containing a tiny `watched.csv` plus a **16 MiB** zero-filled `ignored.bin` allocates approximately **16.80 MB** additional ArrayBuffers and increases RSS by approximately **20.71 MB**, even though only the CSV is returned. This is a single bounded test; no process was intentionally exhausted.
- A synthetic symlink `export/linked.csv → ../outside.csv` is read and included. A cycle was not executed.

**Security interpretation:** There is **no confirmed filesystem Zip Slip**: archive entries are held in memory and not extracted to disk. The `..` check is not the reason for that safety; the no-extraction design is. Resource exhaustion and directory-boundary violations remain relevant for untrusted input.

**Fix:** Filter unwanted entries before decompression, enforce actual byte/file budgets during processing, validate archive layout and reject duplicate/conflicting core paths. Use `lstat`/realpath containment and reject symlinks or explicitly track visited directories. Keep original archives immutable.

**Benefit / complexity:** Medium robustness benefit in the present workflow; medium effort. Avoid replacing a simple memory reader with unsafe filesystem extraction.

**Acceptance:** Oversize inputs stop with a clear bounded error; ignored binaries are never expanded; symlink escapes/cycles are rejected; safe nested ZIP and macOS-junk fixtures remain supported.

### ENG-08 — Valid JSON with an invalid application schema produces a blank page

**Priority:** P1. **Status:** confirmed browser reproduction. **Code:** `src/lib/data.tsx:107–117`; `src/App.tsx:21–32`; `src/main.tsx:6–10`.

The fetch path validates HTTP status and JSON content type, then casts the body to `AppData`. A synthetic `{}` response reached `state.data.totals.ratedFilms` outside the chapter boundaries, produced `Cannot read properties of undefined (reading 'ratedFilms')`, and left the page blank. The missing-file case, by contrast, rendered its intended setup instructions without an error. [Browser interaction evidence](audit-evidence/results/ux/interaction-evidence.json) records both cases; [DESIGN_UX_AUDIT.md](DESIGN_UX_AUDIT.md) covers the visible states.

**Fix / benefit:** Validate a versioned bundle envelope before rendering, distinguish absent/corrupt/incompatible data, and add a root error boundary with a clear recovery action. This converts a total failure into an actionable diagnosis. **Complexity:** medium; shared-schema ownership is required, and schema upgrades need explicit compatibility behavior. **Acceptance:** missing file, malformed JSON, `{}`, an unsupported schema version and a valid sparse bundle each produce the documented state; none yields an unhandled exception or blank page.

### ENG-09 — Report printing depends on whether the user has scrolled through the essay

**Priority:** P1. **Status:** confirmed browser and print-output inspection. **Code:** `src/chapters/Report.tsx:38–46,59–68,94–130`; `src/ui/primitives.tsx:55–68`.

Report sections use viewport-triggered `opacity:0` entrance states. Print styles do not force these states visible. Before scrolling the essay, eight report-section wrappers retained opacity zero in print media; after visiting them, all became visible. A document export must not depend on navigation history. [Interaction evidence](audit-evidence/results/ux/interaction-evidence.json), [unvisited print text](audit-evidence/results/ux/print-unvisited.txt) and [visited print text](audit-evidence/results/ux/print-visited.txt) support the finding. The full visual comparison is in [DESIGN_UX_AUDIT.md](DESIGN_UX_AUDIT.md).

**Fix / benefit:** Make print output deterministic: print the existing generated static HTML, or synchronously mount the report and remove animation/visibility transforms before printing. **Complexity:** low to medium; coordinate report rendering and shared motion primitives, and preserve reduced-motion behavior. **Acceptance:** first-visit and fully scrolled print outputs contain the same complete essay in readable colors; all report paragraphs appear without requiring prior scrolling. The separate generated HTML path should remain available.

### Analysis availability blocker — partial metadata crashes the whole pipeline

**Priority:** P0; tracked primarily as **INT-05** in [TASTE_INTELLIGENCE_AUDIT.md](TASTE_INTELLIGENCE_AUDIT.md). **Code:** `pipeline/analyze/insights.ts:120–130`.

An executed fixture with twenty rated films, runtime known only for five 5★ films at 160 minutes, and fifteen 1★ films with unknown runtime has a qualifying `150+ min` group but no shorter comparison group. Accessing `shortRows[0].key` throws. This uses ordinary valid ratings and plausible partial metadata; it is not a malformed-input-only problem. Guard the comparison and emit an unavailable contrast when no denominator exists. Completion with finite outputs across partial-metadata fixtures is the release gate; details and reproduction remain with INT-05 to avoid duplicating ownership.

## Other material engineering observations

### Snapshot validation and metadata freshness

`readJson<T>()` (`pipeline/paths.ts:32–34`) also casts parsed JSON to types without runtime checks. ENG-08 demonstrates the browser consequence; pipeline file reads need the same boundary discipline so stale or wrong-shaped normalized files fail with a structured diagnostic.

HTTP caches have no timestamps, TTL, schema version or explicit refresh option (`pipeline/enrich/http.ts:42–50,64–67`). Entity caches similarly have no expiry (`pipeline/enrich/wikidata.ts:160–168`). An empty response stays empty indefinitely until manually deleted. Older metadata files are loaded without checking the current export hash (`pipeline/analyze/index.ts:29–30`); the quality panel counts all stored metadata entries, including potentially stale IDs (`pipeline/analyze/index.ts:329–343`). Recommended shared solution: validated, versioned snapshot manifest plus per-film/field fetch status and explicit refresh controls. No database migration is necessary to implement this.

### Source-linking and incomplete records

Review-only films lacking film-level/diary counterparts are retained in `reviews` but remain `watched:false` with `rating:null` (`pipeline/ingest/normalize.ts:197–226`). App film projection filters them out unless they are also on a list/watchlist (`pipeline/analyze/index.ts:89–90`). The synthetic review-only fixture has one reviewed film and zero watched films. Do not automatically fabricate a viewing; expose a reconciliation state and allow the record to remain inspectable. A real complete export may already supply the watched row, so incidence is unverified.

The static model's per-row provenance is a substantial strength. An insight currently generally links to films, rather than preserving an executable definition, complete cohort, snapshot hash and source rows. Richer lineage should be implemented once in the analysis layer and consumed by the UI/report, not duplicated chart by chart.

### Network/cache behavior

The serial client rate limit, per-request timeout, retry budget, redacted credential URLs and atomic individual-cache writes are good safeguards (`pipeline/enrich/http.ts:42–80,93–108`). The `Retry-After` parser accepts numeric seconds only and caps them at 90 seconds (`pipeline/enrich/http.ts:76–78`), so an HTTP-date or a longer required delay is not fully honored. This is a protocol robustness gap; no live rate-limit incident was observed. Correct it with a documented bounded job deadline and explicit deferred status rather than silently retrying too soon.

Automatic matching and enrichment remain serial and can be slow for uncached titles. Fix cache reuse and persistence before introducing concurrency. The existing test verifies that offline requests do not hit the network (`pipeline/test/enrich.test.ts:67–83`). The implementation treats unreadable/truncated HTTP cache files as misses (`pipeline/enrich/http.ts:93–100`); explicit regression coverage for that recovery path is still desirable.

### Privacy and security posture

No credentials or real exports were present in the checked-out tracked files inspected here. Secrets are loaded in the Node CLI, not in frontend source. Git ignore rules cover raw exports, caches, normalized data, generated reports, `.env`/`.env.local`, `public/data` and `dist`. `.github/workflows/ci.yml` uses a read-only contents permission. These are meaningful strengths.

The JSON bundle intentionally includes full review text, dates, tags, profile name/location/bio and lists (`pipeline/analyze/index.ts:114–122,148–157,175–183`). A production build copies that bundle into a static distributable. README explicitly warns not to publish it. There is no authentication layer because this is a private local app. There is no evidence of a public deployment or data breach. Before making a shareable version, introduce a separate redacted export contract and verify generated contents automatically; hiding a chapter is not redaction.

The synthetic production rebuild verified the JSON in `dist/data` is byte-for-byte identical to the generated `public/data` bundle (matching SHA-256); the measured distribution is approximately 1.7 MB. This confirms packaging behavior without exposing actual personal information.

“Nothing is uploaded anywhere” in `src/chapters/Quality.tsx:203–205` is too broad when default enrichment sends film titles/slugs and TMDB searches to external metadata services. The README is clearer about optional lookup exceptions. TMDB poster URLs load directly in the browser (`src/ui/primitives.tsx:240–241`), so offline pipeline flags do not guarantee offline image display. A precise data-flow description, explicit network mode and locally cached images would make the privacy claim defensible. No review bodies are sent by the enrichment code inspected.

React renders review text as text; no `dangerouslySetInnerHTML` was found. `renderReportHtml` escapes ampersands, angle brackets and quotes (`pipeline/analyze/report.ts:3,47–61`). A synthetic script/image injection string remained escaped. Recommendation external links use a fixed HTTPS Wikidata prefix and `rel="noreferrer"` (`src/chapters/next/RecCard.tsx:31`). No confirmed XSS, command injection or credential-in-client defect was found. This does not replace a full adversarial test of an eventual upload/API service.

### Dependencies, licensing and reproducibility

The lockfile and CI are valuable. The inspected [main-branch CI run](https://github.com/shaecodes-wilde/cinema-dna/actions/runs/40377019570) also completed successfully. The dependency advisory check reported no advisories. The 403 locked dependency entries include declared licenses (MIT, ISC, Apache, BSD, OFL for fonts, MPL and others); no dependency entry lacks a license field. A license name in a lockfile does not establish that a distributable includes all required notices. Preserve applicable notices; no general licensing violation is asserted by this audit.

TMDB's [official FAQ](https://developer.themoviedb.org/docs/faq) requires an approved logo and prominent disclaimer in an About/Credits area; it distinguishes attributed noncommercial use from commercial licensing. The inspected application includes the disclaimer (`src/App.tsx:104`, `src/chapters/Quality.tsx:222–226`) but no TMDB logo implementation was found. Treat this as an attribution-completeness gap to resolve before distributing a TMDB-enabled version, not as a claim about an unseen deployment or a legal determination. The audit did not enable TMDB or download posters.

The package advertises Node `>=22`, while locked Vite/Vitest require at least 22.12 within Node 22 and locked jsdom requires 22.22.2 (or supported later lines). The actual Node 24.22.1 run succeeds. Pin a supported Node line/patch in tooling and align README/engines; the audit did not run old Node releases and does not claim a demonstrated crash there.

### Tests and performance interpretation

The existing 47 tests cover meaningful semantics: quoted multiline text, remakes, rewatches, orphan exclusion, date distinctions, metadata rejection, cache offline behavior, credential redaction, small samples and analysis construction. Preserve them. Four test files and no committed browser tests means CLI failure, cache refresh continuity, invalid-data startup, keyboard interactions and realistic schema transitions lack regression coverage.

The pipeline and browser are already separated: expensive fitting and UMAP happen at generation, not on every browser render. This is a major architectural strength. The measured synthetic pipeline time, 4,000-film map run and static bundle size do not establish end-to-end large-library or mobile performance. Prioritize actual browser long tasks, interaction latency, payload parse time and mounted SVG count before rewriting chart libraries. A single shared data context updates when filters/drawer selection change (`src/lib/data.tsx:45–62`); broad rerender risk exists, but no measured bottleneck was established there.

`scrollToSection()` installs three `{once:true}` global listeners per invocation and does not remove unused listeners at the end of its settling loop (`src/lib/data.tsx:69–87`). Repeated anchor clicks without those event types can accumulate handlers. This is a small confirmed lifecycle defect, not a measured memory crisis. Use one cleanup closure called on settle/cancel and on an overlapping navigation.

## Recommended engineering sequence

1. **Agree on contracts:** validation/quarantine states, identity resolution states, per-film metadata mapping, snapshot manifest and stage outcomes. One owner changes shared types.
2. **Three parallel implementation worktrees:** import and refresh correctness (ingestion, identity, cache and stage recovery); analytical truth and recommendation explanations; browser schema/loading/accessibility. One integration owner changes shared contracts and coordinates rebases. Preserve the existing correct fold-local person encoders; improve evaluation methodology as specified in INT-11 rather than claiming an encoder-leakage defect.
3. **Integration gate:** all current tests plus only the targeted regression scenarios listed above; CLI import using synthetic archives; interrupted-stage simulation in temporary directories; browser missing/malformed/valid states; privacy artifact scan.
4. **Then evaluate optimization:** representative small/medium/large synthetic libraries with measured payloads, wall time, peak RSS, render long tasks and interaction latency; optimize the actual bottleneck.

The first release should make the current outputs dependable, not add a server, vector database or external language model. Those choices belong to later product experiments after the import and evaluation foundations are reliable.

## Engineering score rationale

**Architecture/maintainability: 7/10.** Appropriate modular local architecture, strict types, shared model and CI; reduced by unvalidated runtime shapes, fixed-path persistence, weak snapshot consistency and uncovered cross-stage failures.

**Security/privacy: 7/10 for the observed local-only product.** No credential/XSS/Zip Slip issue found; good ignore rules and no telemetry, but unbounded archive handling, symlink traversal, privacy wording and easily published full personal bundles need hardening. This is not a score for an unseen deployed service.

**Data integrity: 6/10 for implementation quality.** Strong semantics and provenance deserve credit; deterministic ambiguity, invalid values and offline cache loss undermine trustworthy end-to-end output. Actual accuracy for the owner’s private export is **not assessable**. The consolidated scorecard is in [EXECUTIVE_AUDIT.md](EXECUTIVE_AUDIT.md).

## Probe evidence inventory

| Reproduction | Captured evidence | Scope |
|---|---|---|
| [ingest-probes.mts.txt](audit-evidence/reproduction/engineering/ingest-probes.mts.txt) | [ingest-results.json](audit-evidence/results/engineering/ingest-results.json) | Parser validation, order-dependent joins, late list identities, review-only behavior, metadata matching |
| [cache-probes.mts.txt](audit-evidence/reproduction/engineering/cache-probes.mts.txt) | [cache-results.json](audit-evidence/results/engineering/cache-results.json) | Incremental offline cache loss with mocked transport |
| [downstream-probes.mts.txt](audit-evidence/reproduction/engineering/downstream-probes.mts.txt) | [downstream-results.json](audit-evidence/results/engineering/downstream-results.json) | Inconsistent numeric display, invalid month, model prose, HTML escaping |
| [archive-probes.mts.txt](audit-evidence/reproduction/engineering/archive-probes.mts.txt) | [archive-results.json](audit-evidence/results/engineering/archive-results.json) | Bounded ZIP allocation and symlink containment |
| [cli-probes.mts.txt](audit-evidence/reproduction/engineering/cli-probes.mts.txt) | [CLI results](audit-evidence/results/engineering/cli-import-results.json), [success log](audit-evidence/results/engineering/cli-import-valid.txt), [parse-failure log](audit-evidence/results/engineering/cli-import-invalid.txt), [enrichment-failure log](audit-evidence/results/engineering/cli-failure.txt) | Complete offline import, correct small-fixture arithmetic, no-network guard, original ZIP preservation and exit behavior |

The portable adaptations were checked against an isolated archive of the audited commit. Four run directly under the audit sandbox; the CLI wrapper additionally needs permission to spawn local Node child processes. That host restriction is distinct from an application defect. All records and metadata responses are synthetic. Timestamp-dependent hashes and machine-dependent memory deltas are not expected to match byte-for-byte across reruns. No personal film, review, or preference is asserted to be wrong merely because a counterexample exists.
