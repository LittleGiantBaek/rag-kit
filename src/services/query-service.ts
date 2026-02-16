import type { AppConfig } from '../types/config.js'
import type { ProjectPaths } from '../config/project-paths.js'
import type { SearchResult } from '../types/metadata.js'
import type { SearchContext } from '../generation/prompt-templates.js'
import { createEmbeddingProvider } from '../embedding/embedding-provider.js'
import { createIndexManager } from '../vectorstore/index-manager.js'
import { createRetriever } from '../retrieval/retriever.js'
import { createContextAssembler } from '../generation/context-assembler.js'
import { createLlmProvider } from '../generation/llm-provider.js'
import { buildSystemPrompt, buildRagPrompt } from '../generation/prompt-templates.js'

export interface RetrievalResult {
  readonly results: readonly SearchResult[]
  readonly contexts: readonly SearchContext[]
}

export interface QueryService {
  readonly retrieve: (question: string, limit: number) => Promise<RetrievalResult>
  readonly generate: (question: string, contexts: readonly SearchContext[]) => Promise<string>
  readonly generateStream: (question: string, contexts: readonly SearchContext[]) => AsyncGenerator<string>
  readonly systemPrompt: string
  readonly llmName: string
}

export async function createQueryService(
  config: AppConfig,
  paths: ProjectPaths,
  options: { readonly useCloud: boolean },
): Promise<QueryService> {
  const llmConfig = options.useCloud
    ? (() => {
        if (!config.cloud?.llm) {
          throw new Error('클라우드 LLM 프로바이더가 설정되지 않았습니다. "rag-kit config set cloud.llm.provider openai" 등으로 설정하세요.')
        }
        return config.cloud.llm
      })()
    : config.llm

  const embedder = createEmbeddingProvider(config.embedding)
  const indexMgr = await createIndexManager(paths.dataDir)
  const retriever = createRetriever(embedder, indexMgr, config.index.services)
  const assembler = createContextAssembler()
  const llm = createLlmProvider(llmConfig)
  const systemPrompt = buildSystemPrompt(config)

  return {
    retrieve: async (question, limit) => {
      const results = await retriever.retrieve(question, limit)
      const contexts = assembler.assemble(results)
      return { results, contexts }
    },

    generate: async (question, contexts) => {
      const ragPrompt = buildRagPrompt(question, contexts, config)
      return llm.generate(ragPrompt, systemPrompt)
    },

    generateStream: async function* (question, contexts) {
      const ragPrompt = buildRagPrompt(question, contexts, config)
      const stream = llm.generateStream(ragPrompt, systemPrompt)
      for await (const chunk of stream) {
        yield chunk
      }
    },

    systemPrompt,
    llmName: llm.name,
  }
}
