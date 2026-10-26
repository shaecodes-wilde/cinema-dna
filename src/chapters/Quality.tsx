import { useState } from 'react'
import type { DateQuality } from '../../shared/types.ts'
import { useData } from '../lib/data.tsx'
import { pct } from '../lib/format.ts'
import { Chapter, InfoTip, Reveal } from '../ui/primitives.tsx'

const QUALITY_LABEL: Record<DateQuality, { label: string; hint: string }> = {
  live: { label: 'Logged live', hint: 'Logged within 7 days of the watch date.' },
  delayed: { label: 'Logged later', hint: 'Logged more than 7 days after the watch date; the date is still yours.' },
  backfilled: { label: 'Backfilled', hint: 'Watch date precedes your account — logged from memory. Excluded from timelines.' },
  approximate: { label: 'Approximate', hint: 'Backfilled and set to 1 January — almost certainly a placeholder year. Excluded from timelines.' },
  missing: { label: 'No date', hint: 'Diary entry without a watch date.' },
}

function Bar({ share, muted = false }: { share: number; muted?: boolean }) {
  return (
    <span className="block h-1.5 w-full overflow-hidden rounded-full bg-line" aria-hidden>
      <span className={`block h-full rounded-full ${muted ? 'bg-ink-2/50' : 'bg-ink-2'}`} style={{ width: `${Math.max(share * 100, share > 0 ? 1 : 0)}%` }} />
    </span>
  )
}

