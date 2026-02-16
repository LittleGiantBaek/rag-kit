import type { LlmConfig } from '../types/config.js'
import type { LlmProvider } from './llm-provider.js'

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'

function buildHeaders(apiKey: string): Record<string, string> {
  return {
    'x-api-key': apiKey,
    'anthropic-version': ANTHROPIC_VERSION,
    'content-type': 'application/json',
  }
}

function buildRequestBody(
  model: string,
  prompt: string,
  maxTokens: number,
  systemPrompt?: string,
  stream?: boolean
) {
  return {
    model,
    max_tokens: maxTokens,
    ...(systemPrompt ? { system: systemPrompt } : {}),
    messages: [{ role: 'user' as const, content: prompt }],
    ...(stream ? { stream: true } : {}),
  }
}

export function createAnthropicLlm(config: LlmConfig): LlmProvider {
  if (!config.apiKey) {
    throw new Error(
      'Anthropic API key is required for Anthropic LLM. ' +
      'Set the apiKey in your LLM configuration or the ANTHROPIC_API_KEY environment variable.'
    )
  }

  const apiKey = config.apiKey
  const maxTokens = config.maxTokens ?? 4096

  return Object.freeze({
    name: `anthropic/${config.model}`,
    model: config.model,

    async generate(prompt: string, systemPrompt?: string): Promise<string> {
      try {
        const body = buildRequestBody(config.model, prompt, maxTokens, systemPrompt)
        const response = await fetch(ANTHROPIC_API_URL, {
          method: 'POST',
          headers: buildHeaders(apiKey),
          body: JSON.stringify(body),
        })

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`API returned ${response.status}: ${errorText}`)
        }

        const data = await response.json() as {
          readonly content: readonly { readonly type: string; readonly text: string }[]
        }
        return data.content[0].text
      } catch (error) {
        if (error instanceof Error && error.message.startsWith('API returned')) {
          throw error
        }
        throw new Error(
          `Anthropic LLM generation failed: ${error instanceof Error ? error.message : String(error)}. ` +
          'Check your API key and network connectivity.'
        )
      }
    },

    async *generateStream(prompt: string, systemPrompt?: string): AsyncGenerator<string> {
      try {
        const body = buildRequestBody(config.model, prompt, maxTokens, systemPrompt, true)
        const response = await fetch(ANTHROPIC_API_URL, {
          method: 'POST',
          headers: buildHeaders(apiKey),
          body: JSON.stringify(body),
        })

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`API returned ${response.status}: ${errorText}`)
        }

        if (!response.body) {
          throw new Error('Response body is null, streaming is not supported')
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer = buffer + decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() ?? ''

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue
              const jsonStr = line.slice(6).trim()
              if (jsonStr === '[DONE]' || jsonStr === '') continue

              const event = JSON.parse(jsonStr) as {
                readonly type: string
                readonly delta?: { readonly type: string; readonly text?: string }
              }

              if (event.type === 'content_block_delta' && event.delta?.text) {
                yield event.delta.text
              }
            }
          }
        } finally {
          reader.releaseLock()
        }
      } catch (error) {
        if (error instanceof Error && error.message.startsWith('API returned')) {
          throw error
        }
        throw new Error(
          `Anthropic LLM streaming failed: ${error instanceof Error ? error.message : String(error)}. ` +
          'Check your API key and network connectivity.'
        )
      }
    },
  })
}
