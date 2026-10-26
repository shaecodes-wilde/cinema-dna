# CINEMA DNA — Taste Intelligence Audit

> **Historical audit.** Synthetic evidence only. Application audited at `b7a732a`; file and line references are valid at that commit. Findings are not measurements of the owner's personal recommendation accuracy. This document ships no fixes. Current status and the adopted repair sequence: [AUDIT_STATUS.md](AUDIT_STATUS.md). Screenshots and PDFs are archived at tag [`audit-2026-10-26`](https://github.com/shaecodes-wilde/cinema-dna/tree/audit-2026-10-26/docs).

**Audit date:** 2026-10-26. **Source:** `main` at `b7a732a5b076858f5cee92da0c9408dded0823a0`.

**Scope:** independent inspection of `pipeline/analyze/`, associated shared contracts, tests and explanatory UI. No application source was changed. All executable probes in this report use invented synthetic records. The owner’s original personal export and generated private analysis were unavailable. No film metadata lookup or private-data upload was performed. **Personal taste accuracy and personal ranking quality are not assessable from this audit.**

**Evidence:** [synthetic probe results](audit-evidence/results/intelligence/probe-results.json), [independent arithmetic recomputation](audit-evidence/results/runtime/independent-recomputation.json), and the [portable reproduction guide](audit-evidence/reproduction/intelligence/README.md). The probe source is stored as `.mts.txt` so it does not enter application compilation, linting or the test suite. It runs from a temporary directory against the inspected source, uses in-memory synthetic records, disables discovery, blocks `fetch`, and writes its result only to an explicitly selected temporary output path.

**Evidence labels:** findings below are confirmed by executable counterexample or direct code inspection as specified. Possible prevalence in the owner’s data, semantic-model gains, and future recommendation improvement remain unverified. Proposed architectures and acceptance criteria are recommendations, not implemented capabilities.

These probes establish concrete counterexamples to the code's general guarantees. They do **not** establish how often a defect affects the owner's actual library, or whether any particular personal recommendation is good.

## Independent verdict

This is a substantive analytic prototype with several unusually good foundations: distinct film and viewing units, a typed data model, exclusion of low-confidence metadata from analytic records, sample-size shrinkage, genuine model fitting and out-of-fold predictions, explicit metadata coverage, film-level evidence links, real candidate retrieval, and a reproducible attribute-based map. It is substantially more than a poster dashboard.

Its principal intelligence weakness is a gap between computation and interpretation. Numerical calculations often have sensible local logic, but a large amount of editorial text asserts the intended personality even when the numbers disagree. Several uncertainty labels describe sample count or matching certainty rather than uncertainty of the stated conclusion. A few true calculation defects — false genre synergy, absent-feature explanations, missingness treated as absence, and a runtime crash — materially weaken trust. Fixing these precedes embeddings or a language model.

**Personal taste accuracy is unassessed.** The repository does not establish what the owner's actual taste is, and synthetic prediction metrics cannot substitute for a historical personal evaluation.

Scores assess the observed implementation. The consolidated scorecard is in [EXECUTIVE_AUDIT.md](EXECUTIVE_AUDIT.md).

| Category | Score | Reason |
|---|---:|---|
| Statistical validity | 4/10 | Useful shrinkage and fold-local people encoders; false comparison groups, heuristic confidence, unsupported prose and unvalidated performance claims |
| Taste profiling intelligence | 4/10 | Interpretable exposure and rating-lift measures; much of the personality language exceeds measured traits; no validated mood/style extraction |
| Recommendation personalization | 4.5/10 | Methodology only: individual ratings influence a real ridge model; people/content candidates and novelty controls exist; no personal ranking benchmark, limited candidate breadth, identity/explanation defects |
| Accuracy for the owner's taste | Not assessable | Original export, matched metadata and observed recommendation outcomes unavailable |

## What the system actually measures

`buildRecords` joins one film to optional metadata and all viewing events. Current film ratings form the analysis target (`pipeline/analyze/features.ts:98–139`; `pipeline/analyze/index.ts:46–54`). Unrated watched films count in exposure-oriented DNA dimensions but are excluded from affinity tables. Diary ratings are retained for timeline and rewatch analysis. This separation should be preserved.

Affinities use the formula

\[
\hat\mu_g=\frac{\sum_{i\in g}r_i+k\bar r}{n_g+k},\quad
\Delta_g=\hat\mu_g-\bar r.
\]

The prior center is the user's empirical mean, while `k` is manually selected by dimension (`pipeline/analyze/affinity.ts:16–20`, `pipeline/analyze/stats.ts:29–41`). This is reasonable fixed-strength shrinkage, not an estimate of the best regularization strength from the observed distribution of group effects. Do not discard it merely because it is simple. Label its assumptions, separate its uncertainty from matching uncertainty, and validate its calibration before describing confidence as scientifically established.

Independent Python recomputation of 11 core totals and 13 genre groups agreed with the application on a broader synthetic dataset ([arithmetic evidence](audit-evidence/results/runtime/independent-recomputation.json)). A real isolated CLI import of five valid ratings `[5,3,1.5,2.5,4]` also produced mean 3.2, median 3 and sample SD 1.35 with zero network calls; its procedure and evidence are documented in [TECHNICAL_AUDIT.md](TECHNICAL_AUDIT.md). Those checks support basic arithmetic and the offline path. They do not establish the validity of derived psychological claims, matching completeness, or personal recommendation quality.

