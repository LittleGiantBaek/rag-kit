import type { Command } from 'commander'
import ora from 'ora'
import chalk from 'chalk'
import { resolve } from 'node:path'
import { loadConfig } from '../../config/config-manager.js'
import { createFileScanner } from '../../ingestion/file-scanner.js'
import { createChunker } from '../../ingestion/chunker.js'
import { createEmbeddingProvider } from '../../embedding/embedding-provider.js'
import { createIndexManager } from '../../vectorstore/index-manager.js'
import { createDocumentScanner, type ScannedDocument } from '../../ingestion/document-scanner.js'
import { createPdfParser } from '../../ingestion/pdf-parser.js'
import { createExcelParser } from '../../ingestion/excel-parser.js'
import { createMarkdownParser } from '../../ingestion/markdown-parser.js'
import { createDocumentChunker } from '../../ingestion/document-chunker.js'
import { documentChunksToRecords } from '../../ingestion/document-converter.js'
import type { VectorRecord } from '../../vectorstore/schema.js'
import type { CodeChunk, DocumentChunk } from '../../types/chunk.js'

const BATCH_SIZE = 20

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

export function registerIndexCommand(program: Command): void {
  program
    .command('index')
    .description('코드베이스 인덱싱')
    .option('-s, --service <name>', '특정 서비스만 인덱싱')
    .option('--docs <path>', '외부 문서 인덱싱')
    .option('--clear', '기존 인덱스 삭제 후 재인덱싱')
    .action(async (options: { service?: string; docs?: string; clear?: boolean }) => {
      const spinner = ora()

      try {
        const config = await loadConfig()
        const indexMgr = await createIndexManager(config.dataDir)
        const embedder = createEmbeddingProvider(config.embedding)

        if (options.clear) {
          spinner.start('기존 인덱스 삭제 중...')
          await indexMgr.clearIndex()
          spinner.succeed('기존 인덱스 삭제 완료')
        }

        if (options.docs) {
          const docsPath = resolve(options.docs)
          spinner.start('문서 스캔 중...')
          const scanner = createDocumentScanner()
          const documents = await scanner.scan(docsPath)
          spinner.succeed(`${documents.length}개 문서 발견`)

          if (documents.length === 0) {
            console.info(chalk.yellow('인덱싱할 문서가 없습니다.'))
            return
          }

          let totalChunks = 0
          let processedDocs = 0

          for (let i = 0; i < documents.length; i += BATCH_SIZE) {
            const batch = documents.slice(i, i + BATCH_SIZE)
            spinner.start(`문서 처리 중... ${processedDocs}/${documents.length}`)

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
                spinner.warn(`${doc.fileName} 파싱 실패: ${msg}`)
                spinner.start(`문서 처리 중... ${processedDocs}/${documents.length}`)
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

          spinner.succeed('문서 인덱싱 완료')

          const stats = await indexMgr.getStats()
          console.info(chalk.green(
            `\n✓ 문서 인덱싱 완료: ${processedDocs}개 문서, ${stats.documents}개 청크`,
          ))
          return
        }

        spinner.start('파일 스캔 중...')
        const scanner = createFileScanner(config.index)
        const filePaths = options.service
          ? await scanner.listServiceFiles(options.service)
          : await scanner.listFiles()
        spinner.succeed(`${filePaths.length}개 파일 발견`)

        const chunker = createChunker({
          chunkSize: config.index.chunkSize,
          chunkOverlap: config.index.chunkOverlap,
        })

        let totalChunks = 0
        let processedFiles = 0

        for (let i = 0; i < filePaths.length; i += BATCH_SIZE) {
          const batch = filePaths.slice(i, i + BATCH_SIZE)
          spinner.start(`처리 중... ${processedFiles}/${filePaths.length} 파일`)

          const files = await Promise.all(batch.map(fp => scanner.readFile(fp)))
          const validFiles = files.filter((f): f is NonNullable<typeof f> => f !== null)

          if (validFiles.length === 0) {
            processedFiles += batch.length
            continue
          }

          const chunks = validFiles.flatMap(f => chunker.chunkFile(f))
          if (chunks.length === 0) {
            processedFiles += batch.length
            continue
          }

          const texts = chunks.map(c => c.content)
          const vectors = await embedder.embedBatch(texts)

          const records = chunksToRecords(chunks, vectors)
          await indexMgr.indexCode(records as VectorRecord[])

          totalChunks += chunks.length
          processedFiles += batch.length
        }

        spinner.succeed('인덱싱 완료')

        const stats = await indexMgr.getStats()
        console.info(chalk.green(`\n✓ 인덱싱 완료: ${processedFiles}개 파일, ${stats.codeChunks}개 청크`))
      } catch (error) {
        spinner.fail('인덱싱 실패')
        const message = error instanceof Error ? error.message : String(error)
        console.error(chalk.red(`오류: ${message}`))
        process.exit(1)
      }
    })
}
