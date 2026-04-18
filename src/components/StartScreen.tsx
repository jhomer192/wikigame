import type { DailyChallenge } from '../lib/daily'

interface StartScreenProps {
  challenge: DailyChallenge
  dailyCompleted: boolean
  onStartDaily: () => void
  onStartRandom: () => void
}

function getDifficultyLabel(d: string): { text: string; color: string } {
  switch (d) {
    case 'easy': return { text: 'Easy', color: 'bg-success/15 text-success' }
    case 'medium': return { text: 'Medium', color: 'bg-warning/15 text-warning' }
    case 'hard': return { text: 'Hard', color: 'bg-danger/15 text-danger' }
    default: return { text: d, color: 'bg-text/15 text-text' }
  }
}

export default function StartScreen({
  challenge,
  dailyCompleted,
  onStartDaily,
  onStartRandom,
}: StartScreenProps) {
  const diff = getDifficultyLabel(challenge.difficulty)

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        {/* Logo */}
        <div className="mb-6">
          <h1 className="text-4xl sm:text-5xl font-bold text-text-bright tracking-tight mb-2">
            WikiGame
          </h1>
          <p className="text-text/60 text-sm">
            Navigate Wikipedia from one article to another by clicking links.
          </p>
        </div>

        {/* Daily challenge card */}
        <div className="bg-bg-card rounded-2xl p-6 border border-border mb-4">
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="text-xs font-medium text-text/60">
              Daily Challenge #{challenge.challengeNumber}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${diff.color}`}>
              {diff.text}
            </span>
          </div>

          <div className="flex items-center justify-center gap-3 mb-5">
            <div className="bg-bg rounded-xl px-4 py-3 flex-1">
              <div className="text-xs text-text/50 mb-1">From</div>
              <div className="text-text-bright font-semibold text-sm sm:text-base truncate">
                {challenge.start}
              </div>
            </div>
            <div className="text-text/30 text-xl">&#x2192;</div>
            <div className="bg-bg rounded-xl px-4 py-3 flex-1">
              <div className="text-xs text-text/50 mb-1">To</div>
              <div className="text-success font-semibold text-sm sm:text-base truncate">
                {challenge.end}
              </div>
            </div>
          </div>

          {dailyCompleted ? (
            <div className="text-sm text-success mb-3">
              &#x2713; Today's challenge completed!
            </div>
          ) : (
            <button
              onClick={onStartDaily}
              className="w-full py-3.5 rounded-xl bg-accent text-white font-semibold text-lg hover:bg-accent-dim transition-colors mb-2"
            >
              Play Daily
            </button>
          )}
        </div>

        {/* Random play */}
        <button
          onClick={onStartRandom}
          className="w-full py-3 rounded-xl bg-bg-card border border-border text-text-bright font-medium hover:bg-bg-hover transition-colors"
        >
          Play Random
        </button>

        {/* How to play */}
        <div className="mt-8 text-left bg-bg-card rounded-2xl p-5 border border-border">
          <h3 className="text-sm font-semibold text-text-bright mb-3">How to play</h3>
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
