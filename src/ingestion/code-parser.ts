import { createHash } from 'node:crypto'
import * as ts from 'typescript'
import type { CodeChunk, ChunkLevel } from '../types/chunk.js'
import type { ScannedFile } from './file-scanner.js'

export interface ParsedSymbol {
  readonly name: string
  readonly kind: 'class' | 'function' | 'interface' | 'enum' | 'type' | 'variable'
  readonly startLine: number
  readonly endLine: number
  readonly content: string
  readonly decorators: readonly string[]
  readonly methods?: readonly ParsedSymbol[]
  readonly parentName?: string
}

export interface CodeParser {
  parseFile(file: ScannedFile): readonly CodeChunk[]
}

function generateChunkId(
  filePath: string,
  startLine: number,
  endLine: number,
): string {
  const input = `${filePath}:${startLine}:${endLine}`
  return createHash('sha256').update(input).digest('hex').slice(0, 16)
}

function getLineNumber(pos: number, sourceFile: ts.SourceFile): number {
  return ts.getLineAndCharacterOfPosition(sourceFile, pos).line + 1
}

function getNodeText(node: ts.Node, sourceFile: ts.SourceFile): string {
  return node.getFullText(sourceFile).trim()
}

function extractDecoratorName(decorator: ts.Decorator): string {
  const expr = decorator.expression
  if (ts.isCallExpression(expr) && ts.isIdentifier(expr.expression)) {
    return expr.expression.text
  }
  if (ts.isIdentifier(expr)) {
    return expr.text
  }
  return ''
}

function extractDecorators(node: ts.Node): readonly string[] {
  if (!ts.canHaveDecorators(node)) {
    return []
  }
  const decorators = ts.getDecorators(node)
  if (!decorators) {
    return []
  }
  return decorators
    .map(extractDecoratorName)
    .filter((name): name is string => name.length > 0)
}

function extractImports(sourceFile: ts.SourceFile): readonly string[] {
  const imports: string[] = []
  for (const statement of sourceFile.statements) {
    if (
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      imports.push(statement.moduleSpecifier.text)
    }
  }
  return imports
}

function extractExportedSymbolNames(
  sourceFile: ts.SourceFile,
): readonly string[] {
  const exported: string[] = []
  for (const statement of sourceFile.statements) {
    if (!hasExportModifier(statement)) {
      continue
    }
    const name = getDeclarationName(statement)
    if (name) {
      exported.push(name)
    }
  }
  return exported
}

function hasExportModifier(node: ts.Node): boolean {
  if (!ts.canHaveModifiers(node)) {
    return false
  }
  const modifiers = ts.getModifiers(node)
  if (!modifiers) {
    return false
  }
  return modifiers.some(m => m.kind === ts.SyntaxKind.ExportKeyword)
}

function getDeclarationName(node: ts.Statement): string | undefined {
  if (ts.isClassDeclaration(node) && node.name) {
    return node.name.text
  }
  if (ts.isFunctionDeclaration(node) && node.name) {
    return node.name.text
  }
  if (ts.isInterfaceDeclaration(node)) {
    return node.name.text
  }
  if (ts.isEnumDeclaration(node)) {
    return node.name.text
  }
  if (ts.isTypeAliasDeclaration(node)) {
    return node.name.text
  }
  if (ts.isVariableStatement(node)) {
    const decl = node.declarationList.declarations[0]
    if (decl && ts.isIdentifier(decl.name)) {
      return decl.name.text
    }
  }
  return undefined
}

function parseClassMembers(
  classNode: ts.ClassDeclaration,
  sourceFile: ts.SourceFile,
  parentName: string,
): readonly ParsedSymbol[] {
  const methods: ParsedSymbol[] = []
  for (const member of classNode.members) {
    if (!ts.isMethodDeclaration(member) || !member.name) {
      continue
    }
    const name = member.name.getText(sourceFile)
    methods.push({
      name,
      kind: 'function',
      startLine: getLineNumber(member.getStart(sourceFile), sourceFile),
      endLine: getLineNumber(member.getEnd(), sourceFile),
      content: getNodeText(member, sourceFile),
      decorators: extractDecorators(member),
      parentName,
    })
  }
  return methods
}

function parseTopLevelNode(
  node: ts.Node,
  sourceFile: ts.SourceFile,
): ParsedSymbol | undefined {
  if (ts.isClassDeclaration(node) && node.name) {
    const name = node.name.text
    return {
      name,
      kind: 'class',
      startLine: getLineNumber(node.getStart(sourceFile), sourceFile),
      endLine: getLineNumber(node.getEnd(), sourceFile),
      content: getNodeText(node, sourceFile),
      decorators: extractDecorators(node),
      methods: parseClassMembers(node, sourceFile, name),
    }
  }

  if (ts.isFunctionDeclaration(node) && node.name) {
    return {
      name: node.name.text,
      kind: 'function',
      startLine: getLineNumber(node.getStart(sourceFile), sourceFile),
      endLine: getLineNumber(node.getEnd(), sourceFile),
      content: getNodeText(node, sourceFile),
      decorators: extractDecorators(node),
    }
  }

  if (ts.isInterfaceDeclaration(node)) {
    return {
      name: node.name.text,
      kind: 'interface',
      startLine: getLineNumber(node.getStart(sourceFile), sourceFile),
      endLine: getLineNumber(node.getEnd(), sourceFile),
      content: getNodeText(node, sourceFile),
      decorators: [],
    }
  }

  if (ts.isEnumDeclaration(node)) {
    return {
      name: node.name.text,
      kind: 'enum',
      startLine: getLineNumber(node.getStart(sourceFile), sourceFile),
      endLine: getLineNumber(node.getEnd(), sourceFile),
      content: getNodeText(node, sourceFile),
      decorators: [],
    }
  }

  if (ts.isTypeAliasDeclaration(node)) {
    return {
      name: node.name.text,
      kind: 'type',
      startLine: getLineNumber(node.getStart(sourceFile), sourceFile),
      endLine: getLineNumber(node.getEnd(), sourceFile),
      content: getNodeText(node, sourceFile),
      decorators: [],
    }
  }

  return undefined
}