The model has genres, selected subgenres, release decade, runtime band, region, notability, language/franchise/awards flags, and five aggregated person-track-record features (`pipeline/analyze/model.ts:70–112`). It has **no direct measured pacing, visual style, experimental form, emotional response, plot structure or atmosphere feature**. Review words, TMDB keywords and overviews are not model inputs. Runtime is not pacing; animation is not formal invention; award recognition is not craft; a broad genre is not an emotional texture.

### DNA dimensions and interpretation limits

| Dimension | Actual computation | Credible reading | Limitation |
|---|---|---|---|
| Generosity | Mean stars rescaled from 0.5–5 to 0–100 | Average rating level | Not generosity relative to other viewers or an external norm |
| Opening-Night Energy | First trustworthy logged viewing in release year or next | Logged near-release exposure | Not necessarily first lifetime viewing; negative release lags also qualify |
| Genre Range | Entropy of genre incidences across 18 genres | Spread of recorded genre tags | Multi-tag films contribute multiple incidences; incomplete tags distort range |
| Time Travel | Share of films released before 2000 | Pre-2000 exposure | Fixed year boundary, not a general measure of artistic adventurousness |
| World Cinema | Non-English or production region outside four named countries | A defined geography/language bucket | Country order and co-productions matter; Australia/NZ count as outside despite English-West wording |
| Franchise Gravity | Recorded series membership share | Recorded franchise exposure | Missing franchise membership is treated as no membership |
| Awards Radar | Recorded major-award nomination/win share | Award metadata prevalence | Missing award claims are not demonstrated lack of recognition |
| Auteur Loyalty | Share with a director seen at least twice | Repeated-director exposure | Can grow with library size or franchise watching, without admiration |
| Dark Matter | Horror/Thriller/Crime tag share | Exposure to these genre tags | Does not directly measure darkness, dread or psychological preference |
| Comfort Loop | Rewatch-flagged diary share | Declared rewatch behavior | Rewatch motives are unobserved; missing original viewings do not imply comfort |
| Critic's Voice | Nonempty reviews / diary entries, capped at 100 | Writing activity ratio | Reviews without a diary and missing ratings change units; empty output says NaN words |
| Off the Beaten Path | Share with fewer than 35 Wikidata sitelinks | A notability proxy | Sitelinks are labeled Wikipedia editions; geographic/age/coverage biases remain |

Sources: `pipeline/analyze/dna.ts:28–220`, `pipeline/analyze/features.ts:35–46,78–94,130–138`. These dimensions are mostly exposure descriptors. Several are correlated: release recency with older-film share; auteur repetition with franchises and corpus size; notability with awards and metadata coverage. The system does not estimate redundancy, covariance or stable factor structure. The radar should remain an editorial profile with explicit definitions, not a psychometric instrument or a universal quality scale.

## Confirmed high-priority findings

### INT-01 — P0: narrative makes claims contradicted by the data

**Evidence:** `pipeline/analyze/insights.ts:80–96,99–115,267–283`; `pipeline/analyze/narrative.ts:73–76,92–95,124–125,188–198`; `pipeline/analyze/report.ts:129–139`.

Synthetic counterexamples:

1. Twenty ratings averaging **1.5★** generate a report saying “3★ [is] a below-average grade” and a closing claim that the user grades warmly. No metadata exists, but the subtitle still says ratings follow craft more than labels.
2. Four films whose diary ratings all move **5→1★** generate the correct finding “0 went up…4 went down,” immediately followed by an explanation that returning deepens appreciation. The opening additionally states that rewatches tend to raise stars. The regex in `pipeline/analyze/narrative.ts:94` matches the phrase “up on the later viewing” even when its preceding count is zero.
3. Those four rewatched films average **1★**, versus **3.4★** globally, yet are described as almost entirely top-tier.
4. A null-signal model tying the baseline at **1.023 RMSE**, with correlation **−0.447**, is described as a modest but real signal. An unavailable constant-rating model produces **NaN% better** and the same claim.

Other code-confirmed examples include “You usually agree with the Academy” triggered solely by one disliked Academy-recognized film (`pipeline/analyze/insights.ts:268–275`), a watchlist described as a different person's taste whenever 20 matched watchlist films exist (`pipeline/analyze/insights.ts:434–459`), and a closing personality centered on cinematic scale/ambition regardless of measured support (`pipeline/analyze/narrative.ts:191–194`). Explicit low-confidence tags do not repair factual contradictions.

**Fix:** render factual statements from typed claims with predicates and denominator checks. Every directional sentence must consume an effect with a known direction; each psychological interpretation must be marked as a hypothesis or omitted. Keep factual observation, interpretation and proposed next experiment distinct. Do not introduce an LLM before this contract exists.

**Benefit:** users can trust the editorial experience instead of reverse-engineering whether prose follows evidence. **Complexity:** medium, because multiple outputs share the problem. **Dependencies:** claim schema and ownership across `pipeline/analyze/insights.ts`, `pipeline/analyze/narrative.ts`, `pipeline/analyze/report.ts` and direct frontend copy. **Acceptance:** adversarial positive/negative/zero/empty fixtures produce no reversed claim; unavailable model produces neither numerical error estimates nor superiority language; every comparative clause names a valid population and effect.

### INT-02 — P0: recommendations misstate feature effects and missing-data fallback

**Evidence:** prediction contribution `pipeline/analyze/model.ts:242–251`; text rendering `pipeline/analyze/recommend.ts:193–206`.

Contributions are centered: `w_j * (x_j - colMean_j)`. An absent feature with a negative coefficient yields a positive contribution. The explanation prints the feature name as if it were present.

