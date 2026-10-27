# Historical audit evidence

> **Historical audit.** Synthetic evidence only. Application audited at `b7a732a`; file and line references are valid at that commit. Findings are not measurements of the owner's personal recommendation accuracy. This document ships no fixes. Current status and the adopted repair sequence: [AUDIT_STATUS.md](../AUDIT_STATUS.md). Screenshots and PDFs are archived at tag [`audit-2026-10-26`](https://github.com/shaecodes-wilde/cinema-dna/tree/audit-2026-10-26/docs).

This folder retains the original audit manifest, synthetic text/JSON/log results and portable reproduction guides. The manifest keeps original audit byte counts and hashes; its availability fields and curation note describe this curated copy. Current verdicts and the repair sequence are in [AUDIT_STATUS.md](../AUDIT_STATUS.md).

The full audit is archived at [`audit-2026-10-26`](https://github.com/shaecodes-wilde/cinema-dna/tree/audit-2026-10-26/docs) (`db5aa10`). These 18 binaries (16 PNGs and 2 PDFs) are available there:

- [audit-evidence/results/ux/print-unvisited.pdf](https://github.com/shaecodes-wilde/cinema-dna/blob/audit-2026-10-26/docs/audit-evidence/results/ux/print-unvisited.pdf)
- [audit-evidence/results/ux/print-visited.pdf](https://github.com/shaecodes-wilde/cinema-dna/blob/audit-2026-10-26/docs/audit-evidence/results/ux/print-visited.pdf)
- [audit-evidence/screenshots/desktop-constellation.png](https://github.com/shaecodes-wilde/cinema-dna/blob/audit-2026-10-26/docs/audit-evidence/screenshots/desktop-constellation.png)
- [audit-evidence/screenshots/desktop-directors.png](https://github.com/shaecodes-wilde/cinema-dna/blob/audit-2026-10-26/docs/audit-evidence/screenshots/desktop-directors.png)
- [audit-evidence/screenshots/desktop-dna.png](https://github.com/shaecodes-wilde/cinema-dna/blob/audit-2026-10-26/docs/audit-evidence/screenshots/desktop-dna.png)
- [audit-evidence/screenshots/desktop-five-star.png](https://github.com/shaecodes-wilde/cinema-dna/blob/audit-2026-10-26/docs/audit-evidence/screenshots/desktop-five-star.png)
- [audit-evidence/screenshots/desktop-genres.png](https://github.com/shaecodes-wilde/cinema-dna/blob/audit-2026-10-26/docs/audit-evidence/screenshots/desktop-genres.png)
- [audit-evidence/screenshots/desktop-next.png](https://github.com/shaecodes-wilde/cinema-dna/blob/audit-2026-10-26/docs/audit-evidence/screenshots/desktop-next.png)
- [audit-evidence/screenshots/desktop-opening.png](https://github.com/shaecodes-wilde/cinema-dna/blob/audit-2026-10-26/docs/audit-evidence/screenshots/desktop-opening.png)
- [audit-evidence/screenshots/desktop-quality.png](https://github.com/shaecodes-wilde/cinema-dna/blob/audit-2026-10-26/docs/audit-evidence/screenshots/desktop-quality.png)
- [audit-evidence/screenshots/desktop-timeline.png](https://github.com/shaecodes-wilde/cinema-dna/blob/audit-2026-10-26/docs/audit-evidence/screenshots/desktop-timeline.png)
- [audit-evidence/screenshots/mobile-dna.png](https://github.com/shaecodes-wilde/cinema-dna/blob/audit-2026-10-26/docs/audit-evidence/screenshots/mobile-dna.png)
- [audit-evidence/screenshots/mobile-next.png](https://github.com/shaecodes-wilde/cinema-dna/blob/audit-2026-10-26/docs/audit-evidence/screenshots/mobile-next.png)
- [audit-evidence/screenshots/print-unvisited-1.png](https://github.com/shaecodes-wilde/cinema-dna/blob/audit-2026-10-26/docs/audit-evidence/screenshots/print-unvisited-1.png)
- [audit-evidence/screenshots/print-unvisited-2.png](https://github.com/shaecodes-wilde/cinema-dna/blob/audit-2026-10-26/docs/audit-evidence/screenshots/print-unvisited-2.png)
- [audit-evidence/screenshots/print-visited-1.png](https://github.com/shaecodes-wilde/cinema-dna/blob/audit-2026-10-26/docs/audit-evidence/screenshots/print-visited-1.png)
- [audit-evidence/screenshots/print-visited-2.png](https://github.com/shaecodes-wilde/cinema-dna/blob/audit-2026-10-26/docs/audit-evidence/screenshots/print-visited-2.png)
- [audit-evidence/screenshots/tablet-dna.png](https://github.com/shaecodes-wilde/cinema-dna/blob/audit-2026-10-26/docs/audit-evidence/screenshots/tablet-dna.png)

A tag does not remove objects from the repository; this curation changes clone layout only.

`results/runtime/synthetic-*.json` are invented test inputs for the PR0b metrics check under `pipeline/test/…`, not personal data. The check will use compact independently checked metrics; targeted defect fixtures belong with each repair.
