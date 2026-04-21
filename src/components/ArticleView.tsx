import { useEffect, useRef, useState, useCallback } from 'react'
import { fetchArticleHtml, extractArticleTitle, isMetaTitle } from '../lib/wiki'
import LinkPreviewPopover from './LinkPreviewPopover'

interface ArticleViewProps {
  title: string
  onNavigate: (title: string) => void
  gameOver: boolean
}

// Delay before hover reveals a preview (ms). Short enough to feel responsive,
// long enough that casual cursor travel doesn't trigger it.
const HOVER_DELAY_MS = 350
// Long-press duration for touch devices (ms).
const LONG_PRESS_MS = 450
// Finger drift after press-down that cancels the long-press (px).
const LONG_PRESS_MOVE_TOLERANCE = 10

function titleFromAnchor(anchor: HTMLElement): string | null {
  const href = anchor.getAttribute('data-wiki-href')
  if (!href) return null
  return extractArticleTitle(href)
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
      // Anchor link within the page: disable so it can't jump to a section
      a.removeAttribute('href')
      a.style.cursor = 'default'
      a.style.pointerEvents = 'none'
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
  const [preview, setPreview] = useState<{ title: string; rect: DOMRect } | null>(null)

  // Reset state when title changes, then fetch
  const [fetchTitle, setFetchTitle] = useState(title)
  if (fetchTitle !== title) {
    setFetchTitle(title)
    setLoading(true)
    setError(null)
  }

  // Apply fetched HTML manually to the container. Using `dangerouslySetInnerHTML`
  // caused React to re-set innerHTML on every parent re-render, which destroyed
  // the link elements (and their event listeners' captured references) every
  // time setPreview fired.
  useEffect(() => {
    if (!containerRef.current) return
    containerRef.current.innerHTML = html
  }, [html])

  useEffect(() => {
    // Scroll to top immediately when navigating to a new article
    if (containerRef.current) {
      containerRef.current.scrollTop = 0
    }

    const controller = new AbortController()

    fetchArticleHtml(title, controller.signal)
      .then((content) => {
        setHtml(processHtml(content))
        setLoading(false)
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

  // Refs for hover/long-press state (synchronous reads inside event handlers)
  const hoverTimerRef = useRef<number | null>(null)
  // Which link the cursor is currently over (after the hover delay fires,
  // this is also what's being previewed).
  const hoveredAnchorRef = useRef<HTMLElement | null>(null)
  const longPressTimerRef = useRef<number | null>(null)
  const longPressStartRef = useRef<{ x: number; y: number } | null>(null)
  const suppressClickRef = useRef(false)

  const clearHoverTimer = () => {
    if (hoverTimerRef.current !== null) {
      window.clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
  }
  const clearLongPressTimer = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
    longPressStartRef.current = null
  }

  const handleClick = useCallback(
    (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('a[data-wiki-href]') as HTMLElement | null
      if (!target) return

      e.preventDefault()
      e.stopPropagation()

      // Long-press just triggered a preview -- swallow the companion click so
      // we don't navigate away from the article the user is inspecting.
      if (suppressClickRef.current) {
        suppressClickRef.current = false
        return
      }

      if (gameOverRef.current) return

      const href = target.getAttribute('data-wiki-href')
      if (!href) return

      const articleTitle = extractArticleTitle(href)
      if (!articleTitle) return

      // Hide any mouse-hover preview before navigating.
      setPreview(null)
      onNavigateRef.current(articleTitle)
    },
    [],
  )

  // Block context menu on links (prevents iOS Safari's callout menu from
  // hijacking the long-press gesture).
  const handleContextMenu = useCallback((e: MouseEvent) => {
    const target = (e.target as HTMLElement).closest('a[data-wiki-href]')
    if (target) {
      e.preventDefault()
    }
  }, [])

  // Mouse hover: show preview after a short delay. Tracking the hovered
  // anchor in a ref (rather than just acting on e.target) lets the
  // mouseout handler reliably dismiss the preview regardless of which
  // descendant the cursor was sitting on when it left the link.
  const handleMouseOver = useCallback((e: MouseEvent) => {
    const anchor = (e.target as HTMLElement).closest('a[data-wiki-href]') as HTMLElement | null
    if (!anchor) return
    if (hoveredAnchorRef.current === anchor) return
    hoveredAnchorRef.current = anchor
    clearHoverTimer()
    const title = titleFromAnchor(anchor)
    if (!title) return
    hoverTimerRef.current = window.setTimeout(() => {
      if (gameOverRef.current) return
      setPreview({ title, rect: anchor.getBoundingClientRect() })
    }, HOVER_DELAY_MS)
  }, [])

  const handleMouseOut = useCallback((e: MouseEvent) => {
    const tracked = hoveredAnchorRef.current
    if (!tracked) return
    const related = e.relatedTarget as Node | null
    // If the cursor moved into a descendant of the tracked anchor, the
    // hover is unchanged -- keep the preview.
    if (related && tracked.contains(related)) return
    hoveredAnchorRef.current = null
    clearHoverTimer()
    setPreview(null)
  }, [])

  // Touch long-press: show preview, suppress the click that follows.
  const handlePointerDown = useCallback((e: PointerEvent) => {
    if (e.pointerType === 'mouse') return
    const anchor = (e.target as HTMLElement).closest('a[data-wiki-href]') as HTMLElement | null
    if (!anchor) return
    clearLongPressTimer()
    longPressStartRef.current = { x: e.clientX, y: e.clientY }
    longPressTimerRef.current = window.setTimeout(() => {
      if (gameOverRef.current) return
      setPreview({ title: titleFromAnchor(anchor)!, rect: anchor.getBoundingClientRect() })
      suppressClickRef.current = true
    }, LONG_PRESS_MS)
  }, [])

  const handlePointerMove = useCallback((e: PointerEvent) => {
    const start = longPressStartRef.current
    if (!start) return
    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    if (Math.hypot(dx, dy) > LONG_PRESS_MOVE_TOLERANCE) {
      clearLongPressTimer()
    }
  }, [])

  const handlePointerUpOrCancel = useCallback(() => {
    clearLongPressTimer()
  }, [])

  // Attach event listeners -- depends on html/loading because the container
  // div only exists when not loading/erroring
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    el.addEventListener('click', handleClick, true)
    el.addEventListener('contextmenu', handleContextMenu, true)
    el.addEventListener('mouseover', handleMouseOver)
    el.addEventListener('mouseout', handleMouseOut)
    el.addEventListener('pointerdown', handlePointerDown)
    el.addEventListener('pointermove', handlePointerMove)
    el.addEventListener('pointerup', handlePointerUpOrCancel)
    el.addEventListener('pointercancel', handlePointerUpOrCancel)

    return () => {
      el.removeEventListener('click', handleClick, true)
      el.removeEventListener('contextmenu', handleContextMenu, true)
      el.removeEventListener('mouseover', handleMouseOver)
      el.removeEventListener('mouseout', handleMouseOut)
      el.removeEventListener('pointerdown', handlePointerDown)
      el.removeEventListener('pointermove', handlePointerMove)
      el.removeEventListener('pointerup', handlePointerUpOrCancel)
      el.removeEventListener('pointercancel', handlePointerUpOrCancel)
    }
  }, [
    handleClick,
    handleContextMenu,
    handleMouseOver,
    handleMouseOut,
    handlePointerDown,
    handlePointerMove,
    handlePointerUpOrCancel,
    html,
    loading,
  ])

  // Dismiss preview on scroll (anchor rect would be stale) or when the
  // article changes.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onScroll = () => setPreview(null)
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [html, loading])

  useEffect(() => { setPreview(null) }, [title])

  // Keep hoveredAnchorRef consistent with the preview state so an external
  // dismiss (document-level pointerdown, title change) doesn't leave the
  // ref pointing at a stale anchor and block future hover events.
  useEffect(() => { if (!preview) hoveredAnchorRef.current = null }, [preview])

  // Touch: after the long-press popover is visible, the next tap anywhere
  // dismisses it. The 50ms delay prevents the long-press gesture's own
  // pointerup from immediately closing the preview.
  useEffect(() => {
    if (!preview) return
    let dismiss: (() => void) | null = null
    const timer = window.setTimeout(() => {
      dismiss = () => setPreview(null)
      document.addEventListener('pointerdown', dismiss, { once: true })
    }, 50)
    return () => {
      window.clearTimeout(timer)
      if (dismiss) document.removeEventListener('pointerdown', dismiss)
    }
  }, [preview])

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
    <>
      <div
        // Keying on title forces React to mount a fresh DOM node for each
        // article. Without this, React reuses the same <div> across renders
        // and its scrollTop carries over from the previous article.
        key={title}
        ref={containerRef}
        className="wiki-content flex-1 overflow-y-auto px-4 py-3 sm:px-6"
      />
      {preview && (
        <LinkPreviewPopover title={preview.title} anchorRect={preview.rect} />
      )}
    </>
  )
}
