# CINEMA DNA — Audit status

> **Historical audit.** Synthetic evidence only; application audited at `b7a732a`, with file and line references valid at that commit. Findings do not measure the owner's personal recommendation accuracy. The status table below tracks the subsequent repairs.

Reports: [Executive audit](EXECUTIVE_AUDIT.md), [Technical audit](TECHNICAL_AUDIT.md), [Taste intelligence audit](TASTE_INTELLIGENCE_AUDIT.md), [Design and UX audit](DESIGN_UX_AUDIT.md), [Implementation roadmap](IMPLEMENTATION_ROADMAP.md). [Evidence guide](audit-evidence/README.md). [Full audit and archived binaries](https://github.com/shaecodes-wilde/cinema-dna/tree/audit-2026-10-26/docs) at `audit-2026-10-26` → `db5aa10`.

## Council verdicts and owner amendments

The owner adopted sequential delivery and amended the council plan. The scoped repairs shipped in #2–#8; broader deferred work remains below.

| Audit item | Council verdict and adopted scope | Delivery PR | Status |
|---|---|---|---|
| Docs merge | Modify: curate reports and text evidence; archive binaries at the tag. | PR0 | shipped in #2 |
| Metrics check | Adopt with owner A4: independently check compact metrics; add defect fixtures with each repair. | PR0b | shipped in #3 |
| R1 analytic validity | Modify: guard empty comparisons, use genre-known pools and fix pair semantics; defer availability schema. | PR1, PR4 | shipped in #4, #7 |
| R2 claims/explanations | Modify: directional prose, model gates, CV labels and present-feature reasons/caveats; reject claim registry for now. | PR1, PR2 | shipped in #4, #5 |
| R3 refresh/snapshots | Adopt core: offline preservation, override precedence, backup, atomic writes and failure exit; add owner A1 publish guard; defer snapshots. | PR3 (#6) | partial (offline + A1 publish guard) |
| R4 identity/exclusion | Modify: exclude watched watchlist candidates by QID; defer identity service. | PR5 | shipped in #8 |
| R5 ingest validation | Modify: validate ratings/dates and report CSV errors; defer ambiguity rework and precision corpus. | PR5 | shipped in #8 |
| R6 runtime/a11y | Adopt core: bundle recovery, drawer focus, print, contrast, poster fallback and mobile nav names. | PR2 | shipped in #5 |
| R7 evaluation | Defer evaluation until real data; disclose development CV limits now. | — (labels: PR1, PR2) | deferred |
| R8 feedback | Defer: needs owner intent, storage and UI. | — | deferred |
| R9 constellation/people | Modify: deduplicate traits and say “most-rated”; reject neighbour wording change and defer layout. | PR1 | shipped in #4 |
| R10 privacy/hosting | Modify: correct upload wording and Node engines; defer hosting and archive limits. | PR2, PR5 | shipped in #5, #8 |
| R11 performance | Reject for now: no measured bottleneck. | — | not planned |
| R12 review intelligence | Defer: needs labelled private data. | — | deferred |
| Phase 0 orchestration | Modify: retain an audited-commit baseline note and add the compact metrics check. | PR0, PR0b | shipped in #2, #3 |
| Phase 1 orchestration | Modify: sequential PRs replace coordinator, schema freeze and three-worktree orchestration. | PR1–PR5 | shipped in #4, #5, #6, #7, #8 |
| Phase 2 orchestration | Defer evaluation and feedback until real data and owner intent. | — | deferred |
| Phase 3 orchestration | Modify: adopt accessibility; defer remaining polish. | PR2 | shipped in #5 |
| Phase 4 orchestration | Defer experiments until local validation. | — | deferred |

## PR delivery sequence

1. **PR0 — docs (shipped in #2):** preserved the historical audit and recorded the adopted sequence here.
2. **PR0b — metrics check (shipped in #3):** independently checked counts, rating statistics, representative shrunk means/intervals and evidence film IDs. Targeted defect fixtures accompany each repair; no full-prose, timestamp or constellation-coordinate snapshots.
3. **PR1 — analytic truth (shipped in #4):** guarded unsupported claims and empty comparisons; fixed DNA denominators, directional prose, reasons and caveats. Described reasons as “selected supporting factors” and corrected the misleading average-only fallback text (owner A3).
4. **PR2 — UI recovery/a11y/model labels (shipped in #5):** added recovery from invalid bundles, improved keyboard/print access and labelled development CV estimates honestly.
5. **PR3 — offline refresh + publish guard (shipped in #6):** preserved prior matches and explicit override choices, added a backup and atomic writes. Refused publication when a detected source failure would drop existing metadata; reported a degraded refresh (owner A1). Tested first-run, repeat-run, override and write/source failure cases (owner A2).
6. **PR4 — genre pairs (shipped in #7):** showed joint-tag “lift vs your average” across calculations, prose and UI.
7. **PR5 — watched exclusion + CSV validation + Node engines (shipped in #8):** excluded watched QIDs, validated ratings/dates and surfaced CSV errors. Set engines to `^22.22.2 || ^24.15.0 || >=26`.
8. **#9 — pre-merge review fixes:** closes the remaining scoped rewatch, narrative, offline overlay, refresh diagnostic, override and CSV issues, and updates the documentation.

## Corrections to the audit's wording

- Ambiguous joins use first-wins resolution despite a recorded conflict (`pipeline/ingest/normalize.ts:103-131` at `b7a732a`).
- The feature vocabulary is built before the CV folds, with an unmeasured effect.
- λ is selected and reported on the same folds (selection optimism, magnitude unknown).

## Deferred backlog

Claim registry, availability model, snapshots, R7 evaluation, R8 feedback, R12 review intelligence and broader online-refresh preservation remain a future backlog. Revisit after local validation on the real export. PR3 shipped the owner A1 publish guard in #6; broader online preservation remains deferred.

## Not established

Personal recommendation quality: synthetic evidence only. No personal export was assessed.