function collectSymbols(sourceFile: ts.SourceFile): readonly ParsedSymbol[] {
  const symbols: ParsedSymbol[] = []
  for (const statement of sourceFile.statements) {
    const symbol = parseTopLevelNode(statement, sourceFile)
    if (symbol) {
      symbols.push(symbol)
    }
  }
  return symbols
}

function collectAllDecorators(
  symbols: readonly ParsedSymbol[],
): readonly string[] {
  const allDecorators: string[] = []
  for (const symbol of symbols) {
    allDecorators.push(...symbol.decorators)
    if (symbol.methods) {
      for (const method of symbol.methods) {
        allDecorators.push(...method.decorators)
      }
    }
  }
  return [...new Set(allDecorators)]
}

function buildFileSummaryContent(
  file: ScannedFile,
  imports: readonly string[],
  exportedNames: readonly string[],
  decorators: readonly string[],
): string {
  const lines = file.content.split('\n')
  const parts: string[] = [
    `// File: ${file.relativePath}`,
    `// Service: ${file.serviceName}`,
    `// Type: ${file.fileType}`,
    `// Lines: ${lines.length}`,
    '',
  ]

  if (imports.length > 0) {
    parts.push('// Imports:', ...imports.map(i => `//   ${i}`), '')
  }

  if (exportedNames.length > 0) {
    parts.push('// Exports:', ...exportedNames.map(e => `//   ${e}`), '')
  }

  if (decorators.length > 0) {
    parts.push('// Decorators:', ...decorators.map(d => `//   @${d}`))
  }

  return parts.join('\n')
}

function createFileSummaryChunk(
  file: ScannedFile,
  sourceFile: ts.SourceFile,
  symbols: readonly ParsedSymbol[],
): CodeChunk {
  const imports = extractImports(sourceFile)
  const exportedNames = extractExportedSymbolNames(sourceFile)
  const decorators = collectAllDecorators(symbols)
  const lineCount = file.content.split('\n').length

  return {
    id: generateChunkId(file.filePath, 0, 0),
    content: buildFileSummaryContent(file, imports, exportedNames, decorators),
    level: 'file-summary' as ChunkLevel,
    filePath: file.filePath,
    relativePath: file.relativePath,
    serviceName: file.serviceName,
    fileType: file.fileType,
    language: file.language,
    startLine: 1,
    endLine: lineCount,
    imports: imports as string[],
    exports: exportedNames as string[],
    decorators: decorators as string[],
  }
}

function symbolToClassChunk(
  symbol: ParsedSymbol,
  file: ScannedFile,
): CodeChunk {
  return {
    id: generateChunkId(file.filePath, symbol.startLine, symbol.endLine),
    content: symbol.content,
    level: 'class' as ChunkLevel,
    filePath: file.filePath,
    relativePath: file.relativePath,
    serviceName: file.serviceName,
    fileType: file.fileType,
    language: file.language,
    startLine: symbol.startLine,
    endLine: symbol.endLine,
    symbolName: symbol.name,
    decorators: symbol.decorators as string[],
  }
}

function symbolToMethodChunk(
  symbol: ParsedSymbol,
  file: ScannedFile,
): CodeChunk {
  return {
    id: generateChunkId(file.filePath, symbol.startLine, symbol.endLine),
    content: symbol.content,
    level: 'method' as ChunkLevel,
    filePath: file.filePath,
    relativePath: file.relativePath,
    serviceName: file.serviceName,
    fileType: file.fileType,
    language: file.language,
    startLine: symbol.startLine,
    endLine: symbol.endLine,
    symbolName: symbol.name,
    parentSymbol: symbol.parentName,
    decorators: symbol.decorators as string[],
  }
}

function symbolsToChunks(
  symbols: readonly ParsedSymbol[],
  file: ScannedFile,
): readonly CodeChunk[] {
  const chunks: CodeChunk[] = []

  for (const symbol of symbols) {
    if (isClassLevelKind(symbol.kind)) {
      chunks.push(symbolToClassChunk(symbol, file))
      if (symbol.methods) {
        for (const method of symbol.methods) {
          chunks.push(symbolToMethodChunk(method, file))
        }
      }
    }

    if (symbol.kind === 'function') {
      chunks.push(symbolToMethodChunk(symbol, file))
    }
  }

  return chunks
}

function isClassLevelKind(
  kind: ParsedSymbol['kind'],
): kind is 'class' | 'interface' | 'enum' | 'type' {
  return (
    kind === 'class' ||
    kind === 'interface' ||
    kind === 'enum' ||
    kind === 'type'
  )
}

export function createCodeParser(): CodeParser {
  return {
    parseFile(file: ScannedFile): readonly CodeChunk[] {
      const sourceFile = ts.createSourceFile(
        file.filePath,
        file.content,
        ts.ScriptTarget.Latest,
        true,
      )

      const symbols = collectSymbols(sourceFile)
      const summaryChunk = createFileSummaryChunk(file, sourceFile, symbols)
      const symbolChunks = symbolsToChunks(symbols, file)

      return [summaryChunk, ...symbolChunks]
    },
  }
}
