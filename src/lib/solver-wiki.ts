/**
 * Wikipedia API helpers for the bot solver.
 * Uses the MediaWiki Action API (same origin/CORS as the game).
 */

const API = 'https://en.wikipedia.org/w/api.php'

function apiUrl(params: Record<string, string>): string {
  const qp = new URLSearchParams({ ...params, format: 'json', origin: '*' })
  return `${API}?${qp.toString()}`
}

async function apiFetch(
  url: string,
  signal?: AbortSignal,
  attempts = 2,
): Promise<Response | null> {
  let lastRes: Response | null = null
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { signal })
      if (res.ok) return res
      if (res.status >= 400 && res.status < 500 && res.status !== 429) return res
      lastRes = res
    } catch (err) {
      if (signal?.aborted) throw err
      if (i === attempts - 1) return null
    }
    if (signal?.aborted) return null
    await new Promise((r) => setTimeout(r, 400 * (i + 1)))
  }
  return lastRes
}

export async function getIntro(title: string, signal?: AbortSignal): Promise<string> {
  const res = await apiFetch(
    apiUrl({
      action: 'query',
      titles: title,
      prop: 'extracts',
      exintro: 'true',
      explaintext: 'true',
      redirects: '1',
    }),
    signal,
  )
  if (!res || !res.ok) return ''
  const data = await res.json()
  const pages = data?.query?.pages ?? {}
  const first = Object.values(pages)[0] as { extract?: string } | undefined
  return first?.extract ?? ''
}

export interface IntrosBatchResult {
  intros: Map<string, string>
  pageSizes: Map<string, number>
}

export async function getIntrosBatch(
  titles: string[],
  signal?: AbortSignal,
): Promise<IntrosBatchResult> {
  const intros = new Map<string, string>()
  const pageSizes = new Map<string, number>()
  if (titles.length === 0) return { intros, pageSizes }
  const BATCH = 20
  for (let i = 0; i < titles.length; i += BATCH) {
    const chunk = titles.slice(i, i + BATCH)
    const res = await apiFetch(
      apiUrl({
        action: 'query',
        titles: chunk.join('|'),
        prop: 'extracts|info',
        exintro: 'true',
        explaintext: 'true',
        redirects: '1',
      }),
      signal,
    )
    if (!res || !res.ok) continue
    const data = await res.json()
    const normalized: { from: string; to: string }[] = data?.query?.normalized ?? []
    const normMap = new Map(normalized.map((n) => [n.to, n.from]))
    const pages = data?.query?.pages ?? {}
    for (const p of Object.values(pages) as { title?: string; extract?: string; length?: number }[]) {
      if (!p.title) continue
      const originalTitle = normMap.get(p.title) ?? p.title
      intros.set(originalTitle, p.extract ?? '')
      intros.set(p.title, p.extract ?? '')
      if (p.length != null) {
        pageSizes.set(originalTitle, p.length)
        pageSizes.set(p.title, p.length)
      }
    }
  }
  return { intros, pageSizes }
}

export async function getLinks(
  title: string,
  maxLinks = 500,
  signal?: AbortSignal,
): Promise<{ titles: string[]; calls: number }> {
  const all: string[] = []
  let plcontinue: string | undefined
  let safety = 0
  let calls = 0
  while (all.length < maxLinks && safety < 4) {
    const params: Record<string, string> = {
      action: 'query',
      titles: title,
      prop: 'links',
      pllimit: 'max',
      plnamespace: '0',
      redirects: '1',
    }
    if (plcontinue) params.plcontinue = plcontinue
    const res = await apiFetch(apiUrl(params), signal)
    calls += 1
    if (!res || !res.ok) break
    const data = await res.json()
    const pages = data?.query?.pages ?? {}
    for (const p of Object.values(pages) as { links?: { title: string }[] }[]) {
      if (p.links) for (const l of p.links) all.push(l.title)
    }
    plcontinue = data?.continue?.plcontinue
    if (!plcontinue) break
    safety += 1
  }
  return { titles: all.slice(0, maxLinks), calls }
}

export async function getBacklinks(
  title: string,
  maxLinks = 500,
  signal?: AbortSignal,
): Promise<{ titles: string[]; calls: number }> {
  const all: string[] = []
  let blcontinue: string | undefined
  let safety = 0
  let calls = 0
  while (all.length < maxLinks && safety < 4) {
    const params: Record<string, string> = {
      action: 'query',
      list: 'backlinks',
      bltitle: title,
      bllimit: 'max',
      blnamespace: '0',
      blfilterredir: 'nonredirects',
    }
    if (blcontinue) params.blcontinue = blcontinue
    const res = await apiFetch(apiUrl(params), signal)
    calls += 1
    if (!res || !res.ok) break
    const data = await res.json()
    const items: { title: string }[] = data?.query?.backlinks ?? []
    for (const it of items) all.push(it.title)
    blcontinue = data?.continue?.blcontinue
    if (!blcontinue) break
    safety += 1
  }
  return { titles: all.slice(0, maxLinks), calls }
}

const META_PREFIXES = [
  'Category:', 'File:', 'Portal:', 'Template:', 'Help:',
  'Wikipedia:', 'Draft:', 'Module:', 'MediaWiki:', 'Book:',
  'TimedText:', 'User:', 'User talk:', 'Talk:',
]

const META_TITLE_PATTERNS: RegExp[] = [
  /^List of /i, /^Lists of /i, /^Outline of /i,
  /^Index of /i, /^Glossary of /i, / \(disambiguation\)$/i,
]

export function isMetaTitle(title: string): boolean {
  for (const p of META_PREFIXES) {
    if (title.startsWith(p)) return true
  }
  for (const re of META_TITLE_PATTERNS) {
    if (re.test(title)) return true
  }
  return false
}
