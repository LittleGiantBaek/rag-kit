import { z } from 'zod'

export const llmProviderSchema = z.enum(['ollama', 'openai', 'anthropic'])
export const embeddingProviderSchema = z.enum(['ollama', 'openai'])
export const profileTypeSchema = z.enum(['code', 'document', 'hybrid'])

export const llmConfigSchema = z.object({
  provider: llmProviderSchema,
  model: z.string().min(1),
  baseUrl: z.string().url().optional(),
  apiKey: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
})

export const embeddingConfigSchema = z.object({
  provider: embeddingProviderSchema,
  model: z.string().min(1),
  dimensions: z.number().int().positive(),
  baseUrl: z.string().url().optional(),
  apiKey: z.string().optional(),
})

export const serviceConfigSchema = z.object({
  name: z.string().min(1),
  path: z.string().min(1),
  framework: z.string().min(1),
  role: z.string().min(1),
})

export const indexConfigSchema = z.object({
  targetPath: z.string(),
  services: z.array(serviceConfigSchema),
  includePatterns: z.array(z.string()),
  excludePatterns: z.array(z.string()),
  chunkSize: z.number().int().positive(),
  chunkOverlap: z.number().int().min(0),
})

export const projectConfigSchema = z.object({
  name: z.string(),
  description: z.string(),
})

export const promptsConfigSchema = z.object({
  systemContext: z.string(),
  answerGuidelines: z.array(z.string()),
})

export const cloudProviderConfigSchema = z.object({
  llm: llmConfigSchema,
})

export const appConfigSchema = z.object({
  project: projectConfigSchema,
  profile: profileTypeSchema,
  llm: llmConfigSchema,
  embedding: embeddingConfigSchema,
  cloud: cloudProviderConfigSchema.optional(),
  index: indexConfigSchema,
  prompts: promptsConfigSchema,
  dataDir: z.string().min(1),
  cacheDir: z.string().min(1),
})

export type ValidatedAppConfig = z.infer<typeof appConfigSchema>
