import type { EmbeddingConfig } from '../types/config.js'
import type { EmbeddingProvider } from './embedding-provider.js'

const EMBED_BATCH_SIZE = 10

async function ollamaEmbed(
  baseUrl: string,
  model: string,
  input: string,
): Promise<number[]> {
  const response = await fetch(`${baseUrl}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, input }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Ollama embed failed (${response.status}): ${text}`)
  }

  const data = await response.json() as { embeddings: number[][] }
  return data.embeddings[0]
}

async function ollamaEmbedBatch(
  baseUrl: string,
  model: string,
  inputs: readonly string[],
): Promise<number[][]> {
  const response = await fetch(`${baseUrl}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, input: inputs }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Ollama batch embed failed (${response.status}): ${text}`)
  }

  const data = await response.json() as { embeddings: number[][] }
  return data.embeddings
}

export function createOllamaEmbedder(config: EmbeddingConfig): EmbeddingProvider {
  const baseUrl = config.baseUrl ?? 'http://localhost:11434'
  const model = config.model

  return {
    name: `ollama/${model}`,
    dimensions: config.dimensions,

    async embedText(text: string): Promise<number[]> {
      try {
        return await ollamaEmbed(baseUrl, model, text)
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        throw new Error(
          `Ollama 임베딩 실패: ${msg}. ` +
          'Ollama가 실행 중인지 확인하세요 (ollama serve).',
        )
      }
    },

    async embedBatch(texts: string[]): Promise<number[][]> {
      try {
        const results: number[][] = []
        for (let i = 0; i < texts.length; i += EMBED_BATCH_SIZE) {
          const batch = texts.slice(i, i + EMBED_BATCH_SIZE)
          const embeddings = await ollamaEmbedBatch(baseUrl, model, batch)
          results.push(...embeddings)
        }
        return results
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        throw new Error(
          `Ollama 배치 임베딩 실패: ${msg}. ` +
          'Ollama가 실행 중인지 확인하세요 (ollama serve).',
        )
      }
    },
  }
}
