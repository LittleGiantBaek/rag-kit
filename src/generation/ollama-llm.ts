import type { LlmConfig } from '../types/config.js'
import type { LlmProvider } from './llm-provider.js'

interface OllamaChatMessage {
  readonly role: 'system' | 'user' | 'assistant'
  readonly content: string
}

interface OllamaChatResponse {
  readonly message: { readonly content: string }
  readonly done: boolean
}

function buildMessages(prompt: string, systemPrompt?: string): readonly OllamaChatMessage[] {
  const messages: OllamaChatMessage[] = []
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt })
  }
  messages.push({ role: 'user', content: prompt })
  return messages
}

export function createOllamaLlm(config: LlmConfig): LlmProvider {
  const baseUrl = config.baseUrl ?? 'http://localhost:11434'
  const model = config.model

  return {
    name: `ollama/${model}`,
    model,

    async generate(prompt: string, systemPrompt?: string): Promise<string> {
      try {
        const response = await fetch(`${baseUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            messages: buildMessages(prompt, systemPrompt),
            stream: false,
            options: {
              temperature: config.temperature ?? 0.1,
              num_predict: config.maxTokens ?? 4096,
            },
          }),
        })

        if (!response.ok) {
          const text = await response.text()
          throw new Error(`Ollama chat failed (${response.status}): ${text}`)
        }

        const data = await response.json() as OllamaChatResponse
        return data.message.content
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        throw new Error(
          `Ollama LLM 실패: ${msg}. ` +
          'Ollama가 실행 중인지 확인하세요 (ollama serve).',
        )
      }
    },

    async *generateStream(prompt: string, systemPrompt?: string): AsyncGenerator<string> {
      try {
        const response = await fetch(`${baseUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            messages: buildMessages(prompt, systemPrompt),
            stream: true,
            options: {
              temperature: config.temperature ?? 0.1,
              num_predict: config.maxTokens ?? 4096,
            },
          }),
        })

        if (!response.ok) {
          const text = await response.text()
          throw new Error(`Ollama stream failed (${response.status}): ${text}`)
        }

        if (!response.body) {
          throw new Error('No response body for streaming')
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            if (line.trim() === '') continue
            try {
              const data = JSON.parse(line) as OllamaChatResponse
              if (data.message?.content) {
                yield data.message.content
              }
            } catch {
              // Skip malformed JSON lines
            }
          }
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        throw new Error(
          `Ollama 스트리밍 실패: ${msg}. ` +
          'Ollama가 실행 중인지 확인하세요 (ollama serve).',
        )
      }
    },
  }
}
