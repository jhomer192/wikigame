import { useState, useCallback, useEffect } from 'react'
import { getDailyChallenge, getRandomChallenge, getSavedResult, saveDailyResult, todayLocal } from './lib/daily'
import { articleExists, titlesMatch } from './lib/wiki'
import type { DailyChallenge } from './lib/daily'
import StartScreen from './components/StartScreen'
import ReadyScreen from './components/ReadyScreen'
import TopBar from './components/TopBar'
import ArticleView from './components/ArticleView'
import ResultsScreen from './components/ResultsScreen'
import TargetPreviewModal from './components/TargetPreviewModal'

type GameState = 'start' | 'ready' | 'playing' | 'results'

interface GameSession {
  startArticle: string
  endArticle: string
  currentArticle: string
  path: string[]
  history: string[] // for back button
  startTime: number
  isDaily: boolean
  challenge: DailyChallenge | null
  /** Bot's hop count -- set when the player leaves the ready screen. */
  botHops: number | null
}

const SESSION_KEY = 'wikigame-session'

function loadSession(): { gameState: GameState; session: GameSession | null } | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* */ }
  return null
}

function persistSession(gameState: GameState, session: GameSession | null) {
  try {
    if (gameState === 'playing' && session) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ gameState, session }))
    } else {
      sessionStorage.removeItem(SESSION_KEY)
    }
  } catch { /* */ }
}

