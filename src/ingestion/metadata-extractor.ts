import type { FileMetadata, FrameworkMetadata } from '../types/metadata.js'
import type { ScannedFile } from './file-scanner.js'
import type { FrameworkAnalyzerPlugin } from './nestjs-analyzer.js'
import { createNestJsPlugin } from './nestjs-analyzer.js'

export interface EnrichedMetadata {
  readonly file: FileMetadata
  readonly framework?: FrameworkMetadata
  readonly summary: string
}

export interface MetadataExtractor {
  extract(file: ScannedFile): EnrichedMetadata
}

function detectRole(content: string): 'module' | 'controller' | 'entity' | 'service' | null {
  if (/@Module\s*\(/.test(content)) return 'module'
  if (/@Controller\s*\(/.test(content)) return 'controller'
  if (/@Entity\s*\(/.test(content)) return 'entity'
  if (/@Injectable\s*\(/.test(content)) return 'service'
  return null
}

function buildModuleSummary(metadata: FileMetadata, framework: FrameworkMetadata): string {
  const imports = framework.moduleImports?.join(', ') ?? 'none'
  return `모듈 (${metadata.serviceName}). Imports: ${imports}`
}

function buildControllerSummary(metadata: FileMetadata, framework: FrameworkMetadata): string {
  const routes = (framework.controllerRoutes ?? [])
    .map(r => `${r.method} ${r.path}`)
    .join(', ')
  return `REST 컨트롤러 (${metadata.serviceName}). Routes: ${routes || 'none'}`
}

function buildEntitySummary(metadata: FileMetadata, framework: FrameworkMetadata): string {
  const relations = (framework.entityRelations ?? [])
    .map(r => `${r.type} → ${r.target}`)
    .join(', ')
  return `엔티티 (${metadata.serviceName}). Relations: ${relations || 'none'}`
}

function buildServiceSummary(metadata: FileMetadata, framework: FrameworkMetadata): string {
  const deps = framework.injectableDeps?.join(', ') ?? 'none'
  return `서비스 (${metadata.serviceName}). Dependencies: ${deps}`
}

function buildFrameworkSummary(
  role: 'module' | 'controller' | 'entity' | 'service',
  metadata: FileMetadata,
  framework: FrameworkMetadata,
): string {
  const builders: Record<typeof role, () => string> = {
    module: () => buildModuleSummary(metadata, framework),
    controller: () => buildControllerSummary(metadata, framework),
    entity: () => buildEntitySummary(metadata, framework),
    service: () => buildServiceSummary(metadata, framework),
  }
  return builders[role]()
}

function buildGenericSummary(metadata: FileMetadata): string {
  return `${metadata.fileType} 파일 (${metadata.serviceName}). ${metadata.language}, ${metadata.lineCount} lines`
}

export function createMetadataExtractor(
  additionalPlugins?: readonly FrameworkAnalyzerPlugin[],
): MetadataExtractor {
  const plugins: readonly FrameworkAnalyzerPlugin[] = [
    createNestJsPlugin(),
    ...(additionalPlugins ?? []),
  ]

  return {
    extract(file: ScannedFile): EnrichedMetadata {
      const matchedPlugin = plugins.find(p => p.canAnalyze(file.content))

      if (!matchedPlugin) {
        return {
          file: file.metadata,
          summary: buildGenericSummary(file.metadata),
        }
      }

      const framework = matchedPlugin.analyze(file.content, file.filePath)
      const role = detectRole(file.content)

      const summary = role
        ? buildFrameworkSummary(role, file.metadata, framework)
        : buildGenericSummary(file.metadata)

      return {
        file: file.metadata,
        framework,
        summary,
      }
    },
  }
}
