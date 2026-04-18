import { useEffect, useRef, useState, useCallback } from 'react'
import { fetchArticleHtml, extractArticleTitle, isMetaTitle } from '../lib/wiki'

interface ArticleViewProps {
  title: string
  onNavigate: (title: string) => void
  gameOver: boolean
}

/**
 * Process fetched Wikipedia HTML to make links safe for in-app use:
 * - Move href to data-wiki-href so the browser won't follow them
 * - Keep the visual appearance of links via CSS
 */
function processHtml(html: string): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  // Remove unwanted sections
  const unwantedIds = ['See_also', 'External_links', 'Further_reading', 'Notes', 'References', 'Bibliography']
  for (const id of unwantedIds) {
    const heading = doc.getElementById(id)
    if (heading) {
      const section = heading.closest('section')
      if (section) {
        section.remove()
      } else {
        let node: Element | null = heading.tagName === 'H2' || heading.tagName === 'H3'
          ? heading : heading.parentElement
        while (node) {
          const next = node.nextElementSibling
          node.remove()
          node = next
        }
      }
    }
  }

  // Remove unwanted elements
  doc.querySelectorAll(
    '.mw-editsection, .navbox, .catlinks, .mw-authority-control, .sistersitebox, ' +
    '.noprint, .ambox, .metadata, .mbox-small, .mw-empty-elt, .portal, .sidebar, ' +
    '.toc, #toc, #coordinates, .mw-indicators, .shortdescription'
  ).forEach(n => n.remove())

  // Process all links: move href to data-wiki-href
  doc.querySelectorAll('a[href]').forEach(el => {
    const a = el as HTMLAnchorElement
    const href = a.getAttribute('href')!
    const articleTitle = extractArticleTitle(href)

    if (articleTitle && !isMetaTitle(articleTitle)) {
      // Valid wiki article link: make it a game link
      a.setAttribute('data-wiki-href', href)
      a.removeAttribute('href')
      a.setAttribute('role', 'link')
      a.setAttribute('tabindex', '0')
      a.style.cursor = 'pointer'
    } else if (href.startsWith('#')) {
      // Anchor link within the page: keep as-is
    } else {
      // External or meta link: disable
      a.removeAttribute('href')
      a.style.color = '#6b7280'
      a.style.cursor = 'default'
      a.style.pointerEvents = 'none'
    }
  })

  return doc.body.innerHTML
}

export default function ArticleView({ title, onNavigate, gameOver }: ArticleViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [html, setHtml] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Reset state when title changes, then fetch
  const [fetchTitle, setFetchTitle] = useState(title)
  if (fetchTitle !== title) {
    setFetchTitle(title)
    setLoading(true)
    setError(null)
  }

  useEffect(() => {
    const controller = new AbortController()

    fetchArticleHtml(title, controller.signal)
      .then((content) => {
        setHtml(processHtml(content))
        setLoading(false)
        if (containerRef.current) {
          containerRef.current.scrollTop = 0
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(err.message || 'Failed to load article')
          setLoading(false)
        }
      })

    return () => controller.abort()
  }, [title])

  // Handle link clicks
  const onNavigateRef = useRef(onNavigate)
  const gameOverRef = useRef(gameOver)

  useEffect(() => {
    onNavigateRef.current = onNavigate
    gameOverRef.current = gameOver
  })

  const handleClick = useCallback(
    (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('a[data-wiki-href]') as HTMLElement | null
      if (!target) return

      e.preventDefault()
      e.stopPropagation()

      if (gameOverRef.current) return

      const href = target.getAttribute('data-wiki-href')
      if (!href) return

      const articleTitle = extractArticleTitle(href)
      if (!articleTitle) return

      onNavigateRef.current(articleTitle)
    },
    [],
  )

  // Block context menu on links
  const handleContextMenu = useCallback((e: MouseEvent) => {
    const target = (e.target as HTMLElement).closest('a[data-wiki-href]')
    if (target) {
      e.preventDefault()
    }
  }, [])

  // Attach event listeners -- depends on html/loading because the container
  // div only exists when not loading/erroring
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    el.addEventListener('click', handleClick, true)
    el.addEventListener('contextmenu', handleContextMenu, true)

    return () => {
      el.removeEventListener('click', handleClick, true)
      el.removeEventListener('contextmenu', handleContextMenu, true)
    }
  }, [handleClick, handleContextMenu, html, loading])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
          <span className="text-sm text-text/60">Loading article...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-danger text-lg mb-2">Failed to load article</div>
          <div className="text-sm text-text/60 mb-4">{error}</div>
          <button
            onClick={() => {
              setLoading(true)
              setError(null)
              fetchArticleHtml(title)
                .then((c) => setHtml(processHtml(c)))
                .catch((err) => setError(err.message))
                .finally(() => setLoading(false))
            }}
            className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-dim transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="wiki-content flex-1 overflow-y-auto px-4 py-3 sm:px-6"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
