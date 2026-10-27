# Reproducing the intelligence audit

Audited application commit: `b7a732a5b076858f5cee92da0c9408dded0823a0` (`main`), 2026-10-26.

`probes.mts.txt` is an isolated executable probe stored as text. It imports the application’s actual analysis functions and constructs all films, ratings, diary events and metadata in memory. It does not read an export, modify application files, write `public/data/`, or use a live movie service. Discovery is disabled on each analysis call; `fetch` is blocked as an additional guard. The only write is the explicit result path supplied on the command line.

## Run

Use the audit documentation branch, which contains this probe while leaving application source at `b7a732a5b076858f5cee92da0c9408dded0823a0`, with the locked dependencies installed. The replay was tested on **Node 24.22.1**; another runtime must satisfy the locked dependency versions' requirements, not merely the README's broad Node 22 floor. From that checkout’s repository root:

```bash
CINEMA_AUDIT_TMP="$(mktemp -d)"
cp docs/audit-evidence/reproduction/intelligence/probes.mts.txt "$CINEMA_AUDIT_TMP/probes.mts"
node --import tsx "$CINEMA_AUDIT_TMP/probes.mts" "$PWD" "$CINEMA_AUDIT_TMP/probe-results.json"
```

The result is printed and saved under the temporary directory. Keep that directory if you want to inspect it; removing it later does not affect the repository. The stored observations are in [probe-results.json](../../results/intelligence/probe-results.json). Compare semantic values rather than stack paths or timestamps. Application fixes can intentionally change these observations; this audit does not assert that a corrected implementation must retain a defect.

Run this against application source matching the commit above to reproduce the audited behavior. A pristine checkout of that source commit does not contain the later audit documentation: copy `probes.mts.txt` from the audit documentation branch into a temporary directory, then pass the pristine checkout's absolute path as `REPOSITORY_ROOT` to the same command. A checkout containing newer application code measures that newer code instead. The text-file extension keeps this harness outside the application’s TypeScript, ESLint and Vitest inputs.

## Scenario map

All scenarios are synthetic. No result measures the owner’s cinematic taste or recommendation satisfaction.

| JSON key | Controlled input / check | Observed result at the audited commit |
|---|---|---|
| `harshGrader` | Twenty ratings alternating 1 and 2 | Mean 1.5★, but report calls 3★ below average and describes warm grading |
| `fallingRewatches` | Four 5→1★ diary-rating pairs; current rewatch ratings 1★ | Correct falling counts coexist with prose claiming rewatches raise stars and are top-tier |
| `singleRuntimeBucket` | Five 5★ films with 160-minute runtime; fifteen 1★ films with unknown runtime | `TypeError` at `pipeline/analyze/insights.ts:128` |
| `centeredExplanations` | Ten Horror films at 1★; thirty Drama films at 5★ | Drama candidate gets a positive Horror explanation; unknown-metadata candidate predicts 3.06★ against 4★ baseline while claiming average-only |
| `genreSynergy` | Five Comedy+Horror films at 5★; forty-five Drama films at 0.5★ | +0.19★ “synergy” despite no Comedy-only or Horror-only observations |
| `emptyComparisonGroup` | Six 5★ Dramas; no <=3.5★ films | Claims Drama markedly more common at the top versus an empty group |
| `mostWatchedDirector` | Three rated films by one director; ten unrated watched films by another | Calls the three-film director most-watched |
| `lexicon` | Negation and mixed-tone text | `not good` positive; `not bad` negative; `slow but loved it` neutral |
| `binaryLogOdds` | Binary counts 9/10 versus 1/10 with 0.5 pseudocounts | App z≈4.202 versus four-cell independent log-odds approximation ≈2.971 |
| `silhouetteSingletons` | Three orthogonal vectors, labels `[0,1,1]` | Mean silhouette 1/3 instead of 0 under the conventional singleton treatment |
| `sparseMetadataDNA` | Sixty matched records without genre or other feature values | High-confidence zero genre/dark scores despite zero genre coverage; no-review prose contains NaN |
| `coldStartCertainty` | Six constant ratings and a well-matched candidate | Model unavailable, but recommendation `uncertain=false` |
| `modelProse` | Null-signal fit and unavailable constant-rating fit | Baseline tie called a real signal; unavailable fit reports NaN% better |
| `watchlistIdentityExclusion` | Watched and watchlist records share validated QID | Watchlist duplicate survives recommendation exclusion |

## Interpretation boundaries

The 40-film binary-signal experiment is intentionally easy to learn. Its CV error confirms mechanics on that fixture; it is not a forecast of personal recommendation performance. The binary log-odds comparison illustrates the missing complement terms under an independent binary approximation, not a calibrated significance test for the entire film library. The silhouette example evaluates a valid two-cluster partition with one singleton. Other probes establish code counterexamples without estimating their prevalence in real exports.

The harness catches the expected sparse-runtime failure and continues collecting evidence. An unrelated uncaught exception should be investigated before claiming the remaining scenarios completed.
