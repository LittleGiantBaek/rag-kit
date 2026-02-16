import type { EmbeddingProvider } from '../embedding/embedding-provider.js'
import type { IndexManager } from '../vectorstore/index-manager.js'
import type { SearchResult } from '../types/metadata.js'

export interface SemanticSearcher {
  readonly search: (
    query: string,
    limit: number,
    filter?: string,
  ) => Promise<readonly SearchResult[]>
}

function mapRecordToSearchResult(record: Record<string, unknown>): SearchResult {
  const distance = typeof record['_distance'] === 'number'
    ? record['_distance']
    : 1.0

  return {
    id: typeof record['id'] === 'string' ? record['id'] : '',
    content: typeof record['content'] === 'string' ? record['content'] : '',
    score: 1.0 - Math.min(distance, 1.0),
    metadata: {
      filePath: record['filePath'],
      relativePath: record['relativePath'],
      serviceName: record['serviceName'],
      fileType: record['fileType'],
      language: record['language'],
      symbolName: record['symbolName'],
      level: record['level'],
      startLine: record['startLine'],
      endLine: record['endLine'],
      chunkType: record['chunkType'],
    },
    filePath: typeof record['filePath'] === 'string'
      ? record['filePath']
      : undefined,
    serviceName: typeof record['serviceName'] === 'string'
      ? record['serviceName']
      : undefined,
    fileType: typeof record['fileType'] === 'string'
      ? record['fileType']
      : undefined,
    symbolName: typeof record['symbolName'] === 'string'
      ? record['symbolName']
      : undefined,
  }
}

export function createSemanticSearcher(
  embedder: EmbeddingProvider,
  indexManager: IndexManager,
): SemanticSearcher {
  return {
    search: async (query, limit, filter) => {
      const vector = await embedder.embedText(query)
      const records = await indexManager.searchAll(vector, limit, filter)

      return records.map(mapRecordToSearchResult)
    },
  }
}
