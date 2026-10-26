---
name: cinema-dna
description: Analyse a Letterboxd data export with CINEMA DNA. Use when the user provides or mentions a Letterboxd export zip (letterboxd-*-utc.zip), asks to analyse their Letterboxd/film taste, wants movie recommendations from their Letterboxd history, or asks questions about their CINEMA DNA results.
---

# CINEMA DNA

Follow `AGENTS.md` at the repo root. In short:

1. If there's no export yet, tell the user: Letterboxd → Settings → Data → **Export your data**, then share the zip path.
2. `npm install` (if `node_modules/` is missing), then `npm run import -- <path-to-zip>`.
   - No network? add `--offline --no-discover`.
   - First run takes a few minutes (rate-limited Wikidata enrichment); say so before starting.
3. Start the dashboard with `npm run dev` (run it in the background) and give the user the URL.
4. Summarise the identity title, 4–6 strongest findings (with sample sizes) and a few recommendations by
   reading `reports/taste-analysis.md` and `public/data/cinema-dna.json`.
5. For follow-up questions, answer from those files; label your own judgement as such; never invent data.
6. Never commit or publish anything under `data/`, `public/data/`, `reports/` or `dist/`.
