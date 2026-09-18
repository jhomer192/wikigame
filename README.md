# WikiGame

WikiGame is a daily Wikipedia racing game. You get two articles and have to walk from the first to the second using only the links inside each page — the Wikipedia game, wikiracing, whatever your group calls it — with a bot solving the same pair to set your par.

[Play today's challenge](https://jackhomer.com/wikigame/). Nothing to install and no account.

![The WikiGame start screen showing Daily Challenge #1 and the how-to-play rules](https://jackhomer.com/screenshots/wikigame.webp)

## How a round works

Everyone playing on a given day gets the same pair, picked from a curated pool of 1,822 challenges graded easy, medium or hard. The pool is indexed by the number of days since launch, so it lasts about five years before it wraps.

Before the clock starts, a solver bot runs the same pair in the background. Its hop count becomes your par, and it's cached locally so replaying the day doesn't make you wait through it again. If the bot gets stuck, you play the round with no par. The timer only starts when you press Begin, so you can read the target article first.

Wikipedia pages render inside the app. Every link is rewritten so clicks stay in the game and count as hops, and the parts that would let you cheat are stripped out: references, see-also, external links, further reading, navboxes, category links, and the table of contents. Section anchors are dead. Hovering a link (or long-pressing on a phone) shows a preview of where it goes. The back button works, but it costs a hop like any other move.

You can also start a random game, which pulls two genuinely random articles from the MediaWiki API and filters out stubs, list pages, disambiguations and bare years, or type in your own start and end, which are validated before the round begins.

## Results

The results screen has your hop count, your time, the path you took, and the bot's path next to it once it's available. Daily results are saved in the browser, so a finished day stays open to look at again — including days you gave up on.

Share text is spoiler-safe. It carries the challenge number, hops and time, and renders your path as coloured squares with no article names, and it omits the start and end pair on daily challenges so posting it doesn't ruin the puzzle for anyone.

## The bot

The par-setter is a greedy TF-IDF walker, a trimmed-down port of [wikipedia-game-solver](https://github.com/jhomer192/wikipedia-game-solver). At each article it pulls the outgoing links, batch-fetches a short intro for up to 20 candidates, scores each one by cosine similarity against the target's intro (with extra weight for title overlap and for short, hub-like titles), and jumps to the best unvisited one. It takes the shortcut when a candidate is a known backlink of the target, has an escape hatch for flat scores and year-variant loops, and gives up after 20 hops. The par it produces is a decent human benchmark rather than a true shortest path — for that, use the solver's bidirectional BFS mode.

## Running it locally

```bash
npm install
npm run dev
```

```bash
npm run build     # tsc -b && vite build
npm run lint
npm run preview   # serve dist/
```

## Stack

React 19, TypeScript, Vite, Tailwind. Article HTML, search, and the random-article picker all come straight from the public MediaWiki API with `origin=*`, so there's no backend and no API key. State lives in `localStorage` and `sessionStorage`. `.github/workflows/deploy.yml` publishes to GitHub Pages on every push to `main`.

The related project is [wikipedia-game-solver](https://github.com/jhomer192/wikipedia-game-solver), which is the solver on its own, with a shortest-path mode and a trace of every scoring decision. Longer write-up: [jackhomer.com/projects/wikigame](https://jackhomer.com/projects/wikigame/).

A project by [Jack Homer](https://jackhomer.com/).
