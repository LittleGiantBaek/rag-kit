import { resolve, basename, join } from 'node:path'
import { readFile, readdir, stat, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import type { Command } from 'commander'
import chalk from 'chalk'
import { saveConfig } from '../../config/config-manager.js'
import { resolveProjectPaths } from '../../config/project-paths.js'
import type { ServiceConfig, ProfileType } from '../../types/config.js'
import { PROFILE_PRESETS } from '../../types/profile.js'

interface DetectedService {
  readonly name: string
  readonly path: string
  readonly framework: string
  readonly role: string
}

async function detectFramework(dirPath: string): Promise<string> {
  const pkgPath = join(dirPath, 'package.json')
  if (!existsSync(pkgPath)) return 'unknown'

  try {
    const raw = await readFile(pkgPath, 'utf-8')
    const pkg = JSON.parse(raw) as Record<string, unknown>
    const deps = {
      ...(pkg.dependencies as Record<string, string> | undefined),
      ...(pkg.devDependencies as Record<string, string> | undefined),
    }

    if (deps['@nestjs/core']) return 'NestJS'
    if (deps['next']) return 'Next.js'
    if (deps['express']) return 'Express'
    if (deps['fastify']) return 'Fastify'
    if (deps['react']) return 'React'
    if (deps['vue']) return 'Vue'
    if (deps['django']) return 'Django'
    if (deps['flask']) return 'Flask'
    return 'Node.js'
  } catch {
    return 'unknown'
  }
}

function deriveRole(framework: string): string {
  const roleMap: Record<string, string> = {
    'NestJS': '백엔드 API',
    'Next.js': '프론트엔드',
    'Express': '백엔드 API',
    'Fastify': '백엔드 API',
    'React': '프론트엔드',
    'Vue': '프론트엔드',
    'Django': '백엔드 API',
    'Flask': '백엔드 API',
  }
  return roleMap[framework] ?? 'service'
}

async function scanServices(targetPath: string): Promise<readonly DetectedService[]> {
  const entries = await readdir(targetPath, { withFileTypes: true })
  const dirs = entries.filter(e => e.isDirectory() && !e.name.startsWith('.'))

  const results = await Promise.all(
    dirs.map(async (dir): Promise<DetectedService | null> => {
      const dirPath = join(targetPath, dir.name)
      const hasPkgJson = existsSync(join(dirPath, 'package.json'))
      const hasTsConfig = existsSync(join(dirPath, 'tsconfig.json'))

      if (!hasPkgJson && !hasTsConfig) return null

      const framework = await detectFramework(dirPath)
      return {
        name: dir.name,
        path: dir.name,
        framework,
        role: deriveRole(framework),
      }
    }),
  )

  return results.filter((s): s is DetectedService => s !== null)
}

export function registerInitCommand(program: Command): void {
  program
    .command('init <path>')
    .description('대상 코드베이스 경로를 설정하고 서비스를 자동 감지합니다')
    .option('-p, --profile <type>', '프로필 (code, document, hybrid)', 'code')
    .option('-n, --name <name>', '프로젝트 이름')
    .option('-d, --description <desc>', '프로젝트 설명')
    .action(async (inputPath: string, options: { profile: string; name?: string; description?: string }) => {
      try {
        const targetPath = resolve(inputPath)

        const targetStat = await stat(targetPath).catch(() => null)
        if (!targetStat?.isDirectory()) {
          console.error(chalk.red(`오류: 경로가 존재하지 않거나 디렉토리가 아닙니다: ${targetPath}`))
          process.exit(1)
        }

        const profile = options.profile as ProfileType
        const preset = PROFILE_PRESETS[profile]
        if (!preset) {
          console.error(chalk.red(`오류: 지원하지 않는 프로필: ${options.profile}. (code, document, hybrid)`))
          process.exit(1)
        }

        const paths = resolveProjectPaths(targetPath)

        if (!existsSync(paths.dataDir)) {
          await mkdir(paths.dataDir, { recursive: true })
        }
        if (!existsSync(paths.cacheDir)) {
          await mkdir(paths.cacheDir, { recursive: true })
        }

        const detectedServices = await scanServices(targetPath)
        const services: readonly ServiceConfig[] = detectedServices.map(s => ({
          name: s.name,
          path: s.path,
          framework: s.framework,
          role: s.role,
        }))

        const projectName = options.name ?? basename(targetPath)
        const projectDescription = options.description ?? ''

        await saveConfig(paths, {
          project: {
            name: projectName,
            description: projectDescription,
          },
          profile,
          index: {
            targetPath,
            services: services as ServiceConfig[],
            includePatterns: preset.includePatterns as string[],
            excludePatterns: preset.excludePatterns as string[],
            chunkSize: preset.chunkSize,
            chunkOverlap: 200,
          },
        })

        console.info(chalk.green('\n✔ 초기화 완료'))
        console.info(`프로젝트: ${chalk.cyan(projectName)}`)
        console.info(`대상 경로: ${chalk.cyan(targetPath)}`)
        console.info(`프로필: ${chalk.cyan(profile)}`)

        if (services.length > 0) {
          const serviceList = services
            .map(s => `${s.name} (${s.framework})`)
            .join(', ')
          console.info(`감지된 서비스: ${chalk.cyan(serviceList)}`)
        } else {
          console.info(`감지된 서비스: ${chalk.yellow('없음 (전체 경로 스캔 모드)')}`)
        }

        console.info(`설정 파일: ${chalk.dim(paths.configFile)}`)
        console.info(chalk.dim('\n다음 단계: rag-kit index'))
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(chalk.red(`초기화 실패: ${message}`))
        process.exit(1)
      }
    })
}
