# Reproduce the engineering audit safely

These documentation-only `.mts.txt` files reproduce findings against **synthetic records**. They do not implement fixes. The original audit ran at commit `b7a732a5b076858f5cee92da0c9408dded0823a0`; the captured results are under [`../../results/engineering/`](../../results/engineering/).

## Isolation is required

The application's paths are derived from the location of `pipeline/paths.ts`, **not** the working directory. Running an absolute path to the original CLI from a temporary working directory can still overwrite the original generated data. The commands below instead archive the audited source into a new temporary directory, excluding untracked/ignored exports, `.env.local`, caches and generated data. Dependencies are linked read-only in intent; the probes do not run an install or change dependencies.

Use an existing installation of the audited lockfile (`node_modules/`); the audit used Node **24.22.1**. If dependencies are absent, install the audited lockfile in a separate source checkout first. Dependency installation contacts the package registry; the probes below do not require external metadata access.

Run these commands from the repository root in Bash:

```bash
set -euo pipefail
cinema_audit_repo="$(git rev-parse --show-toplevel)"
cinema_audit_temp="$(mktemp -d "${TMPDIR:-/tmp}/cinema-dna-reproduce.XXXXXX")"
mkdir -p "$cinema_audit_temp/source" "$cinema_audit_temp/probes" "$cinema_audit_temp/results"
git archive b7a732a5b076858f5cee92da0c9408dded0823a0 | tar -x -C "$cinema_audit_temp/source"
test -d "$cinema_audit_repo/node_modules"
ln -s "$cinema_audit_repo/node_modules" "$cinema_audit_temp/source/node_modules"
for cinema_audit_probe in "$cinema_audit_repo/docs/audit-evidence/reproduction/engineering/"*.mts.txt; do
  cinema_audit_name="$(basename "$cinema_audit_probe" .txt)"
  cp "$cinema_audit_probe" "$cinema_audit_temp/probes/$cinema_audit_name"
done
export CINEMA_DNA_AUDIT_ROOT="$cinema_audit_temp/source"
export CINEMA_DNA_AUDIT_OUTPUT="$cinema_audit_temp/results"
cinema_audit_loader="$CINEMA_DNA_AUDIT_ROOT/node_modules/tsx/dist/loader.mjs"
node --import "$cinema_audit_loader" "$cinema_audit_temp/probes/ingest-probes.mts"
node --import "$cinema_audit_loader" "$cinema_audit_temp/probes/cache-probes.mts"
node --import "$cinema_audit_loader" "$cinema_audit_temp/probes/downstream-probes.mts"
node --expose-gc --import "$cinema_audit_loader" "$cinema_audit_temp/probes/archive-probes.mts"
node --import "$cinema_audit_loader" "$cinema_audit_temp/probes/cli-probes.mts"
printf 'Synthetic audit results: %s\n' "$CINEMA_DNA_AUDIT_OUTPUT"
```

Keep the generated results if useful, then delete only the temporary directory printed by this procedure. Do not use the probes against personal exports.

## What each probe establishes

| Probe | Scope | Expected behavior at the audited commit |
|---|---|---|
| `ingest-probes.mts` | Pure CSV/normalization functions; mocked TMDB search | Invalid rating/date acceptance, extra-field error, ambiguous joins, fallback duplication, confidence edge cases |
| `cache-probes.mts` | Actual enrichment/cache code in a temporary directory; mock initial responses, then offline | Adding one uncached film changes the batch cache key and loses an existing match |
| `downstream-probes.mts` | In-memory analysis with discovery disabled | Five ratings including 99 give a 23★ mean while the histogram counts four; invalid timeline month; unavailable-model prose; HTML strings escaped |
| `archive-probes.mts` | Small bounded ZIP and symlink fixtures | Ignored 16 MiB binary is expanded; directory reader follows a symlink outside the selected folder |
| `cli-probes.mts` | Additional temporary source copy and local network guard | Valid import succeeds with zero requests; bad CSV exits 1 without altering previous outputs; mocked enrichment failure exits 0 |

The cache probe changes `Date.now()` inside its own process to avoid waiting for mocked network rate limits. It never calls a real endpoint. The CLI probe strips optional TMDB/contact settings from its child environment and replaces `fetch` with local stubs. The archive probe deliberately uses only **16 MiB** of uncompressed dummy data; it is not an exhaustion attack. Memory deltas vary by runtime and garbage collection.

These adapted probes are not part of the application's CI suite. Their expected defect outputs should change when a later implementation fixes the corresponding issue. Timestamp-dependent hashes and machine-dependent timings are not pass/fail criteria.
