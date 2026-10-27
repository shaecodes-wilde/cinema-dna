# AGENTS.md — running CINEMA DNA for a user

CINEMA DNA turns a Letterboxd data export (a `letterboxd-<user>-<date>-utc.zip`) into an evidence-based taste
analysis and a local interactive dashboard. These instructions are for coding agents (Claude Code, Codex,
Cursor, …) operating this repo on a user's behalf.

## The happy path

When the user hands you their Letterboxd export:

```bash
npm install                                  # once
npm run import -- /path/to/letterboxd-export.zip
npm run dev                                  # dashboard on http://localhost:5173
```

`npm run import` copies the zip into `data/raw/` (the original is never modified), then runs
ingest → enrich → analyze. The first enrichment takes a few minutes because Wikidata requests are
deliberately rate-limited; re-runs use `data/cache/` and are fast. Then point the user at:

- the dashboard (`npm run dev`, or `npm run build && npm run preview`)
- `reports/taste-analysis.md` — the full written analysis (DNA, every insight with evidence, affinity tables)
- `reports/cinema-dna-report.html` — the printable identity report

If the user doesn't know how to get their export: Letterboxd → Settings → Data → **Export your data**.

### Flags and variants

| Situation | Command |
|---|---|
| No network / sandboxed | `npm run import -- <zip> --offline --no-discover` (analysis runs on export data; metadata-driven parts degrade gracefully) |
| Newer export later | `npm run import -- <new zip>` (offline refreshes keep previous matches; online refreshes may re-query existing films) |
| Re-run analysis only | `npm run analyze` |
| Posters & keywords | user sets `TMDB_API_KEY` in `.env.local` (see `.env.example`), then `npm run enrich && npm run analyze` |
| Faster Wikidata tier | user sets `CINEMA_DNA_CONTACT` (their URL or email) in `.env.local` |
| Wrong film match | add `"lb:<code>": "Q<wikidata id>"` (or `null`) to `data/overrides.json`, re-run `npm run enrich && npm run analyze` |

Never put a user's email or other details into config on their behalf; ask them.

## Answering questions about the user's taste

Read the generated files rather than re-deriving numbers:

- `reports/taste-analysis.md` — start here for narrative questions ("what do I like?", "rate my taste").
- `public/data/cinema-dna.json` — the full bundle, typed by `shared/app-types.ts` (`AppData`):
  `dna`, `insights` (each with `finding`, `stats`, `n`, `confidence`, `filmIds`), `affinities[kind]`
  (shrunk means per genre/director/decade/…), `recommendations` (scored, with `reasons`, `via`, `novelty`,
  `moods`, `source: watchlist | discovery`), `films`, `viewings`, `timeline`, `critical`, `model`.
- `data/normalized/dataset.json` — the normalized export with per-row provenance (`shared/types.ts`).

Ground every claim in these files and quote sample sizes. Be explicit when something is your judgement rather
than the data (e.g. "trippy" picks: the taste model has no notion of mood beyond genre-based tags). Never
invent ratings, viewing dates or film metadata. Recommendations must come from `recommendations` or be
clearly labelled as your own outside suggestions.

## Privacy rules (non-negotiable)

- Everything under `data/raw/`, `data/cache/`, `data/normalized/`, `public/data/`, `reports/` and `dist/` is the
  user's personal data. It is git-ignored; keep it that way. Never commit, upload, paste into issues/PRs or
  deploy it publicly.
- Don't add the user's username, reviews, ratings or screenshots of their dashboard to code, docs, tests or
  commit messages. Tests use synthetic fixtures (`pipeline/test/fixtures.ts`).

## Working on the code

- Stack: TypeScript everywhere. `pipeline/` (Node, run via `tsx`), `src/` (React 19 + Tailwind v4 + D3 + Motion),
  shared types in `shared/`.
- Checks: `npm run typecheck && npm run lint && npm test && npm run build`. Tests never touch the network.
- Wikimedia etiquette: keep requests serial, cached and slow (`pipeline/enrich/http.ts`); honour `Retry-After`.
- Every insight in `pipeline/analyze/insights.ts` must be computed with explicit thresholds and only emitted
  when the data supports it; narrative sentences in `narrative.ts` must be conditional on the numbers.
- Charts follow the palette and rules documented at the top of `src/styles.css` (diverging cool↔warm around the
  user's own mean; ≤ 3 categorical hues; no dual axes; hover tooltips; reduced-motion support).
