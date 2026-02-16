import { readFile, stat } from 'node:fs/promises'
import { join, relative, extname, basename } from 'node:path'
import { glob } from 'glob'
import type { IndexConfig, ServiceConfig } from '../types/config.js'
import type { FileMetadata } from '../types/metadata.js'

const MAX_FILE_SIZE = 50_000 // 50KB

export interface ScannedFile {
  readonly filePath: string
  readonly relativePath: string
  readonly serviceName: string
  readonly fileType: string
  readonly language: string
  readonly content: string
  readonly metadata: FileMetadata
}

export interface FilePath {
  readonly filePath: string
  readonly relativePath: string
  readonly serviceName: string
}

export interface FileScanner {
  listFiles(): Promise<readonly FilePath[]>
  listServiceFiles(serviceName: string): Promise<readonly FilePath[]>
  readFile(filePath: FilePath): Promise<ScannedFile | null>
}

function detectFileType(filePath: string): string {
  const name = filePath.toLowerCase()
  if (name.includes('.controller.')) return 'controller'
  if (name.includes('.service.')) return 'service'
  if (name.includes('.module.')) return 'module'
  if (name.includes('.entity.')) return 'entity'
  if (name.includes('.dto.')) return 'dto'
  if (name.includes('.guard.')) return 'guard'
  if (name.includes('.interceptor.')) return 'interceptor'
  if (name.includes('.pipe.')) return 'pipe'
  if (name.includes('.middleware.')) return 'middleware'
  if (name.includes('.resolver.')) return 'resolver'
  if (name.includes('.gateway.')) return 'gateway'
  if (name.includes('.strategy.')) return 'strategy'
  if (name.includes('.repository.')) return 'repository'
  if (name.includes('.interface.')) return 'interface'
  if (name.includes('.enum.')) return 'enum'
  if (name.includes('.config.') || name.includes('.configuration.')) return 'config'
  if (name.includes('.spec.') || name.includes('.test.')) return 'test'
  if (name.includes('/components/') || name.endsWith('.tsx') || name.endsWith('.jsx')) return 'component'
  if (name.includes('/pages/') || name.includes('/app/')) return 'page'
  if (name.includes('/hooks/') || name.includes('use')) return 'hook'
  if (name.includes('/utils/') || name.includes('/util/') || name.includes('/helpers/')) return 'util'
  if (name.includes('/models/') || name.includes('/schemas/')) return 'model'
  if (name.includes('/routes/') || name.includes('/router')) return 'route'
  return 'unknown'
}

function detectLanguage(filePath: string): string {
  const ext = extname(filePath).toLowerCase()
  const languageMap: Record<string, string> = {
    '.ts': 'typescript',
    '.tsx': 'typescript-react',
    '.js': 'javascript',
    '.jsx': 'javascript-react',
    '.py': 'python',
    '.go': 'go',
    '.java': 'java',
    '.rs': 'rust',
    '.rb': 'ruby',
    '.php': 'php',
    '.swift': 'swift',
    '.kt': 'kotlin',
    '.scala': 'scala',
    '.cs': 'csharp',
    '.cpp': 'cpp',
    '.c': 'c',
  }
  return languageMap[ext] ?? 'unknown'
}

async function listServiceDir(
  service: ServiceConfig,
  config: IndexConfig,
): Promise<readonly FilePath[]> {
  const serviceDir = join(config.targetPath, service.path)
  const includePatterns = config.includePatterns.map(p => join(serviceDir, p))
  const ignorePatterns = config.excludePatterns.map(p => join(serviceDir, p))

  const filePaths = await glob(includePatterns, {
    ignore: ignorePatterns,
    nodir: true,
    absolute: true,
  })

  return filePaths.map(fp => ({
    filePath: fp,
    relativePath: relative(config.targetPath, fp),
    serviceName: service.name,
  }))
}

async function loadFile(fp: FilePath): Promise<ScannedFile | null> {
  try {
    const fileStat = await stat(fp.filePath)
    if (fileStat.size === 0 || fileStat.size > MAX_FILE_SIZE) return null

    const content = await readFile(fp.filePath, 'utf-8')
    const fileType = detectFileType(fp.filePath)
    const language = detectLanguage(fp.filePath)

    return {
      filePath: fp.filePath,
      relativePath: fp.relativePath,
      serviceName: fp.serviceName,
      fileType,
      language,
      content,
      metadata: {
        filePath: fp.filePath,
        relativePath: fp.relativePath,
        serviceName: fp.serviceName,
        fileType,
        language,
        lineCount: content.split('\n').length,
        lastModified: fileStat.mtime.toISOString(),
        size: fileStat.size,
      },
    }
  } catch {
    return null
  }
}

export function createFileScanner(config: IndexConfig): FileScanner {
  return {
    async listFiles(): Promise<readonly FilePath[]> {
      if (config.services.length === 0) {
        const rootService: ServiceConfig = {
          name: basename(config.targetPath),
          path: '.',
          framework: 'unknown',
          role: 'root',
        }
        return listServiceDir(rootService, config)
      }

      const allResults = await Promise.all(
        config.services.map(svc => listServiceDir(svc, config)),
      )
      return allResults.flat()
    },

    async listServiceFiles(serviceName: string): Promise<readonly FilePath[]> {
      const service = config.services.find(s => s.name === serviceName)
      if (!service) {
        throw new Error(`알 수 없는 서비스: ${serviceName}. 사용 가능: ${config.services.map(s => s.name).join(', ')}`)
      }
      return listServiceDir(service, config)
    },

    async readFile(fp: FilePath): Promise<ScannedFile | null> {
      return loadFile(fp)
    },
  }
}
