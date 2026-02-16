import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { existsSync } from 'node:fs'
import { appConfigSchema } from './config-schema.js'
import { DEFAULT_CONFIG, CONFIG_FILE_PATH } from './defaults.js'
import type { AppConfig } from '../types/config.js'

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

export async function loadConfig(): Promise<AppConfig> {
  if (!existsSync(CONFIG_FILE_PATH)) {
    return DEFAULT_CONFIG
  }

  try {
    const raw = await readFile(CONFIG_FILE_PATH, 'utf-8')
    const userConfig = JSON.parse(raw) as Record<string, unknown>
    const merged = deepMerge(
      DEFAULT_CONFIG as unknown as Record<string, unknown>,
      userConfig,
    )
    const validated = appConfigSchema.parse(merged)
    return validated as AppConfig
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`설정 파일 로드 실패 (${CONFIG_FILE_PATH}): ${message}`)
  }
}

export async function saveConfig(config: Partial<AppConfig>): Promise<AppConfig> {
  const current = await loadConfig()
  const merged = deepMerge(
    current as unknown as Record<string, unknown>,
    config as unknown as Record<string, unknown>,
  )
  const validated = appConfigSchema.parse(merged)

  const dir = dirname(CONFIG_FILE_PATH)
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true })
  }

  await writeFile(CONFIG_FILE_PATH, JSON.stringify(validated, null, 2), 'utf-8')
  return validated as AppConfig
}

export async function getConfigValue(path: string): Promise<unknown> {
  const config = await loadConfig()
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

export async function setConfigValue(path: string, value: unknown): Promise<AppConfig> {
  const parts = path.split('.')
  const patch: Record<string, unknown> = {}
  let current = patch
  for (let i = 0; i < parts.length - 1; i++) {
    const next: Record<string, unknown> = {}
    current[parts[i]] = next
    current = next
  }
  current[parts[parts.length - 1]] = value
  return saveConfig(patch as Partial<AppConfig>)
}