/** § — Data quality & provenance: what was read, what was linked, what is missing. */
export function Quality() {
  const { data } = useData()
  const { audit, metadata, notes } = data.quality
  const c = audit.counts
  const [showConflicts, setShowConflicts] = useState(false)
  const viewingsTotal = Object.values(c.viewingsByDateQuality).reduce((a, b) => a + b, 0)
  const confTotal = Object.values(metadata.byConfidence).reduce((a, b) => a + b, 0)

  return (
    <Chapter
      id="quality"
      number="§"
      title="Data Quality & Provenance"
      kicker="Show your work"
      intro={
        <>
          Every number on this page is reproducible from your export. Here is exactly what was read, how records were linked, which fields are missing, and where the film metadata came from. Your
          archive was read locally and never modified.
        </>
      }
    >
      <div className="space-y-16">
        <Reveal>
          <div className="grid gap-x-8 gap-y-6 sm:grid-cols-3 lg:grid-cols-6">
            {[
              ['Films (all sources)', c.films],
              ['Watched', c.watchedFilms],
              ['Rated', c.ratedFilms],
              ['Diary viewings', c.diaryViewings],
              ['Reviews', c.reviews],
              ['Watched, no diary entry', c.watchedWithoutDiary],
              ['Rewatch entries', c.rewatchViewings],
              ['Watchlist', c.watchlistFilms],
              ['Liked', c.likedFilms],
              ['Lists', c.lists],
              ['Rating revisions', c.ratingRevisions],
              ['Orphaned / deleted', c.detachedEntries],
            ].map(([label, v]) => (
              <div key={label} className="border-t hairline pt-3">
                <div className="num text-2xl">{v}</div>
                <div className="label mt-1">{label}</div>
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal>
          <div className="grid gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
            <div>
              <h3 className="display mb-4 text-3xl">Records processed</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-line-2 text-left">
                      {['File', 'Rows', 'Linked', 'Unlinked', 'Missing fields'].map((h, i) => (
                        <th key={h} scope="col" className={`label py-2 pr-4 font-normal ${i > 0 && i < 4 ? 'text-right' : ''}`}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {audit.files.map((f) => (
                      <tr key={f.file} className="border-b hairline">
                        <td className="num py-2 pr-4 text-[12px] text-ink">{f.file}</td>
                        <td className="num py-2 pr-4 text-right text-ink-2">{f.rows}</td>
                        <td className="num py-2 pr-4 text-right text-ink-2">{f.linked}</td>
                        <td className={`num py-2 pr-4 text-right ${f.unlinked ? 'text-ember' : 'text-faint'}`}>{f.unlinked}</td>
                        <td className="py-2 pr-4 text-[12px] text-muted">
                          {Object.keys(f.missing).length ? Object.entries(f.missing).map(([k, n]) => `${k}: ${n}`).join(', ') : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-[12px] text-muted">
                Orphaned rows are entries Letterboxd exported without a film link (e.g. TV events). They are kept in the normalized dataset but excluded from all film statistics.
              </p>
            </div>
            <div className="space-y-10">
              <div>
                <h3 className="display mb-4 text-3xl">
                  Watch-date quality
                  <InfoTip>A film being marked "watched" is not a viewing; only diary entries are. Each diary entry's watch date is classified by how it was logged.</InfoTip>
                </h3>
                <dl className="space-y-3">
                  {(Object.keys(QUALITY_LABEL) as DateQuality[]).map((q) => {
                    const n = c.viewingsByDateQuality[q] ?? 0
                    return (
                      <div key={q} className="grid grid-cols-[130px_1fr_64px] items-center gap-3 text-[13px]" title={QUALITY_LABEL[q].hint}>
                        <dt className="text-ink-2">{QUALITY_LABEL[q].label}</dt>
                        <dd>
                          <Bar share={viewingsTotal ? n / viewingsTotal : 0} muted={q !== 'live' && q !== 'delayed'} />
                        </dd>
                        <dd className="num text-right text-ink">{n}</dd>
                      </div>
                    )
                  })}
                </dl>
              </div>
              <div>
                <h3 className="display mb-4 text-3xl">Metadata coverage</h3>
                <p className="mb-4 text-[13px] text-ink-2">
                  {metadata.watchedMatched} of {metadata.watchedTotal} watched films ({pct(metadata.watchedMatched / Math.max(metadata.watchedTotal, 1))}) matched; {metadata.matched} of{' '}
                  {metadata.total} films overall.{' '}
                  {Object.entries(metadata.byConfidence)
                    .map(([k, n]) => `${n} ${k}-confidence (${pct(n / Math.max(confTotal, 1))})`)
                    .join(', ')}
                  .
                </p>
                <dl className="space-y-2.5">
                  {metadata.fieldCoverage.map((f) => (
                    <div key={f.field} className="grid grid-cols-[130px_1fr_64px] items-center gap-3 text-[13px]">
                      <dt className="text-ink-2">{f.field}</dt>
                      <dd>
                        <Bar share={f.share} />
                      </dd>
                      <dd className="num text-right text-ink">{pct(f.share)}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-2 text-[12px] text-muted">Share of watched films with each field.</p>
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal>
          <div className="grid gap-12 lg:grid-cols-2">
            <div>
              <h3 className="display mb-4 text-3xl">Unmatched titles · {metadata.unmatched.length}</h3>
              <p className="mb-3 text-[13px] text-muted">
                No confident Wikidata match, so these are excluded from genre, people and similarity analysis. Their ratings still count toward your overall statistics.
              </p>
              <ul className="scroll-thin max-h-80 columns-1 overflow-y-auto pr-2 text-[13px] sm:columns-2">
                {metadata.unmatched.map((u) => (
                  <li key={`${u.title}-${u.year}`} className="break-inside-avoid border-b hairline py-1.5 text-ink-2" title={u.reason}>
                    {u.title} <span className="text-muted">{u.year ?? ''}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="display mb-4 text-3xl">Conflicts & notes</h3>
              <ul className="space-y-2 text-[13px] text-ink-2">
                {notes.map((n, i) => (
                  <li key={i} className="flex gap-2">
                    <span aria-hidden className="text-amber">·</span>
                    {n}
                  </li>
                ))}
              </ul>
              {audit.conflicts.length > 0 && (
                <div className="mt-5">
                  <button type="button" aria-expanded={showConflicts} onClick={() => setShowConflicts(!showConflicts)} className="chip">
                    {showConflicts ? 'Hide' : 'Show'} {audit.conflicts.length} logged conflicts
                  </button>
                  {showConflicts && (
                    <ul className="mt-3 space-y-1.5 text-[12px] text-muted">
                      {audit.conflicts.map((cf, i) => (
                        <li key={i} className="border-b hairline pb-1.5">
                          <span className="num text-faint">{cf.kind}</span> · {cf.detail}
                          <span className="text-faint"> ({cf.refs.map((r) => `${r.file}:${r.row}`).join(', ')})</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
        </Reveal>

        <Reveal>
          <div className="panel grid gap-8 p-6 md:grid-cols-3">
            <div>
              <div className="label mb-2">Your data</div>
              <p className="text-[13px] leading-relaxed text-ink-2">
                Source archive <span className="num text-ink">{data.source.archive}</span>
                {data.source.exportedAt && <> exported {data.source.exportedAt.slice(0, 10)}</>}. Read in place (zip or folder) and never modified. Normalized records with per-row provenance live in{' '}
                <span className="num">data/normalized/</span>; nothing is uploaded anywhere.
              </p>
              {data.quality.social && (
                <p className="mt-3 text-[12px] text-muted">
                  Also in the export, but not used in the analysis: {data.quality.social.likedReviews} liked reviews, {data.quality.social.likedLists} liked lists,{' '}
                  {data.quality.social.commentsWritten} comment{data.quality.social.commentsWritten === 1 ? '' : 's'} written.
                </p>
              )}
            </div>
            <div>
              <div className="label mb-2">Film metadata</div>
              <p className="text-[13px] leading-relaxed text-ink-2">
                {data.source.metadataSources.includes('wikidata') ? 'Wikidata (CC0 public domain), ' : ''}matched first by Letterboxd film ID (property P6127), then by exact title and year. Responses are cached
                under <span className="num">data/cache/</span>, so refreshes only fetch what's new. Pin or block a match in <span className="num">data/overrides.json</span>.
              </p>
            </div>
            <div>
              <div className="label mb-2">Posters & keywords</div>
              <p className="text-[13px] leading-relaxed text-ink-2">
                {data.source.metadataSources.includes('tmdb')
                  ? 'TMDB enrichment is active. This product uses the TMDB API but is not endorsed or certified by TMDB.'
                  : 'Posters are typographic until you enable TMDB: set TMDB_API_KEY (or TMDB_READ_ACCESS_TOKEN) and run npm run refresh.'}
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </Chapter>
  )
}
