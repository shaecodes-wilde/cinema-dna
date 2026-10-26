import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { writeAtomic, type CachedHttp } from './http.ts'

/**
 * Wikidata access goes through the SPARQL endpoint in batches (dozens of films per query),
 * which keeps a full refresh to a few dozen requests — well inside Wikimedia's rate limits.
 */
const SPARQL = 'https://query.wikidata.org/sparql'

/** Properties we keep from film entities. */
export const FILM_PROPS = {
  instanceOf: 'P31',
  publicationDate: 'P577',
  duration: 'P2047',
  genre: 'P136',
  director: 'P57',
  screenwriter: 'P58',
  cast: 'P161',
  cinematographer: 'P344',
  composer: 'P86',
  editor: 'P1040',
  producer: 'P162',
  company: 'P272',
  distributor: 'P750',
  country: 'P495',
  language: 'P364',
  subject: 'P921',
  series: 'P179',
  franchise: 'P8345',
  basedOn: 'P144',
  award: 'P166',
  nominated: 'P1411',
  tmdb: 'P4947',
  imdb: 'P345',
  letterboxd: 'P6127',
} as const

const CLAIM_PROPS = Object.values(FILM_PROPS).filter((p) => p !== 'P2047')

export interface CompactEntity {
  id: string
  label: string
  description: string | null
  aliases: string[]
  sitelinks: number
  /** property → values (QIDs, strings, ISO dates, or minutes for P2047) */
  claims: Record<string, string[]>
}

/** Item classes we accept as "a film or film-like work" (feature, animated, documentary, TV film, specials…). */
export const FILM_CLASSES = new Set([
  'Q11424', // film
  'Q24869', // feature film
  'Q202866', // animated film
  'Q29168811', // animated feature film
  'Q93204', // documentary film
  'Q506240', // television film
  'Q24862', // short film
  'Q226730', // silent film
  'Q1257444', // film adaptation
  'Q229390', // 3D film
  'Q17517379', // animated short film
  'Q18011172', // film project
  'Q1261214', // television special
  'Q21191270', // television series episode
])

/** Television classes: Letterboxd lists some series/miniseries; we keep them but flag the format. */
export const TV_CLASSES = new Set([
  'Q5398426', // television series
  'Q1259759', // miniseries
  'Q526877', // web series
  'Q63952888', // anime television series
  'Q581714', // animated series
  'Q117467246', // animated television series
  'Q15416', // television program
])

export const isFilmLike = (e: CompactEntity) =>
  (e.claims.P31 ?? []).some((c) => FILM_CLASSES.has(c)) ||
  /\b(film|movie|documentary|television special|concert film)\b/i.test(e.description ?? '')

export function yearsOf(e: CompactEntity): number[] {
  return (e.claims.P577 ?? []).map((t) => Number(t.match(/(\d{4})/)?.[1])).filter((y) => y > 1800)
}

type Binding = Record<string, { type: string; value: string; 'xml:lang'?: string }>
const qid = (uri: string) => uri.split('/').pop()!
const lit = (s: string) => JSON.stringify(s)

export class Wikidata {
  private http: CachedHttp
  private entityDir: string
  private labelsPath: string
  private labels: Record<string, string>

  constructor(http: CachedHttp, cacheRoot: string) {
    this.http = http
    this.entityDir = join(cacheRoot, 'wikidata-entities')
    this.labelsPath = join(cacheRoot, 'wikidata-labels.json')
    mkdirSync(this.entityDir, { recursive: true })
    this.labels = readJsonOr(this.labelsPath, {})
  }

  async sparql(query: string): Promise<Binding[]> {
    return (await this.sparqlOrNull(query)) ?? []
  }

  /** null = not available (offline cache miss), as opposed to an empty result. */
  async sparqlOrNull(query: string): Promise<Binding[] | null> {
    const res = await this.http.json<{ results: { bindings: Binding[] } }>(
      SPARQL,
      new URLSearchParams({ query: query.replace(/\s+/g, ' ').trim(), format: 'json' }),
    )
    return res ? res.results.bindings : null
  }

  /** Items whose Letterboxd film ID (P6127) is one of `slugs`. */
  async findByLetterboxdSlugs(slugs: string[]): Promise<Map<string, string[]>> {
    const out = new Map<string, string[]>()
    for (let i = 0; i < slugs.length; i += 200) {
      const values = slugs.slice(i, i + 200).map(lit).join(' ')
      for (const r of await this.sparql(`SELECT ?item ?slug WHERE { VALUES ?slug { ${values} } ?item wdt:P6127 ?slug }`)) {
        out.set(r.slug.value, [...(out.get(r.slug.value) ?? []), qid(r.item.value)])
      }
    }
    return out
  }

