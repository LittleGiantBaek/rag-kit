import type { QueryAnalysis } from '../types/metadata.js'
import type { ServiceConfig } from '../types/config.js'

const FILE_TYPE_KEYWORDS: ReadonlyMap<string, string> = new Map([
  ['controller', 'controller'],
  ['service', 'service'],
  ['entity', 'entity'],
  ['module', 'module'],
  ['dto', 'dto'],
  ['guard', 'guard'],
  ['interceptor', 'interceptor'],
  ['pipe', 'pipe'],
  ['middleware', 'middleware'],
  ['resolver', 'resolver'],
  ['gateway', 'gateway'],
  ['strategy', 'strategy'],
  ['repository', 'repository'],
  ['component', 'component'],
  ['page', 'page'],
  ['hook', 'hook'],
  ['util', 'util'],
  ['model', 'model'],
  ['route', 'route'],
])

const STOP_WORDS: ReadonlySet<string> = new Set([
  '의', '에서', '를', '이', '가', '은', '는', '에', '로', '으로',
  '와', '과', '도', '만', '부터', '까지', '한', '할', '하는', '된',
  'the', 'is', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of',
  'how', 'what', 'where', 'when', 'why', 'which', 'who',
  'and', 'or', 'but', 'not', 'this', 'that', 'it', 'be',
  'are', 'was', 'were', 'been', 'has', 'have', 'had', 'do', 'does',
])

const ARCHITECTURAL_KEYWORDS: ReadonlySet<string> = new Set([
  '구조', '아키텍처', 'architecture', 'structure', '설계',
  'design', '흐름', 'flow', '전체', 'overview', 'diagram',
  '패턴', 'pattern', '의존성', 'dependency',
])

const ENTITY_NAME_PATTERN = /\b([A-Z][a-z]+(?:[A-Z][a-z]+)*)\b/g

function buildServicePatterns(
  services: readonly ServiceConfig[],
): readonly (readonly [RegExp, string])[] {
  if (services.length === 0) return []

  const patterns: (readonly [RegExp, string])[] = []

  for (const svc of services) {
    const escaped = svc.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    patterns.push([new RegExp(escaped.replace(/-/g, '[-\\s]?'), 'i'), svc.name])
  }

  for (const svc of services) {
    const shortName = svc.name.replace(/^.*?-/, '')
    if (shortName && shortName !== svc.name) {
      const escaped = shortName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      patterns.push([new RegExp(`\\b${escaped}\\b`, 'i'), svc.name])
    }
  }

  return patterns
}

function extractServiceName(
  query: string,
  servicePatterns: readonly (readonly [RegExp, string])[],
): string | undefined {
  const matched = servicePatterns.find(([pattern]) => pattern.test(query))
  return matched ? matched[1] : undefined
}

function extractFileType(query: string): string | undefined {
  const lowerQuery = query.toLowerCase()
  const entries = Array.from(FILE_TYPE_KEYWORDS.entries())
  const matched = entries.find(([keyword]) => lowerQuery.includes(keyword))
  return matched ? matched[1] : undefined
}

function extractEntityNames(query: string): readonly string[] {
  const matches = query.match(ENTITY_NAME_PATTERN)

  if (!matches) {
    return []
  }

  const filtered = matches.filter(
    (name) => name.length > 2 && !STOP_WORDS.has(name.toLowerCase()),
  )

  return [...new Set(filtered)]
}

function extractKeywords(query: string): readonly string[] {
  const words = query
    .split(/[\s,;.!?]+/)
    .map((word) => word.trim().toLowerCase())
    .filter((word) => word.length > 1)
    .filter((word) => !STOP_WORDS.has(word))

  return [...new Set(words)]
}

function detectArchitectural(query: string): boolean {
  const lowerQuery = query.toLowerCase()
  return Array.from(ARCHITECTURAL_KEYWORDS).some(
    (keyword) => lowerQuery.includes(keyword),
  )
}

export function createQueryAnalyzer(
  services: readonly ServiceConfig[],
): (query: string) => QueryAnalysis {
  const servicePatterns = buildServicePatterns(services)

  return (query: string): QueryAnalysis => ({
    originalQuery: query,
    keywords: extractKeywords(query),
    serviceFilter: extractServiceName(query, servicePatterns),
    fileTypeFilter: extractFileType(query),
    entityNames: extractEntityNames(query),
    isArchitectural: detectArchitectural(query),
  })
}
