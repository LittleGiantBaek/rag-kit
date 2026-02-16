import { OpenAIEmbeddings } from '@langchain/openai'
import type { EmbeddingConfig } from '../types/config.js'
import type { EmbeddingProvider } from './embedding-provider.js'

export function createOpenAIEmbedder(config: EmbeddingConfig): EmbeddingProvider {
  if (!config.apiKey) {
    throw new Error(
      'OpenAI API key is required for OpenAI embeddings. ' +
      'Set the apiKey in your embedding configuration or the OPENAI_API_KEY environment variable.'
    )
  }

  const embeddings = new OpenAIEmbeddings({
    model: config.model,
    dimensions: config.dimensions,
    openAIApiKey: config.apiKey,
  })

  return Object.freeze({
    name: `openai/${config.model}`,
    dimensions: config.dimensions,

    async embedText(text: string): Promise<number[]> {
      try {
        return await embeddings.embedQuery(text)
      } catch (error) {
        throw new Error(
          `OpenAI embedding failed for text: ${error instanceof Error ? error.message : String(error)}. ` +
          'Check your API key and network connectivity.'
        )
      }
    },

    async embedBatch(texts: string[]): Promise<number[][]> {
      try {
        return await embeddings.embedDocuments(texts)
      } catch (error) {
        throw new Error(
          `OpenAI batch embedding failed: ${error instanceof Error ? error.message : String(error)}. ` +
          'Check your API key and network connectivity.'
        )
      }
    },
  })
}
