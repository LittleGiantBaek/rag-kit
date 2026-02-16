import { resolve } from 'node:path'
import type { AppConfig } from '../types/config.js'
import type { ProjectPaths } from '../config/project-paths.js'
import type { VectorRecord } from '../vectorstore/schema.js'
import type { CodeChunk, DocumentChunk } from '../types/chunk.js'
import { createFileScanner } from '../ingestion/file-scanner.js'
import { createChunker } from '../ingestion/chunker.js'
import { createEmbeddingProvider } from '../embedding/embedding-provider.js'
import { createIndexManager, type IndexStats } from '../vectorstore/index-manager.js'
import { createDocumentScanner, type ScannedDocument } from '../ingestion/document-scanner.js'
import { createPdfParser } from '../ingestion/pdf-parser.js'
import { createExcelParser } from '../ingestion/excel-parser.js'
import { createMarkdownParser } from '../ingestion/markdown-parser.js'
import { createDocumentChunker } from '../ingestion/document-chunker.js'
import { documentChunksToRecords } from '../ingestion/document-converter.js'

const BATCH_SIZE = 20

export interface IndexResult {
  readonly processedCount: number
  readonly chunkCount: number
}

export interface IndexServiceCallbacks {
  readonly onScanComplete?: (count: number) => void
  readonly onBatchProgress?: (processed: number, total: number) => void
  readonly onDocumentError?: (fileName: string, error: string) => void
  readonly onComplete?: (stats: IndexStats) => void
}

export interface IndexService {
  readonly indexCode: (serviceName?: string, callbacks?: IndexServiceCallbacks) => Promise<IndexResult>
  readonly indexDocuments: (docsPath: string, callbacks?: IndexServiceCallbacks) => Promise<IndexResult>
  readonly clearIndex: () => Promise<void>
  readonly getStats: () => Promise<IndexStats>
}

function chunksToRecords(
  chunks: readonly CodeChunk[],
  vectors: readonly (readonly number[])[],
): readonly VectorRecord[] {
  return chunks.map((chunk, i) => ({
    id: chunk.id,
    content: chunk.content,
    vector: vectors[i],
    chunkType: 'code' as const,
    filePath: chunk.filePath,
    relativePath: chunk.relativePath,
    serviceName: chunk.serviceName,
    fileType: chunk.fileType,
    language: chunk.language,
    symbolName: chunk.symbolName ?? '',
    level: chunk.level,
    startLine: chunk.startLine,
    endLine: chunk.endLine,
  }))
}

async function parseAndChunkDocument(
  doc: ScannedDocument,
  chunkSize: number,
  chunkOverlap: number,
): Promise<readonly DocumentChunk[]> {
  const chunker = createDocumentChunker({ chunkSize, chunkOverlap })

  switch (doc.documentType) {
    case 'pdf': {
      const parser = createPdfParser()
      const result = await parser.parse(doc.filePath)
      return chunker.chunkPdf(doc.relativePath, result)
    }
    case 'excel': {
      const parser = createExcelParser()
      const result = await parser.parse(doc.filePath)
      return chunker.chunkExcel(doc.relativePath, result)
    }
    case 'markdown': {
      const parser = createMarkdownParser()
      const result = await parser.parse(doc.filePath)
      return chunker.chunkMarkdown(doc.relativePath, result, 'markdown')
    }
    case 'text': {
      const parser = createMarkdownParser()
      const result = await parser.parseText(doc.filePath)
      return chunker.chunkMarkdown(doc.relativePath, result, 'text')
    }
  }
}

export async function createIndexService(
  config: AppConfig,
  paths: ProjectPaths,
): Promise<IndexService> {
  const indexMgr = await createIndexManager(paths.dataDir)
  const embedder = createEmbeddingProvider(config.embedding)

  return {
    indexCode: async (serviceName, callbacks) => {
      const scanner = createFileScanner(config.index)
      const filePaths = serviceName
        ? await scanner.listServiceFiles(serviceName)
        : await scanner.listFiles()

      callbacks?.onScanComplete?.(filePaths.length)

      const chunker = createChunker({
        chunkSize: config.index.chunkSize,
        chunkOverlap: config.index.chunkOverlap,
      })

      let totalChunks = 0
      let processedFiles = 0

      for (let i = 0; i < filePaths.length; i += BATCH_SIZE) {
        const batch = filePaths.slice(i, i + BATCH_SIZE)
        callbacks?.onBatchProgress?.(processedFiles, filePaths.length)

        const files = await Promise.all(batch.map(fp => scanner.readFile(fp)))
        const validFiles = files.filter((f): f is NonNullable<typeof f> => f !== null)

        if (validFiles.length > 0) {
          const chunks = validFiles.flatMap(f => chunker.chunkFile(f))

          if (chunks.length > 0) {
            const texts = chunks.map(c => c.content)
            const vectors = await embedder.embedBatch(texts)
            const records = chunksToRecords(chunks, vectors)
            await indexMgr.indexCode(records as VectorRecord[])
            totalChunks += chunks.length
          }
        }

        processedFiles += batch.length
      }

      const stats = await indexMgr.getStats()
      callbacks?.onComplete?.(stats)

      return { processedCount: processedFiles, chunkCount: totalChunks }
    },

    indexDocuments: async (docsPath, callbacks) => {
      const resolvedPath = resolve(docsPath)
      const scanner = createDocumentScanner()
      const documents = await scanner.scan(resolvedPath)

      callbacks?.onScanComplete?.(documents.length)

      let totalChunks = 0
      let processedDocs = 0

      for (let i = 0; i < documents.length; i += BATCH_SIZE) {
        const batch = documents.slice(i, i + BATCH_SIZE)
        callbacks?.onBatchProgress?.(processedDocs, documents.length)

        const batchChunks: DocumentChunk[] = []

        for (const doc of batch) {
          try {
            const chunks = await parseAndChunkDocument(
              doc,
              config.index.chunkSize,
              config.index.chunkOverlap,
            )
            batchChunks.push(...chunks)
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error)
            callbacks?.onDocumentError?.(doc.fileName, msg)
          }
        }

        if (batchChunks.length > 0) {
          const texts = batchChunks.map(c => c.content)
          const vectors = await embedder.embedBatch(texts)
          const records = documentChunksToRecords(batchChunks, vectors)
          await indexMgr.indexDocuments(records as VectorRecord[])
          totalChunks += batchChunks.length
        }

        processedDocs += batch.length
      }

      const stats = await indexMgr.getStats()
      callbacks?.onComplete?.(stats)

      return { processedCount: processedDocs, chunkCount: totalChunks }
    },

    clearIndex: () => indexMgr.clearIndex(),

    getStats: () => indexMgr.getStats(),
  }
}
