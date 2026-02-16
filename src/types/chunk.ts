export type ChunkLevel = 'file-summary' | 'class' | 'method' | 'text'

export interface CodeChunk {
  readonly id: string
  readonly content: string
  readonly level: ChunkLevel
  readonly filePath: string
  readonly relativePath: string
  readonly serviceName: string
  readonly fileType: string
  readonly language: string
  readonly startLine: number
  readonly endLine: number
  readonly symbolName?: string
  readonly parentSymbol?: string
  readonly decorators?: readonly string[]
  readonly imports?: readonly string[]
  readonly exports?: readonly string[]
}

export interface DocumentChunk {
  readonly id: string
  readonly content: string
  readonly source: string
  readonly sourceType: 'pdf' | 'excel' | 'markdown' | 'text'
  readonly page?: number
  readonly sheet?: string
  readonly metadata: Record<string, string>
}

export type Chunk = CodeChunk | DocumentChunk

export interface IndexedChunk {
  readonly id: string
  readonly content: string
  readonly vector: readonly number[]
  readonly chunkType: 'code' | 'document'
  readonly metadata: Record<string, unknown>
}
