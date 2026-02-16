import type { EmbeddingProvider } from '../embedding/embedding-provider.js'
import type { IndexManager } from '../vectorstore/index-manager.js'
import type { SearchResult, QueryAnalysis } from '../types/metadata.js'
import type { ServiceConfig } from '../types/config.js'
import { createQueryAnalyzer } from './query-analyzer.js'
import { createHybridSearcher } from './hybrid-searcher.js'
import { createReranker } from './reranker.js'
import { createContextExpander } from './context-expander.js'

const DEFAULT_LIMIT = 6
const SEARCH_MULTIPLIER = 3

export interface Retriever {
  readonly retrieve: (
    query: string,
    limit?: number,
  ) => Promise<readonly SearchResult[]>
}

function buildFilterFromAnalysis(analysis: QueryAnalysis): string | undefined {
  const conditions: readonly string[] = [
    ...(analysis.serviceFilter
      ? [`\`serviceName\` = '${escapeSQL(analysis.serviceFilter)}'`]
      : []),
    ...(analysis.fileTypeFilter
      ? [`\`fileType\` = '${escapeSQL(analysis.fileTypeFilter)}'`]
      : []),
  ]

  if (conditions.length === 0) {
    return undefined
  }

  return conditions.join(' AND ')
}

function escapeSQL(value: string): string {
  return value.replace(/'/g, "''")
}

export function createRetriever(
  embedder: EmbeddingProvider,
  indexManager: IndexManager,
  services?: readonly ServiceConfig[],
): Retriever {
  const hybridSearcher = createHybridSearcher(embedder, indexManager)
  const reranker = createReranker()
  const expander = createContextExpander(indexManager)
  const analyzeQuery = createQueryAnalyzer(services ?? [])

  return {
    retrieve: async (query, limit = DEFAULT_LIMIT) => {
      const analysis = analyzeQuery(query)
      const filter = buildFilterFromAnalysis(analysis)
      const searchLimit = limit * SEARCH_MULTIPLIER

      const hybridResults = await hybridSearcher.search(
        query,
        analysis.keywords,
        searchLimit,
        filter,
      )

      const reranked = reranker.rerank(hybridResults, analysis, limit)
      const expanded = await expander.expand(reranked)

      return expanded
    },
  }
}
