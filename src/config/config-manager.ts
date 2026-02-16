import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { existsSync } from 'node:fs'
import { appConfigSchema } from './config-schema.js'
import { DEFAULT_CONFIG } from './defaults.js'
import type { AppConfig } from '../types/config.js'
import type { ProjectPaths } from './project-paths.js'

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const result = { ...target }
  for (const key of Object.keys(source)) {
    const sourceVal = source[key]
    const targetVal = target[key]
    if (
      sourceVal !== null &&
      typeof sourceVal === 'object' &&
      !Array.isArray(sourceVal) &&
      targetVal !== null &&
      typeof targetVal === 'object' &&
      !Array.isArray(targetVal)
    ) {
      result[key] = deepMerge(
        targetVal as Record<string, unknown>,
        sourceVal as Record<string, unknown>,
      )
    } else {
      result[key] = sourceVal
    }
  }
  return result
}

export async function loadConfig(paths: ProjectPaths): Promise<AppConfig> {
  if (!existsSync(paths.configFile)) {
    return DEFAULT_CONFIG
  }

  try {
    const raw = await readFile(paths.configFile, 'utf-8')
    const userConfig = JSON.parse(raw) as Record<string, unknown>
    const merged = deepMerge(
      DEFAULT_CONFIG as unknown as Record<string, unknown>,
      userConfig,
    )
    const validated = appConfigSchema.parse(merged)
    return validated as AppConfig
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`설정 파일 로드 실패 (${paths.configFile}): ${message}`)
  }
}

export async function saveConfig(paths: ProjectPaths, config: Partial<AppConfig>): Promise<AppConfig> {
  const current = await loadConfig(paths)
  const merged = deepMerge(
    current as unknown as Record<string, unknown>,
    config as unknown as Record<string, unknown>,
  )
  const validated = appConfigSchema.parse(merged)

  const dir = dirname(paths.configFile)
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true })
  }

  await writeFile(paths.configFile, JSON.stringify(validated, null, 2), 'utf-8')
  return validated as AppConfig
}

export async function getConfigValue(paths: ProjectPaths, path: string): Promise<unknown> {
  const config = await loadConfig(paths)
  const parts = path.split('.')
  let current: unknown = config
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined
    }
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

export async function setConfigValue(paths: ProjectPaths, path: string, value: unknown): Promise<AppConfig> {
  const parts = path.split('.')
  const patch: Record<string, unknown> = {}
  let current = patch
  for (let i = 0; i < parts.length - 1; i++) {
    const next: Record<string, unknown> = {}
    current[parts[i]] = next
    current = next
  }
  current[parts[parts.length - 1]] = value
  return saveConfig(paths, patch as Partial<AppConfig>)
}
