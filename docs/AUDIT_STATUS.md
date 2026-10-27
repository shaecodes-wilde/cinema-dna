# CINEMA DNA — Audit status

> **Historical audit.** Synthetic evidence only; application audited at `b7a732a`, with file and line references valid at that commit. Findings do not measure the owner's personal recommendation accuracy. This file records documentation and plans; it does not mean any application fix has shipped.

Reports: [Executive audit](EXECUTIVE_AUDIT.md), [Technical audit](TECHNICAL_AUDIT.md), [Taste intelligence audit](TASTE_INTELLIGENCE_AUDIT.md), [Design and UX audit](DESIGN_UX_AUDIT.md), [Implementation roadmap](IMPLEMENTATION_ROADMAP.md). [Evidence guide](audit-evidence/README.md). [Full audit and archived binaries](https://github.com/shaecodes-wilde/cinema-dna/tree/audit-2026-10-26/docs) at `audit-2026-10-26` → `db5aa10`.

## Council verdicts and owner amendments

The owner adopted sequential delivery and amended the council plan. These are plans, not completed repairs.

| Audit item | Council verdict and adopted scope | Planned PR | Status |
|---|---|---|---|
| Docs merge | Modify: curate reports and text evidence; archive binaries at the tag. | PR0 | done when this merges |
| Metrics check | Adopt with owner A4: independently check compact metrics; add defect fixtures with each repair. | PR0b | planned |
| R1 analytic validity | Modify: guard empty comparisons, use genre-known pools and fix pair semantics; defer availability schema. | PR1, PR4 | planned |
| R2 claims/explanations | Modify: directional prose, model gates, CV labels and present-feature reasons/caveats; reject claim registry for now. | PR1, PR2 | planned |
| R3 refresh/snapshots | Adopt core: offline preservation, override precedence, backup, atomic writes and failure exit; add owner A1 publish guard; defer snapshots. | PR3 | planned — partial (offline; plus owner publish guard A1) |
| R4 identity/exclusion | Modify: exclude watched watchlist candidates by QID; defer identity service. | PR5 | planned |
| R5 ingest validation | Modify: validate ratings/dates and report CSV errors; defer ambiguity rework and precision corpus. | PR5 | planned |
| R6 runtime/a11y | Adopt core: bundle recovery, drawer focus, print, contrast, poster fallback and mobile nav names. | PR2 | planned |
| R7 evaluation | Defer evaluation until real data; disclose development CV limits now. | — (labels: PR1, PR2) | deferred |
| R8 feedback | Defer: needs owner intent, storage and UI. | — | deferred |
| R9 constellation/people | Modify: deduplicate traits and say “most-rated”; reject neighbour wording change and defer layout. | PR1 | planned |
| R10 privacy/hosting | Modify: correct upload wording and Node engines; defer hosting and archive limits. | PR2, PR5 | planned |
| R11 performance | Reject for now: no measured bottleneck. | — | not planned |
| R12 review intelligence | Defer: needs labelled private data. | — | deferred |
| Phase 0 orchestration | Modify: retain an audited-commit baseline note and add the compact metrics check. | PR0, PR0b | planned |
| Phase 1 orchestration | Modify: sequential PRs replace coordinator, schema freeze and three-worktree orchestration. | PR1–PR5 | planned |
| Phase 2 orchestration | Defer evaluation and feedback until real data and owner intent. | — | deferred |
| Phase 3 orchestration | Modify: adopt accessibility; defer remaining polish. | PR2 | planned |
| Phase 4 orchestration | Defer experiments until local validation. | — | deferred |

## Planned PR sequence

1. **PR0 — docs:** preserve the historical audit and record the adopted sequence here.
2. **PR0b — metrics check:** independently check counts, rating statistics, representative shrunk means/intervals and evidence film IDs. Add targeted defect fixtures with each repair; no full-prose, timestamp or constellation-coordinate snapshots. Justify changes to expected values.
3. **PR1 — analytic truth:** guard unsupported claims and empty comparisons; fix DNA denominators, directional prose, reasons and caveats. Describe reasons as “selected supporting factors” and correct the misleading average-only fallback text (owner A3).
4. **PR2 — UI recovery/a11y/model labels:** recover from invalid bundles, improve keyboard/print access and label development CV estimates honestly.
5. **PR3 — offline refresh + publish guard:** preserve prior matches and explicit override choices, keep a backup and write atomically. Refuse to publish when a detected source failure would drop existing metadata; report a degraded refresh (owner A1). Test first-run, repeat-run, override and write/source failure cases (owner A2).
6. **PR4 — genre pairs:** show joint-tag “lift vs your average” across calculations, prose and UI.
7. **PR5 — watched exclusion + CSV validation + Node engines:** exclude watched QIDs, validate ratings/dates and surface CSV errors. Set engines to `^22.22.2 || ^24.15.0 || >=26`.

## Corrections to the audit's wording

- Ambiguous joins use first-wins resolution despite a recorded conflict (`pipeline/ingest/normalize.ts:103-131` at `b7a732a`).
- The feature vocabulary is built before the CV folds, with an unmeasured effect.
- λ is selected and reported on the same folds (selection optimism, magnitude unknown).

## Deferred backlog

Claim registry, availability model, snapshots, R7 evaluation, R8 feedback, R12 review intelligence and broader online-refresh preservation remain a future backlog. Revisit after local validation on the real export. PR3 is planned to include the owner A1 publish guard; broader online preservation remains deferred.

## Not established

Personal recommendation quality: synthetic evidence only. No personal export was assessed.
