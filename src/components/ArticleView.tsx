import { useEffect, useRef, useState, useCallback } from 'react'
import { fetchArticleHtml, extractArticleTitle, isMetaTitle } from '../lib/wiki'

interface ArticleViewProps {
  title: string
  onNavigate: (title: string) => void
  gameOver: boolean
}

export default function ArticleView({ title, onNavigate, gameOver }: ArticleViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [html, setHtml] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch article HTML
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)

    fetchArticleHtml(title, controller.signal)
      .then((content) => {
        setHtml(content)
        setLoading(false)
        // Scroll to top on new article
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
  const handleClick = useCallback(
    (e: MouseEvent) => {
      if (gameOver) return

      const target = (e.target as HTMLElement).closest('a')
      if (!target) return

      e.preventDefault()
      e.stopPropagation()

      const href = target.getAttribute('href')
      if (!href) return

      const articleTitle = extractArticleTitle(href)
      if (!articleTitle) return
      if (isMetaTitle(articleTitle)) return

      onNavigate(articleTitle)
    },
    [onNavigate, gameOver],
  )

  // Block context menu on links
  const handleContextMenu = useCallback((e: MouseEvent) => {
    const target = (e.target as HTMLElement).closest('a')
    if (target) {
      e.preventDefault()
    }
  }, [])

  // Attach event listeners
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    el.addEventListener('click', handleClick)
    el.addEventListener('contextmenu', handleContextMenu)

    return () => {
      el.removeEventListener('click', handleClick)
      el.removeEventListener('contextmenu', handleContextMenu)
    }
  }, [handleClick, handleContextMenu])

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
                .then(setHtml)
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
