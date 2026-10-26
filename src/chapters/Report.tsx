import { useCallback } from 'react'
import type { AppData } from '../../shared/app-types.ts'
import { useData } from '../lib/data.tsx'
import { Chapter, Poster, Reveal } from '../ui/primitives.tsx'

export function reportMarkdown(data: AppData): string {
  const r = data.report
  return [
    `# ${r.title}`,
    '',
    `*${data.identity.subtitle}*`,
    '',
    `> ${r.subtitle}`,
    '',
    ...r.sections.flatMap((s) => [`## ${[s.kicker, s.heading].filter(Boolean).join(' ')}`, '', ...s.paragraphs.flatMap((p) => [p, ''])]),
  ].join('\n')
}

/** Splits off the first sentence (used to lift a pull-quote from the closing section). */
const firstSentence = (p: string) => p.match(/^.+?[.!?](?=\s|$)/)?.[0] ?? p

/** 10 — The Cinematic Identity Report: the long-form essay, downloadable and printable. */
export function Report() {
  const { data, film } = useData()
  const r = data.report
  const slug = `cinema-dna-${data.profile.username}`

  const downloadMd = useCallback(() => {
    const blob = new Blob([reportMarkdown(data)], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${slug}-report.md`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, [data, slug])

  const print = useCallback(() => {
    document.body.classList.add('printing-report')
    const done = () => {
      document.body.classList.remove('printing-report')
      window.removeEventListener('afterprint', done)
    }
    window.addEventListener('afterprint', done)
    window.print()
  }, [])

  const last = r.sections.at(-1)
  const quote = last?.paragraphs[0] ? firstSentence(last.paragraphs[0]) : null

  return (
    <Chapter
      id="report"
      number="10"
      title="The Identity Report"
      kicker="An essay in eight reels"
      intro={<>Everything above, written up as a critic would: a single essay grounded in your ratings, diary and reviews. Download it, print it, or keep it for next year's comparison.</>}
    >
      <style>{`
        @media print {
          body.printing-report nav, body.printing-report footer, body.printing-report main > section:not(#report),
          body.printing-report #report > header, body.printing-report .report-actions, body.printing-report [role='dialog'] { display: none !important; }
          body.printing-report, body.printing-report html { background: #fff !important; }
          body.printing-report #report { border: 0; padding: 0; }
          body.printing-report #report * { color: #141210 !important; background: transparent !important; box-shadow: none !important; }
          body.printing-report .report-essay section { break-inside: avoid-page; }
          body.printing-report .report-shelf { display: none !important; }
        }
      `}</style>
      <Reveal>
        <div className="report-actions mb-14 flex flex-wrap gap-2">
          <a className="chip px-4 py-2" href={`${import.meta.env.BASE_URL}data/cinema-dna-report.html`} download={`${slug}-report.html`}>
            ↓ Download HTML
          </a>
          <button type="button" className="chip px-4 py-2" onClick={downloadMd}>
            ↓ Download Markdown
          </button>
          <button type="button" className="chip px-4 py-2" onClick={print}>
            ⎙ Print / Save as PDF
          </button>
        </div>
      </Reveal>

      <article className="report-essay mx-auto max-w-[68ch]">
        <Reveal>
          <header className="mb-16 border-b hairline pb-12 text-center">
            <div className="eyebrow mb-6">Cinema DNA · Identity report</div>
            <h3 className="display text-6xl leading-[0.9] md:text-8xl">{r.title}</h3>
            <p className="display mx-auto mt-6 max-w-xl text-2xl italic leading-snug text-ink-2">{data.identity.subtitle}</p>
            <p className="mt-6 text-[12px] uppercase tracking-[0.2em] text-muted">{r.subtitle}</p>
          </header>
        </Reveal>

        {r.sections.map((s, si) => (
          <Reveal key={s.heading}>
            <section className="mb-16">
              <div className="mb-3 flex items-baseline gap-4">
                {s.kicker && <span className="display text-2xl italic text-amber">{s.kicker}</span>}
                <h4 className="display text-4xl leading-tight">{s.heading}</h4>
              </div>
              {si === r.sections.length - 1 && quote && (
                <blockquote className="display my-8 border-y border-amber/40 py-6 text-center text-[32px] italic leading-[1.15] text-amber">{quote}</blockquote>
              )}
              <div className="space-y-5 text-[18px] leading-[1.75] text-ink-2">
                {s.paragraphs.map((p, pi) => (
                  <p
                    key={pi}
                    className={
                      si === 0 && pi === 0
                        ? 'first-letter:float-left first-letter:mr-3 first-letter:mt-1 first-letter:font-[family-name:var(--font-display)] first-letter:text-[84px] first-letter:leading-[0.8] first-letter:text-amber'
                        : ''
                    }
                  >
                    {p}
                  </p>
                ))}
              </div>
              {s.filmIds && s.filmIds.length > 0 && (
                <div className="report-shelf scroll-thin -mx-2 mt-8 flex gap-3 overflow-x-auto px-2 pb-3">
                  {s.filmIds
                    .slice(0, 12)
                    .map(film)
                    .filter((f) => !!f)
                    .map((f) => (
                      <Poster key={f!.id} film={f!} size="sm" />
                    ))}
                </div>
              )}
            </section>
          </Reveal>
        ))}
        <p className="border-t hairline pt-6 text-[12px] leading-relaxed text-muted">
          Ratings, dates and reviews come from your Letterboxd export ({data.source.archive}); film metadata from {data.source.metadataSources.join(' + ') || 'none'}. Patterns describe your own history;
          none is a causal claim. Generated {data.generatedAt.slice(0, 10)}.
        </p>
      </article>
    </Chapter>
  )
}
