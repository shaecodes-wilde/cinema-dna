# CINEMA DNA

A personal, local-first taste atlas built from a Letterboxd data export: a reusable ingestion + analysis
pipeline and an interactive, editorial-style dashboard that explains *why* you rate films the way you do.

Everything runs on your machine. Your export, the normalized dataset, caches, the generated dashboard data
and reports are all git-ignored and never leave your computer (the only network calls are optional
metadata lookups to Wikidata and, if you enable it, TMDB).

```
data/raw/letterboxd-*.zip ──ingest──▶ data/normalized/dataset.json   (typed, with provenance + audit)
                          ──enrich──▶ data/normalized/metadata.json  (Wikidata [+ TMDB], cached)
                          ──analyze─▶ public/data/cinema-dna.json    (dashboard bundle)
                                      reports/taste-analysis.md      (full written analysis)
                                      reports/cinema-dna-report.{html,md}  (downloadable identity report)
```

## Use it with an agent

The easiest way in: clone the repo, open it in Claude Code (or Codex, Cursor, any coding agent) and say

> Here's my Letterboxd export: `~/Downloads/letterboxd-<you>-<date>-utc.zip`. Run CINEMA DNA on it.

The repo ships agent instructions (`AGENTS.md`, plus a Claude Code skill in `.claude/skills/cinema-dna/`) that
tell the agent how to install, import your export, start the dashboard, summarise your results and answer
follow-up questions ("what should I watch next?", "rate my taste") from the generated analysis without
inventing data or publishing it anywhere.

Don't have an export yet? Letterboxd → **Settings → Data → Export your data**.

## Quick start (by hand)

Requires Node 22.22.2+ (22.x), 24.15.0+ (24.x) or 26+ (CI uses 24).

```bash
git clone https://github.com/shaecodes-wilde/cinema-dna && cd cinema-dna
npm install
npm run import -- ~/Downloads/letterboxd-<you>-<date>-utc.zip   # copies it into data/raw/, then ingest → enrich → analyze
npm run dev                                                    # open http://localhost:5173
```

The first run takes a few minutes: film metadata comes from Wikidata, which is queried slowly and cached.

`npm run build && npm run preview` serves a production build. Note that `dist/` then contains your personal
analysis bundle (copied from `public/data/`), so treat it as private — don't deploy it publicly. The dashboard reads
`public/data/cinema-dna.json`; if it is missing you get instructions instead of an empty page.

## Refreshing with a newer export

Run `npm run import -- <new zip>` (or drop it into `data/raw/` — the newest file wins — and run
`npm run refresh`). Metadata lookups are cached in `data/cache/`; offline refreshes keep previous
matches, while online refreshes may re-query existing films. Original files are never modified.

| Command | What it does |
|---|---|
| `npm run import -- <zip>` | Copy an export into `data/raw/`, then run everything |
| `npm run ingest` | Parse the export → `data/normalized/dataset.json` + audit |
| `npm run enrich` | Match films on Wikidata (and TMDB if configured) → `metadata.json` |
| `npm run analyze` | Compute the taste analysis, recommendations and reports |
| `npm run refresh` | All three |
| `… -- --offline` | Use caches only, no network |
| `… analyze -- --no-discover` | Skip the Wikidata discovery pool (watchlist recommendations only) |

### Optional configuration (`.env.local`, git-ignored — see `.env.example`)

- `TMDB_API_KEY` (or `TMDB_READ_ACCESS_TOKEN`): adds **posters**, overviews, keywords and billing-ordered cast.
  Without it the dashboard uses typographic title cards. Re-run `npm run enrich && npm run analyze` after setting it.
- `CINEMA_DNA_CONTACT`: a URL or email added to the Wikimedia User-Agent, which moves requests into
  Wikimedia's higher rate-limit tier. Without it the client stays deliberately slow (one request every 2.5 s).

### Fixing a metadata match

Copy `data/overrides.example.json` to `data/overrides.json` (git-ignored) and map a film id (`lb:<boxd.it code>`, shown
in the explorer/film dossier) to a Wikidata QID, or to `null` to force "no match". Re-run `npm run enrich`.

## What the pipeline does

**Ingest** (`pipeline/ingest/`) reads the zip (or an extracted folder) and builds one normalized,
typed model (`shared/types.ts`):

- Film identity is anchored on the film's `boxd.it` code from `watched.csv`, `ratings.csv`, `likes/films.csv`,
  `watchlist.csv` and lists. Diary and review rows carry *entry* codes, so they are joined on (title, year);
  same-title remakes (e.g. *A Star Is Born* 1976 vs 2018) stay separate.
- **Watched ≠ viewed.** `watched.csv` dates are when a film was *marked* watched; only diary rows are viewings.
  Diary dates before your join date are flagged `backfilled` (or `approximate` if set to Jan 1) and excluded
  from timeline charts.
