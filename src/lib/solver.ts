/**
 * Wikipedia path solver for the "Bot's Path" widget.
 * Simplified port of wikipedia-game-solver -- single attempt,
 * capped at 20 hops and 20 candidates per step.
 */

import { getBacklinks, getIntro, getIntrosBatch, getLinks, isMetaTitle } from './solver-wiki'
import { scoreCandidates, tokenize } from './tfidf'

export interface SolverStep {
  title: string
  index: number
}

export type SolverEvent =
  | { type: 'status'; message: string }
  | { type: 'step'; step: SolverStep }
  | { type: 'found'; path: string[] }
  | { type: 'stuck'; reason: string }

const MAX_HOPS = 20
const MAX_CANDIDATES = 20
const TITLE_BOOST = 0.35
const TITLE_LENGTH_BOOST = 0.05
const FLAT_THRESHOLD = 0.01
const WEAK_SCORE = 0.005
const STUCK_TOLERANCE = 2

export async function* solve(
  start: string,
  end: string,
  signal?: AbortSignal,
): AsyncGenerator<SolverEvent, void, undefined> {
  const visited = new Set<string>()
  const pathTitles: string[] = [start]

  yield { type: 'status', message: `Fetching target "${end}"` }
  const endIntro = await getIntro(end, signal)
  if (!endIntro) {
    yield { type: 'stuck', reason: `Could not load target article "${end}".` }
    return
  }

  const startIntro = await getIntro(start, signal)
  if (!startIntro) {
    yield { type: 'stuck', reason: `Could not load start article "${start}".` }
    return
  }

  yield { type: 'status', message: `Fetching backlinks to "${end}"` }
  const backlinksResult = await getBacklinks(end, 500, signal).catch(() => ({ titles: [] as string[], calls: 1 }))
  const backlinks = new Set(backlinksResult.titles)

  const endTitleTokens = new Set(tokenize(end))
  const endIntroTokens = new Set(tokenize(endIntro))
  endIntroTokens.forEach((t) => endTitleTokens.add(t))

  const startLinksResult = await getLinks(start, 500, signal)
  const startLinks = startLinksResult.titles.filter((l) => !isMetaTitle(l))

  visited.add(start)
  yield { type: 'step', step: { title: start, index: 0 } }

  let currentTitle = start
  let currentLinks = startLinks.filter((l) => !visited.has(l))
  let consecutiveWeak = 0
  const recentTitles: string[] = []

  for (let hop = 1; hop <= MAX_HOPS; hop++) {
    if (signal?.aborted) return

    // Direct link to target?
    if (currentLinks.includes(end)) {
      pathTitles.push(end)
      yield { type: 'step', step: { title: end, index: hop } }
      yield { type: 'found', path: pathTitles }
      return
    }

    // Backlink shortcut: one hop from target
    const backlinkHit = currentLinks.find((l) => !visited.has(l) && backlinks.has(l))
    if (backlinkHit) {
      visited.add(backlinkHit)
      pathTitles.push(backlinkHit)
      currentTitle = backlinkHit
      yield { type: 'step', step: { title: backlinkHit, index: hop } }

      const nextResult = await getLinks(backlinkHit, 500, signal)
      currentLinks = nextResult.titles.filter((l) => !isMetaTitle(l))
      consecutiveWeak = 0
      recentTitles.push(backlinkHit)
      if (recentTitles.length > 5) recentTitles.shift()
      continue
    }

    // Score candidates via TF-IDF
    const candidates = currentLinks
      .filter((l) => !visited.has(l) && l.length <= 80)
      .slice(0, MAX_CANDIDATES)

    if (candidates.length === 0) {
      yield { type: 'stuck', reason: `No unvisited links from "${currentTitle}".` }
      return
    }

    yield { type: 'status', message: `Scoring ${candidates.length} candidates...` }

    const { intros: introMap, pageSizes } = await getIntrosBatch(candidates, signal)
    const texts = candidates.map((c) => introMap.get(c) ?? '')
    const cosineScores = scoreCandidates(texts, endIntro)

    const maxCosine = Math.max(...cosineScores, 0)
    const isNicheTarget = maxCosine < 0.03

    const boosted = candidates.map((title, i) => {
      const candTokens = new Set(tokenize(title))
      let titleOverlap = 0
      for (const t of candTokens) if (endTitleTokens.has(t)) titleOverlap += 1
      const titleBoost = TITLE_BOOST * (titleOverlap / Math.max(endTitleTokens.size, 1))

      let introOverlap = 0
      for (const t of candTokens) if (endIntroTokens.has(t)) introOverlap += 1
      const introBoost = 0.15 * (introOverlap / Math.max(endIntroTokens.size, 1))

      let lengthBias = TITLE_LENGTH_BOOST * Math.max(0, 1 - title.length / 50)

      if (isNicheTarget) {
        const pageSize = pageSizes.get(title) ?? 0
        const hubBoost = pageSize > 0 ? 0.05 * Math.max(0, Math.log(pageSize / 5000) / Math.log(16)) : 0
        lengthBias += hubBoost
      }

      return { title, score: cosineScores[i] + titleBoost + introBoost + lengthBias }
    })

    const scored = boosted.sort((a, b) => b.score - a.score)

    // Escape flat scoring / year-variant loops
    const stripYears = (s: string) => s.replace(/\b\d{4}\b/g, '').replace(/\s+/g, ' ').trim()
    const isYearLoop =
      recentTitles.length >= 2 &&
      new Set(recentTitles.slice(-2).map(stripYears)).size === 1
    const isFlat =
      scored.length >= 3 &&
      scored[0].score - scored[Math.min(4, scored.length - 1)].score < FLAT_THRESHOLD
    const shouldEscape = isFlat || isYearLoop

    let finalScored = scored
    if (shouldEscape) {
      const recentWords = new Set<string>()
      for (const t of recentTitles) for (const w of tokenize(t)) recentWords.add(w)
      const filtered = scored.filter(({ title }) => {
        const words = tokenize(title)
        if (words.length === 0) return true
        const overlapCount = words.filter((w) => recentWords.has(w)).length
        return overlapCount / words.length < 0.5
      })
      const pool = filtered.length > 0 ? filtered : scored
      const escapeCandidates = pool.map(({ title, score }) => {
        const words = tokenize(title)
        const overlapCount = words.filter((w) => recentWords.has(w)).length
        const overlapRatio = words.length > 0 ? overlapCount / words.length : 0
        const noveltyPenalty = -1.5 * overlapRatio
        const hubBonus = 0.1 * Math.max(0, 1 - title.length / 40)
        const pageSize = pageSizes.get(title) ?? 0
        const pageSizeBonus = pageSize > 0 ? Math.max(0, Math.log(pageSize / 5000) / Math.log(16)) : 0
        return { title, score: score + noveltyPenalty + hubBonus + pageSizeBonus }
      })
      finalScored = escapeCandidates.sort((a, b) => b.score - a.score)
    }

    const next = finalScored.find((s) => !visited.has(s.title))
    if (!next) {
      yield { type: 'stuck', reason: `No unvisited candidates at "${currentTitle}".` }
      return
    }

    if (next.score < WEAK_SCORE) {
      consecutiveWeak += 1
      if (consecutiveWeak >= STUCK_TOLERANCE) {
        yield { type: 'stuck', reason: 'All candidates scored near zero for multiple steps.' }
        return
      }
    } else {
      consecutiveWeak = 0
    }

    visited.add(next.title)
    pathTitles.push(next.title)
    currentTitle = next.title
    recentTitles.push(next.title)
    if (recentTitles.length > 5) recentTitles.shift()

    yield { type: 'step', step: { title: next.title, index: hop } }

    const nextResult = await getLinks(next.title, 500, signal)
    currentLinks = nextResult.titles.filter((l) => !isMetaTitle(l))
  }

  yield { type: 'stuck', reason: `Hit max hop limit of ${MAX_HOPS}.` }
}

// Cache key for localStorage. Accepts a challenge number (daily) or any string
// identifier (e.g. start||end pair for random/custom games).
function cacheKey(id: number | string): string {
  return `wikigame-bot-path-${id}`
}

export function getCachedBotPath(id: number | string): string[] | null {
  try {
    const raw = localStorage.getItem(cacheKey(id))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.length > 0) return parsed
    return null
  } catch {
    return null
  }
}

export function cacheBotPath(id: number | string, path: string[]): void {
  try {
    localStorage.setItem(cacheKey(id), JSON.stringify(path))
  } catch {
    // localStorage full or unavailable
  }
}

/**
 * High-level wrapper: runs the solver and returns the path array.
 * Calls onStep with each article title as the bot visits it.
 */
export async function solvePath(
  start: string,
  end: string,
  onStep?: (title: string) => void,
  signal?: AbortSignal,
): Promise<string[]> {
  for await (const event of solve(start, end, signal)) {
    switch (event.type) {
      case 'step':
        onStep?.(event.step.title)
        break
      case 'found':
        return event.path
      case 'stuck':
        return []
    }
  }
  return []
}
