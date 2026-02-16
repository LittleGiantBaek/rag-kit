export type LlmProvider = 'ollama' | 'openai' | 'anthropic'
export type EmbeddingProvider = 'ollama' | 'openai'
export type ProfileType = 'code' | 'document' | 'hybrid'

export interface LlmConfig {
  readonly provider: LlmProvider
  readonly model: string
  readonly baseUrl?: string
  readonly apiKey?: string
  readonly temperature?: number
  readonly maxTokens?: number
}

export interface EmbeddingConfig {
  readonly provider: EmbeddingProvider
  readonly model: string
  readonly dimensions: number
  readonly baseUrl?: string
  readonly apiKey?: string
}

export interface IndexConfig {
  readonly targetPath: string
  readonly services: readonly ServiceConfig[]
  readonly includePatterns: readonly string[]
  readonly excludePatterns: readonly string[]
  readonly chunkSize: number
  readonly chunkOverlap: number
}

export interface ServiceConfig {
  readonly name: string
  readonly path: string
  readonly framework: string
  readonly role: string
}

export interface ProjectConfig {
  readonly name: string
  readonly description: string
}

export interface PromptsConfig {
  readonly systemContext: string
  readonly answerGuidelines: readonly string[]
}

export interface CloudProviderConfig {
  readonly llm: LlmConfig
}

export interface AppConfig {
  readonly project: ProjectConfig
  readonly profile: ProfileType
  readonly llm: LlmConfig
  readonly embedding: EmbeddingConfig
  readonly cloud?: CloudProviderConfig
  readonly index: IndexConfig
  readonly prompts: PromptsConfig
  readonly dataDir: string
  readonly cacheDir: string
}