- Current ratings come from `ratings.csv`; per-viewing diary ratings are kept as history, and disagreements
  are reported as rating revisions.
- Orphaned/deleted rows (content Letterboxd couldn't link to a film, e.g. TV events) are kept in a separate
  `detached` collection and never counted as viewing history.
- An audit records rows per file, linked/unlinked rows, missing fields, identity conflicts and date quality.

**Enrich** (`pipeline/enrich/`) matches films on Wikidata, first by Letterboxd film ID (property P6127, with
Letterboxd-style slug candidates), then by exact title/alias + year among film items, then by entity search,
always requiring year agreement within ±1. Every match records its method and confidence. Results include
genres (normalised to an 18-genre vocabulary plus finer sub-genres), directors, writers, cast,
cinematographers, composers, countries, languages, series, awards/nominations, runtime and a notability
proxy (number of Wikipedia editions). TV series that Letterboxd lists are flagged.

**Analyze** (`pipeline/analyze/`):

- *Affinities* — empirical-Bayes shrunk averages per genre, decade, runtime, region, person, etc.
  (k pseudo-films pulled toward your mean, so a single 5★ film can't crown a genre), with 90% intervals and
  confidence labels.
- *Cinematic DNA* — 12 transparent dimensions (definitions in the UI), each with exposure and rating lift.
- *Insights* — the Phase-3 investigations (hidden favourites, contradictions, five-star formula,
  disappointments, evolution, director loyalty, rewatch drift, below-the-line crew, genre overlaps (lift vs your average),
  watchlist psychology, review language, model exceptions, defining films), each with sample size,
  confidence, evidence type and the films behind it. Insights are emitted only when the data supports them.
- *Taste model* — ridge regression over film attributes plus leave-one-out "track record" of the film's
  people, λ by 10-fold CV; reported honestly against a constant baseline.
- *Constellation* — weighted attribute vectors → cosine distance → seeded UMAP; k-means clusters labelled by
  over-represented traits. Proximity means shared verified attributes only.
- *Recommendations* — your released watchlist plus a discovery pool of real films from Wikidata (other work by
  people you rate above baseline, plus major-award nominees), scored by the taste model, with reasons,
  "because you liked" films, novelty, moods and uncertainty flags. Watchlist picks exclude films watched
  under another record with the same Wikidata ID; discovery also skips known titles.
- *Narrative* — the identity title, opening editorial and identity report are generated from the computed
  evidence; every sentence is conditional on the numbers that justify it.

## The dashboard

`src/` — React 19 + TypeScript + Tailwind v4 + D3 + Motion. Chapters: 01 Opening · 02 Taste DNA ·
03 Genre Universe · 04 Timeline · 05 Directors (and other creative roles) · 06 Constellation ·
07 Five-Star Universe · 08 Critical Analysis · 09 Next favourite · 10 Identity report · Film explorer ·
Data quality. Any film opens a dossier drawer; genres, people and years drill into the explorer.
Respects `prefers-reduced-motion`; keyboard-navigable; fonts are self-hosted.

## Development

```bash
npm test            # vitest (parsing, joins, date semantics, matching, stats, model, recommendations, e2e)
npm run lint
npm run typecheck
npm run build
```

Synthetic fixtures live in `pipeline/test/fixtures.ts`; tests never touch your real data or the network.

## Known limitations

- Letterboxd's export has no genres/cast/runtime, so those depend on Wikidata coverage. Documentaries,
  TV specials and very new releases are the most likely to be unmatched (listed on the Data quality panel).
- Without TMDB there are no posters (typographic cards are used instead) and no plot keywords, so thematic
  analysis relies on your review text and Wikidata genres/subjects.
- Wikidata cast lists are unordered, so cast-based signals use everyone credited rather than top billing.
- Review-language analysis uses transparent lexicons on short reviews: treat it as tendency, not diagnosis.
- With a few hundred ratings, most person-level and small-group findings are "low confidence" by design.
- All patterns are correlations within your own history; none is a causal claim.
- You need at least 5 rated films for the dashboard and 20 (with some variety) for the taste model; below that the
  app says so instead of showing empty statistics.
- People are identified by name, so two different people who share a name are merged.
- The timeline only uses diary dates on/after your join date. If you imported older history from IMDb/Trakt, most of it
  is treated as backfilled.
- Very large libraries work (a 4,000-film map builds in under a minute) but the first Wikidata enrichment is slow
  because unmatched titles are searched one at a time at a polite rate.
- Wikidata content is CC0. TMDB use, if enabled, is subject to TMDB's terms ("This product uses the TMDB API but
  is not endorsed or certified by TMDB."). Not affiliated with Letterboxd.

## License

MIT. Your Letterboxd data is yours; nothing in this repo collects or transmits it.
