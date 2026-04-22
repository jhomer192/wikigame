import { useEffect, useRef, useState } from 'react'
import { fetchArticleReadOnlyHtml, fetchArticleSummary, type ArticleSummary } from '../lib/wiki'

interface TargetPreviewModalProps {
  title: string
  onClose: () => void
}

export default function TargetPreviewModal({ title, onClose }: TargetPreviewModalProps) {
  const [summary, setSummary] = useState<ArticleSummary | null>(null)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [fullHtml, setFullHtml] = useState<string | null>(null)
  const [fullError, setFullError] = useState<string | null>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

  // Fast path: hit the summary endpoint so the header (title, description,
  // thumbnail, first paragraph) appears immediately while the full body
  // is still loading.
  useEffect(() => {
    const ctrl = new AbortController()
    fetchArticleSummary(title, ctrl.signal)
      .then((s) => setSummary(s))
      .catch((e) => {
        if (!ctrl.signal.aborted) setSummaryError(e.message || 'Failed to load preview')
      })
    return () => ctrl.abort()
  }, [title])

  // Slow path: fetch the full article HTML, strip all links so the player
  // can read more detail / browse infoboxes and tables without being able
  // to click through to the target.
  useEffect(() => {
    const ctrl = new AbortController()
    fetchArticleReadOnlyHtml(title, ctrl.signal)
      .then((html) => setFullHtml(html))
      .catch((e) => {
        if (!ctrl.signal.aborted) setFullError(e.message || 'Failed to load full article')
      })
    return () => ctrl.abort()
  }, [title])

  // Apply the fetched HTML to our container by hand -- avoids React's
  // dangerouslySetInnerHTML reconciliation thrashing on state updates.
  useEffect(() => {
    if (!bodyRef.current) return
    bodyRef.current.innerHTML = fullHtml ?? ''
  }, [fullHtml])

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative bg-bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close preview"
          className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-bg/70 hover:bg-bg text-text hover:text-text-bright transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        {/* Fixed header */}
        <div className="p-5 pb-3 border-b border-border">
          <div className="text-xs uppercase tracking-wide text-success/80 font-semibold mb-2">
            Target article
          </div>

          {summary?.thumbnail && (
            <img
              src={summary.thumbnail.source}
              alt=""
              className="w-full max-h-40 object-cover rounded-lg mb-3 bg-bg"
            />
          )}

          <h2 className="text-xl font-bold text-text-bright mb-1">
            {summary?.title ?? title}
          </h2>

          {summary?.description && (
            <div className="text-sm text-text/70 italic">
              {summary.description}
            </div>
          )}

          {summaryError && !summary && (
            <div className="text-sm text-danger">{summaryError}</div>
          )}
        </div>

        {/* Scrollable body -- full article with every link stripped */}
        <div className="flex-1 overflow-y-auto">
          {fullHtml ? (
            <div ref={bodyRef} className="wiki-content target-preview px-5 py-4" />
          ) : fullError ? (
            // Fallback to the summary extract if full-article fetch failed.
            <div className="p-5">
              {summary ? (
                <p className="text-sm text-text leading-relaxed whitespace-pre-wrap">
                  {summary.extract || '(No summary available.)'}
                </p>
              ) : (
                <div className="text-sm text-danger">{fullError}</div>
              )}
            </div>
          ) : (
            // Full body still loading -- show summary extract as a placeholder.
            <div className="p-5">
              {summary ? (
                <>
                  <p className="text-sm text-text leading-relaxed whitespace-pre-wrap">
                    {summary.extract || '(No summary available.)'}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-text/50 mt-4">
                    <div className="w-3 h-3 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                    Loading full article…
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2 text-sm text-text/60">
                  <div className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                  Loading preview…
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-5 py-3 text-xs text-text/50 border-t border-border">
          All links stripped — read freely, but you still have to navigate here the hard way.
        </div>
      </div>
    </div>
  )
}
