import { stat } from 'node:fs/promises'
import { relative, extname } from 'node:path'
import { glob } from 'glob'

const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024 // 10MB

const DOCUMENT_PATTERNS = [
  '**/*.pdf',
  '**/*.xls',
  '**/*.xlsx',
  '**/*.md',
  '**/*.txt',
]

const IGNORE_PATTERNS = [
  '**/node_modules/**',
  '**/dist/**',
  '**/.git/**',
  '**/build/**',
]

export type DocumentType = 'pdf' | 'excel' | 'markdown' | 'text'

export interface ScannedDocument {
  readonly filePath: string
  readonly relativePath: string
  readonly documentType: DocumentType
  readonly fileName: string
  readonly sizeBytes: number
}

export interface DocumentScanner {
  readonly scan: (dirPath: string) => Promise<readonly ScannedDocument[]>
}

function detectDocumentType(filePath: string): DocumentType {
  const ext = extname(filePath).toLowerCase()
  switch (ext) {
    case '.pdf':
      return 'pdf'
    case '.xls':
    case '.xlsx':
      return 'excel'
    case '.md':
      return 'markdown'
    case '.txt':
      return 'text'
    default:
      return 'text'
  }
}

function extractFileName(filePath: string): string {
  const parts = filePath.split('/')
  return parts[parts.length - 1] ?? filePath
}

async function scanDirectory(dirPath: string): Promise<readonly ScannedDocument[]> {
  const patterns = DOCUMENT_PATTERNS.map(p => `${dirPath}/${p}`)

  const filePaths = await glob(patterns, {
    ignore: IGNORE_PATTERNS,
    nodir: true,
    absolute: true,
  })

  const documents: ScannedDocument[] = []

  for (const fp of filePaths) {
    try {
      const fileStat = await stat(fp)
      if (fileStat.size === 0 || fileStat.size > MAX_DOCUMENT_SIZE) continue

      documents.push({
        filePath: fp,
        relativePath: relative(dirPath, fp),
        documentType: detectDocumentType(fp),
        fileName: extractFileName(fp),
        sizeBytes: fileStat.size,
      })
    } catch {
      // Skip files that cannot be accessed
    }
  }

  return documents
}

export function createDocumentScanner(): DocumentScanner {
  return {
    scan: (dirPath: string) => scanDirectory(dirPath),
  }
}
