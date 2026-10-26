# Reproduce the populated dashboard and arithmetic checks

All records in `../../results/runtime/synthetic-*` are invented audit data. Names, reviews, film attributes and ratings are fictional. Do not interpret the fixture's unusually strong fitted association as personal recommendation performance. Its purpose is to populate the actual application's views and independently verify basic calculations.

The audit used application commit `b7a732a5b076858f5cee92da0c9408dded0823a0`, Node 24.22.1, Chromium 134.0.6998.35 and Playwright 1.51.1. Screenshots are actual local captures at 1440×1000, 768×1000 and 390×1000. External browser requests were blocked. The main fixture has no poster URLs; the failed-image test separately substituted a nonexistent loopback URL.

## Independent arithmetic

From the audit documentation branch, which includes the preserved synthetic CSV strings and generated result:

```bash
python docs/audit-evidence/reproduction/runtime/recompute.py.txt docs/audit-evidence/results/runtime
```

This standard-library Python script imports no application functions. It parses the synthetic CSV strings independently, joins known fixture IDs to the invented metadata and compares counts, rating summary, histogram and all 13 genre groups with the preserved dashboard JSON. It prints results and does not modify any file. The metadata itself is a controlled fixture, not independently verified film information. Matching the shrinkage arithmetic does not validate confidence calibration or personality interpretations.

## Open the fixture without touching personal data

Run from the documentation branch with the locked dependencies already installed. This procedure makes a temporary archive of the audited source. Changing shell cwd alone does not isolate the application's CLI paths.

```bash
set -euo pipefail
cinema_audit_repo="$(git rev-parse --show-toplevel)"
cinema_audit_ui="$(mktemp -d "${TMPDIR:-/tmp}/cinema-dna-ui.XXXXXX")"
git archive b7a732a5b076858f5cee92da0c9408dded0823a0 | tar -x -C "$cinema_audit_ui"
test -d "$cinema_audit_repo/node_modules"
ln -s "$cinema_audit_repo/node_modules" "$cinema_audit_ui/node_modules"
mkdir -p "$cinema_audit_ui/public/data"
cp "$cinema_audit_repo/docs/audit-evidence/results/runtime/synthetic-app-data.json" "$cinema_audit_ui/public/data/cinema-dna.json"
cd "$cinema_audit_ui"
npm run dev -- --host 127.0.0.1 --port 5173
```

Use another port if 5173 is occupied. The source archive excludes untracked private exports, caches and local credentials. Do not run enrichment for this fixture. The source JSON is enough to inspect charts, explorer, filters, drawer and report printing. The CLI-generated downloadable HTML file is not included by this minimal UI procedure; use the engineering CLI reproduction to test generated files.

Useful manual checks, matching the captured interaction evidence:

1. Search Explorer for `Amber Tide 01`; clear the search and try an impossible title.
2. Select Drama in Genre Universe, inspect its 57 rated records, then drill to Explorer; note the broader population includes unrated films.
3. Open the first Explorer film. Shift+Tab from Close escapes to the background at the audited commit; Escape closes and restores focus.
4. In Next, select Mind-bending: the fixture's 36 candidates become 14. Try ArrowRight on the Source radio control.
5. Zoom, reset and filter Constellation. These operations worked in the captured run.
6. Open the Report chapter before scrolling through it and use its print action. Compare the exported PDF to one printed after all eight sections have appeared. Inspect rendered pages, not only extracted text or an afterprint screenshot.
7. At 390px and reduced motion, the shelf stops moving but most posters remain outside its clipped viewport. At normal motion, duplicate focusable poster controls exist below an aria-hidden wrapper.

For schema/error reproductions, alter only the temporary copy's bundle or intercept its response: 404 gives instructions; valid JSON `{}` gives a blank page at the audited commit. A nonempty failed poster URL lacks the missing-URL text-card recovery. Restore the synthetic bundle before other checks.

## Scale probe

The preserved performance observation is a single warm-process run per size, repeating the fixture's metadata patterns to reach 1,000 and 4,000 records. It measures offline constellation generation, not browser speed, live enrichment or statistical cluster quality. Hardware and timings are in `../../results/runtime/performance.json`. Repeating those timings exactly is not an acceptance criterion. The technical report recommends production/device measurements before optimizing an unmeasured frontend bottleneck.

## Evidence limitations

The screenshots show synthetic content and ordinary title-card fallbacks, not real poster coverage. A screenshot proves a view rendered; only the named interaction checks establish that a control was exercised. The screenshot manifest distinguishes inspected captures from supplementary captures and excludes the misleading afterprint screen image. Neither this fixture nor the existing automated tests establishes personal metadata precision, real historical recommendation accuracy, live service availability or accessibility across all devices and assistive technology.
