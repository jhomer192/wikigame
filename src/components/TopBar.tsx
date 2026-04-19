import { useEffect, useState } from 'react'
import { ThemePicker } from './ThemePicker'

interface TopBarProps {
  currentArticle: string
  targetArticle: string
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
  hops,
  startTime,
  gameOver,
  onBack,
  canGoBack,
  onGiveUp,
  onQuit,
}: TopBarProps) {
  const [elapsed, setElapsed] = useState(0)

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
        <span className="font-medium text-success">{targetArticle}</span>
      </div>
    </header>
  )
}
