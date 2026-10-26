# CINEMA DNA — Executive audit

**Audit date:** 26 October 2026

**Repository:** [shaecodes-wilde/cinema-dna](https://github.com/shaecodes-wilde/cinema-dna)

**Audited application commit:** `b7a732a5b076858f5cee92da0c9408dded0823a0`, source branch `main`

**Audit working branch:** `audit/cinema-dna-2026-10-26`

**Scope:** independent product, data, statistics, recommendations, design, engineering and privacy review. Documentation only; no application fixes were made.

## Assessment

**CINEMA DNA is a strong, distinctive prototype, approximately 6/10 overall. Its presentation and engineering foundations are ahead of its analytical reliability.** It already contains substantially more than basic Letterboxd charts: separate film and viewing records, data provenance, metadata matching, shrinkage, a fitted personal rating model, an attribute-based constellation, a searchable explorer and a coherent cinematic identity. Those are valuable assets.

The main problem is that the application sometimes turns limited, absent or contradictory evidence into confident personal conclusions. We reproduced reversed rewatch interpretations, a positive genre “synergy” with no valid comparison groups, explanations naming a genre absent from a recommended film, and high-confidence DNA scores computed from missing fields. These are product defects, because the product's central promise is understanding taste through evidence. More elaborate graphics or a language model would amplify the problem before they solved it.

**The owner's actual taste accuracy remains unassessed.** No personal Letterboxd export, generated personal analysis bundle, metadata cache or credentials were available in the audited checkout or located in the accessible files. No deployed application was identified from repository configuration. The runtime review used entirely synthetic records, and live metadata matching was not exercised. This audit establishes what the implementation does and where its guarantees fail; it cannot establish the accuracy of any personal recommendation or claim about the owner's taste.

The right next investment is a coordinated **data and analytical reliability phase**, followed by honest recommendation evaluation and a useful decision/feedback loop. Preserve the local architecture and visual language. Earn the stronger intelligence claims before adding more of them.

## Scope, methods and evidence

The source checkout was clean at the audited commit. That says nothing about uncommitted changes on the owner's original workstation, which was not available. The relevant environment was Linux, Node `24.22.1`, npm `11.9.0`, Python `3.12.14`, Vite `8.3.5`, and local Chromium `134` driven through Playwright `1.51.1`. The application ran on loopback. External browser requests were blocked; enrichment probes used mocked transport or offline mode. No private export or review text was transmitted externally.

Three parallel specialist investigations covered engineering, intelligence and UX. Their findings were reconciled, and duplicate symptoms were grouped into the priorities below. Every number in this document is an observed audit result or an explicitly identified judgment. Detailed source locations and reproduction procedures are in the specialist reports.

| Verification | Observed result | What it establishes |
|---|---|---|
| Dependency installation | `npm ci --ignore-scripts --no-audit --no-fund` succeeded | Locked project can be installed in this environment |
| Type checks, lint, tests, production build | All passed; **47 tests in 4 files** | Existing automated gates are green; they do not cover all reproduced defects |
| Dependency advisory audit | **0 advisories** reported | No known advisory was reported by that audit at inspection time; not a security certification |
| Actual offline CLI import | Exit 0, 7 output files, **0 network calls**, original ZIP bytes unchanged | The import-to-dashboard workflow functions on a small valid synthetic export |
| Independent metric recomputation | **11 core totals and 13 genre groups agreed** | Normal-input arithmetic agrees with independently parsed synthetic CSVs; the statistical interpretation is a separate question |
| Broader synthetic dashboard | 240 watched, 210 rated, 240 diary events, 20 rewatches, 74 reviews, 36 watchlist films | Enough varied records to inspect populated chapters; not the owner's statistics |
| Browser inspection | Desktop 1440×1000, tablet 768×1000, mobile 390×1000; real screenshots and keyboard interactions | Actual local rendering and selected interactions, not a source-only design opinion |
| Map scale probe | 1,000 films: **2.38 s**; 4,000: **10.52 s**, about 311 MiB process RSS | Offline constellation generation with repeated synthetic attributes, one warm-process run per size |
| Production assets | JS **623.03 kB / 191.43 kB gzip**; CSS **55.09 kB / 12.72 kB gzip** | A concrete payload baseline; not a measured mobile load-time score |

The 240-film analysis took about **634 ms** and produced a **572,121-byte** JSON bundle on this machine. These are single-run observations. The synthetic fixture deliberately contains learnable associations; its model metrics are not evidence of real recommendation quality. No Lighthouse score, physical-phone benchmark, Safari result, screen-reader certification or personal NDCG score is claimed.

Evidence: [test output](audit-evidence/results/runtime/tests.txt), [independent recomputation](audit-evidence/results/runtime/independent-recomputation.json), [CLI results](audit-evidence/results/engineering/cli-import-results.json), [map timings](audit-evidence/results/runtime/performance.json), [interaction results](audit-evidence/results/ux/interaction-evidence.json). The [evidence manifest](audit-evidence/manifest.json) identifies the complete preserved set.

## Scores and confidence

Scores assess the implementation at the audited commit, not the owner's taste. A 5 means a useful prototype with substantive gaps; an 8 would require robust validation and dependable operation; a 10 would require exceptional demonstrated quality. These are reasoned product judgments, not a mechanical average or measured scientific scale.

| Category | Score | Reason and limits |
|---|---:|---|
| Data integrity | **6/10** | Good film/event distinction, source references and basic reconciliation; invalid-field acceptance, order-dependent identity joins, derived-metadata loss on offline refresh and uncertain matching weaken the contract. Personal reconciliation is unverified. |
| Statistical validity | **4/10** | Core arithmetic and shrinkage are useful. Invalid contrasts, heuristic confidence, missingness bias, timeline weighting and selection-optimistic evaluation make several stronger claims indefensible. |
| Taste profiling intelligence | **4/10** | Interpretable exposure and rating-lift measures exist. Atmosphere, pacing, formal experimentation and emotional preference are largely unmeasured; some personality prose contradicts its inputs. |
| Recommendation personalization | **4.5/10** | A genuine fitted personal model and creator-based candidates exist. Explanation errors, watched-identity leakage, a narrow candidate pool and no independent ranking evaluation limit trust. This is a capability score; personal satisfaction is unknown. |
| Visualization quality | **6/10** | Varied, attractive, connected views with meaningful exploration. Radar semantics, overlapping labels, capped marks, projected-distance neighbors and some unsupported statistical stories need repair. |
| UI/UX and visual identity | **6/10** | Strong typography, palette, composition and editorial cohesion. Keyboard focus escapes the drawer, mobile labels disappear, faint text fails contrast, and print/broken-image states fail. Provisional Chromium/synthetic-data assessment. |
| Performance and responsiveness | **7/10 offline processing; frontend N/A** | Build and local exploration work; measured offline map cost is reasonable at tested sizes. Large initial JS, one full bundle and broad reactive updates warrant measurement. Browser latency, real-device and real-export responsiveness remain unmeasured; the numeric score covers build/offline-processing capability only. |
| Architecture and maintainability | **7/10** | Appropriate typed batch pipeline and static UI, logical modules, reproducibility and useful tests. Runtime schemas, snapshot coherence, shared evidence rules and clearer failure contracts are missing. |
| Security and privacy | **7/10** | Local processing, ignored private artifacts, escaped report text and no tracked credentials found. Generated data is copied into deployable output; archive limits and precise network disclosures need work. No actual breach or exploit was found. |
| Feature completeness | **7/10** | Major advertised chapters are implemented and several interactions were exercised. Reliability gaps, no persistent recommendation feedback, incomplete cold-start UX and unverified live discovery prevent a production-complete assessment. |
| **Overall product quality** | **6/10** | A compelling foundation whose central evidence promise is not yet dependable enough to support its most confident conclusions. |

**Not meaningfully assessable:** actual personal taste accuracy, real metadata precision/recall, discovery satisfaction, historical ranking performance, production uptime and real-device performance. Do not substitute the scores above for those missing measurements.

## Feature inventory

“Functional” below means verified for the stated fixture and interaction, not universally correct. “Partial” means a real implementation exists with material limitations. “Unverified” is used where inspection could not establish operational quality.

| Area | Status | Evidence and qualification |
|---|---|---|
| ZIP import and source preservation | Functional for valid fixture; partial robustness | Full isolated CLI succeeded, source and copy hashes agree; malformed CSV reports cryptic failure; archive expansion is unbounded |
| Films, current ratings, diary viewings, reviews, likes and lists | Partial | Basic counts and rewatch preservation work; same-title/year collisions and late list IDs can misassign or duplicate records |
| Unlinked/deleted content audit | Functional in fixture | Detached records retained without inventing diary viewings |
| Wikidata/TMDB enrichment | Implemented; live quality unverified | Source and mocked matching reviewed; no personal export or API configuration to verify actual coverage/precision |
| Offline refresh/caching | Broken incremental case | Adding an uncached film can remove previously derived matches from the published metadata file |
| Overview and counts | Functional on ordinary fixture | Independently recomputed totals agree; malformed numeric values bypass validation |
| Taste DNA | Partial; unsupported confidence in some cases | Exposure measures render, but missing fields can become confident zero scores and several labels imply unmeasured traits |
| Genre Universe | Interactive; analytical defects | Genre selection and explorer drill-down work; “synergy” can arise solely from inconsistent shrinkage |
| Cinema Timeline | Partial | Multiple views render and use diary semantics; rolling rating denominator and date-quality assumptions need correction |
| Director's Gallery and other creative roles | Partial | Populated views and film drill-downs exist; “most watched” can use rated-only counts and dot plots hide repeated tied observations |
| Movie Constellation | Functional exploration; limited interpretation | Zoom, reset and filtering work; original-space clustering is good; projected neighbors and cluster validity need correction |
| Five-Star Universe | Partial | Film collection and relationships render; comparative formula can use an empty reference cohort |
| Critical Analysis / Review language | Partial | Ratings and lexicon summaries exist; lexicon misses negation and does not establish nuanced aesthetic preference |
| Recommendations | Functional filters; partial intelligence | Mood filter reduced 36 to 14 candidates in fixture; ranking exists; explanations and source-dependent watched exclusion fail specific probes |
| New discovery retrieval | Implemented; live usefulness unverified | Real query construction exists, but audit ran offline and no personal retrieval/ranking evaluation was possible |
| Film Explorer | Functional selected flows | Exact-title search, empty state and genre drill-down exercised; film drawer opens and closes |
| Film drawer accessibility | Broken modal containment | Shift+Tab moves focus behind the open modal; Escape and return focus worked |
| Quality and provenance page | Functional, incomplete repair flow | Counts/coverage render; canonical IDs needed for documented overrides are not conveniently exposed |
| Report files and report page | Partial | Files are generated; some prose is false/non-finite; browser printing before reveal leaves missing sections |
| Loading/empty/error handling | Partial | Missing bundle shows useful instructions; valid JSON with wrong shape (`{}`) causes blank-page failure |
| Mobile and reduced motion | Partial | No horizontal page overflow at 390/768 px; number-only navigation, dense labels and a clipped nonmoving shelf reduce access |
| Persistent shortlist, dismiss/seen feedback, recommendation learning loop | Missing | Filtering is available; durable preference feedback and outcome tracking are not implemented |
| Browser upload, account service, cloud sync, background job service | Missing by current product design | Agent/CLI import and local static output are intentional; these are not required merely to make the present tool useful |

## Five most important weaknesses

### 1. The product's prose is not reliably constrained by evidence

Four films whose rewatch ratings all declined from 5★ to 1★ still generated an explanation that returning deepens appreciation. A 1.5★ average produced language calling 3★ below average. A model unavailable on five ordinary ratings produced `NaN% better` and a claim of real predictive signal. These are confirmed counterexamples, not subjective disagreements with tone. See INT-01 and ENG-06.

The same problem occurs structurally: genre intersections can be called synergy without single-genre comparison groups; unknown genres can produce high-confidence zero scores; a positive recommendation contribution caused by **absence** of Horror is described as “Horror: +0.47★.” Repairing individual phrases is insufficient. Computed claims and prose need one explicit evidence contract.

### 2. Data identity, field availability and refresh state are not dependable end to end

The normalized model is thoughtfully designed, but ambiguous title/year joins remain order-dependent, film IDs introduced by lists can duplicate fallback identities, and cache keys depend on batches instead of reusable film mappings. Offline refresh can publish zero matches despite usable per-entity cache files. A valid partial-runtime dataset can crash analysis. These failures threaten the foundation of every downstream insight. See ENG-02–05 and INT-04–06.

### 3. Recommendation quality is asserted more strongly than it is measured

The current engine is personalized: it learns from the user's ratings and creator track records. It is not merely a popularity list. However, it mostly evaluates rating reconstruction, uses the same cross-validation results to choose and report regularization, and has no independent retrieval/ranking benchmark. Creator and award eligibility constrain discovery toward established territory. A novelty slider only reranks available candidates; it cannot introduce missing film movements or filmmakers. See INT-11–12.

There is an important strength here: person encoders and baselines are rebuilt inside training folds. This audit did **not** find wholesale held-out-target leakage. The remaining evaluation issues should be fixed precisely, without discarding good work.

### 4. Several polished interactions are inaccessible or fail at the edges

The visual system is coherent, but the modal is not keyboard-contained, mobile navigation exposes numbers without useful labels, a secondary text token measures roughly 2.43–2.73:1 contrast, and a broken poster URL leaves an empty tile. Printing the report before its sections have entered the viewport produces mostly missing content. These are observed or directly measured failures, not a proposal for a cosmetic redesign. See the design report's runtime evidence.

### 5. The product describes a taste identity better than it supports an ongoing discovery habit

The user can inspect and filter many views, but cannot maintain a meaningful local “interested / already seen / not for me / not tonight” history. There is no durable shortlist, no distinction between permanent preference and session constraints, and no prospective evidence of which recommendations actually worked. Adding this small decision loop can improve usefulness and provide the evidence future modeling needs.

## Five highest-impact improvements

| Improvement | Expected benefit | Effort and dependency | Objective verification |
|---|---|---|---|
| **One evidence contract for all claims** | Numbers, labels, prose and reports agree; uncertainty becomes understandable | Medium–high; shared claim/missingness schema first | Counterexamples no longer produce reversed claims, false comparisons, NaN or confident unknowns; every factual claim links to records and denominators |
| **Canonical identity and coherent refresh snapshots** | Rewatches and reviews remain attached correctly; incremental offline use preserves knowledge | Medium–high; single schema and persistence owner | Row permutation invariant; no validated watched identity is recommended; cached matches survive new-film offline imports; failed stages retain last usable snapshot |
| **Qualified recommendation evaluation, then broader retrieval** | Personalization is demonstrated; discovery can reach beyond favorite creators and awards | Medium–high; repaired identities/features first | Independent held-out ranking and rating comparisons, retrieval recall, coverage/diversity, honest fallback if no model wins |
| **Accessible, reliable evidence exploration** | More people can understand and operate the existing visual experience | Medium; shared UI primitive owner | Keyboard-contained drawer, readable names/contrast, resilient bundle/image states, complete print before scrolling, equivalent mobile evidence access |
| **A small local decision and feedback loop** | Recommendations become actionable and improve through actual choices | Medium; local event schema and candidate versions | User can shortlist and correct seen status, distinguish enduring rejection from tonight's constraints, and revisit outcome history without losing data |

Do not start by replacing the stack, adding a vector database, applying an LLM to every review, or rewriting all charts in canvas. The measured map cost does not justify that priority; the confirmed failures are elsewhere.

## Strengths that should be preserved

1. **Film identity and viewing events are distinct concepts.** Current ratings, diary history, detached entries and source references provide a better foundation than a flat “one CSV row equals one watch” model.
2. **Local ownership is central.** Flat files, deterministic batch analysis, self-hosted fonts and a static browser consumer are suitable for a private single-user tool. A hosted backend is not a prerequisite for better intelligence.
3. **The analytics are inspectable.** Shrinkage, explicit feature construction, fold-local people encoders and metadata confidence are understandable and testable. Improve their contracts instead of replacing transparency with opaque scores.
4. **The visual identity is distinctive.** Instrument Serif headlines, warm dark surfaces, cream/amber accents, film-strip details and generous editorial spacing already create a cinematic atmosphere.
5. **Exploration connects to evidence.** The explorer, film dossier, quality panel, genre/person drill-downs and original-space clustering can become a strong explanation interface with focused improvements.

## What is genuinely trustworthy today?

The basic distinction between unique watched films and diary viewing events is sound in ordinary tested inputs. Straight counts, the current-rating distribution and arithmetic means on valid records are useful; representative synthetic totals independently agreed. A displayed film's source records and raw metadata are valuable evidence, subject to identity/matching verification. Shrunk affinities are reasonable descriptive summaries when labeled with their included population and assumptions.

Trust becomes conditional as the claim grows stronger. A high average for a director is not proof of stable future compatibility; exposure to Crime/Horror/Thriller is not measured psychological darkness; repeated directors do not by themselves establish admiration; runtime does not measure pacing. The constellation is an exploratory map of encoded attributes, not a discovered objective taxonomy of personal taste. Current recommendation scores and novelty controls can help exploration, but their accuracy has not been established for this owner.

Treat **genre synergy, the five-star formula's invalid comparisons, unqualified model superiority, several rewatch/personality statements and high-confidence missing-data scores as unsupported until repaired**. The intelligence report identifies exact code and counterexamples rather than asking the user to distrust every number equally.

## What would differentiate an exceptional version?

The differentiator should be **personal insight that can show its evidence, admit uncertainty and help choose a rewarding unfamiliar film**. Many products can count genres or place posters on a map. A stronger CINEMA DNA could answer: “You repeatedly praise controlled tension, but only when character motivation remains legible; here are the passages and films supporting that, here is a counterexample, and here are three unfamiliar candidates with different confidence levels.” That example describes a future capability, not a finding about this owner.

The architecture for that experience is practical: immutable source events; verified identities and field provenance; versioned features; typed observed/estimated/hypothesized claims; independently evaluated retrieval and ranking; diverse recommendation sets; and explanations grounded in several actual films or review passages. A language model may help extract aspects or phrase verified claims, but must not invent their statistical basis. Private review processing should remain local unless explicitly authorized otherwise.

The interface can become an interactive film museum through a clear journey: **portrait → explore relationships → choose a film**. Keep the immersive editorial entrance, offer consistent evidence drawers and accessible list alternatives, and make the recommendation room a place to act. The design report evaluates the requested ideas and proposes additional experiments, including a tonight-specific viewing contract, a double-feature program, an expectation notebook, a separate rewatch lane, finite personal seasons and optional blind discovery cards. The roadmap selects a few rather than treating every idea as a commitment.

## Recommended next development authorization

Authorize **Phase 1: trustworthy data, claims and access** as a separate engineering session. A coordinator first freezes the shared schema/status interfaces. Then use three isolated worktrees for (A) import/identity/refresh, (B) analytical validity and recommendation explanations, and (C) runtime validation/accessibility/print. Integrate through focused regression fixtures and the existing gates. Exact ownership, dependencies and acceptance criteria are in [IMPLEMENTATION_ROADMAP.md](IMPLEMENTATION_ROADMAP.md).

That phase is finished when ordinary partial data cannot crash analysis; all comparison and explanation counterexamples pass; unknown fields cannot imply confident negative preferences; incremental offline refresh preserves known metadata; all candidate sources honor watched identity; and the core UI remains usable by keyboard, on mobile and in print. Only then should the next phase claim improvements in recommendation accuracy through independent evaluation.

**This audit did not begin that implementation.** Application source and the dependency lockfile are unchanged, and the source `main` branch is untouched. The audit adds documentation and synthetic evidence on a separate branch as the handoff for the next session.

## Report set

- [TECHNICAL_AUDIT.md](TECHNICAL_AUDIT.md): architecture, ingestion, matching, persistence, runtime, security, performance, tests and reproduction.
- [TASTE_INTELLIGENCE_AUDIT.md](TASTE_INTELLIGENCE_AUDIT.md): statistical validity, DNA, recommendations, evaluation design, uncertainty and improved intelligence architecture.
- [DESIGN_UX_AUDIT.md](DESIGN_UX_AUDIT.md): observed screenshots, chapter-by-chapter design, interaction, accessibility and product opportunities.
- [IMPLEMENTATION_ROADMAP.md](IMPLEMENTATION_ROADMAP.md): canonical priorities, worktree ownership, phases, dependencies and measurable acceptance criteria.