**Synthetic experiment:** 10 Horror films rated 1★ and 30 Drama films rated 5★, baseline 4★. A Drama-only candidate receives **4.94★**, with reasons including **“Horror: +0.47★ in your taste model.”** It is not Horror. A candidate without metadata receives **3.06★**, while its uncertainty text says prediction uses the average only. It also says Drama pulls ratings down, although the trained Drama coefficient is positive: the penalty actually comes from the absence of the feature in a centered vector.

The toy model's CV RMSE **0.122** vs baseline **1.746** only confirms it can learn a planted binary signal; it is not a personal benchmark.

**Fix:** reasons must store present/absent/unknown state plus the exact attributed term, reference point and evidence. Prefer verified present positive contributors; phrase absence explicitly only when the field is known. For no metadata, use an explicit baseline policy, or explain remaining known predictors such as release decade honestly. Unknown must not be encoded as a known zero without a missingness strategy. People reasons should also respect the learned contribution: they currently prioritize positive historical deltas regardless of the sign of the fitted people coefficient.

**Complexity:** medium. **Dependency:** feature-state and explanation contracts. **Acceptance:** every reason references a known candidate attribute or explicitly stated absence; signed contributions sum to the documented pre-clamp score; absent metadata cannot silently produce a precise nonbaseline “average-only” prediction.

### INT-03 — P0: genre “synergy” can be manufactured by different shrinkage strengths

**Evidence:** `pipeline/analyze/affinity.ts:66–94`, particularly pair `k=5` versus genre `k=6`; `pipeline/analyze/insights.ts:185–205`.

The calculation is `shrunk(A∩B) − max(shrunk(A), shrunk(B))`. Parent groups include intersection films; they are not “A alone” or “B alone.” The narrative says otherwise and mixes the raw intersection mean with a shrunk-effect difference.

**Synthetic experiment:** five films all tagged Comedy+Horror and rated 5★; 45 other films are Drama rated 0.5★. There are **zero** Comedy-only and **zero** Horror-only films. The output says Comedy alone averages **2.79★**, Horror alone **2.79★**, the combination is **5★**, synergy **+0.19★**, and humor makes horror land. The +0.19 is caused entirely by `k=5` vs `k=6` on identical observations (with rounding). No interaction evidence exists.

**Fix:** initially rename this to “joint-tag affinity” and show raw/shrunk values consistently. Only test interaction when A-only, B-only, both and a defined reference group have sufficient support. Use a regularized interaction term or posterior group contrast; expose counts and uncertainty. Control exploratory multiplicity or label all selected combinations as hypotheses.

**Complexity:** small to stop misleading copy, medium for valid interaction inference. **Acceptance:** identical tag sets cannot generate synergy; zero exclusive groups force “insufficient contrast”; no chart calls inclusive parents “alone.”

### INT-04 — P0: unknown metadata becomes high-confidence negative evidence

**Evidence:** `pipeline/analyze/features.ts:103–138`, `pipeline/analyze/dna.ts:14–24,69–82,119–144,165–176,209–220`, `pipeline/analyze/stats.ts:56–59`, `pipeline/analyze/insights.ts:355–395`.

Matched metadata is considered usable even when individual fields are empty. Many proportions divide by all matched films, not records with the relevant field known. A matching-confidence label says nothing about field completeness.

**Synthetic experiment:** 60 high-confidence matched records with empty metadata produce **Genre Range 0, Dark Matter 0, Franchise 0, Awards 0**, all labeled **high confidence**, while the Data Quality result correctly says genre coverage is **0/60**. Zero sitelinks are interpreted as offbeat, yielding **100/high confidence**. A no-review profile also prints “usually NaN words,” because an empty-array mean becomes text (`pipeline/analyze/language.ts:150`, `pipeline/analyze/dna.ts:200–202`).

**Fix:** add field-level states (`known_present`, `known_absent` when defensible, `unknown`) and evidence coverage. Every analytic module declares required fields; every denominator excludes unknowns or exposes a bounded range under missingness. Sparse fields do not support high-confidence population claims. No numeric or textual NaN/Infinity anywhere. Display unavailable DNA dimensions as unavailable, not zero.

**Complexity:** medium-high, shared-schema work. **Acceptance:** deleting genre metadata from a record cannot convert it into a known non-Horror observation; no high-confidence genre conclusion is possible with zero genre coverage; original matched-count and field-coverage differences remain visible.

### INT-05 — P0: valid sparse metadata can crash the entire analysis

**Evidence:** `pipeline/analyze/insights.ts:120–128`.

**Synthetic experiment:** five high-rated films have runtime 160 minutes; 15 low-rated films lack runtimes. The long-runtime group exceeds the positive-lift threshold, but no shorter bucket exists. `lowest.key` throws `TypeError: Cannot read properties of undefined (reading 'key')`. The full `analyze()` call fails before output generation.

**Fix:** treat missing comparison groups as a first-class unavailable state. Show only the supported long-group statistic, or omit the comparative insight. **Complexity:** small. **Acceptance:** known-long-only, known-short-only, all-unknown and empty groups complete without a crash or invented comparator.

### INT-06 — P0: already-watched canonical film can still be recommended from watchlist

**Evidence:** `pipeline/analyze/index.ts:283–288` filters watchlist only by the record's `watched` flag. QID and normalized title/year matching are applied to discovery at `pipeline/analyze/index.ts:311–318`, not to watchlist candidates.

**Synthetic experiment:** watched `lb:X0` and unwatched watchlist `lb:X6` have different titles but the same metadata QID `Q123456`. `lb:X6` is recommended. This is a counterexample to the universal watched-exclusion claim; the actual prevalence of duplicate identities remains unmeasured.

