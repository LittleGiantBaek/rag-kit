import type { SearchResult, QueryAnalysis } from '../types/metadata.js'

const SERVICE_MATCH_BOOST = 0.2
const FILE_TYPE_MATCH_BOOST = 0.15
const ENTITY_NAME_BOOST = 0.1
const ARCHITECTURAL_FILE_TYPE_BOOST = 0.1
const KEYWORD_OVERLAP_BOOST = 0.05

const ARCHITECTURAL_FILE_TYPES: ReadonlySet<string> = new Set([
  'module',
  'service',
])

export interface Reranker {
  readonly rerank: (
    results: readonly SearchResult[],
    analysis: QueryAnalysis,
    limit: number,
  ) => readonly SearchResult[]
}

function deduplicateById(
  results: readonly SearchResult[],
): readonly SearchResult[] {
  const seen = new Set<string>()

  return results.filter((result) => {
    if (seen.has(result.id)) {
      return false
    }
    seen.add(result.id)
    return true
  })
}

function calculateKeywordOverlapBoost(
  content: string,
  keywords: readonly string[],
): number {
  if (keywords.length === 0) {
    return 0
  }

  const contentLower = content.toLowerCase()
  const matchCount = keywords.filter(
    (keyword) => contentLower.includes(keyword.toLowerCase()),
  ).length

  return matchCount * KEYWORD_OVERLAP_BOOST
}

function calculateBoost(
  result: SearchResult,
  analysis: QueryAnalysis,
): number {
  let boost = 0

  if (analysis.serviceFilter && result.serviceName === analysis.serviceFilter) {
    boost += SERVICE_MATCH_BOOST
  }

  if (analysis.fileTypeFilter && result.fileType === analysis.fileTypeFilter) {
    boost += FILE_TYPE_MATCH_BOOST
  }

  if (analysis.entityNames && analysis.entityNames.length > 0) {
    const contentLower = result.content.toLowerCase()
    const entityMatches = analysis.entityNames.filter(
      (name) => contentLower.includes(name.toLowerCase()),
    )
    boost += entityMatches.length * ENTITY_NAME_BOOST
  }

  if (analysis.isArchitectural && result.fileType) {
    if (ARCHITECTURAL_FILE_TYPES.has(result.fileType)) {
      boost += ARCHITECTURAL_FILE_TYPE_BOOST
    }
  }

  boost += calculateKeywordOverlapBoost(result.content, analysis.keywords)

  return boost
}

function applyBoostToResult(
  result: SearchResult,
  boost: number,
): SearchResult {
  return {
    ...result,
    score: result.score + boost,
  }
}

function normalizeScores(
  results: readonly SearchResult[],
): readonly SearchResult[] {
  if (results.length === 0) {
    return results
  }

  const scores = results.map((r) => r.score)
  const minScore = Math.min(...scores)
  const maxScore = Math.max(...scores)
  const range = maxScore - minScore

  if (range === 0) {
    return results.map((result) => ({ ...result, score: 1.0 }))
  }

  return results.map((result) => ({
    ...result,
    score: (result.score - minScore) / range,
  }))
}

function sortByScoreDescending(
  results: readonly SearchResult[],
): readonly SearchResult[] {
  return [...results].sort((a, b) => b.score - a.score)
}

export function createReranker(): Reranker {
  return {
    rerank: (results, analysis, limit) => {
      const deduplicated = deduplicateById(results)

      const boosted = deduplicated.map((result) => {
        const boost = calculateBoost(result, analysis)
        return applyBoostToResult(result, boost)
      })

      const normalized = normalizeScores(boosted)
      const sorted = sortByScoreDescending(normalized)

      return sorted.slice(0, limit)
    },
  }
}
