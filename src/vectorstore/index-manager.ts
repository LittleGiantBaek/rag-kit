import { createLanceStore, type LanceStore } from './lance-store.js'
import { type VectorRecord } from './schema.js'

const DEFAULT_CODE_TABLE = 'code_chunks'
const DEFAULT_DOCUMENTS_TABLE = 'documents'
const DEFAULT_DIMENSIONS = 768

export interface IndexManagerOptions {
  readonly codeTable?: string
  readonly documentsTable?: string
}

export interface IndexStats {
  readonly codeChunks: number
  readonly documents: number
}

export interface IndexManager {
  readonly indexCode: (records: readonly VectorRecord[]) => Promise<void>
  readonly indexDocuments: (records: readonly VectorRecord[]) => Promise<void>
  readonly searchCode: (
    queryVector: readonly number[],
    limit: number,
    filter?: string,
  ) => Promise<readonly Record<string, unknown>[]>
  readonly searchDocuments: (
    queryVector: readonly number[],
    limit: number,
  ) => Promise<readonly Record<string, unknown>[]>
  readonly searchAll: (
    queryVector: readonly number[],
    limit: number,
    filter?: string,
  ) => Promise<readonly Record<string, unknown>[]>
  readonly getChunksByProximity: (
    filePath: string,
    startLine: number,
    range: number,
    limit: number,
  ) => Promise<readonly Record<string, unknown>[]>
  readonly clearIndex: (tableName?: string) => Promise<void>
  readonly getStats: () => Promise<IndexStats>
}

function mergeAndSortByScore(
  codeResults: readonly Record<string, unknown>[],
  docResults: readonly Record<string, unknown>[],
  limit: number,
): readonly Record<string, unknown>[] {
  const combined = [...codeResults, ...docResults]

  const sorted = combined
    .sort((a, b) => {
      const scoreA = typeof a['_distance'] === 'number' ? a['_distance'] : Infinity
      const scoreB = typeof b['_distance'] === 'number' ? b['_distance'] : Infinity
      return scoreA - scoreB
    })
    .slice(0, limit)

  return sorted
}

function escapeSQL(value: string): string {
  return value.replace(/'/g, "''")
}

async function clearAllTables(
  store: LanceStore,
  codeTable: string,
  documentsTable: string,
): Promise<void> {
  await store.deleteTable(codeTable)
  await store.deleteTable(documentsTable)
}

async function clearSingleTable(
  store: LanceStore,
  tableName: string,
): Promise<void> {
  await store.deleteTable(tableName)
}

async function searchByProximity(
  store: LanceStore,
  codeTable: string,
  filePath: string,
  startLine: number,
  range: number,
  limit: number,
): Promise<readonly Record<string, unknown>[]> {
  const exists = await store.tableExists(codeTable)

  if (!exists) {
    return []
  }

  const escapedPath = escapeSQL(filePath)
  const rangeStart = startLine - range
  const rangeEnd = startLine + range
  const filter = `\`filePath\` = '${escapedPath}' AND \`startLine\` BETWEEN ${rangeStart} AND ${rangeEnd}`

  const dummyVector = Array.from(
    { length: DEFAULT_DIMENSIONS },
    () => 0,
  )

  return store.search(codeTable, dummyVector, limit, filter)
}

export async function createIndexManager(
  dataDir: string,
  options?: IndexManagerOptions,
): Promise<IndexManager> {
  const store = await createLanceStore(dataDir)
  const codeTable = options?.codeTable ?? DEFAULT_CODE_TABLE
  const documentsTable = options?.documentsTable ?? DEFAULT_DOCUMENTS_TABLE

  return {
    indexCode: (records) =>
      store.addRecords(codeTable, records, DEFAULT_DIMENSIONS),

    indexDocuments: (records) =>
      store.addRecords(documentsTable, records, DEFAULT_DIMENSIONS),

    searchCode: (queryVector, limit, filter) =>
      store.search(codeTable, queryVector, limit, filter),

    searchDocuments: (queryVector, limit) =>
      store.search(documentsTable, queryVector, limit),

    searchAll: async (queryVector, limit, filter) => {
      const [codeResults, docResults] = await Promise.all([
        store.search(codeTable, queryVector, limit, filter),
        store.search(documentsTable, queryVector, limit),
      ])

      return mergeAndSortByScore(codeResults, docResults, limit)
    },

    getChunksByProximity: (filePath, startLine, range, limit) =>
      searchByProximity(store, codeTable, filePath, startLine, range, limit),

    clearIndex: (tableName) =>
      tableName
        ? clearSingleTable(store, tableName)
        : clearAllTables(store, codeTable, documentsTable),

    getStats: async () => {
      const [codeChunks, documents] = await Promise.all([
        store.getRecordCount(codeTable),
        store.getRecordCount(documentsTable),
      ])

      return { codeChunks, documents }
    },
  }
}
