import {
  Field,
  Float32,
  FixedSizeList,
  Int32,
  Schema,
  Utf8,
} from 'apache-arrow'

export interface VectorRecord {
  readonly id: string
  readonly content: string
  readonly vector: readonly number[]
  readonly chunkType: 'code' | 'document'
  readonly filePath: string
  readonly relativePath: string
  readonly serviceName: string
  readonly fileType: string
  readonly language: string
  readonly symbolName: string
  readonly level: string
  readonly startLine: number
  readonly endLine: number
}

const DEFAULT_DIMENSIONS = 768

export function createTableSchema(
  dimensions: number = DEFAULT_DIMENSIONS,
): Schema {
  return new Schema([
    new Field('id', new Utf8(), false),
    new Field('content', new Utf8(), false),
    new Field(
      'vector',
      new FixedSizeList(dimensions, new Field('item', new Float32(), false)),
      false,
    ),
    new Field('chunkType', new Utf8(), false),
    new Field('filePath', new Utf8(), false),
    new Field('relativePath', new Utf8(), false),
    new Field('serviceName', new Utf8(), false),
    new Field('fileType', new Utf8(), false),
    new Field('language', new Utf8(), false),
    new Field('symbolName', new Utf8(), false),
    new Field('level', new Utf8(), false),
    new Field('startLine', new Int32(), false),
    new Field('endLine', new Int32(), false),
  ])
}
