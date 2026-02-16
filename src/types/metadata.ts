export interface FrameworkMetadata {
  readonly moduleImports?: readonly string[]
  readonly controllerRoutes?: readonly RouteInfo[]
  readonly entityRelations?: readonly EntityRelation[]
  readonly injectableDeps?: readonly string[]
  readonly decorators?: readonly DecoratorInfo[]
}

export interface RouteInfo {
  readonly method: string
  readonly path: string
  readonly handlerName: string
  readonly guards?: readonly string[]
  readonly interceptors?: readonly string[]
}

export interface EntityRelation {
  readonly type: 'OneToOne' | 'OneToMany' | 'ManyToOne' | 'ManyToMany'
  readonly target: string
  readonly inverseSide?: string
  readonly joinColumn?: boolean
}

export interface DecoratorInfo {
  readonly name: string
  readonly args?: readonly unknown[]
  readonly target: string
}

export interface FileMetadata {
  readonly filePath: string
  readonly relativePath: string
  readonly serviceName: string
  readonly fileType: string
  readonly language: string
  readonly lineCount: number
  readonly lastModified: string
  readonly size: number
}

export interface SearchResult {
  readonly id: string
  readonly content: string
  readonly score: number
  readonly metadata: Record<string, unknown>
  readonly filePath?: string
  readonly serviceName?: string
  readonly fileType?: string
  readonly symbolName?: string
}

export interface QueryAnalysis {
  readonly originalQuery: string
  readonly keywords: readonly string[]
  readonly serviceFilter?: string
  readonly fileTypeFilter?: string
  readonly entityNames?: readonly string[]
  readonly isArchitectural: boolean
}
