import { readFile } from 'node:fs/promises'

const MAX_ROWS_PER_SHEET = 10_000

export interface ExcelSheet {
  readonly sheetName: string
  readonly content: string
  readonly rowCount: number
}

export interface ExcelParseResult {
  readonly sheets: readonly ExcelSheet[]
  readonly metadata: {
    readonly sheetNames: readonly string[]
    readonly totalSheets: number
  }
}

export interface ExcelParser {
  readonly parse: (filePath: string) => Promise<ExcelParseResult>
}

async function parseExcelFile(filePath: string): Promise<ExcelParseResult> {
  const XLSX = await import('xlsx')
  const buffer = await readFile(filePath)
  const workbook = XLSX.read(buffer, { type: 'buffer' })

  const sheets: ExcelSheet[] = workbook.SheetNames.map(sheetName => {
    const sheet = workbook.Sheets[sheetName]
    if (!sheet) {
      return { sheetName, content: '', rowCount: 0 }
    }

    const csvContent = XLSX.utils.sheet_to_csv(sheet)
    const rows = csvContent.split('\n')
    const truncatedRows = rows.slice(0, MAX_ROWS_PER_SHEET)
    const content = truncatedRows.join('\n').trim()

    return {
      sheetName,
      content,
      rowCount: truncatedRows.length,
    }
  }).filter(s => s.content.length > 0)

  return {
    sheets,
    metadata: {
      sheetNames: workbook.SheetNames,
      totalSheets: workbook.SheetNames.length,
    },
  }
}

export function createExcelParser(): ExcelParser {
  return {
    parse: (filePath: string) => parseExcelFile(filePath),
  }
}
