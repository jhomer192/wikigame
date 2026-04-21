import { useEffect, useRef, useState } from 'react'
import type { DailyChallenge, DailyResult } from '../lib/daily'
import { searchArticles } from '../lib/wiki'
import { ThemePicker } from './ThemePicker'

interface StartScreenProps {
  challenge: DailyChallenge
  dailyResult: DailyResult | null
  onStartDaily: () => void
  onStartRandom: () => void
  onStartCustom: (start: string, end: string) => Promise<string | null>
  onViewDailyResult: () => void
  randomLoading?: boolean
}

function getDifficultyLabel(d: string): { text: string; color: string } {
  switch (d) {
    case 'easy': return { text: 'Easy', color: 'bg-success/15 text-success' }
    case 'medium': return { text: 'Medium', color: 'bg-warning/15 text-warning' }
    case 'hard': return { text: 'Hard', color: 'bg-danger/15 text-danger' }
    default: return { text: d, color: 'bg-text/15 text-text' }
  }
}

interface ArticleSearchProps {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
}

function ArticleSearch({ label, value, onChange, placeholder }: ArticleSearchProps) {
  const [query, setQuery] = useState(value)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const abortRef = useRef<AbortController | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Keep local query in sync when parent clears it
  useEffect(() => {
    setQuery(value)
  }, [value])

  // Debounced search
  useEffect(() => {
    if (query.trim().length < 2) {
      setSuggestions([])
      return
    }
    const handle = setTimeout(() => {
      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl
      searchArticles(query, ctrl.signal)
        .then((results) => {
          if (!ctrl.signal.aborted) {
            setSuggestions(results)
            setHighlight(-1)
          }
        })
        .catch(() => { /* aborted or network err -- ignore */ })
    }, 200)
    return () => clearTimeout(handle)
  }, [query])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const pick = (title: string) => {
    setQuery(title)
    onChange(title)
    setOpen(false)
    setSuggestions([])
  }

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => Math.min(h + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter' && highlight >= 0) {
      e.preventDefault()
      pick(suggestions[highlight])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-xs font-medium text-text/70 mb-1">{label}</label>
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKey}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg bg-bg border border-border text-text-bright placeholder:text-text/40 focus:outline-none focus:border-accent"
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-10 left-0 right-0 mt-1 bg-bg-card border border-border rounded-lg shadow-lg max-h-56 overflow-y-auto">
          {suggestions.map((title, i) => (
            <li
              key={title}
              onMouseDown={(e) => { e.preventDefault(); pick(title) }}
              onMouseEnter={() => setHighlight(i)}
              className={`px-3 py-2 text-sm cursor-pointer ${
                i === highlight ? 'bg-accent/20 text-text-bright' : 'text-text hover:bg-bg-hover'
              }`}
            >
              {title}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function StartScreen({
  challenge,
  dailyResult,
  onStartDaily,
  onStartRandom,
  onStartCustom,
  onViewDailyResult,
  randomLoading = false,
}: StartScreenProps) {
  const diff = getDifficultyLabel(challenge.difficulty)
  const [customOpen, setCustomOpen] = useState(false)
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [customError, setCustomError] = useState<string | null>(null)
  const [customLoading, setCustomLoading] = useState(false)

  const handleCustomPlay = async () => {
    const start = customStart.trim()
    const end = customEnd.trim()
    if (!start || !end) {
      setCustomError('Choose both a start and a target article.')
      return
    }
    if (start.toLowerCase() === end.toLowerCase()) {
      setCustomError('Start and target must be different.')
      return
    }
    setCustomError(null)
    setCustomLoading(true)
    const err = await onStartCustom(start, end)
    setCustomLoading(false)
    if (err) setCustomError(err)
  }

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        {/* Logo */}
        <div className="mb-6">
          <div className="flex items-center justify-center gap-3 mb-2">
            <h1 className="text-4xl sm:text-5xl font-bold text-text-bright tracking-tight">
              WikiGame
            </h1>
            <ThemePicker />
          </div>
          <p className="text-text/60 text-sm">
            Navigate Wikipedia from one article to another by clicking links.
          </p>
        </div>

        {/* Daily challenge card */}
        <div className="bg-bg-card rounded-2xl p-6 border border-border mb-3">
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="text-xs font-medium text-text/60">
              Daily Challenge #{challenge.challengeNumber}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${diff.color}`}>
              {diff.text}
            </span>
          </div>

          {dailyResult?.completed ? (
            <>
              <div className="text-sm text-success mb-3">
                &#x2713; Today's challenge completed in {dailyResult.hops} hop{dailyResult.hops === 1 ? '' : 's'}
              </div>
              <button
                onClick={onViewDailyResult}
                className="w-full py-3 rounded-xl bg-bg border border-border text-text-bright font-semibold hover:border-accent transition-colors"
              >
                View result
              </button>
            </>
          ) : dailyResult?.gaveUp ? (
            <>
              <div className="text-sm text-warning mb-3">
                &#x1F3F3;&#xFE0F; You gave up after {dailyResult.hops} hop{dailyResult.hops === 1 ? '' : 's'}
              </div>
              <button
                onClick={onViewDailyResult}
                className="w-full py-3 rounded-xl bg-bg border border-border text-text-bright font-semibold hover:border-accent transition-colors"
              >
                View result
              </button>
            </>
          ) : (
            <>
              <p className="text-text/50 text-sm mb-5">
                Tap play to reveal today's articles
              </p>
              <button
                onClick={onStartDaily}
                className="w-full py-3.5 rounded-xl bg-accent text-white font-semibold text-lg hover:bg-accent-dim transition-colors"
              >
                Play
              </button>
            </>
          )}
        </div>

        {/* Random + Custom */}
        <div className="grid grid-cols-2 gap-2 mb-2">
          <button
            onClick={onStartRandom}
            disabled={randomLoading}
            className="py-3 rounded-xl bg-bg-card border border-border text-text-bright font-semibold hover:border-accent transition-colors disabled:opacity-60 disabled:cursor-wait"
          >
            {randomLoading ? 'Finding…' : '\u{1f3b2} Random'}
          </button>
          <button
            onClick={() => {
              setCustomOpen((v) => !v)
              setCustomError(null)
            }}
            className={`py-3 rounded-xl border font-semibold transition-colors ${
              customOpen
                ? 'bg-accent/10 border-accent text-text-bright'
                : 'bg-bg-card border-border text-text-bright hover:border-accent'
            }`}
          >
            &#x2699; Custom
          </button>
        </div>

        {/* Custom form */}
        {customOpen && (
          <div className="bg-bg-card rounded-2xl p-5 border border-border mb-2 text-left space-y-3">
            <ArticleSearch
              label="Start article"
              value={customStart}
              onChange={setCustomStart}
              placeholder="e.g. Banana"
            />
            <ArticleSearch
              label="Target article"
              value={customEnd}
              onChange={setCustomEnd}
              placeholder="e.g. Philosophy"
            />
            {customError && (
              <div className="text-xs text-danger">{customError}</div>
            )}
            <button
              onClick={handleCustomPlay}
              disabled={customLoading}
              className="w-full py-2.5 rounded-lg bg-accent text-white font-semibold hover:bg-accent-dim transition-colors disabled:opacity-50"
            >
              {customLoading ? 'Checking…' : 'Play custom'}
            </button>
          </div>
        )}

        {/* How to play */}
        <div className="mt-6 text-left bg-bg-card rounded-2xl p-5 border border-border">
          <h3 className="text-sm font-semibold text-text-bright mb-3">How to play</h3>
          <p className="text-sm text-text-bright mb-3 font-medium">
            Race from a random start article to a target article using only the links inside each Wikipedia page.
          </p>
          <ol className="text-sm text-text space-y-2">
            <li className="flex gap-2">
              <span className="text-accent font-bold">1.</span>
              <span>You start on a Wikipedia article</span>
            </li>
            <li className="flex gap-2">
              <span className="text-accent font-bold">2.</span>
              <span>Click links within the article to navigate to other articles</span>
            </li>
            <li className="flex gap-2">
              <span className="text-accent font-bold">3.</span>
              <span>Reach the target article in as few hops as possible</span>
            </li>
            <li className="flex gap-2">
              <span className="text-accent font-bold">4.</span>
              <span>No searching allowed -- only clicking links!</span>
            </li>
          </ol>
        </div>

        {/* Donate */}
        <div className="mt-6 mb-4">
          <a
            href="https://donate.wikimedia.org"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-success/70 hover:text-success transition-colors"
          >
            Built on Wikipedia content. Please consider donating.
          </a>
        </div>
      </div>
    </div>
  )
}
