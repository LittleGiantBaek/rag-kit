import type { EmbeddingProvider } from './embedding-provider.js'

export interface BatchEmbedderOptions {
  readonly batchSize: number
  readonly delayMs: number
  readonly onProgress?: (processed: number, total: number) => void
}

export interface BatchEmbedder {
  embedAll(texts: string[]): Promise<number[][]>
}

const DEFAULT_OPTIONS: Readonly<Omit<BatchEmbedderOptions, 'onProgress'>> = {
  batchSize: 50,
  delayMs: 100,
}

function splitIntoBatches(texts: readonly string[], batchSize: number): readonly string[][] {
  const batches: string[][] = []
  for (let i = 0; i < texts.length; i += batchSize) {
    batches.push(texts.slice(i, i + batchSize))
  }
  return batches
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function createBatchEmbedder(
  provider: EmbeddingProvider,
  options?: Partial<BatchEmbedderOptions>
): BatchEmbedder {
  const resolvedOptions: BatchEmbedderOptions = {
    ...DEFAULT_OPTIONS,
    ...options,
  }

  return Object.freeze({
    async embedAll(texts: string[]): Promise<number[][]> {
      if (texts.length === 0) {
        return []
      }

      const batches = splitIntoBatches(texts, resolvedOptions.batchSize)
      const results: number[][] = []
      let processed = 0

      for (let i = 0; i < batches.length; i++) {
        const batchResults = await provider.embedBatch([...batches[i]])
        results.push(...batchResults)

        processed += batches[i].length
        resolvedOptions.onProgress?.(processed, texts.length)

        const isLastBatch = i === batches.length - 1
        if (!isLastBatch && resolvedOptions.delayMs > 0) {
          await delay(resolvedOptions.delayMs)
        }
      }

      return results
    },
  })
}
