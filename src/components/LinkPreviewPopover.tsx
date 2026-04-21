import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { fetchArticleSummary, type ArticleSummary } from '../lib/wiki'

interface Props {
  title: string
  anchorRect: DOMRect
}

// Module-level cache: previewing the same link repeatedly shouldn't re-fetch.
const cache = new Map<string, ArticleSummary | { __error: string }>()

export default function LinkPreviewPopover({ title, anchorRect }: Props) {
  const cached = cache.get(title)
  const [summary, setSummary] = useState<ArticleSummary | null>(
    cached && !('__error' in cached) ? cached : null,
  )
  const [error, setError] = useState<string | null>(
    cached && '__error' in cached ? cached.__error : null,
  )
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: -9999, left: -9999 })

  useEffect(() => {
    if (summary || error) return
    const ctrl = new AbortController()
    fetchArticleSummary(title, ctrl.signal)
      .then((s) => {
        cache.set(title, s)
        setSummary(s)
      })
      .catch((e: unknown) => {
        if (ctrl.signal.aborted) return
        const msg = e instanceof Error ? e.message : 'Failed to load preview'
        cache.set(title, { __error: msg })
        setError(msg)
      })
    return () => ctrl.abort()
  }, [title, summary, error])

  // Position relative to the anchor element, clamped to viewport.
  useLayoutEffect(() => {
    if (!ref.current) return
    const card = ref.current.getBoundingClientRect()
    const margin = 8
    const vw = window.innerWidth
    const vh = window.innerHeight

    // Prefer below the link; flip above if there's not enough room.
    let top = anchorRect.bottom + margin
    if (top + card.height > vh - margin) {
      top = Math.max(margin, anchorRect.top - card.height - margin)
    }

    let left = anchorRect.left + anchorRect.width / 2 - card.width / 2
    left = Math.max(margin, Math.min(vw - card.width - margin, left))

    setPos({ top, left })
  }, [anchorRect, summary, error])

  return (
    <div
      ref={ref}
      role="tooltip"
      // pointer-events-none so hovering the preview doesn't block the
      // mouseleave on the underlying link.
      className="fixed z-40 w-72 max-w-[calc(100vw-16px)] bg-bg-card border border-border rounded-xl shadow-2xl overflow-hidden pointer-events-none"
      style={{ top: pos.top, left: pos.left }}
    >
      {summary?.thumbnail && (
        <img
          src={summary.thumbnail.source}
          alt=""
          className="w-full max-h-32 object-cover bg-bg"
        />
      )}
      <div className="p-3">
        <div className="text-sm font-bold text-text-bright leading-tight">
          {summary?.title ?? title}
        </div>
        {summary?.description && (
          <div className="text-xs text-text/70 italic mt-0.5">
            {summary.description}
          </div>
        )}
        {error ? (
          <div className="text-xs text-danger mt-2">{error}</div>
        ) : summary ? (
          <p className="text-xs text-text leading-snug mt-2 line-clamp-5">
            {summary.extract || '(No summary available.)'}
          </p>
        ) : (
          <div className="flex items-center gap-2 text-xs text-text/60 mt-2">
            <div className="w-3 h-3 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
            Loading…
          </div>
        )}
      </div>
    </div>
  )
}
