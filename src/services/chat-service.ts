import type { AppConfig } from '../types/config.js'
import type { ProjectPaths } from '../config/project-paths.js'
import { createQueryService, type QueryService } from './query-service.js'
import { buildRagPrompt } from '../generation/prompt-templates.js'

interface ChatMessage {
  readonly role: 'user' | 'assistant'
  readonly content: string
}

export interface ChatTurnResult {
  readonly resultCount: number
  readonly stream: AsyncGenerator<string>
}

export interface ChatService {
  readonly ask: (question: string, limit: number) => Promise<ChatTurnResult>
  readonly clearHistory: () => void
  readonly llmName: string
}

export async function createChatService(
  config: AppConfig,
  paths: ProjectPaths,
  options: { readonly useCloud: boolean },
): Promise<ChatService> {
  const queryService = await createQueryService(config, paths, options)
  const history: ChatMessage[] = []

  return {
    ask: async (question, limit) => {
      const { results, contexts } = await queryService.retrieve(question, limit)

      const recentHistory = history.slice(-4)
      const historyContext = recentHistory
        .map(m => `${m.role === 'user' ? '질문' : '답변'}: ${m.content}`)
        .join('\n')

      const ragPrompt = historyContext
        ? `이전 대화:\n${historyContext}\n\n${buildRagPrompt(question, contexts, config)}`
        : buildRagPrompt(question, contexts, config)

      async function* streamWithHistory(): AsyncGenerator<string> {
        let fullResponse = ''
        const stream = queryService.generateStream(ragPrompt, contexts)
        for await (const chunk of stream) {
          fullResponse += chunk
          yield chunk
        }
        history.push({ role: 'user', content: question })
        history.push({ role: 'assistant', content: fullResponse })
      }

      return {
        resultCount: results.length,
        stream: streamWithHistory(),
      }
    },

    clearHistory: () => {
      history.length = 0
    },

    llmName: queryService.llmName,
  }
}