**Fix:** canonicalize identity or perform one watched-exclusion step shared by all candidate sources, with matching confidence and collision handling. **Complexity:** medium; depends on canonical identity contract. **Acceptance:** no candidate sharing a validated identity with a watched film survives any source; uncertain title collisions do not indiscriminately delete distinct films.

## Additional confirmed statistical limitations

### INT-07 — P1: empty comparison groups and exaggerated binary log-odds scores

`pipeline/analyze/insights.ts:352–395` compares top ratings with <=3.5★ ratings but only requires five top films. Six all-5★ Dramas yield **100% vs 0%** and “markedly more common at the top,” despite a comparison group of zero films. `Math.max(midSet.length,1)` prevents division by zero numerically but invents the zero reference proportion.

`pipeline/analyze/stats.ts:97–106` implements a word-frequency log-odds approximation with variance `1/a + 1/b`, then applies it to binary film traits and document presence. For a binary trait, the ordinary independent log-odds variance also includes the two complement-cell terms. At counts 9/10 versus 1/10 with 0.5 pseudocounts, the app returns **z=4.202**, versus **2.971** using the full four-cell approximation. Its large-word-vocabulary approximation is not justified for near-universal binary attributes. Treat these as descriptive ranking scores until properly modeled; require observed comparison cohorts and correct uncertainty.

### INT-08 — P1: confidence and intervals are heuristic, not validated inference

`pipeline/analyze/stats.ts:38–58` uses pooled rating SD divided by sqrt(n+k), a fixed 1.645 multiplier, and n/z cutoffs. These intervals assume a normal noise model and fixed prior center; they are not calibrated to an estimated baseline, correlated film groups, uncertain metadata or multiple exploratory searches. The interval can extend outside the 0.5–5 scale (the pair probe includes a 0.24★ lower bound). A low label with confident “reliably pays off” prose remains overstatement (`pipeline/analyze/insights.ts:287–308`).

Use a declared estimand: historical mean is exactly observed for the rated corpus, whereas a predictive or population preference requires uncertainty. Retain shrinkage, but use bootstrap or hierarchical posterior intervals suited to the claim; present effective distinct-film sample sizes and coverage. Validate with simulation under null and known effects. Do not automatically convert p-values into certainty about a person's taste. Director/crew group counts can double-count co-credited films in insight-level `n` (`pipeline/analyze/insights.ts:324,345`); store both credited occurrences and unique films.

### INT-09 — P1: most-watched directors are actually most-rated directors

`pipeline/analyze/index.ts:53–70` builds all affinities from rated films; `pipeline/analyze/insights.ts:330–346` chooses `mostWatched` from those rows. Synthetic library: Director Rated has 3 rated films; Director Unrated has 10 watched unrated films. The insight calls Director Rated most-watched.

Compute exposure counts from watched films and preference estimates from rated films separately. Preserve the intended watched-versus-loved comparison, but make its two numerators explicit. Test uneven rating coverage, not only complete-rating fixtures.

### INT-10 — P1: temporal conclusions sometimes mix incompatible units

`buildTimeline` correctly uses diary watched dates and event ratings, and keeps repeated events (`pipeline/analyze/timeline.ts:10–38`). However, `src/chapters/timeline/Monthly.tsx:31–37` weights month-level average ratings by **all viewings**, not rated viewings. Example: a month with one rated 5★ event and 99 unrated events, followed by 100 rated 1★ events, renders a combined **3★** rather than **105/101≈1.04★**. Add `ratedViewings` to the aggregate or aggregate raw rating sums/counts.

`releaseLag` uses first trustworthy logged viewing, which can be a rewatch after an excluded backfilled first viewing (`pipeline/analyze/features.ts:143–150`). DNA calls that a first watch. Negative lags satisfy `<=1` in `pipeline/analyze/dna.ts:51`, `pipeline/analyze/timeline.ts:30`, and `pipeline/analyze/insights.ts:364,414`; quarantine metadata/date conflicts and require nonnegative lag for a normal near-release bucket. Missing release years are included in the denominator of monthly first-watch freshness (`pipeline/analyze/timeline.ts:27–37`). `pipeline/analyze/insights.ts:422` labels a mean release year as median.

Pre-account dates may be accurately imported history, not memory. The current exclusion is a policy assumption, not a proven quality judgment. The parser and visible wording are covered in [TECHNICAL_AUDIT.md](TECHNICAL_AUDIT.md) and [DESIGN_UX_AUDIT.md](DESIGN_UX_AUDIT.md). Offer an explicit imported-history policy and audit its consequences before doing taste archaeology.

Two lower-severity semantic inconsistencies should be corrected alongside this work: `pipeline/analyze/dna.ts:226–231` chooses the lower middle observation for even-sized samples while `pipeline/analyze/stats.ts:12–17` uses the usual midpoint, so DNA release-year/lag “median” values follow an undocumented different convention. `pipeline/analyze/timeline.ts:71–74` names its calendar-year lag array `lagDays`; keep units explicit in the contract to prevent future conversion bugs.

### INT-11 — P1: evaluation is useful development CV, not a validated discovery benchmark

Strength: each CV training fold rebuilds its own people index and baseline (`pipeline/analyze/model.ts:175–185`). A test rating does not directly enter the person affinity used to predict it. Training rows exclude their own film from person history. This should be explicitly preserved; it would be inaccurate to claim obvious wholesale target leakage.

Limitations:

