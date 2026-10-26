import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** Wikimedia asks for contact info in the UA; set CINEMA_DNA_CONTACT (URL or email) to get the higher rate tier. */
export const USER_AGENT = `CinemaDNA/1.0 (personal film-taste analysis, low volume${process.env.CINEMA_DNA_CONTACT ? '; ' + process.env.CINEMA_DNA_CONTACT : ''})`

/** Strips credentials (api_key, token, …) from a URL before it can reach logs or error messages. */
export const redactUrl = (url: string) => url.replace(/([?&](?:api_key|apikey|key|token|access_token)=)[^&#]*/gi, '$1REDACTED')

export interface HttpOptions {
  cacheDir: string
  /** minimum ms between network requests */
  minIntervalMs: number
  offline: boolean
  headers?: Record<string, string>
  fetchImpl?: typeof fetch
}

export class CachedHttp {
  private last = 0
  networkRequests = 0
  cacheHits = 0
  private opts: HttpOptions

  constructor(opts: HttpOptions) {
    this.opts = opts
    mkdirSync(opts.cacheDir, { recursive: true })
  }

  private pathFor(key: string): string {
    return join(this.opts.cacheDir, createHash('sha1').update(key).digest('hex') + '.json')
  }

  /** GET (or POST form) JSON with an on-disk cache keyed by URL+body. Returns null when offline and uncached. */
  async json<T>(url: string, body?: URLSearchParams): Promise<T | null> {
    const key = body ? `${url}\n${body.toString()}` : url
    const path = this.pathFor(key)
    if (existsSync(path)) {
      this.cacheHits++
      return JSON.parse(readFileSync(path, 'utf8')) as T
    }
    if (this.opts.offline) return null
    const fetchImpl = this.opts.fetchImpl ?? fetch
    for (let attempt = 0; attempt < 8; attempt++) {
      const wait = this.last + this.opts.minIntervalMs - Date.now()
      if (wait > 0) await sleep(wait)
      this.last = Date.now()
      this.networkRequests++
      const res = await fetchImpl(url, {
        method: body ? 'POST' : 'GET',
        body,
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', ...this.opts.headers },
      }).catch((e: unknown) => ({ ok: false, status: 0, error: e }) as const)
      if ('error' in res || !res.ok) {
        const status = res.status
        if (status === 404 || status === 400 || status === 401) {
          throw new Error(`HTTP ${status} for ${redactUrl(url).slice(0, 160)}`)
        }
        const retryAfter = 'headers' in res ? Number(res.headers.get('retry-after')) : NaN
        // Honour Retry-After (Wikimedia/TMDB both send it); otherwise back off from 5 s.
        await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 180) * 1000 + 250 : 5000 * 2 ** attempt)
        continue
      }
      const data = (await res.json()) as T
      writeFileSync(path, JSON.stringify(data))
      return data
    }
    throw new Error(`Giving up after retries: ${redactUrl(url).slice(0, 160)}`)
  }
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
