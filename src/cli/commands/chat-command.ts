import type { Command } from 'commander'
import { createInterface } from 'node:readline'
import chalk from 'chalk'
import { loadConfig } from '../../config/config-manager.js'
import { createEmbeddingProvider } from '../../embedding/embedding-provider.js'
import { createIndexManager } from '../../vectorstore/index-manager.js'
import { createRetriever } from '../../retrieval/retriever.js'
import { createContextAssembler } from '../../generation/context-assembler.js'
import { createLlmProvider } from '../../generation/llm-provider.js'
import { buildSystemPrompt, buildRagPrompt } from '../../generation/prompt-templates.js'

interface ChatMessage {
  readonly role: 'user' | 'assistant'
  readonly content: string
}

export function registerChatCommand(program: Command): void {
  program
    .command('chat')
    .description('대화형 질의')
    .option('-n, --results <number>', '검색 결과 수', '6')
    .option('--cloud', '클라우드 LLM 사용')
    .option('--local', '로컬 LLM 사용 (기본값)')
    .action(async (options: { results: string; cloud?: boolean }) => {
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

        const embedder = createEmbeddingProvider(config.embedding)
        const indexMgr = await createIndexManager(config.dataDir)
        const retriever = createRetriever(embedder, indexMgr, config.index.services)
        const assembler = createContextAssembler()
        const llm = createLlmProvider(llmConfig)
        const systemPrompt = buildSystemPrompt(config)
        const limit = parseInt(options.results, 10)

        const history: ChatMessage[] = []

        const chatTitle = config.project.name
          ? `${config.project.name} RAG 채팅`
          : 'RAG 채팅'

        console.info(chalk.cyan(`${chatTitle}`))
        if (options.cloud) {
          console.info(chalk.dim(`[${llm.name}]`))
        }
        console.info(chalk.dim('질문을 입력하세요. 종료하려면 "exit" 또는 Ctrl+C'))
        console.info('')

        const rl = createInterface({
          input: process.stdin,
          output: process.stdout,
        })

        const askQuestion = (): void => {
          rl.question(chalk.green('> '), async (input) => {
            const question = input.trim()

            if (!question || question === 'exit' || question === 'quit') {
              console.info(chalk.dim('\n세션 종료'))
              rl.close()
              return
            }

            if (question === 'clear') {
              history.length = 0
              console.info(chalk.dim('대화 기록 초기화됨\n'))
              askQuestion()
              return
            }

            try {
              const results = await retriever.retrieve(question, limit)

              if (results.length > 0) {
                console.info(chalk.dim(`\n${results.length}개 소스 참조`))
              }

              const contexts = assembler.assemble(results)

              const recentHistory = history.slice(-4)
              const historyContext = recentHistory
                .map(m => `${m.role === 'user' ? '질문' : '답변'}: ${m.content}`)
                .join('\n')

              const ragPrompt = historyContext
                ? `이전 대화:\n${historyContext}\n\n${buildRagPrompt(question, contexts, config)}`
                : buildRagPrompt(question, contexts, config)

              console.info('')
              const stream = llm.generateStream(ragPrompt, systemPrompt)
              let fullResponse = ''
              for await (const chunk of stream) {
                process.stdout.write(chunk)
                fullResponse += chunk
              }
              console.info('\n')

              history.push({ role: 'user', content: question })
              history.push({ role: 'assistant', content: fullResponse })
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error)
              console.error(chalk.red(`오류: ${message}\n`))
            }

            askQuestion()
          })
        }

        askQuestion()
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(chalk.red(`초기화 실패: ${message}`))
        process.exit(1)
      }
    })
}
