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

export interface ArticleSummary {
  title: string
  description?: string
  extract: string
  thumbnail?: { source: string; width: number; height: number }
}

/**
 * Fetch a concise summary of an article (title, description, intro paragraph,
 * and thumbnail image). Used to preview the target article so players know
 * what they're searching for without being able to click straight to it.
 */
export async function fetchArticleSummary(title: string, signal?: AbortSignal): Promise<ArticleSummary> {
  const encoded = encodeURIComponent(title.replace(/ /g, '_'))
  const res = await fetch(`${REST_API}/page/summary/${encoded}`, { signal })
  if (!res.ok) throw new Error(`Summary failed: ${res.status}`)
  const data = await res.json()
  return {
    title: data.title ?? title,
    description: data.description,
    extract: data.extract ?? '',
    thumbnail: data.thumbnail,
  }
}

/**
 * Fetch the full article HTML but with every link unwrapped (replaced by its
 * text), so the target preview modal can show rich content -- paragraphs,
 * tables, infobox -- without giving the player a way to click straight
 * through to the target.
 *
 * The returned string is intended for injection via innerHTML inside a
 * container styled by the .wiki-content CSS rules.
 */
export async function fetchArticleReadOnlyHtml(
  title: string,
  signal?: AbortSignal,
): Promise<string> {
  const html = await fetchArticleHtml(title, signal)
  // Parse and unwrap anchors.
  const doc = new DOMParser().parseFromString(html, 'text/html')
  // Replace every <a> with its text content -- keeps words, kills navigation.
  doc.querySelectorAll('a').forEach((a) => {
    const text = doc.createTextNode(a.textContent ?? '')
    a.replaceWith(text)
  })
  // Strip <script>, <style>, <link> -- same hygiene as in-game article view.
  doc.querySelectorAll('script, style, link').forEach((el) => el.remove())
  // Wrap wide tables (data tables, not infoboxes) in a horizontal scroll
  // container so Comparison-of-X tables and List-of-X sortable tables don't
  // get clipped by the modal's overflow-hidden frame on narrow screens.
  doc.querySelectorAll('table').forEach((tbl) => {
    if (tbl.closest('.infobox, .infobox *, .vertical-navbox')) return
    if (tbl.parentElement?.classList.contains('table-scroll')) return
    const wrapper = doc.createElement('div')
    wrapper.className = 'table-scroll'
    tbl.replaceWith(wrapper)
    wrapper.appendChild(tbl)
  })
  return doc.body.innerHTML
}