export default function App() {
  const saved = loadSession()
  const [gameState, setGameState] = useState<GameState>(saved?.gameState ?? 'start')
  const [session, setSession] = useState<GameSession | null>(saved?.session ?? null)
  const [finalTime, setFinalTime] = useState(0)
  const [gaveUp, setGaveUp] = useState(false)
  const [showMobilePreview, setShowMobilePreview] = useState(false)
  const dailyChallenge = getDailyChallenge()
  const dailyResult = getSavedResult(todayLocal())

  // Persist session so path survives page navigation
  useEffect(() => {
    persistSession(gameState, session)
  }, [gameState, session])

  // Enter the "ready" state: articles are chosen, bot is solving for par
  // target, but the clock hasn't started yet. Timer begins when the player
  // hits Begin on the ready screen.
  const startGame = useCallback((start: string, end: string, isDaily: boolean, challenge: DailyChallenge | null) => {
    const newSession: GameSession = {
      startArticle: start,
      endArticle: end,
      currentArticle: start,
      path: [start],
      history: [],
      startTime: 0, // set at handleBegin
      isDaily,
      challenge,
      botHops: null,
    }
    setSession(newSession)
    setGaveUp(false)
    setGameState('ready')
  }, [])

  const handleBegin = useCallback((botHops: number | null) => {
    setSession((prev) => (prev ? { ...prev, startTime: Date.now(), botHops } : prev))
    setGameState('playing')
  }, [])

  const handleStartDaily = useCallback(() => {
    const c = getDailyChallenge()
    startGame(c.start, c.end, true, c)
  }, [startGame])

  // Re-open a saved daily result (for completed or gave-up days).
  const handleReopenDailyResult = useCallback(() => {
    if (!dailyResult) return
    const c = dailyChallenge
    const start = dailyResult.start ?? c.start
    const end = dailyResult.end ?? c.end
    const restored: GameSession = {
      startArticle: start,
      endArticle: end,
      currentArticle: dailyResult.path[dailyResult.path.length - 1] ?? start,
      path: dailyResult.path,
      history: [],
      startTime: Date.now() - dailyResult.timeSeconds * 1000,
      isDaily: true,
      challenge: c,
      botHops: null,
    }
    setSession(restored)
    setFinalTime(dailyResult.timeSeconds)
    setGaveUp(!!dailyResult.gaveUp)
    setGameState('results')
  }, [dailyResult, dailyChallenge])

  const [randomLoading, setRandomLoading] = useState(false)
  const handleStartRandom = useCallback(async () => {
    if (randomLoading) return
    setRandomLoading(true)
    try {
      const r = await getRandomChallenge()
      startGame(r.start, r.end, false, null)
    } finally {
      setRandomLoading(false)
    }
  }, [startGame, randomLoading])

  const handleStartCustom = useCallback(async (start: string, end: string): Promise<string | null> => {
    // Validate both articles exist before starting
    try {
      const [startOk, endOk] = await Promise.all([
        articleExists(start),
        articleExists(end),
      ])
      if (!startOk) return `Couldn't find article "${start}".`
      if (!endOk) return `Couldn't find article "${end}".`
    } catch {
      return 'Network error while validating articles.'
    }
    startGame(start, end, false, null)
    return null
  }, [startGame])

  const handleNavigate = useCallback((title: string) => {
    setSession(prev => {
      if (!prev) return prev

      const newPath = [...prev.path, title]
      const newHistory = [...prev.history, prev.currentArticle]

      // Check for victory
      if (titlesMatch(title, prev.endArticle)) {
        const elapsed = Math.floor((Date.now() - prev.startTime) / 1000)
        setFinalTime(elapsed)

        // Save daily result
        if (prev.isDaily && prev.challenge) {
          saveDailyResult({
            challengeNumber: prev.challenge.challengeNumber,
            date: prev.challenge.date,
            hops: newPath.length - 1,
            timeSeconds: elapsed,
            path: newPath,
            completed: true,
            start: prev.startArticle,
            end: prev.endArticle,
          })
        }

        // Delay state change slightly so the article renders first
        setTimeout(() => setGameState('results'), 300)
      }

      return {
        ...prev,
        currentArticle: title,
        path: newPath,
        history: newHistory,
      }
    })
  }, [])

  const handleBack = useCallback(() => {
    setSession(prev => {
      if (!prev || prev.history.length === 0) return prev
      const newHistory = [...prev.history]
      const previousArticle = newHistory.pop()!
      return {
        ...prev,
        currentArticle: previousArticle,
        path: [...prev.path, previousArticle],
        history: newHistory,
      }
    })
  }, [])

  const handleGiveUp = useCallback(() => {
    if (!session) return
    const elapsed = Math.floor((Date.now() - session.startTime) / 1000)
    setFinalTime(elapsed)
    setGaveUp(true)

    // Register daily give-ups too, so the home screen reflects that today
    // was attempted (and the player can re-open the result).
    if (session.isDaily && session.challenge) {
      saveDailyResult({
        challengeNumber: session.challenge.challengeNumber,
        date: session.challenge.date,
        hops: session.path.length - 1,
        timeSeconds: elapsed,
        path: session.path,
        completed: false,
        gaveUp: true,
        start: session.startArticle,
        end: session.endArticle,
      })
    }

    setGameState('results')
  }, [session])

  const handleQuit = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY)
    setSession(null)
    setGameState('start')
  }, [])

  const handleBackToStart = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY)
    setSession(null)
    setGameState('start')
  }, [])

  if (gameState === 'start') {
    return (
      <div className="h-full flex flex-col overflow-y-auto">
        <StartScreen
          challenge={dailyChallenge}
          dailyResult={dailyResult}
          onStartDaily={handleStartDaily}
          onStartRandom={handleStartRandom}
          onStartCustom={handleStartCustom}
          onViewDailyResult={handleReopenDailyResult}
          randomLoading={randomLoading}
        />
      </div>
    )
  }

  if (gameState === 'ready' && session) {
    const botCacheKey = session.challenge?.challengeNumber
      ?? `${session.startArticle}||${session.endArticle}`
    return (
      <div className="h-full flex flex-col overflow-y-auto">
        <ReadyScreen
          startArticle={session.startArticle}
          endArticle={session.endArticle}
          botCacheKey={botCacheKey}
          onBegin={handleBegin}
          onCancel={handleQuit}
        />
      </div>
    )
  }

  if (gameState === 'results' && session) {
    return (
      <div className="h-full flex flex-col">
        {/* Minimal top bar in results */}
        <header className="flex-shrink-0 bg-bg-card border-b border-border px-3 py-2 flex items-center justify-between">
          <button
            onClick={handleBackToStart}
            className="text-sm text-accent hover:text-accent-dim transition-colors"
          >
            &#x2190; Home
          </button>
          <span className="text-lg font-bold text-text-bright">WikiGame</span>
          <a
            href="https://donate.wikimedia.org"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs px-2.5 py-1 rounded-full bg-success/15 text-success hover:bg-success/25 transition-colors font-medium"
          >
            Donate
          </a>
        </header>
        <ResultsScreen
          startArticle={session.startArticle}
          endArticle={session.endArticle}
          path={session.path}
          hops={session.path.length - 1}
          timeSeconds={finalTime}
          isDaily={session.isDaily}
          gaveUp={gaveUp}
          challengeNumber={session.challenge?.challengeNumber}
          difficulty={session.challenge?.difficulty}
        />
      </div>
    )
  }

  if (gameState === 'playing' && session) {
    const gameOver = titlesMatch(session.currentArticle, session.endArticle)

    return (
      <div className="h-full flex flex-col">
        <TopBar
          currentArticle={session.currentArticle}
          targetArticle={session.endArticle}
          path={session.path}
          hops={session.path.length - 1}
          startTime={session.startTime}
          gameOver={gameOver}
          onBack={handleBack}
          canGoBack={session.history.length > 0}
          onGiveUp={handleGiveUp}
          onQuit={handleQuit}
        />
        <ArticleView
          title={session.currentArticle}
          onNavigate={handleNavigate}
          gameOver={gameOver}
        />
        {/* Mobile bottom bar */}
        <div className="flex-shrink-0 bg-bg-card border-t border-border px-3 py-2 flex items-center justify-between sm:hidden">
          <button
            onClick={() => setShowMobilePreview(true)}
            className="flex items-center gap-1.5 text-xs min-w-0 hover:text-text-bright transition-colors"
            title="Preview target article"
          >
            <span className="text-text/50">Target:</span>
            <span className="text-success font-medium truncate underline decoration-dotted underline-offset-2">
              {session.endArticle}
            </span>
            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-success flex-shrink-0">
              <circle cx="12" cy="12" r="3" />
              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
            </svg>
          </button>
          <div className="flex items-center gap-2 text-xs flex-shrink-0">
            <span className="font-mono font-bold text-text-bright">{session.path.length - 1} hops</span>
          </div>
        </div>
        {showMobilePreview && (
          <TargetPreviewModal
            title={session.endArticle}
            onClose={() => setShowMobilePreview(false)}
          />
        )}
      </div>
    )
  }

  return null
}
