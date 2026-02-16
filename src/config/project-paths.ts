import { join, resolve } from 'node:path'
import { existsSync } from 'node:fs'

const RAG_KIT_DIR = '.rag-kit'

export interface ProjectPaths {
  readonly projectRoot: string
  readonly configFile: string
  readonly dataDir: string
  readonly cacheDir: string
}

export function findProjectRoot(startDir?: string): string {
  let current = resolve(startDir ?? process.cwd())

  while (true) {
    const candidate = join(current, RAG_KIT_DIR)
    if (existsSync(candidate)) {
      return current
    }

    const parent = resolve(current, '..')
    if (parent === current) {
      throw new Error(
        `프로젝트를 찾을 수 없습니다. 현재 디렉토리 또는 상위에 .rag-kit/이 없습니다.\n"rag-kit init <path>"로 먼저 초기화하세요.`,
      )
    }
    current = parent
  }
}

export function resolveProjectPaths(projectRoot: string): ProjectPaths {
  const ragKitDir = join(projectRoot, RAG_KIT_DIR)

  return {
    projectRoot,
    configFile: join(ragKitDir, 'config.json'),
    dataDir: join(ragKitDir, 'data'),
    cacheDir: join(ragKitDir, 'cache'),
  }
}

export function getProjectPaths(startDir?: string): ProjectPaths {
  const root = findProjectRoot(startDir)
  return resolveProjectPaths(root)
}
