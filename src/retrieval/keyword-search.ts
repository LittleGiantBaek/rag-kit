import type { IndexManager } from '../vectorstore/index-manager.js'
import type { SearchResult } from '../types/metadata.js'

const DEFAULT_DIMENSIONS = 768

export interface KeywordSearcher {
  readonly search: (
    keywords: readonly string[],
    limit: number,
    filter?: string,
  ) => Promise<readonly SearchResult[]>
}

function buildKeywordFilter(keywords: readonly string[]): string {
  return keywords
    .map((keyword) => `content LIKE '%${escapeSQL(keyword)}%'`)
    .join(' OR ')
}

function combineFilters(
  keywordFilter: string,
  additionalFilter?: string,
): string {
  if (!additionalFilter) {
    return keywordFilter
  }

  return `(${keywordFilter}) AND (${additionalFilter})`
}

function escapeSQL(value: string): string {
  return value.replace(/'/g, "''")
}

function countKeywordOccurrences(
  content: string,
  keywords: readonly string[],
): number {
  const lowerContent = content.toLowerCase()

  return keywords.reduce((count, keyword) => {
    const lowerKeyword = keyword.toLowerCase()
    const regex = new RegExp(escapeRegExp(lowerKeyword), 'g')
    const matches = lowerContent.match(regex)
    return count + (matches ? matches.length : 0)
  }, 0)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function mapRecordToSearchResult(
  record: Record<string, unknown>,
  keywords: readonly string[],
): SearchResult {
  const content = typeof record['content'] === 'string'
    ? record['content']
    : ''
  const occurrences = countKeywordOccurrences(content, keywords)
  const maxPossible = Math.max(keywords.length * 5, 1)
  const score = Math.min(occurrences / maxPossible, 1.0)

  return {
    id: typeof record['id'] === 'string' ? record['id'] : '',
    content,
    score,
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

function sortByScoreDescending(
  results: readonly SearchResult[],
): readonly SearchResult[] {
  return [...results].sort((a, b) => b.score - a.score)
}

export function createKeywordSearcher(
  indexManager: IndexManager,
): KeywordSearcher {
  return {
    search: async (keywords, limit, filter) => {
      if (keywords.length === 0) {
        return []
      }

      const keywordFilter = buildKeywordFilter(keywords)
      const combinedFilter = combineFilters(keywordFilter, filter)

      const dummyVector = Array.from(
        { length: DEFAULT_DIMENSIONS },
        () => 0,
      )

      const fetchLimit = limit * 3
      const records = await indexManager.searchAll(
        dummyVector,
        fetchLimit,
        combinedFilter,
      )

      const results = records.map(
        (record) => mapRecordToSearchResult(record, keywords),
      )

      const sorted = sortByScoreDescending(results)

      return sorted.slice(0, limit)
    },
  }
}
