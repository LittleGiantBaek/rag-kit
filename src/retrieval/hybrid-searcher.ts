import type { EmbeddingProvider } from '../embedding/embedding-provider.js'
import type { IndexManager } from '../vectorstore/index-manager.js'
import type { SearchResult } from '../types/metadata.js'
import { createSemanticSearcher } from './semantic-search.js'
import { createKeywordSearcher } from './keyword-search.js'

const RRF_K = 60

export interface HybridSearcher {
  readonly search: (
    query: string,
    keywords: readonly string[],
    limit: number,
    filter?: string,
  ) => Promise<readonly SearchResult[]>
}

function buildRankMap(
  results: readonly SearchResult[],
): ReadonlyMap<string, number> {
  const rankMap = new Map<string, number>()

  results.forEach((result, index) => {
    rankMap.set(result.id, index + 1)
  })

  return rankMap
}

function calculateRRFScore(
  semanticRank: number | undefined,
  keywordRank: number | undefined,
): number {
  const semanticContribution = semanticRank !== undefined
    ? 1 / (RRF_K + semanticRank)
    : 0

  const keywordContribution = keywordRank !== undefined
    ? 1 / (RRF_K + keywordRank)
    : 0

  return semanticContribution + keywordContribution
}

function collectAllResults(
  semanticResults: readonly SearchResult[],
  keywordResults: readonly SearchResult[],
): ReadonlyMap<string, SearchResult> {
  const resultMap = new Map<string, SearchResult>()

  for (const result of semanticResults) {
    resultMap.set(result.id, result)
  }

  for (const result of keywordResults) {
    if (!resultMap.has(result.id)) {
      resultMap.set(result.id, result)
    }
  }

  return resultMap
}

function fuseResults(
  semanticResults: readonly SearchResult[],
  keywordResults: readonly SearchResult[],
  limit: number,
): readonly SearchResult[] {
  const semanticRanks = buildRankMap(semanticResults)
  const keywordRanks = buildRankMap(keywordResults)
  const allResults = collectAllResults(semanticResults, keywordResults)

  const fused: readonly SearchResult[] = Array.from(allResults.entries())
    .map(([id, result]) => {
      const rrfScore = calculateRRFScore(
        semanticRanks.get(id),
        keywordRanks.get(id),
      )

      return { ...result, score: rrfScore }
    })

  const sorted = [...fused].sort((a, b) => b.score - a.score)

  return sorted.slice(0, limit)
}

export function createHybridSearcher(
  embedder: EmbeddingProvider,
  indexManager: IndexManager,
): HybridSearcher {
  const semanticSearcher = createSemanticSearcher(embedder, indexManager)
  const keywordSearcher = createKeywordSearcher(indexManager)

  return {
    search: async (query, keywords, limit, filter) => {
      const [semanticResults, keywordResults] = await Promise.all([
        semanticSearcher.search(query, limit, filter),
        keywordSearcher.search(keywords, limit, filter),
      ])

      return fuseResults(semanticResults, keywordResults, limit)
    },
  }
}
