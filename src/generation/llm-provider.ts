import type { LlmConfig } from '../types/config.js'
import { createOllamaLlm } from './ollama-llm.js'
import { createOpenAILlm } from './openai-llm.js'
import { createAnthropicLlm } from './anthropic-llm.js'

export interface LlmProvider {
  readonly name: string
  readonly model: string
  generate(prompt: string, systemPrompt?: string): Promise<string>
  generateStream(prompt: string, systemPrompt?: string): AsyncGenerator<string>
}

export function createLlmProvider(config: LlmConfig): LlmProvider {
  switch (config.provider) {
    case 'ollama':
      return createOllamaLlm(config)
    case 'openai':
      return createOpenAILlm(config)
    case 'anthropic':
      return createAnthropicLlm(config)
    default:
      throw new Error(
        `Unsupported LLM provider: "${config.provider}". Supported providers: ollama, openai, anthropic`
      )
  }
}
