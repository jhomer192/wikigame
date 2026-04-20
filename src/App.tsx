import { useState, useCallback, useEffect } from 'react'
import { getDailyChallenge, getRandomChallenge, getSavedResult, saveDailyResult, todayLocal } from './lib/daily'
import { articleExists, titlesMatch } from './lib/wiki'
import type { DailyChallenge } from './lib/daily'
import StartScreen from './components/StartScreen'
import TopBar from './components/TopBar'
import ArticleView from './components/ArticleView'
import ResultsScreen from './components/ResultsScreen'

type GameState = 'start' | 'playing' | 'results'

interface GameSession {
  startArticle: string
  endArticle: string
  currentArticle: string
  path: string[]
  history: string[] // for back button
  startTime: number
  isDaily: boolean
  challenge: DailyChallenge | null
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
  const dailyChallenge = getDailyChallenge()
  const dailyResult = getSavedResult(todayLocal())
  const dailyCompleted = !!dailyResult?.completed

  // Persist session so path survives page navigation
  useEffect(() => {
    persistSession(gameState, session)
  }, [gameState, session])

  const startGame = useCallback((start: string, end: string, isDaily: boolean, challenge: DailyChallenge | null) => {
    const newSession: GameSession = {
      startArticle: start,
      endArticle: end,
      currentArticle: start,
      path: [start],
      history: [],
      startTime: Date.now(),
      isDaily,
      challenge,
    }
    setSession(newSession)
    setGaveUp(false)
    setGameState('playing')
  }, [])

  const handleStartDaily = useCallback(() => {
    const c = getDailyChallenge()
    startGame(c.start, c.end, true, c)
  }, [startGame])

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
          dailyCompleted={dailyCompleted}
          onStartDaily={handleStartDaily}
          onStartRandom={handleStartRandom}
          onStartCustom={handleStartCustom}
          randomLoading={randomLoading}
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
          <div className="flex items-center gap-1.5 text-xs min-w-0">
            <span className="text-text/50">Target:</span>
            <span className="text-success font-medium truncate">{session.endArticle}</span>
          </div>
          <div className="flex items-center gap-2 text-xs flex-shrink-0">
            <span className="font-mono font-bold text-text-bright">{session.path.length - 1} hops</span>
          </div>
        </div>
      </div>
    )
  }

  return null
}
