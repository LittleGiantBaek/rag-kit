import type { Command } from 'commander'
import ora from 'ora'
import chalk from 'chalk'
import { loadConfig } from '../../config/config-manager.js'
import { createEmbeddingProvider } from '../../embedding/embedding-provider.js'
import { createIndexManager } from '../../vectorstore/index-manager.js'
import { createRetriever } from '../../retrieval/retriever.js'
import { createContextAssembler } from '../../generation/context-assembler.js'
import { createLlmProvider } from '../../generation/llm-provider.js'
import { buildSystemPrompt, buildRagPrompt } from '../../generation/prompt-templates.js'

export function registerAskCommand(program: Command): void {
  program
    .command('ask <question>')
    .description('단발 질문')
    .option('-n, --results <number>', '검색 결과 수', '6')
    .option('--no-stream', '스트리밍 비활성화')
    .option('--cloud', '클라우드 LLM 사용')
    .option('--local', '로컬 LLM 사용 (기본값)')
    .action(async (question: string, options: { results: string; stream: boolean; cloud?: boolean }) => {
      const spinner = ora()

      try {
        const config = await loadConfig()

        const llmConfig = options.cloud
          ? (() => {
              if (!config.cloud?.llm) {
                throw new Error('클라우드 LLM 프로바이더가 설정되지 않았습니다. "rag-kit config set cloud.llm.provider openai" 등으로 설정하세요.')
              }
              return config.cloud.llm
            })()
          : config.llm

        spinner.start('검색 중...')
        const embedder = createEmbeddingProvider(config.embedding)
        const indexMgr = await createIndexManager(config.dataDir)
        const retriever = createRetriever(embedder, indexMgr, config.index.services)

        const limit = parseInt(options.results, 10)
        const results = await retriever.retrieve(question, limit)
        spinner.succeed(`${results.length}개 관련 코드 발견`)

        if (results.length === 0) {
          console.info(chalk.yellow('관련 코드를 찾을 수 없습니다. 먼저 "rag-kit index"를 실행하세요.'))
          return
        }

        console.info(chalk.dim('\n참조 소스:'))
        for (const result of results) {
          const path = result.filePath ?? 'unknown'
          const score = (result.score * 100).toFixed(1)
          console.info(chalk.dim(`  - ${path} (${score}%)`))
        }
        console.info('')

        const assembler = createContextAssembler()
        const contexts = assembler.assemble(results)
        const ragPrompt = buildRagPrompt(question, contexts, config)
        const systemPrompt = buildSystemPrompt(config)

        const llm = createLlmProvider(llmConfig)

        if (options.cloud) {
          console.info(chalk.dim(`[${llm.name}]`))
        }

        if (options.stream) {
          const stream = llm.generateStream(ragPrompt, systemPrompt)
          for await (const chunk of stream) {
            process.stdout.write(chunk)
          }
          process.stdout.write('\n')
        } else {
          spinner.start('답변 생성 중...')
          const answer = await llm.generate(ragPrompt, systemPrompt)
          spinner.stop()
          console.info(answer)
        }
      } catch (error) {
        spinner.fail('질문 처리 실패')
        const message = error instanceof Error ? error.message : String(error)
        console.error(chalk.red(`오류: ${message}`))
        process.exit(1)
      }
    })
}
