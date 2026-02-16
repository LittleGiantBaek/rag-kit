import type { EmbeddingConfig } from '../types/config.js'
import { createOllamaEmbedder } from './ollama-embedder.js'
import { createOpenAIEmbedder } from './openai-embedder.js'

export interface EmbeddingProvider {
  readonly name: string
  readonly dimensions: number
  embedText(text: string): Promise<number[]>
  embedBatch(texts: string[]): Promise<number[][]>
}

export function createEmbeddingProvider(config: EmbeddingConfig): EmbeddingProvider {
  switch (config.provider) {
    case 'ollama':
      return createOllamaEmbedder(config)
    case 'openai':
      return createOpenAIEmbedder(config)
    default:
      throw new Error(
        `Unsupported embedding provider: "${config.provider}". Supported providers: ollama, openai`
      )
  }
}
