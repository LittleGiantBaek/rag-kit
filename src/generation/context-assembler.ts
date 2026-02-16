import type { SearchResult } from '../types/metadata.js'
import type { SearchContext } from './prompt-templates.js'

export interface ContextAssemblerOptions {
  readonly maxTokens: number
  readonly maxChunks: number
}

export interface ContextAssembler {
  assemble(results: readonly SearchResult[]): readonly SearchContext[]
}

const DEFAULT_MAX_TOKENS = 6000
const DEFAULT_MAX_CHUNKS = 8
const CHARS_PER_TOKEN = 3

function estimateTokens(content: string): number {
  return Math.ceil(content.length / CHARS_PER_TOKEN)
}

function sortByScoreDescending(
  results: readonly SearchResult[]
): readonly SearchResult[] {
  return [...results].sort((a, b) => b.score - a.score)
}

function mapToSearchContext(result: SearchResult): SearchContext {
  const chunkType = result.metadata['chunkType'] === 'document' ? 'document' as const : 'code' as const
  const startLine = typeof result.metadata['startLine'] === 'number'
    ? result.metadata['startLine']
    : undefined

  return {
    content: result.content,
    filePath: result.filePath ?? 'unknown',
    serviceName: result.serviceName ?? 'unknown',
    fileType: result.fileType ?? 'unknown',
    score: result.score,
    chunkType,
    startLine,
  }
}

export function createContextAssembler(
  options?: Partial<ContextAssemblerOptions>
): ContextAssembler {
  const maxTokens = options?.maxTokens ?? DEFAULT_MAX_TOKENS
  const maxChunks = options?.maxChunks ?? DEFAULT_MAX_CHUNKS

  return Object.freeze({
    assemble(results: readonly SearchResult[]): readonly SearchContext[] {
      const sorted = sortByScoreDescending(results)
      let totalTokens = 0
      const assembled: SearchContext[] = []

      for (const result of sorted) {
        if (assembled.length >= maxChunks) break

        const tokens = estimateTokens(result.content)
        if (totalTokens + tokens > maxTokens) break

        assembled.push(mapToSearchContext(result))
        totalTokens = totalTokens + tokens
      }

      return Object.freeze(assembled)
    },
  })
}
