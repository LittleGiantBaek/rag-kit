import { ChatOpenAI } from '@langchain/openai'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import type { LlmConfig } from '../types/config.js'
import type { LlmProvider } from './llm-provider.js'

function buildMessages(prompt: string, systemPrompt?: string) {
  const messages = systemPrompt
    ? [new SystemMessage(systemPrompt), new HumanMessage(prompt)]
    : [new HumanMessage(prompt)]
  return messages
}

export function createOpenAILlm(config: LlmConfig): LlmProvider {
  if (!config.apiKey) {
    throw new Error(
      'OpenAI API key is required for OpenAI LLM. ' +
      'Set the apiKey in your LLM configuration or the OPENAI_API_KEY environment variable.'
    )
  }

  const chat = new ChatOpenAI({
    model: config.model,
    temperature: config.temperature ?? 0.1,
    maxTokens: config.maxTokens,
    openAIApiKey: config.apiKey,
  })

  return Object.freeze({
    name: `openai/${config.model}`,
    model: config.model,

    async generate(prompt: string, systemPrompt?: string): Promise<string> {
      try {
        const messages = buildMessages(prompt, systemPrompt)
        const response = await chat.invoke(messages)
        return typeof response.content === 'string'
          ? response.content
          : JSON.stringify(response.content)
      } catch (error) {
        throw new Error(
          `OpenAI LLM generation failed: ${error instanceof Error ? error.message : String(error)}. ` +
          'Check your API key and network connectivity.'
        )
      }
    },

    async *generateStream(prompt: string, systemPrompt?: string): AsyncGenerator<string> {
      try {
        const messages = buildMessages(prompt, systemPrompt)
        const stream = await chat.stream(messages)
        for await (const chunk of stream) {
          const text = typeof chunk.content === 'string'
            ? chunk.content
            : JSON.stringify(chunk.content)
          if (text) {
            yield text
          }
        }
      } catch (error) {
        throw new Error(
          `OpenAI LLM streaming failed: ${error instanceof Error ? error.message : String(error)}. ` +
          'Check your API key and network connectivity.'
        )
      }
    },
  })
}
