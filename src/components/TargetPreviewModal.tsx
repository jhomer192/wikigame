import { useEffect, useState } from 'react'
import { fetchArticleSummary, type ArticleSummary } from '../lib/wiki'

interface TargetPreviewModalProps {
  title: string
  onClose: () => void
}

export default function TargetPreviewModal({ title, onClose }: TargetPreviewModalProps) {
  const [summary, setSummary] = useState<ArticleSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const ctrl = new AbortController()
    fetchArticleSummary(title, ctrl.signal)
      .then((s) => setSummary(s))
      .catch((e) => {
        if (!ctrl.signal.aborted) setError(e.message || 'Failed to load preview')
      })
    return () => ctrl.abort()
  }, [title])

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
        className="relative bg-bg-card border border-border rounded-2xl w-full max-w-md max-h-[80vh] overflow-y-auto shadow-2xl"
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

        <div className="p-5">
          <div className="text-xs uppercase tracking-wide text-success/80 font-semibold mb-2">
            Target article
          </div>

          {summary?.thumbnail && (
            <img
              src={summary.thumbnail.source}
              alt=""
              className="w-full max-h-48 object-cover rounded-lg mb-3 bg-bg"
            />
          )}

          <h2 className="text-xl font-bold text-text-bright mb-1">
            {summary?.title ?? title}
          </h2>

          {summary?.description && (
            <div className="text-sm text-text/70 italic mb-3">
              {summary.description}
            </div>
          )}

          {error ? (
            <div className="text-sm text-danger">{error}</div>
          ) : summary ? (
            <p className="text-sm text-text leading-relaxed whitespace-pre-wrap">
              {summary.extract || '(No summary available.)'}
            </p>
          ) : (
            <div className="flex items-center gap-2 text-sm text-text/60">
              <div className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
              Loading preview…
            </div>
          )}

          <div className="mt-4 text-xs text-text/50 border-t border-border pt-3">
            Navigate here by clicking links in the article you're on. No direct jumping!
          </div>
        </div>
      </div>
    </div>
  )
}
