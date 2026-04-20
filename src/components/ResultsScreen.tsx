import { useEffect, useRef, useState } from 'react'
import type { DailyChallenge } from '../lib/daily'
import { buildShareText } from '../lib/daily'
import { getCachedBotPath, cacheBotPath, solvePath } from '../lib/solver'

interface ResultsScreenProps {
  challenge: DailyChallenge | null
  path: string[]
  hops: number
  timeSeconds: number
  isDaily: boolean
  gaveUp?: boolean
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
}

function getDifficultyColor(d: string): string {
  switch (d) {
    case 'easy': return 'text-success'
    case 'medium': return 'text-warning'
    case 'hard': return 'text-danger'
    default: return 'text-text'
  }
}

function PathVisualization({ path, label, incomplete }: { path: string[]; label?: string; incomplete?: boolean }) {
  const visited = new Set<string>()
  return (
    <div className="bg-bg-card rounded-xl p-4 border border-border mb-4">
      {label && <h3 className="text-sm font-semibold text-text-bright mb-3">{label}</h3>}
      <div className="space-y-0">
        {path.map((title, i) => {
          const isFirst = i === 0
          const isLast = i === path.length - 1
          const isBacktrack = !isFirst && visited.has(title)
          visited.add(title)
          // When incomplete, the last article isn't the target -- render it
          // as a neutral stopping point rather than a green success dot.
          const lastColor = incomplete ? 'bg-text/30' : 'bg-success'
          const dotColor = isFirst ? 'bg-accent' : isLast ? lastColor : isBacktrack ? 'bg-danger' : 'bg-border'
          const textColor = isBacktrack ? 'text-danger/70' : (isFirst || isLast) ? 'text-text-bright font-medium' : 'text-text'
          return (
            <div key={i} className="flex items-start gap-2">
              <div className="flex flex-col items-center">
                <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${dotColor}`} />
                {i < path.length - 1 && (
                  <div className="w-px h-5 bg-border" />
                )}
              </div>
              <div className={`text-sm pb-1 ${textColor}`}>
                {title}{isBacktrack ? ' \u21a9' : ''}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function ResultsScreen({
  challenge,
  path,
  hops,
  timeSeconds,
  isDaily,
  gaveUp = false,
}: ResultsScreenProps) {
  const [botPath, setBotPath] = useState<string[] | null>(null)
  const [botLoading, setBotLoading] = useState(false)
  const [botStep, setBotStep] = useState<string | null>(null)
  const [botError, setBotError] = useState(false)
  const [showBot, setShowBot] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  // On mount, check cache for bot path
  useEffect(() => {
    if (challenge) {
      const cached = getCachedBotPath(challenge.challengeNumber)
      if (cached) {
        setBotPath(cached)
        setShowBot(true)
      }
    }
  }, [challenge])

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => { abortRef.current?.abort() }
  }, [])

  const runBot = async () => {
    if (!challenge) return
    setShowBot(true)
    setBotLoading(true)
    setBotError(false)
    setBotStep(null)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const result = await solvePath(
        challenge.start,
        challenge.end,
        (title) => setBotStep(title),
        controller.signal,
      )
      if (result.length > 0) {
        setBotPath(result)
        cacheBotPath(challenge.challengeNumber, result)
      } else {
        setBotError(true)
      }
    } catch {
      if (!controller.signal.aborted) {
        setBotError(true)
      }
    } finally {
      setBotLoading(false)
      setBotStep(null)
    }
  }

  const botHops = botPath ? botPath.length - 1 : null
  const playerBeatBot = !gaveUp && botHops !== null && hops < botHops
  const playerTiedBot = !gaveUp && botHops !== null && hops === botHops

  const handleShare = async () => {
    if (!challenge) return
    const text = buildShareText(challenge, hops, timeSeconds, path, gaveUp)
    try {
      if (navigator.share) {
        await navigator.share({ text })
      } else {
        await navigator.clipboard.writeText(text)
        const btn = document.getElementById('share-btn')
        if (btn) {
          btn.textContent = 'Copied!'
          setTimeout(() => { btn.textContent = 'Share Results' }, 2000)
        }
      }
    } catch {
      // User cancelled share
    }
  }

  return (
    <div className="flex-1 overflow-y-auto flex items-start justify-center p-4 pt-8">
      <div className="w-full max-w-md">
        {/* Result header */}
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">{gaveUp ? '\u{1F3F3}\u{FE0F}' : '\u{1F389}'}</div>
          <h2 className="text-2xl font-bold text-text-bright mb-1">
            {gaveUp ? 'Gave up' : 'You made it!'}
          </h2>
          {gaveUp && (
            <p className="text-sm text-text/60 mb-1">
              Target was{' '}
              <span className="text-text-bright font-medium">
                {challenge?.end ?? path[path.length - 1]}
              </span>
            </p>
          )}
          {challenge && (
            <div className="text-sm text-text/60">
              {isDaily ? `WikiGame #${challenge.challengeNumber}` : 'Random Challenge'}
              {' \u00B7 '}
              <span className={getDifficultyColor(challenge.difficulty)}>
                {challenge.difficulty}
              </span>
            </div>
          )}
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-bg-card rounded-xl p-4 text-center border border-border">
            <div className="text-3xl font-bold font-mono text-text-bright">{hops}</div>
            <div className="text-xs text-text/60 mt-1">{gaveUp ? 'Hops taken' : 'Hops'}</div>
          </div>
          <div className="bg-bg-card rounded-xl p-4 text-center border border-border">
            <div className="text-3xl font-bold font-mono text-text-bright">{formatTime(timeSeconds)}</div>
            <div className="text-xs text-text/60 mt-1">Time</div>
          </div>
        </div>

        {/* Comparison header when bot result is available */}
        {botHops !== null && (
          <div className="text-center mb-4">
            <div className="text-sm font-semibold text-text-bright">
              You: {hops} hop{hops !== 1 ? 's' : ''} | Bot: {botHops} hop{botHops !== 1 ? 's' : ''}
            </div>
            {playerBeatBot && (
              <div className="text-sm font-bold text-success mt-1">
                You beat the bot!
              </div>
            )}
            {playerTiedBot && (
              <div className="text-sm font-bold text-warning mt-1">
                Tied with the bot!
              </div>
            )}
          </div>
        )}

        {/* Player's path */}
        <PathVisualization path={path} label="Your path" incomplete={gaveUp} />

        {/* Bot path section */}
        {!showBot && challenge && (
          <button
            onClick={runBot}
            className="w-full py-3 rounded-xl bg-bg-card border border-border text-text-bright font-semibold hover:bg-bg-hover transition-colors mb-4"
          >
            See how the bot did it
          </button>
        )}

        {showBot && botLoading && (
          <div className="bg-bg-card rounded-xl p-4 border border-border mb-4">
            <h3 className="text-sm font-semibold text-text-bright mb-2">Bot's path</h3>
            <div className="flex items-center gap-2 text-sm text-text/60">
              <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              <span>
                {botStep ? `Visiting: ${botStep}` : 'Bot is thinking...'}
              </span>
            </div>
          </div>
        )}

        {showBot && botError && (
          <div className="bg-bg-card rounded-xl p-4 border border-border mb-4">
            <h3 className="text-sm font-semibold text-text-bright mb-2">Bot's path</h3>
            <div className="text-sm text-text/60">The bot got stuck on this one.</div>
          </div>
        )}

        {showBot && botPath && !botLoading && (
          <PathVisualization path={botPath} label="Bot's path" />
        )}

        {/* Copy path button */}
        <button
          id="copy-path-btn"
          onClick={async () => {
            const pathText = path.join(' → ')
            try {
              await navigator.clipboard.writeText(pathText)
              const btn = document.getElementById('copy-path-btn')
              if (btn) { btn.textContent = 'Path Copied!'; setTimeout(() => { btn.textContent = 'Copy My Path' }, 2000) }
            } catch { /* */ }
          }}
          className="w-full py-2.5 rounded-xl bg-bg-card border border-border text-text font-medium hover:bg-bg-hover transition-colors text-sm mb-4"
        >
          Copy My Path
        </button>

        {/* Action buttons */}
        <div className="space-y-3">
          <button
            id="share-btn"
            onClick={handleShare}
            className="w-full py-3 rounded-xl bg-accent text-white font-semibold hover:bg-accent-dim transition-colors"
          >
            Share Results
          </button>
        </div>

        {/* Wikipedia credit */}
        <div className="text-center mt-6 mb-4">
          <a
            href="https://donate.wikimedia.org"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-success/80 hover:text-success transition-colors"
          >
            Content from Wikipedia. Please consider donating.
          </a>
        </div>
      </div>
    </div>
  )
}
