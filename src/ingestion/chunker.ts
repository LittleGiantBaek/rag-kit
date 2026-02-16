import { createHash } from 'node:crypto'
import type { CodeChunk, ChunkLevel } from '../types/chunk.js'
import type { ScannedFile } from './file-scanner.js'

export interface ChunkerOptions {
  readonly chunkSize: number
  readonly chunkOverlap: number
}

export interface Chunker {
  chunkFile(file: ScannedFile): readonly CodeChunk[]
}

function generateChunkId(filePath: string, startLine: number, endLine: number): string {
  const input = `${filePath}:${startLine}:${endLine}`
  return createHash('sha256').update(input).digest('hex').slice(0, 16)
}

function buildFileSummary(file: ScannedFile): string {
  const lines = file.content.split('\n')
  const importLines = lines.filter(l => l.startsWith('import ')).slice(0, 10)
  const exportLines = lines.filter(l => l.includes('export ')).slice(0, 10)

  const parts = [
    `// File: ${file.relativePath}`,
    `// Service: ${file.serviceName}`,
    `// Type: ${file.fileType}`,
    `// Lines: ${lines.length}`,
    '',
  ]

  if (importLines.length > 0) {
    parts.push('// Imports:', ...importLines, '')
  }
  if (exportLines.length > 0) {
    parts.push('// Exports:', ...exportLines)
  }

  return parts.join('\n')
}

function extractImports(content: string): readonly string[] {
  const importRegex = /import\s+.*?\s+from\s+['"](.+?)['"]/g
  const imports: string[] = []
  let match: RegExpExecArray | null
  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1])
  }
  return imports
}

function extractExports(content: string): readonly string[] {
  const exportRegex = /export\s+(?:default\s+)?(?:class|function|const|interface|type|enum)\s+(\w+)/g
  const exports: string[] = []
  let match: RegExpExecArray | null
  while ((match = exportRegex.exec(content)) !== null) {
    exports.push(match[1])
  }
  return exports
}

function extractDecorators(content: string): readonly string[] {
  const decoratorRegex = /@(\w+)\(/g
  const decorators: string[] = []
  let match: RegExpExecArray | null
  while ((match = decoratorRegex.exec(content)) !== null) {
    decorators.push(match[1])
  }
  return [...new Set(decorators)]
}

function splitBySize(
  content: string,
  file: ScannedFile,
  chunkSize: number,
  chunkOverlap: number,
): readonly CodeChunk[] {
  const lines = content.split('\n')
  const chunks: CodeChunk[] = []

  const linesPerChunk = Math.max(1, Math.floor(chunkSize / 80))
  const overlapLines = Math.max(0, Math.floor(chunkOverlap / 80))

  let start = 0
  while (start < lines.length) {
    const end = Math.min(start + linesPerChunk, lines.length)
    const chunkContent = lines.slice(start, end).join('\n')

    if (chunkContent.trim().length > 0) {
      chunks.push({
        id: generateChunkId(file.filePath, start + 1, end),
        content: chunkContent,
        level: 'text' as ChunkLevel,
        filePath: file.filePath,
        relativePath: file.relativePath,
        serviceName: file.serviceName,
        fileType: file.fileType,
        language: file.language,
        startLine: start + 1,
        endLine: end,
        decorators: extractDecorators(chunkContent),
      })
    }

    const nextStart = end - overlapLines
    if (nextStart <= start) break
    start = nextStart
  }

  return chunks
}

export function createChunker(options: ChunkerOptions): Chunker {
  return {
    chunkFile(file: ScannedFile): readonly CodeChunk[] {
      const chunks: CodeChunk[] = []
      const lines = file.content.split('\n')

      // Level 1: File summary
      const summary = buildFileSummary(file)
      chunks.push({
        id: generateChunkId(file.filePath, 0, 0),
        content: summary,
        level: 'file-summary',
        filePath: file.filePath,
        relativePath: file.relativePath,
        serviceName: file.serviceName,
        fileType: file.fileType,
        language: file.language,
        startLine: 1,
        endLine: lines.length,
        imports: extractImports(file.content) as string[],
        exports: extractExports(file.content) as string[],
        decorators: extractDecorators(file.content) as string[],
      })

      // Level 2/3: Split by size (Phase 2 will add AST-based splitting)
      const contentChunks = splitBySize(
        file.content,
        file,
        options.chunkSize,
        options.chunkOverlap,
      )
      chunks.push(...contentChunks)

      return chunks
    },
  }
}
