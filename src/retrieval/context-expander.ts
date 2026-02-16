import type { IndexManager } from '../vectorstore/index-manager.js'
import type { SearchResult } from '../types/metadata.js'

const PROXIMITY_RANGE = 50
const PROXIMITY_LIMIT = 3
const ADJACENT_SCORE_FACTOR = 0.5

export interface ContextExpander {
  readonly expand: (
    results: readonly SearchResult[],
  ) => Promise<readonly SearchResult[]>
}

function isCodeChunk(result: SearchResult): boolean {
  return result.metadata['chunkType'] === 'code'
}

function hasLineInfo(result: SearchResult): boolean {
  return (
    typeof result.metadata['filePath'] === 'string' &&
    typeof result.metadata['startLine'] === 'number'
  )
}

function isExpandable(result: SearchResult): boolean {
  return isCodeChunk(result) && hasLineInfo(result)
}

function mapRecordToSearchResult(
  record: Record<string, unknown>,
  baseScore: number,
): SearchResult {
  return {
    id: typeof record['id'] === 'string' ? record['id'] : '',
    content: typeof record['content'] === 'string' ? record['content'] : '',
    score: baseScore * ADJACENT_SCORE_FACTOR,
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

async function fetchAdjacentChunks(
  indexManager: IndexManager,
  result: SearchResult,
): Promise<readonly SearchResult[]> {
  const filePath = result.metadata['filePath'] as string
  const startLine = result.metadata['startLine'] as number

  const records = await indexManager.getChunksByProximity(
    filePath,
    startLine,
    PROXIMITY_RANGE,
    PROXIMITY_LIMIT,
  )

  return records
    .filter((record) => record['id'] !== result.id)
    .map((record) => mapRecordToSearchResult(record, result.score))
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

export function createContextExpander(
  indexManager: IndexManager,
): ContextExpander {
  return {
    expand: async (results) => {
      const expandable = results.filter(isExpandable)

      const adjacentPromises = expandable.map(
        (result) => fetchAdjacentChunks(indexManager, result),
      )

      const adjacentResults = await Promise.all(adjacentPromises)
      const allAdjacent = adjacentResults.flat()

      const combined = [...results, ...allAdjacent]

      return deduplicateById(combined)
    },
  }
}
