import type { AppConfig, ServiceConfig } from '../types/config.js'

export interface SearchContext {
  readonly content: string
  readonly filePath: string
  readonly serviceName: string
  readonly fileType: string
  readonly score: number
  readonly chunkType?: 'code' | 'document'
  readonly startLine?: number
}

function buildServiceList(services: readonly ServiceConfig[]): string {
  if (services.length === 0) return ''

  const list = services
    .map(s => `- ${s.name}: ${s.framework} (${s.role})`)
    .join('\n')

  return `\n\n프로젝트 서비스 구성:\n${list}`
}

function buildGuidelines(guidelines: readonly string[]): string {
  if (guidelines.length === 0) return ''

  return '\n\nGuidelines:\n' + guidelines.map(g => `- ${g}`).join('\n')
}

export function buildSystemPrompt(config: AppConfig): string {
  const projectIntro = config.project.name
    ? `You are an expert assistant for ${config.project.name}.`
    : 'You are an expert code and document assistant.'

  const description = config.project.description
    ? `\n${config.project.description}`
    : ''

  const systemContext = config.prompts.systemContext
    ? `\n${config.prompts.systemContext}`
    : ''

  const serviceList = buildServiceList(config.index.services)
  const guidelines = buildGuidelines(config.prompts.answerGuidelines)

  return [
    projectIntro,
    description,
    systemContext,
    serviceList,
    guidelines,
  ].join('')
}

function formatContextHeader(ctx: SearchContext, index: number): string {
  const scorePercent = (ctx.score * 100).toFixed(1)

  if (ctx.chunkType === 'document') {
    const pageInfo = ctx.startLine && ctx.startLine > 0
      ? `, page ${ctx.startLine}`
      : ''
    return `[${index}] ${ctx.filePath} (${ctx.fileType}${pageInfo}, ${scorePercent}%)`
  }

  const path = ctx.serviceName
    ? `${ctx.serviceName}/${ctx.filePath}`
    : ctx.filePath
  return `[${index}] ${path} (${ctx.fileType}, ${scorePercent}%)`
}

export function buildRagPrompt(
  query: string,
  contexts: readonly SearchContext[],
  config: AppConfig,
): string {
  const contextSections = contexts.map((ctx, index) => {
    const header = formatContextHeader(ctx, index + 1)
    return `${header}\n${ctx.content}`
  })

  const projectLabel = config.project.name || 'knowledge base'

  return [
    '## Context',
    '',
    `The following code snippets and documents are retrieved from the ${projectLabel}:`,
    '',
    ...contextSections.flatMap(section => [section, '']),
    '## Question',
    '',
    query,
    '',
    '## Instructions',
    '',
    'Answer the question based on the provided context above.',
    'Cite the relevant file paths (e.g., [1] src/user/user.service.ts) when referencing code.',
    'If the context does not contain enough information, clearly state the limitation.',
  ].join('\n')
}
