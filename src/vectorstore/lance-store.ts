import { connect, type Connection, type Table } from '@lancedb/lancedb'

import { createTableSchema, type VectorRecord } from './schema.js'

export interface VectorStore {
  readonly addRecords: (
    tableName: string,
    records: readonly VectorRecord[],
    dimensions: number,
  ) => Promise<void>
  readonly search: (
    tableName: string,
    queryVector: readonly number[],
    limit: number,
    filter?: string,
  ) => Promise<readonly Record<string, unknown>[]>
  readonly deleteTable: (tableName: string) => Promise<void>
  readonly tableExists: (tableName: string) => Promise<boolean>
  readonly getRecordCount: (tableName: string) => Promise<number>
}

function toWritableRecords(
  records: readonly VectorRecord[],
): Record<string, unknown>[] {
  return records.map((record) => ({
    ...record,
    vector: Array.from(record.vector),
  }))
}

async function openTable(
  db: Connection,
  tableName: string,
): Promise<Table> {
  return db.openTable(tableName)
}

async function checkTableExists(
  db: Connection,
  tableName: string,
): Promise<boolean> {
  const tableNames = await db.tableNames()
  return tableNames.includes(tableName)
}

async function addRecordsToStore(
  db: Connection,
  tableName: string,
  records: readonly VectorRecord[],
  dimensions: number,
): Promise<void> {
  const writableRecords = toWritableRecords(records)
  const exists = await checkTableExists(db, tableName)

  if (exists) {
    const table = await openTable(db, tableName)
    await table.add(writableRecords)
  } else {
    const schema = createTableSchema(dimensions)
    await db.createTable(tableName, writableRecords, { schema })
  }
}

async function searchInTable(
  db: Connection,
  tableName: string,
  queryVector: readonly number[],
  limit: number,
  filter?: string,
): Promise<readonly Record<string, unknown>[]> {
  const exists = await checkTableExists(db, tableName)

  if (!exists) {
    return []
  }

  const table = await openTable(db, tableName)
  const writableVector = Array.from(queryVector)
  let query = table.search(writableVector).limit(limit)

  if (filter) {
    query = query.where(filter)
  }

  const results = await query.toArray()

  return results.map((row) => ({ ...row }))
}

async function deleteTableFromStore(
  db: Connection,
  tableName: string,
): Promise<void> {
  const exists = await checkTableExists(db, tableName)

  if (exists) {
    await db.dropTable(tableName)
  }
}

async function countRecords(
  db: Connection,
  tableName: string,
): Promise<number> {
  const exists = await checkTableExists(db, tableName)

  if (!exists) {
    return 0
  }

  const table = await openTable(db, tableName)
  return table.countRows()
}

export async function createVectorStore(
  dataDir: string,
): Promise<VectorStore> {
  const db = await connect(dataDir)

  return {
    addRecords: (tableName, records, dimensions) =>
      addRecordsToStore(db, tableName, records, dimensions),
    search: (tableName, queryVector, limit, filter) =>
      searchInTable(db, tableName, queryVector, limit, filter),
    deleteTable: (tableName) =>
      deleteTableFromStore(db, tableName),
    tableExists: (tableName) =>
      checkTableExists(db, tableName),
    getRecordCount: (tableName) =>
      countRecords(db, tableName),
  }
}
