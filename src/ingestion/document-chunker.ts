import { createHash } from 'node:crypto'
import type { DocumentChunk } from '../types/chunk.js'
import type { PdfParseResult } from './pdf-parser.js'
import type { ExcelParseResult } from './excel-parser.js'
import type { MarkdownParseResult } from './markdown-parser.js'
import type { DocumentType } from './document-scanner.js'

export interface DocumentChunkerOptions {
  readonly chunkSize: number
  readonly chunkOverlap: number
}

export interface DocumentChunker {
  readonly chunkPdf: (
    source: string,
    result: PdfParseResult,
  ) => readonly DocumentChunk[]
  readonly chunkExcel: (
    source: string,
    result: ExcelParseResult,
  ) => readonly DocumentChunk[]
  readonly chunkMarkdown: (
    source: string,
    result: MarkdownParseResult,
    sourceType: DocumentType,
  ) => readonly DocumentChunk[]
}

function generateDocChunkId(source: string, section: string, index: number): string {
  const input = `doc:${source}:${section}:${index}`
  return createHash('sha256').update(input).digest('hex').slice(0, 16)
}

function splitTextBySize(
  text: string,
  chunkSize: number,
  chunkOverlap: number,
): readonly string[] {
  if (text.length <= chunkSize) {
    return [text]
  }

  const chunks: string[] = []
  let start = 0

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length)
    const chunk = text.slice(start, end)

    if (chunk.trim().length > 0) {
      chunks.push(chunk)
    }

    const nextStart = end - chunkOverlap
    if (nextStart <= start) break
    start = nextStart
  }

  return chunks
}

function chunkPdfResult(
  source: string,
  result: PdfParseResult,
  options: DocumentChunkerOptions,
): readonly DocumentChunk[] {
  const chunks: DocumentChunk[] = []

  for (const page of result.pages) {
    const textChunks = splitTextBySize(
      page.content,
      options.chunkSize,
      options.chunkOverlap,
    )

    for (let i = 0; i < textChunks.length; i++) {
      chunks.push({
        id: generateDocChunkId(source, `page-${page.pageNumber}`, i),
        content: textChunks[i],
        source,
        sourceType: 'pdf',
        page: page.pageNumber,
        metadata: {
          title: result.metadata.title,
          author: result.metadata.author,
          totalPages: String(result.metadata.totalPages),
        },
      })
    }
  }

  return chunks
}

function chunkExcelResult(
  source: string,
  result: ExcelParseResult,
  options: DocumentChunkerOptions,
): readonly DocumentChunk[] {
  const chunks: DocumentChunk[] = []

  for (const sheet of result.sheets) {
    const textChunks = splitTextBySize(
      sheet.content,
      options.chunkSize,
      options.chunkOverlap,
    )

    for (let i = 0; i < textChunks.length; i++) {
      chunks.push({
        id: generateDocChunkId(source, `sheet-${sheet.sheetName}`, i),
        content: textChunks[i],
        source,
        sourceType: 'excel',
        sheet: sheet.sheetName,
        metadata: {
          sheetName: sheet.sheetName,
          rowCount: String(sheet.rowCount),
          totalSheets: String(result.metadata.totalSheets),
        },
      })
    }
  }

  return chunks
}

function chunkMarkdownResult(
  source: string,
  result: MarkdownParseResult,
  sourceType: DocumentType,
  options: DocumentChunkerOptions,
): readonly DocumentChunk[] {
  const chunks: DocumentChunk[] = []
  const mappedSourceType = sourceType === 'text' ? 'text' : 'markdown'

  for (const section of result.sections) {
    const headerPrefix = section.heading
      ? `${'#'.repeat(section.level)} ${section.heading}\n\n`
      : ''
    const fullContent = `${headerPrefix}${section.content}`

    const textChunks = splitTextBySize(
      fullContent,
      options.chunkSize,
      options.chunkOverlap,
    )

    for (let i = 0; i < textChunks.length; i++) {
      chunks.push({
        id: generateDocChunkId(source, `section-${section.heading || 'root'}`, i),
        content: textChunks[i],
        source,
        sourceType: mappedSourceType,
        metadata: {
          heading: section.heading,
          headingLevel: String(section.level),
          sectionCount: String(result.metadata.sectionCount),
        },
      })
    }
  }

  return chunks
}

export function createDocumentChunker(
  options: DocumentChunkerOptions,
): DocumentChunker {
  return {
    chunkPdf: (source, result) =>
      chunkPdfResult(source, result, options),

    chunkExcel: (source, result) =>
      chunkExcelResult(source, result, options),

    chunkMarkdown: (source, result, sourceType) =>
      chunkMarkdownResult(source, result, sourceType, options),
  }
}
