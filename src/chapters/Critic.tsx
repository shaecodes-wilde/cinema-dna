import { useData } from '../lib/data.tsx'
import { fmtRating } from '../lib/format.ts'
import { InsightCard } from '../ui/InsightCard.tsx'
import { Chapter, InfoTip, Reveal } from '../ui/primitives.tsx'
import { DirectorScatter, GenreStrips, LengthChart, RatingHistogram } from './critic/Charts.tsx'
import { DistinctiveWords, LanguageLift } from './critic/Language.tsx'
import { ExceptionsDumbbell, ModelPanel, RatingMotion } from './critic/Motion.tsx'

/** 08 — Critical Analysis: how you score, how you write, and where the stars surprise. */
export function Critic() {
  const { data } = useData()
  const t = data.totals
  const generosity = data.insights.find((i) => i.category === 'generosity')
  const language = data.insights.filter((i) => i.category === 'language')
  const corr = data.critical.textRatingCorrelation

  return (
    <Chapter
      id="critic"
      number="08"
      title="Critical Analysis"
      kicker="The critic at work"
      intro={
        <>
          How you score, how you write, and how the two disagree. Your stars average <span className="num text-ink">{fmtRating(t.meanRating)}</span> with a spread of{' '}
          <span className="num text-ink">{t.sdRating.toFixed(2)}</span>; everything below is measured against that personal baseline, not anyone else's.
        </>
      }
    >
      <div className="space-y-24">
        <Reveal>
          <div className="grid gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
            <div>
              <h3 className="display mb-1 text-3xl">The shape of your stars</h3>
              <p className="mb-6 text-[14px] text-muted">
                {t.ratedFilms} current ratings. Bars are coloured relative to your own mean. Click a bar to open the films at or above it.
              </p>
              <RatingHistogram />
            </div>
            {generosity && <InsightCard insight={generosity} defaultOpen />}
          </div>
        </Reveal>

        <Reveal>
          <h3 className="display mb-1 text-3xl">Every genre, every film</h3>
          <p className="mb-6 max-w-3xl text-[14px] text-muted">
            Each dot is a rated film; the diamond is the genre's shrunk average
            <InfoTip>Empirical-Bayes average: the genre mean pulled toward your overall mean by six pseudo-films, so small genres can't top the chart on one lucky film.</InfoTip>. Wide clouds mean the genre label tells you little about your verdict.
          </p>
          <GenreStrips />
        </Reveal>

        <Reveal>
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <h3 className="display mb-1 text-3xl">Director consistency</h3>
              <p className="mb-6 text-[14px] text-muted">Directors you've watched at least twice. Click one to see their films.</p>
              <DirectorScatter />
            </div>
            <div>
              <h3 className="display mb-1 text-3xl">Ratings in motion</h3>
              <p className="mb-6 text-[14px] text-muted">Your stars are not fixed. Here is every time one moved.</p>
              <RatingMotion />
            </div>
          </div>
        </Reveal>

        <Reveal>
          <h3 className="display mb-1 text-3xl">What your reviews talk about</h3>
          <p className="mb-6 max-w-3xl text-[14px] text-muted">
            Twelve transparent keyword lexicons applied to {t.reviews} reviews. Select a theme to read the evidence in your own words.
          </p>
          <LanguageLift />
        </Reveal>

        <Reveal>
          <div className="grid gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
            <div>
              <h3 className="display mb-6 text-3xl">Words of praise, words of doubt</h3>
              <DistinctiveWords />
            </div>
            <div className="space-y-8">
              <div>
                <h3 className="display mb-1 text-3xl">Length vs. stars</h3>
                <p className="mb-4 text-[14px] text-muted">Average words per review at each rating.</p>
                <LengthChart />
              </div>
              <div className="panel flex items-baseline justify-between gap-4 p-5">
                <div className="label">
                  Words ↔ stars agreement
                  <InfoTip>
                    Pearson correlation between a simple positive/negative word score of each review and its star rating. Near 0 means your text and your stars carry different information; 1 would mean
                    the words alone predict the stars.
                  </InfoTip>
                </div>
                <div className="num text-3xl">{corr === null ? '—' : `r = ${corr.toFixed(2)}`}</div>
              </div>
            </div>
          </div>
        </Reveal>

        {language.length > 0 && (
          <Reveal>
            <div className="grid gap-6 md:grid-cols-2">
              {language.map((i) => (
                <InsightCard key={i.id} insight={i} />
              ))}
            </div>
          </Reveal>
        )}

        <Reveal>
          <h3 className="display mb-1 text-3xl">Standout exceptions</h3>
          <p className="mb-6 max-w-3xl text-[14px] text-muted">
            Films where your rating (filled dot) landed farthest from what your taste model predicted (hollow dot) — the personal, unquantifiable part of your taste. Predictions are cross-validated, so a
            film never predicts itself.
          </p>
          <div className="grid gap-10 lg:grid-cols-2">
            <ExceptionsDumbbell ids={data.critical.exceptions.above} title="You loved them more than expected" />
            <ExceptionsDumbbell ids={data.critical.exceptions.below} title="They let you down more than expected" />
          </div>
        </Reveal>

        <Reveal>
          <div className="border-t hairline pt-12">
            <h3 className="display mb-6 text-3xl">How predictable is your taste?</h3>
            <ModelPanel />
          </div>
        </Reveal>
      </div>
    </Chapter>
  )
}