- The feature vocabulary/frequency filter is created on all rated films before CV (`pipeline/analyze/model.ts:147,70–88`). This is modest transductive covariate leakage, not held-out-label leakage; the future evaluation should fit it inside each training split.
- Lambda is selected by minimum error on the same CV predictions later reported as performance (`pipeline/analyze/model.ts:195–225`), causing selection optimism. Use outer evaluation with inner tuning or a frozen independently chosen lambda.
- Random folds predict current ratings of known watched films. They do not simulate discovery at a past date, include retrieval recall, or test unfamiliar filmmakers.
- MAE/RMSE/correlation are rating metrics, not ranked recommendation metrics. Candidate coverage, NDCG, relevance, novelty/diversity and calibration are unmeasured.
- `available=true` only requires 20 varying ratings, not improvement over the baseline (`pipeline/analyze/model.ts:143–161`). Ranking still proceeds if the model is tied or worse.
- Recommendation uncertainty concerns metadata/recency, not model error (`pipeline/analyze/recommend.ts:204–210`). A six-rating constant model is unavailable, but a full-metadata candidate has `uncertain=false`.
- UI describes new-candidate scores as cross-validated estimates and displays “typical miss ±MAE” (`src/chapters/Next.tsx:211`). Cross-validation evaluates the procedure on historical films; the final candidate score is a full-data model prediction, and MAE is not a confidence/prediction interval.

