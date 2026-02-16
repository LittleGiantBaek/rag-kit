import type {
  FrameworkMetadata,
  RouteInfo,
  EntityRelation,
  DecoratorInfo,
} from '../types/metadata.js'

export interface FrameworkAnalyzerPlugin {
  readonly name: string
  readonly canAnalyze: (content: string) => boolean
  readonly analyze: (content: string, filePath: string) => FrameworkMetadata
}

const HTTP_METHODS = ['Get', 'Post', 'Put', 'Delete', 'Patch'] as const

const RELATION_TYPES = [
  'OneToOne',
  'OneToMany',
  'ManyToOne',
  'ManyToMany',
] as const

function extractBracketContent(text: string, startIndex: number): string {
  let depth = 0
  let start = -1

  for (let i = startIndex; i < text.length; i++) {
    if (text[i] === '[') {
      if (depth === 0) start = i + 1
      depth++
    }
    if (text[i] === ']') {
      depth--
      if (depth === 0) return text.slice(start, i)
    }
  }

  return ''
}

function extractModuleImports(content: string): readonly string[] {
  const moduleMatch = content.match(/@Module\s*\(\s*\{/)
  if (!moduleMatch?.index) return []

  const importsMatch = content.slice(moduleMatch.index).match(/imports\s*:\s*\[/)
  if (!importsMatch?.index) return []

  const absoluteIndex = moduleMatch.index + importsMatch.index
  const raw = extractBracketContent(content, absoluteIndex)
  if (!raw) return []

  return raw
    .split(',')
    .map(item => item.trim())
    .filter(item => item.length > 0)
    .map(item => {
      const forRootMatch = item.match(/^(\w+)\.(forRoot|forRootAsync|forFeature|register|registerAsync)\s*\(/)
      if (forRootMatch) return `${forRootMatch[1]}.${forRootMatch[2]}`
      return item.replace(/\(.*\)/, '').trim()
    })
    .filter(item => item.length > 0)
}

function extractGuardsOrInterceptors(
  methodBlock: string,
  decoratorName: string,
): readonly string[] {
  const pattern = new RegExp(`@${decoratorName}\\s*\\(([^)]+)\\)`)
  const match = methodBlock.match(pattern)
  if (!match) return []

  return match[1]
    .split(',')
    .map(g => g.trim())
    .filter(g => g.length > 0)
}

function extractControllerRoutes(content: string): readonly RouteInfo[] {
  const controllerMatch = content.match(/@Controller\s*\(\s*['"]([^'"]*)['"]\s*\)/)
  const basePath = controllerMatch ? `/${controllerMatch[1].replace(/^\//, '')}` : '/'

  const routes: RouteInfo[] = []

  for (const method of HTTP_METHODS) {
    const pattern = new RegExp(
      `@${method}\\s*\\(\\s*(?:['"]([^'"]*)['"'])?\\s*\\)([\\s\\S]*?)(?=@(?:${HTTP_METHODS.join('|')})|$)`,
      'g',
    )

    let match: RegExpExecArray | null
    while ((match = pattern.exec(content)) !== null) {
      const routePath = match[1] ?? ''
      const methodBlock = match[2]

      const handlerMatch = methodBlock.match(
        /(?:async\s+)?(\w+)\s*\(/,
      )
      const handlerName = handlerMatch ? handlerMatch[1] : 'unknown'

      const fullPath = routePath
        ? `${basePath}/${routePath}`.replace(/\/+/g, '/')
        : basePath

      const guards = extractGuardsOrInterceptors(methodBlock, 'UseGuards')
      const interceptors = extractGuardsOrInterceptors(methodBlock, 'UseInterceptors')

      routes.push({
        method: method.toUpperCase(),
        path: fullPath,
        handlerName,
        ...(guards.length > 0 ? { guards } : {}),
        ...(interceptors.length > 0 ? { interceptors } : {}),
      })
    }
  }

  return routes
}

function extractEntityRelations(content: string): readonly EntityRelation[] {
  const relations: EntityRelation[] = []

  for (const relType of RELATION_TYPES) {
    const pattern = new RegExp(
      `@${relType}\\s*\\(\\s*\\(\\)\\s*=>\\s*(\\w+)(?:\\s*,\\s*(?:\\(\\w+\\)\\s*=>\\s*(\\w+\\.\\w+)|[^)]+))?\\)([\\s\\S]*?)(?=\\n\\s*(?:@|\\w))`,
      'g',
    )

    let match: RegExpExecArray | null
    while ((match = pattern.exec(content)) !== null) {
      const target = match[1]
      const inverseSide = match[2]
      const trailing = match[3] ?? ''
      const hasJoinColumn = /@JoinColumn\s*\(/.test(trailing)

      relations.push({
        type: relType,
        target,
        ...(inverseSide ? { inverseSide } : {}),
        ...(hasJoinColumn ? { joinColumn: true } : {}),
      })
    }
  }

  return relations
}

function extractInjectableDeps(content: string): readonly string[] {
  const constructorMatch = content.match(/constructor\s*\(([\s\S]*?)\)/)
  if (!constructorMatch) return []

  const params = constructorMatch[1]

  const deps: string[] = []

  const injectPattern = /@Inject\s*\(\s*['"]?(\w+)['"]?\s*\)/g
  let injectMatch: RegExpExecArray | null
  while ((injectMatch = injectPattern.exec(params)) !== null) {
    deps.push(injectMatch[1])
  }

  const typePattern = /(?:private|protected|public|readonly)\s+\w+\s*:\s*(\w+)/g
  let typeMatch: RegExpExecArray | null
  while ((typeMatch = typePattern.exec(params)) !== null) {
    if (!deps.includes(typeMatch[1])) {
      deps.push(typeMatch[1])
    }
  }

  return deps
}

function extractDecorators(content: string): readonly DecoratorInfo[] {
  const decorators: DecoratorInfo[] = []
  const pattern = /@(\w+)\s*\(([^)]*)\)\s*\n\s*(?:export\s+)?(?:class|(?:async\s+)?\w+\s*\(|(?:readonly\s+)?(\w+)\s*[:(])/g

  let match: RegExpExecArray | null
  while ((match = pattern.exec(content)) !== null) {
    const name = match[1]
    const rawArgs = match[2].trim()
    const target = match[3] ?? extractTargetName(content, match.index + match[0].length)

    const args: unknown[] = rawArgs.length > 0 ? [rawArgs] : []

    decorators.push({
      name,
      ...(args.length > 0 ? { args } : {}),
      target,
    })
  }

  return decorators
}

function extractTargetName(content: string, fromIndex: number): string {
  const slice = content.slice(fromIndex, fromIndex + 200)
  const classMatch = slice.match(/class\s+(\w+)/)
  if (classMatch) return classMatch[1]

  const methodMatch = slice.match(/(?:async\s+)?(\w+)\s*\(/)
  if (methodMatch) return methodMatch[1]

  return 'unknown'
}

const NESTJS_DECORATOR_PATTERN = /@(?:Module|Controller|Injectable|Entity)\s*\(/

export function createNestJsPlugin(): FrameworkAnalyzerPlugin {
  return {
    name: 'nestjs',

    canAnalyze(content: string): boolean {
      return NESTJS_DECORATOR_PATTERN.test(content)
    },

    analyze(content: string, _filePath: string): FrameworkMetadata {
      const moduleImports = extractModuleImports(content)
      const controllerRoutes = extractControllerRoutes(content)
      const entityRelations = extractEntityRelations(content)
      const injectableDeps = extractInjectableDeps(content)
      const decorators = extractDecorators(content)

      return {
        ...(moduleImports.length > 0 ? { moduleImports } : {}),
        ...(controllerRoutes.length > 0 ? { controllerRoutes } : {}),
        ...(entityRelations.length > 0 ? { entityRelations } : {}),
        ...(injectableDeps.length > 0 ? { injectableDeps } : {}),
        ...(decorators.length > 0 ? { decorators } : {}),
      }
    },
  }
}
