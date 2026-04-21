import { useEffect, useRef, useState } from 'react'
import { ThemePicker } from './ThemePicker'
import TargetPreviewModal from './TargetPreviewModal'

interface TopBarProps {
  currentArticle: string
  targetArticle: string
  path: string[]
  hops: number
  startTime: number | null
  gameOver: boolean
  onBack: () => void
  canGoBack: boolean
  onGiveUp: () => void
  onQuit: () => void
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function TopBar({
  currentArticle,
  targetArticle,
  path,
  hops,
  startTime,
  gameOver,
  onBack,
  canGoBack,
  onGiveUp,
  onQuit,
}: TopBarProps) {
  const [elapsed, setElapsed] = useState(0)
  const [showPreview, setShowPreview] = useState(false)
  const trailRef = useRef<HTMLDivElement>(null)

  // Auto-scroll the breadcrumb to the right as new hops are added
  useEffect(() => {
    if (trailRef.current) {
      trailRef.current.scrollLeft = trailRef.current.scrollWidth
    }
  }, [path.length])

  useEffect(() => {
    if (!startTime || gameOver) return
    const tick = () => setElapsed(Math.floor((Date.now() - startTime) / 1000))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [startTime, gameOver])

  return (
    <header className="flex-shrink-0 bg-bg-card border-b border-border px-3 py-2">
      {/* Top row: logo + donate */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-text-bright tracking-tight">WikiGame</span>
          <span className="text-xs text-text/60 hidden sm:inline">Daily Wikipedia Racing</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemePicker />
          <button
            onClick={onGiveUp}
            className="text-xs px-2.5 py-1 rounded-full bg-danger/15 text-danger hover:bg-danger/25 transition-colors font-medium"
          >
            Give Up
          </button>
          <button
            onClick={onQuit}
            className="text-xs px-2.5 py-1 rounded-full bg-text/10 text-text/60 hover:bg-text/20 transition-colors font-medium"
          >
            Quit
          </button>
          <a
            href="https://donate.wikimedia.org"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs px-2.5 py-1 rounded-full bg-success/15 text-success hover:bg-success/25 transition-colors font-medium hidden sm:inline"
          >
            Donate
          </a>
        </div>
      </div>

      {/* Game info row */}
      <div className="flex items-center gap-2 text-sm">
        {/* Back button */}
        <button
          onClick={onBack}
          disabled={!canGoBack}
          className="p-1.5 rounded-lg hover:bg-bg-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-text-bright"
          title="Go back"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Current article */}
        <div className="flex-1 min-w-0">
          <div className="truncate text-text-bright font-medium">{currentArticle}</div>
        </div>

        {/* Hop counter */}
        <div className="flex items-center gap-1 bg-bg/50 px-2 py-1 rounded-lg">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
            <path d="M13 17l5-5-5-5M6 17l5-5-5-5" />
          </svg>
          <span className="font-mono font-bold text-text-bright">{hops}</span>
        </div>

        {/* Timer */}
        <div className="flex items-center gap-1 bg-bg/50 px-2 py-1 rounded-lg font-mono text-text-bright">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-warning">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
          {formatTime(elapsed)}
        </div>
      </div>

      {/* Target reminder */}
      <div className="mt-1.5 flex items-center gap-1.5 text-xs">
        <span className="text-text/60">Target:</span>
        <button
          onClick={() => setShowPreview(true)}
          className="font-medium text-success hover:opacity-80 underline decoration-dotted underline-offset-2 transition-opacity inline-flex items-center gap-1"
          title="Preview target article"
        >
          {targetArticle}
          <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
          </svg>
        </button>
      </div>

      {/* Path breadcrumb */}
      {path.length > 1 && (
        <div
          ref={trailRef}
          className="mt-1.5 flex items-center gap-1 text-xs overflow-x-auto whitespace-nowrap scrollbar-thin"
        >
          <span className="text-text/60 flex-shrink-0">Path:</span>
          {path.map((title, i) => (
            <span key={i} className="flex items-center gap-1 flex-shrink-0">
              {i > 0 && (
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-text/40">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              )}
              <span
                className={
                  i === path.length - 1
                    ? 'font-medium text-accent'
                    : 'text-text/70'
                }
                title={title}
              >
                {title}
              </span>
            </span>
          ))}
        </div>
      )}

      {showPreview && (
        <TargetPreviewModal
          title={targetArticle}
          onClose={() => setShowPreview(false)}
        />
      )}
    </header>
  )
}
