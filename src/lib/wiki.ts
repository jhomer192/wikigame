/**
 * Fetch Wikipedia article HTML via the REST API.
 * Returns the raw HTML string for rendering in our container.
 */

const REST_API = 'https://en.wikipedia.org/api/rest_v1'

export async function fetchArticleHtml(title: string, signal?: AbortSignal): Promise<string> {
  const encoded = encodeURIComponent(title.replace(/ /g, '_'))
  const res = await fetch(`${REST_API}/page/html/${encoded}`, {
    signal,
    headers: { Accept: 'text/html; charset=utf-8' },
  })
  if (!res.ok) {
    throw new Error(`Failed to fetch article: ${res.status}`)
  }
  let html = await res.text()
  // Strip <base> tags -- Wikipedia sets base href to //en.wikipedia.org/wiki/
  // which causes relative link clicks to navigate away from the app
  html = html.replace(/<base[^>]*>/gi, '')
  return html
}

/**
 * Extract Wikipedia article title from a link href.
 * Returns null if not a valid article link.
 */
export function extractArticleTitle(href: string): string | null {
  // Relative wiki link: ./Title
  const relMatch = href.match(/^\.\/([^#?]+)/)
  if (relMatch) {
    return decodeURIComponent(relMatch[1].replace(/_/g, ' '))
  }

  // Absolute wiki link (with or without protocol)
  const absMatch = href.match(/(?:\/\/)?(?:en\.)?wikipedia\.org\/wiki\/([^#?]+)/)
  if (absMatch) {
    return decodeURIComponent(absMatch[1].replace(/_/g, ' '))
  }

  // /wiki/Title (no domain)
  const wikiMatch = href.match(/^\/wiki\/([^#?]+)/)
  if (wikiMatch) {
    return decodeURIComponent(wikiMatch[1].replace(/_/g, ' '))
  }

  return null
}

/**
 * Check if a title is a "meta" page we should skip (namespaced pages).
 */
const META_PREFIXES = [
  'Category:', 'File:', 'Portal:', 'Template:', 'Help:',
  'Wikipedia:', 'Draft:', 'Module:', 'MediaWiki:', 'Book:',
  'TimedText:', 'User:', 'User talk:', 'Talk:', 'Special:',
]

export function isMetaTitle(title: string): boolean {
  return META_PREFIXES.some(p => title.startsWith(p))
}

/**
 * Normalize a title for comparison (case-insensitive first char, underscores to spaces).
 */
export function normalizeTitle(title: string): string {
  const t = title.replace(/_/g, ' ').trim()
  return t.charAt(0).toUpperCase() + t.slice(1)
}

/**
 * Check if two titles refer to the same article.
 */
export function titlesMatch(a: string, b: string): boolean {
  return normalizeTitle(a) === normalizeTitle(b)
}

/**
 * Wikipedia OpenSearch autocomplete. Returns article titles matching the query.
 * Meta/namespaced pages are filtered out so only real articles appear.
 */
export async function searchArticles(query: string, signal?: AbortSignal): Promise<string[]> {
  const q = query.trim()
  if (q.length < 2) return []
  const url = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(q)}&limit=8&namespace=0&format=json&origin=*`
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`Search failed: ${res.status}`)
  const data = await res.json()
  const titles = Array.isArray(data) && Array.isArray(data[1]) ? (data[1] as string[]) : []
  return titles.filter((t) => !isMetaTitle(t))
}

/**
 * Verify an article exists before starting a custom challenge.
 */
export async function articleExists(title: string, signal?: AbortSignal): Promise<boolean> {
  const encoded = encodeURIComponent(title.replace(/ /g, '_'))
  const res = await fetch(`${REST_API}/page/summary/${encoded}`, { signal, method: 'HEAD' })
  return res.ok
}
