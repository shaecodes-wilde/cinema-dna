import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
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
  /** per-request timeout (default 45 s) */
  timeoutMs?: number
  log?: (msg: string) => void
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

  /**
   * GET (or POST form) JSON with an on-disk cache keyed by URL+body. Returns null when offline and uncached.
   * Failure budget: network errors fail after 2 tries, other retryable statuses after 4; each request times out.
   */
  async json<T>(url: string, body?: URLSearchParams): Promise<T | null> {
    const key = body ? `${url}\n${body.toString()}` : url
    const path = this.pathFor(key)
    const cached = readCache<T>(path)
    if (cached !== undefined) {
      this.cacheHits++
      return cached
    }
    if (this.opts.offline) return null
    const fetchImpl = this.opts.fetchImpl ?? fetch
    const log = this.opts.log ?? ((m: string) => console.warn(m))
    for (let attempt = 0; ; attempt++) {
      const wait = this.last + this.opts.minIntervalMs - Date.now()
      if (wait > 0) await sleep(wait)
      this.last = Date.now()
      this.networkRequests++
      const res = await fetchImpl(url, {
        method: body ? 'POST' : 'GET',
        body,
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', ...this.opts.headers },
        signal: AbortSignal.timeout(this.opts.timeoutMs ?? 45_000),
      }).catch((e: unknown) => ({ ok: false, status: 0, error: e }) as const)
      if (!('error' in res) && res.ok) {
        const data = (await res.json()) as T
        writeAtomic(path, JSON.stringify(data))
        return data
      }
      const status = res.status
      const where = redactUrl(url).slice(0, 120)
      if ([400, 401, 403, 404].includes(status)) throw new HttpError(status, `HTTP ${status} for ${where}`)
      const budget = status === 0 ? 2 : 4
      if (attempt + 1 >= budget) {
        throw new HttpError(status, status === 0 ? `Network unreachable (${where}). Re-run with --offline to use cached data only.` : `HTTP ${status} after ${budget} attempts: ${where}`)
      }
      const retryAfter = 'headers' in res ? Number(res.headers.get('retry-after')) : NaN
      // Honour Retry-After (Wikimedia/TMDB both send it), capped; otherwise back off from 5 s.
      const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 90) * 1000 + 250 : Math.min(5000 * 2 ** attempt, 30_000)
      log(`  … ${status === 0 ? 'network error' : `HTTP ${status}`}, retrying in ${Math.round(delay / 1000)}s`)
      await sleep(delay)
    }
  }
}

export class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/** Unreadable/truncated cache files (e.g. a run killed mid-write) are treated as misses. */
function readCache<T>(path: string): T | undefined {
  if (!existsSync(path)) return undefined
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T
  } catch {
    return undefined
  }
}

/** Write-then-rename so an interrupted run never leaves a half-written cache file. */
export function writeAtomic(path: string, text: string): void {
  const tmp = `${path}.${process.pid}.tmp`
  writeFileSync(tmp, text)
  renameSync(tmp, path)
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