  /** Film-like items whose English label or alias exactly equals one of `titles`. */
  async findByExactTitle(titles: string[]): Promise<Map<string, string[]>> {
    const out = new Map<string, string[]>()
    const classes = [...FILM_CLASSES].map((c) => `wd:${c}`).join(' ')
    for (let i = 0; i < titles.length; i += 60) {
      const batch = titles.slice(i, i + 60)
      const values = batch.flatMap((t) => [`${lit(t)}@en`, `${lit(t)}@mul`]).join(' ')
      const rows = await this.sparql(`SELECT DISTINCT ?item ?t WHERE {
        VALUES ?t { ${values} }
        { ?item rdfs:label ?t } UNION { ?item skos:altLabel ?t }
        ?item wdt:P31 ?type . VALUES ?type { ${classes} }
      }`)
      for (const r of rows) out.set(r.t.value, [...(out.get(r.t.value) ?? []), qid(r.item.value)])
    }
    return out
  }

  /** Fuzzy search (Wikidata's own entity search, called from inside SPARQL). */
  async search(title: string): Promise<string[]> {
    const rows = await this.sparql(`SELECT ?item WHERE {
      SERVICE wikibase:mwapi {
        bd:serviceParam wikibase:endpoint "www.wikidata.org"; wikibase:api "EntitySearch";
          mwapi:search ${lit(title)}; mwapi:language "en"; mwapi:limit "10" .
        ?item wikibase:apiOutputItem mwapi:item .
      }
    }`)
    return rows.map((r) => qid(r.item.value))
  }

  async entities(ids: string[]): Promise<Map<string, CompactEntity>> {
    const out = new Map<string, CompactEntity>()
    const missing: string[] = []
    for (const id of new Set(ids)) {
      const p = join(this.entityDir, `${id}.json`)
      const cached = readJsonOr<CompactEntity | null>(p, null)
      if (cached) out.set(id, cached)
      else missing.push(id)
    }
    const props = CLAIM_PROPS.map((p) => `wdt:${p}`).join(' ')
    for (let i = 0; i < missing.length; i += 40) {
      const batch = missing.slice(i, i + 40)
      const values = batch.map((id) => `wd:${id}`).join(' ')
      const head = await this.sparqlOrNull(`SELECT ?item ?itemLabel ?itemDescription ?sl ?secs WHERE {
        VALUES ?item { ${values} }
        OPTIONAL { ?item wikibase:sitelinks ?sl }
        OPTIONAL { ?item p:P2047/psn:P2047/wikibase:quantityAmount ?secs }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en,mul". }
      }`)
      const claims = await this.sparqlOrNull(`SELECT ?item ?prop ?val ?valLabel WHERE {
        VALUES ?item { ${values} }
        VALUES ?prop { ${props} }
        ?item ?prop ?val .
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en,mul". }
      }`)
      // Only cache entities when both halves were actually fetched; a partial (offline) batch is skipped.
      if (!head || !claims) continue
      const built = new Map<string, CompactEntity>()
      for (const r of head) {
        const id = qid(r.item.value)
        const e = built.get(id) ?? {
          id,
          label: r.itemLabel?.value ?? id,
          description: r.itemDescription?.value ?? null,
          aliases: [],
          sitelinks: Number(r.sl?.value ?? 0),
          claims: {},
        }
        if (r.secs && !e.claims.P2047) e.claims.P2047 = [String(Math.round(Number(r.secs.value) / 60))]
        built.set(id, e)
      }
      for (const r of claims) {
        const e = built.get(qid(r.item.value))
        if (!e) continue
        const prop = qid(r.prop.value)
        const isItem = r.val.type === 'uri' && r.val.value.includes('/entity/Q')
        const value = isItem ? qid(r.val.value) : r.val.value
        if (isItem && r.valLabel && r.valLabel.value !== value) this.labels[value] = r.valLabel.value
        const list = (e.claims[prop] ??= [])
        if (!list.includes(value)) list.push(value)
      }
      for (const [id, e] of built) {
        writeAtomic(join(this.entityDir, `${id}.json`), JSON.stringify(e))
        this.labels[id] = e.label
        out.set(id, e)
      }
      this.saveLabels()
    }
    return out
  }

  label(id: string): string {
    return this.labels[id] ?? id
  }

  saveLabels() {
    writeAtomic(this.labelsPath, JSON.stringify(this.labels))
  }
}

function readJsonOr<T>(path: string, fallback: T): T {
  if (!existsSync(path)) return fallback
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T
  } catch {
    return fallback // truncated by an interrupted run: refetch
  }
}