Follow the [primary scikit-learn explanation of nested evaluation](https://scikit-learn.org/stable/auto_examples/model_selection/plot_nested_cross_validation_iris.html). Its principle supports the proposed design; no benchmark in that documentation is a CINEMA DNA result.

### INT-12 — P1/P2: discovery retrieves a narrow, popularity-filtered slice

`discoverPool` fetches people-linked films with at least 8 sitelinks, or 25 for cast, and award films with at least 20 sitelinks released from 1960 onward (`pipeline/analyze/recommend.ts:55–85`). It caps candidates at 450 by number of retrieval reasons; equal scores preserve service-return order rather than an explicit stable notability ordering. The comment says genre-positive award nominees, but no genre-affinity parameter or filter exists. The strongest one-film directors can seed retrieval (`pipeline/analyze/index.ts:298–305`), despite sparse evidence.

This is genuine personalization, but it structurally favors connected, well-documented and award-recognized films. Broad low-profile, pre-1960, different-movement/country and first-time-director discoveries have limited admission paths. Exploration in `src/chapters/Next.tsx:27–28,57–69` adds a novelty bonus to already retrieved candidates; it cannot recover films missing from that pool. It also does not diversify a list: twelve novel films can all come from the same director/region.

Keep the novelty control. Add transparent candidate-source quotas and separate an experimental unfamiliar-content channel; evaluate retrieval separately from ranking. Apply maximal marginal relevance or a constrained greedy reranker across director, franchise, region, era and semantic neighborhood. Do not optimize only a one-dimensional notability number; language and documentation biases need coverage slices.

### INT-13 — P2: constellation metrics overstate certainty of structure

`pipeline/analyze/constellation.ts:93–120` appropriately clusters original vectors rather than 2-D UMAP coordinates. This is a strength. The k search starts at `min(5,kMax)`, however, so it excludes k=2–4 for larger libraries without stating that restriction. `pipeline/analyze/constellation.ts:241–245` gives singleton clusters a=0, making their silhouette 1 instead of the conventional zero treatment. Three orthogonal points labeled `[0,1,1]` produce a mean **1/3**; the expected reference mean is **0**.

Dropped singleton features alter vector normalization, not merely computation size (`pipeline/analyze/constellation.ts:57–65`): two films with unique traits can become more similar after those traits disappear. Weights are manually chosen; a 1.4 coordinate creates a squared contribution in a dot product, so do not interpret the displayed ratio as a direct importance ratio. `src/ui/FilmDrawer.tsx:28–36` selects nearest films in 2-D rather than in the underlying metric, which can disagree with real neighborhood structure.

Fix silhouette, allow a smaller/no-structure solution, measure stability over seeds/resampling, compute displayed film neighbors from original vectors, and state that map gaps/cluster labels are exploratory. The [UMAP authors document density distortion and false tears](https://umap-learn.readthedocs.io/en/latest/clustering.html). The map should not become a rating predictor by proximity alone.

### INT-14 — P2: review-language analysis is useful vocabulary evidence, not aspect sentiment

Categories explicitly describe mentions, which is sound (`pipeline/analyze/language.ts:5–22,76–98`). However, lexicon sentiment cannot handle negation or context: synthetic `not good` scores **+0.707**, `not bad` **−0.707**, and `slow but loved it` **0** (`pipeline/analyze/language.ts:55–60`). Mentioning “beautiful” and criticizing a film's look can be conflated; “score” can refer to rating rather than music. Review word statistics use only rated reviews while DNA introduces counts of all nonempty reviews (`pipeline/analyze/language.ts:77,150–151`; `pipeline/analyze/dna.ts:195–203`). Repeated reviews of one film are not independent film evidence.

Keep the lexicon as a transparent baseline. A richer local aspect extractor should output cited text spans, aspect, positive/negative/mixed/unclear sentiment and confidence; allow corrections. Build a manually reviewed synthetic/opted-in validation set with negation, sarcasm, comparisons, spoilers and multilingual text. Do not send private review text to a hosted model without explicit authorization. Only use reviewed aspect evidence to support aesthetic claims; avoid inferred psychological personality.

### Implementation and verification notes for INT-07–14

These estimates concern the scoped fixes, not a complete replacement of the analytic engine. Small means a localized change; medium means coordinated module and test changes; large means a new data/evaluation capability.

| Finding | Expected benefit | Complexity | Dependencies and trade-offs | Objective verification |
|---|---|---|---|---|
| INT-07 — binary comparisons | Stops nonexistent comparison populations from becoming preference claims | Small for guards; medium for corrected inference | Requires a declared binary or word-count model; stronger validity will suppress some impressive-looking results | Empty reference groups yield unavailable comparisons; validated reference calculations agree across boundary counts |
| INT-08 — uncertainty | Makes small-group rankings and confidence understandable | Medium-large | Needs distinct-film counts, field coverage and an explicit estimand; broader intervals may reduce apparent certainty | Simulations assess interval coverage and false-positive behavior; a null dataset does not routinely produce strong preference claims |
| INT-09 — exposure counts | Correctly distinguishes frequent watching from enjoyment | Small-medium | Adds watched/rated counts to shared display contracts; people identity remains a prerequisite | A director with ten unrated watches outranks one with three watches by exposure without gaining a fabricated preference estimate |
| INT-10 — time semantics | Correct rolling averages and comparable historical profiles | Medium | Requires rated-event sums/counts and explicit date policy; genuinely uncertain history stays uncertain | Mixed-rating-coverage example returns 105/101★; negative release lags are flagged; units and median conventions are consistent |
| INT-11 — evaluation | Prevents weak models from masquerading as predictive intelligence | Large | Depends on corrected identities/features and real labeled data; nested evaluation costs more offline compute | Fold-isolation assertions pass, tuning is separate from reported testing, baselines and paired uncertainty are reported, and unqualified models are clearly labeled |
| INT-12 — retrieval/diversity | Surfaces promising unfamiliar films and reduces repetitive lists | Medium-large | Needs candidate catalog/source provenance, identity exclusion and evaluation; novelty can trade off against immediate fit | Measure retrieval coverage and NDCG separately; report director/franchise concentration and novelty at a common relevance threshold |
| INT-13 — map semantics | Preserves useful visual exploration without misleading neighborhood claims | Medium | Original vectors/neighbor IDs must be retained; stability checks add import-time work | Singleton silhouette reference passes, original-space neighbors match their computed similarity, and cluster stability/coverage are recorded |
| INT-14 — review interpretation | Distinguishes praised aesthetics from criticized ones | Medium for transparent fixes; large for validated aspect extraction | Requires a reviewed evaluation set and opt-in private-text processing; richer inference increases compute and validation effort | Evaluate aspect/sentiment agreement, negation and sarcasm cases, quoted-span fidelity, and abstention quality; never infer unsupported traits from absent text |

These changes complement rather than replace the evidence requirements and explicit acceptance criteria attached to INT-01–06.

## Improved intelligence architecture

### 1. Preserve a reproducible evidence spine

Keep raw source data immutable, with stable canonical films and separately identified viewing/review events. Persist the raw record references, source hashes, metadata source/version/retrieval time, match candidates and overrides. Keep identity certainty, field completeness, statistical uncertainty and user feedback separate. Produce an `analysisManifest` with code commit, schema versions, feature definitions, analysis date/cutoff, RNG seed and configuration hashes. Re-running with that manifest must reproduce metrics.

The existing normalized model and film IDs are a strong start. `AppData.source` currently has archive name/date/sources but not the source hash/transform/config lineage (`pipeline/analyze/index.ts:183`); insight evidence is film IDs plus preformatted strings (`shared/app-types.ts:75–103`), insufficient to reconstruct each denominator, exclusion or hypothesis test from the dashboard alone.

### 2. Define feature requirements and missing-data policy before modeling

For each feature declare: semantic definition, required fields, valid values, unknown state, coverage denominator, confidence floor, transform version, eligible population and known confounders. Distinguish field absence in a source from a verified negative fact. Do not treat “has no award claim” as “has no awards.”

Proposed starting policy, to validate rather than canonize:

- Descriptive counts may render at any n if exact numerator/denominator and missing counts are shown.
- Group-affinity estimates can render at small n with shrinkage and an explicit low-evidence state; avoid “reliable” personality prose until interval/coverage support exists.
- Comparative claims require both groups and enough independent films; no complement group means no contrast.
- Mood/style labels from curated metadata or extracted public synopses must indicate source and confidence; broad genre tags alone get “genre-based suggestion,” not measured mood.
- Personal review-derived aspects need supporting quoted spans and an explicit user-editable evidence record.
- No-diary/no-genre/no-review dimensions render “not enough information”; zero is a measured zero only.
- Candidate scoring falls back to a declared baseline or reduced-feature model when required fields are unknown. Use missing indicators or a probabilistic feature treatment learned and evaluated inside folds.

### 3. Use a claim registry, then write narratives

A claim object should contain ID, version, estimand, population/filter, contributing and excluded film/event IDs, numerator/denominator, effect, interval, prior/model settings, confidence reason, metadata coverage and a scope tag (`observed`, `estimated`, `hypothesis`). Text is generated only from valid claims. The statement “prefers a hypnotic pace” needs aspect-specific evidence; it cannot be synthesized from runtime or Mystery exposure.

An optional language model can connect already validated claims into prose, but cannot add statistics or film facts. Each sentence cites claim IDs; a checker rejects unsupported numerals, comparisons or causal/psychological statements. Simple deterministic templates are sufficient for the first phase and cheaper to validate.

### 4. Build complementary candidate channels

Keep released watchlist, known favorite creators and award candidates. Add publicly described content neighbors using genres/themes and, later, public synopsis embeddings. Include an exploration channel spanning unfamiliar countries, eras and movements, plus a user “not interested/already seen/wrong match” feedback store. Identity exclusion and metadata quality filtering happen before all ranking channels merge.

### 5. Compare simple rankers before increasing model complexity

Retain the ridge baseline, add shrinkage-based content affinity and weighted nearest-neighbor rankers, and evaluate each against constant preference and public-popularity baselines. Hybrid score weights should be selected only inside training data. A complex embedding model is worthwhile if it improves held-out ranking and discovery coverage, not because it makes the map prettier.

After relevance scoring, diversify the top set while respecting user intent. A conservative mode can cap same-director/franchise repetitions; an exploration mode can spend a transparent number of slots on uncertain but plausibly rewarding films. Separate “high fit,” “different but promising” and “not enough evidence.” Preserve novelty as a comprehensible control, but calibrate its meaning with actual choices.

### 6. Report uncertainty in the right units

Each recommendation should show identity quality, feature coverage, model qualification, predicted fit band and evidence strength. A global MAE can be disclosed as a retrospective diagnostic, without masquerading as a per-film interval. If the model cannot outperform a baseline reliably, state that personalized predictive ranking is unproven and use safer content explanations/explicit preferences. Calibration uses out-of-sample residuals, not training fit.

### Cost, complexity and privacy trade-offs

These are engineering estimates, not measured cloud bills or performance promises.

| Improvement | Algorithm/complexity | Runtime and ongoing cost | Privacy | Expected quality benefit |
|---|---|---|---|---|
| Claim registry + missingness | Linear aggregation over films/events/features | Low local compute; no API required | Fully local | Largest immediate gain in truthfulness and reproducibility |
| Better shrinkage/intervals | Group aggregates; bootstrap B repeats approximately O(BN) for simple summaries | Moderate import-time local work; cached | Fully local | Honest small-sample comparisons and stability |
| Nested rating/ranking evaluation | Current ridge fit roughly O(np²+p³) per fit; outer folds multiply inner training cost | Background/offline; no work on each UI click | Fully local | Measured proof of improvement and model fallback gates |
| Content k-nearest neighbors | O(CNd) brute-force candidate/history comparison; cache vectors/similarities | Practical small personal libraries; profile before adding a vector database | Public metadata can be fetched; personal preference vector stays local | Strong explainable baseline, more than popularity matching |
| Embedding retrieval | Encode public text once; dense vector storage O(Cd); nearest-neighbor scoring | Local model download and batch compute, or optional metered public-text API | No reviews/ratings need leave the machine; hosted query must not reveal private profile | Theme/style connections beyond exact genre and creator overlap |
| Diverse reranking | Greedy K picks over C candidates, O(KCd) without cached similarity | Low for hundreds/thousands of candidates | Fully local | Less repetitive recommendations without abandoning relevance |
| Local aspect extraction | Batch language-model inference per review; cache by text/model hash | Heavier local CPU/GPU, offline import step | Private reviews remain local | Separates praised/criticized aesthetics and validates nuanced claims |
| Optional cloud narrative | Only validated claim payload; bounded output; cache by evidence hash | Metered only on refresh; budget before enabling | Sending the payload can still expose preferences; explicit opt-in | More fluent personal writing, not improved factual inference by itself |

## Offline recommendation evaluation: what can and cannot be claimed

No genuine personalized ranking evaluation was possible without the original personal ratings/history. Executed synthetic probes verify mechanics and detect errors; they do not produce personal Precision@K, Recall@K or NDCG.

### Phase A: current-profile held-out reconstruction

When the real dataset is available, use repeated grouped outer splits by canonical film identity, with tuning wholly inside training. Freeze all transforms and candidate filters in the training fold; rebuild person indexes, baselines, feature counts, review-derived traits, similarity seeds and discovery seed creators without the held-out target. Reviews of held-out films cannot become user taste features.

Evaluate two tasks separately:

1. **Rating prediction** on all held-out rated films: MAE, RMSE, Spearman correlation and calibration by predicted band, with paired uncertainty versus the training-mean baseline. Include a median baseline and simple shrinkage content model.
2. **Ranking known held-out choices**: rank a common held-out candidate set containing both liked and lower-rated watched films; report NDCG@10/20 using predeclared relevance gains, Precision@10 and Recall@10 for >=4/4.5★ thresholds, with the threshold choice fixed before results. Recall uses only labeled positives in the defined eligible test set. Small test sets require uncertainty and disclose effective K.

This is a **retrospective reconstruction**, not future discovery. Unwatched catalog movies are unknown outcomes, not negative labels. Do not manufacture precision by counting every unobserved movie as disliked or by evaluating only favorite films against random unlabeled negatives. Give popularity/award, genre-affinity, content-neighbor and current-ridge baselines the same candidate universe.

### Phase B: dated backtesting, only if labels support it

A temporal cutoff must respect what was known at the time. Current ratings can have been revised after an old viewing; diary export values may also be editable rather than immutable historical snapshots. A single export often cannot reconstruct an exact past user state. If rating revisions/as-of metadata are unavailable, label the exercise explicitly as an approximate retrospective split rather than historical deployment simulation.

With reliable dated events, use rolling cutoffs, train before cutoff, evaluate first subsequent eligible watches, and group repeated viewings of the same film. Keep pre-account/imported-date policies explicit. Report retrieval hit rate separately: whether the candidate generator could retrieve a withheld favorite at all. Test new-director/new-franchise and low-notability slices, not just continuation of existing favorites.

### Phase C: prospective discovery quality

Log recommendation impression, candidate pool/version, rank, reasons, user choice, already-seen/rejected feedback and subsequent rating locally. Ask a short optional response: “new to me?”, “interested?”, “why?”. Measure watched-and-liked rate among accepted recommendations, discovery/novelty, catalog coverage, director concentration and calibration. For a single user, progress should be judged over meaningful sessions with uncertainty, not a tiny pseudo-A/B test. Acquisition and exposure are selection processes; report conditional outcomes honestly.

Acceptance gates are predeclared: no watched identity leaks; no fabricated explanations; no ranking superiority claim without a held-out comparison; at least one qualified model improves the chosen relevance metric without unacceptable diversity/coverage regressions, or product stays in explicit exploration mode. Numeric gain targets should be set after baseline measurement, not invented during the audit.

## Feature prioritization from the intelligence perspective

High-value near-term: an **evidence inspector** for every claim; confidence-aware director compatibility; robust outlier analysis using qualified out-of-sample residuals; and recommendation explanations connecting several loved films through verified specific features. Taste Archaeology and comparable Taste Fingerprints need trustworthy date semantics and matched time windows first. Review Intelligence needs validated aspect extraction and local privacy controls. “Perfect Movie Formula” should be renamed preference combinations and require genuine contrasts. Cinematic Neighborhoods should preserve original-space relationships and be treated as exploratory. Interactive Taste Interview is promising for uncertainty reduction, using focused comparisons rather than generic favorite-genre questions; test whether answers improve ranking before a large conversational feature.

Five additional original features worth testing, not automatic commitments:

| Feature | Why useful and novel here | Feasibility / cost | Decision |
|---|---|---|---|
| **Evidence sensitivity switch** | Hide one franchise, one prolific director, unmatched films or a rating period and see which conclusions survive; reveals fragile identities | Medium; local cached recomputation; no API | P1/P2 after claim contracts |
| **Taste question ledger** | Show unresolved hypotheses (“Do you like slow pacing, or just this director?”), the films supporting each side, and one discriminating next watch | Medium-high; needs aspect evidence and controlled comparisons | P3 small prototype |
| **Personal double-feature curator** | Pair one familiar anchor with a surprising film sharing a precise creative relationship; explain both shared and contrasting qualities | Medium; use existing content retrieval/diversity | P2 after better candidates |
| **Correction ripple preview** | Before accepting a metadata fix, show exactly which recommendations and claims change | Medium; deterministic lineage and caching | P1/P2, high trust benefit |
| **Mood-to-verdict journal** | Optional post-watch “what worked/what didn't/tonight's context” separates stable preference from session-specific experience | Small UI, medium longitudinal model; local storage | P3 opt-in; collect only useful minimal data |
| **Recommendation debt shelf** | Track repeatedly recommended but ignored films, ask one lightweight reason, and stop monopolizing the list | Small-medium; local feedback store | P1/P2 practical usefulness |

## First coordinated implementation phase (recommendation only)

Authorize the coordinated correctness phase in [IMPLEMENTATION_ROADMAP.md](IMPLEMENTATION_ROADMAP.md), with one coordinator and three isolated worktrees:

| Owner | Scope relevant to this audit | Integration boundary |
|---|---|---|
| Coordinator | Own `shared/types.ts` and `shared/app-types.ts`; approve the evidence and identity contracts; review B’s integration in `pipeline/analyze/index.ts` | Freeze interfaces first; integrate A, B and C sequentially when their dependent interfaces are ready |
| A — ingestion, identity and refresh | Canonical identities, field provenance and metadata refresh correctness | Supply a shared watched-identity exclusion interface and field-availability evidence to B |
| B — analytic truth, explanations and exclusion | Sole owner of `pipeline/analyze/index.ts` with coordinator review; runtime guards; missingness denominators; valid comparison groups; narrative predicates; model-report wording; centered recommendation explanations; all-source watched exclusion | Sequence these changes within this one worktree. Do not create four additional simultaneous owners of the same analysis modules |
| C — UI, runtime and accessibility | Remove direct unsupported UI claims; display unavailable dimensions correctly; use rated-event counts for rolling averages; show prediction qualification and accessible evidence | Consume the coordinator’s contracts and B’s output without independently redefining statistics |

Within B, first add focused regression fixtures for the confirmed counterexamples, then correct aggregation/fallback behavior, then explanation and narrative generation, and finally verify every output surface. Its dedicated fixtures may live in a new test file to avoid concurrent changes to the central fixture module. Each check must protect a real observed failure; avoid tests that merely repeat implementation formulas.

Shared conflict files are `shared/app-types.ts`, `shared/types.ts`, `pipeline/analyze/index.ts`, `pipeline/analyze/features.ts` and any shared fixture module. Assign one owner per file. The coordinator owns shared schema changes; B owns analysis and prose logic; C owns frontend wording and display. Model/ranking evaluation belongs to a subsequent phase once the evidence contract is stable, although baseline capture can be prepared independently. No implementation is authorized or started by this audit.

Preserve the existing deterministic, local-first typed pipeline and the separation of observation from metadata; preserve transparent shrinkage, fold-local people encoders, explicit novelty controls and original-space constellation clustering. The exceptional future product is a cinematic discovery companion that shows what it knows, how it knows it, what remains uncertain and which next film could teach both the user and the model something. It should earn poetic language through reliable evidence.

## Primary method references inspected

- [scikit-learn, nested versus non-nested cross-validation](https://scikit-learn.org/stable/auto_examples/model_selection/plot_nested_cross_validation_iris.html) — explains selection optimism and nested assessment.
- [scikit-learn, silhouette samples](https://scikit-learn.org/stable/modules/generated/sklearn.metrics.silhouette_samples.html) — defines distance-based silhouette and valid label counts.
- [UMAP authors, clustering caveats](https://umap-learn.readthedocs.io/en/latest/clustering.html) — warns that density and apparent cluster separations can be distorted.

All numeric CINEMA DNA results above come from inspected code or the isolated synthetic probe, not those references. Neither tests nor literature verify personal recommendation satisfaction.
