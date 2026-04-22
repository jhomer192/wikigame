import { useEffect, useRef, useState } from 'react'
import { getCachedBotPath, cacheBotPath, solvePath } from '../lib/solver'

interface ReadyScreenProps {
  startArticle: string
  endArticle: string
  /** Stable cache id: challenge number for daily, `start||end` string otherwise. */
  botCacheKey: number | string
  onBegin: (botHops: number | null) => void
  onCancel: () => void
}

// Rough-estimate: how many seconds of game time each bot hop is worth as a
// par target for the player. Calibrated from feel -- most humans can skim a
// Wikipedia article, find a relevant link, and click it in ~25s.
const SECONDS_PER_HOP = 25

function formatTargetTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s === 0 ? `${m}m` : `${m}m ${s}s`
}

/**
 * Shown between StartScreen and the playing state. While the player reads the
 * articles, the bot solver runs in the background. When it finishes we show
 * the player a par target (bot's hop count + an estimated time budget) so
 * there's a concrete score to chase. The player can tap Begin at any time --
 * they don't have to wait for the bot.
 */
export default function ReadyScreen({
  startArticle,
  endArticle,
  botCacheKey,
  onBegin,
  onCancel,
}: ReadyScreenProps) {
  const [botHops, setBotHops] = useState<number | null>(null)
  const [botLoading, setBotLoading] = useState(false)
  const [botFailed, setBotFailed] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  // Kick off solver on mount. If we already cached the bot path (e.g. user
  // replaying a daily), skip straight to showing the target.
  useEffect(() => {
    const cached = getCachedBotPath(botCacheKey)
    if (cached) {
      setBotHops(cached.length - 1)
      return
    }

    const controller = new AbortController()
    abortRef.current = controller
    setBotLoading(true)
    setBotFailed(false)

    solvePath(startArticle, endArticle, undefined, controller.signal)
      .then((path) => {
        if (controller.signal.aborted) return
        if (path.length > 0) {
          cacheBotPath(botCacheKey, path)
          setBotHops(path.length - 1)
        } else {
          setBotFailed(true)
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setBotFailed(true)
      })
      .finally(() => {
        if (!controller.signal.aborted) setBotLoading(false)
      })

    return () => {
      controller.abort()
    }
  }, [botCacheKey, startArticle, endArticle])

  const targetTime = botHops !== null ? botHops * SECONDS_PER_HOP : null

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-text-bright mb-1">Ready?</h2>
          <p className="text-sm text-text/60">Race from the first article to the second.</p>
        </div>

        {/* Start & target articles */}
        <div className="bg-bg-card rounded-2xl border border-border p-5 mb-4">
          <div className="text-left">
            <div className="text-xs text-text/60 mb-1">Start</div>
            <div className="text-lg font-bold text-accent mb-3">{startArticle}</div>
            <div className="text-xs text-text/60 mb-1">Target</div>
            <div className="text-lg font-bold text-success">{endArticle}</div>
          </div>
        </div>

        {/* Par target card */}
        <div className="bg-bg-card rounded-2xl border border-border p-5 mb-4 min-h-[120px] flex items-center justify-center">
          {botLoading && botHops === null && (
            <div className="flex items-center gap-2 text-sm text-text/60">
              <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              <span>Bot is solving to set your par target...</span>
            </div>
          )}
          {botFailed && botHops === null && (
            <div className="text-sm text-text/60">
              Bot got stuck. No par target for this one -- go freestyle.
            </div>
          )}
          {botHops !== null && (
            <div className="w-full">
              <div className="text-xs text-text/60 mb-2">Bot's par target</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-3xl font-bold font-mono text-text-bright">{botHops}</div>
                  <div className="text-xs text-text/60 mt-1">hop{botHops === 1 ? '' : 's'}</div>
                </div>
                <div>
                  <div className="text-3xl font-bold font-mono text-text-bright">
                    {formatTargetTime(targetTime!)}
                  </div>
                  <div className="text-xs text-text/60 mt-1">time (est)</div>
                </div>
              </div>
              <div className="text-xs text-text/50 mt-3">
                Beat either one to brag. Time estimate is ~{SECONDS_PER_HOP}s per hop.
              </div>
            </div>
          )}
        </div>

        <button
          onClick={() => onBegin(botHops)}
          className="w-full py-3.5 rounded-xl bg-accent text-white font-semibold text-lg hover:bg-accent-dim transition-colors"
        >
          Begin game
        </button>
        <button
          onClick={onCancel}
          className="w-full mt-2 py-2 text-sm text-text/60 hover:text-text-bright transition-colors"
        >
          ← Back
        </button>
      </div>
    </div>
  )
}
