import type { DocumentChunk } from '../types/chunk.js'
import type { VectorRecord } from '../vectorstore/schema.js'

export function documentChunksToRecords(
  chunks: readonly DocumentChunk[],
  vectors: readonly (readonly number[])[],
): readonly VectorRecord[] {
  return chunks.map((chunk, i) => ({
    id: chunk.id,
    content: chunk.content,
    vector: vectors[i],
    chunkType: 'document' as const,
    filePath: chunk.source,
    relativePath: chunk.source,
    serviceName: '',
    fileType: chunk.sourceType,
    language: '',
    symbolName: '',
    level: chunk.sheet ?? chunk.metadata['heading'] ?? '',
    startLine: chunk.page ?? 0,
    endLine: 0,
  }))
}
