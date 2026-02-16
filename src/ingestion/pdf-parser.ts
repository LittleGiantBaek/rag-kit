import { readFile } from 'node:fs/promises'

export interface PdfPage {
  readonly pageNumber: number
  readonly content: string
}

export interface PdfParseResult {
  readonly pages: readonly PdfPage[]
  readonly metadata: {
    readonly title: string
    readonly author: string
    readonly totalPages: number
  }
}

export interface PdfParser {
  readonly parse: (filePath: string) => Promise<PdfParseResult>
}

async function parsePdfFile(filePath: string): Promise<PdfParseResult> {
  const pdfParse = (await import('pdf-parse')).default
  const buffer = await readFile(filePath)
  const data = await pdfParse(buffer)

  const rawPages = splitByPages(data.text, data.numpages)

  const pages: readonly PdfPage[] = rawPages
    .map((content, index) => ({
      pageNumber: index + 1,
      content: content.trim(),
    }))
    .filter(p => p.content.length > 0)

  return {
    pages,
    metadata: {
      title: data.info?.Title ?? '',
      author: data.info?.Author ?? '',
      totalPages: data.numpages,
    },
  }
}

function splitByPages(text: string, pageCount: number): readonly string[] {
  if (pageCount <= 1) {
    return [text]
  }

  // pdf-parse joins pages with form feed characters
  const formFeedSplit = text.split('\f')
  if (formFeedSplit.length > 1) {
    return formFeedSplit
  }

  // Fallback: split text evenly by approximate page boundaries
  const avgCharsPerPage = Math.ceil(text.length / pageCount)
  const pages: string[] = []
  for (let i = 0; i < text.length; i += avgCharsPerPage) {
    pages.push(text.slice(i, i + avgCharsPerPage))
  }
  return pages
}

export function createPdfParser(): PdfParser {
  return {
    parse: (filePath: string) => parsePdfFile(filePath),
  }
}
