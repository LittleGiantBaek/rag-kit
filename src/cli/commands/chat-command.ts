import type { Command } from 'commander'
import { createInterface } from 'node:readline'
import chalk from 'chalk'
import { loadConfig } from '../../config/config-manager.js'
import { getProjectPaths } from '../../config/project-paths.js'
import { createChatService } from '../../services/chat-service.js'

export function registerChatCommand(program: Command): void {
  program
    .command('chat')
    .description('대화형 질의')
    .option('-n, --results <number>', '검색 결과 수', '6')
    .option('--cloud', '클라우드 LLM 사용')
    .option('--local', '로컬 LLM 사용 (기본값)')
    .action(async (options: { results: string; cloud?: boolean }) => {
      try {
        const paths = getProjectPaths()
        const config = await loadConfig(paths)
        const chatService = await createChatService(config, paths, { useCloud: options.cloud ?? false })
        const limit = parseInt(options.results, 10)

        const chatTitle = config.project.name
          ? `${config.project.name} RAG 채팅`
          : 'RAG 채팅'

        console.info(chalk.cyan(`${chatTitle}`))
        if (options.cloud) {
          console.info(chalk.dim(`[${chatService.llmName}]`))
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
              chatService.clearHistory()
              console.info(chalk.dim('대화 기록 초기화됨\n'))
              askQuestion()
              return
            }

            try {
              const { resultCount, stream } = await chatService.ask(question, limit)

              if (resultCount > 0) {
                console.info(chalk.dim(`\n${resultCount}개 소스 참조`))
              }

              console.info('')
              for await (const chunk of stream) {
                process.stdout.write(chunk)
              }
              console.info('\n')
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
