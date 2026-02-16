import type { Command } from 'commander'
import ora from 'ora'
import chalk from 'chalk'
import { loadConfig } from '../../config/config-manager.js'
import { getProjectPaths } from '../../config/project-paths.js'
import { createIndexService } from '../../services/index-service.js'

export function registerIndexCommand(program: Command): void {
  program
    .command('index')
    .description('코드베이스 인덱싱')
    .option('-s, --service <name>', '특정 서비스만 인덱싱')
    .option('--docs <path>', '외부 문서 인덱싱')
    .option('--clear', '기존 인덱스 삭제 후 재인덱싱')
    .action(async (options: { service?: string; docs?: string; clear?: boolean }) => {
      const spinner = ora()

      try {
        const paths = getProjectPaths()
        const config = await loadConfig(paths)
        const indexService = await createIndexService(config, paths)

        if (options.clear) {
          spinner.start('기존 인덱스 삭제 중...')
          await indexService.clearIndex()
          spinner.succeed('기존 인덱스 삭제 완료')
        }

        if (options.docs) {
          spinner.start('문서 스캔 중...')
          const result = await indexService.indexDocuments(options.docs, {
            onScanComplete: (count) => {
              spinner.succeed(`${count}개 문서 발견`)
              if (count === 0) {
                console.info(chalk.yellow('인덱싱할 문서가 없습니다.'))
              }
            },
            onBatchProgress: (processed, total) => {
              spinner.start(`문서 처리 중... ${processed}/${total}`)
            },
            onDocumentError: (fileName, error) => {
              spinner.warn(`${fileName} 파싱 실패: ${error}`)
            },
            onComplete: (stats) => {
              spinner.succeed('문서 인덱싱 완료')
              console.info(chalk.green(
                `\n✓ 문서 인덱싱 완료: ${result.processedCount}개 문서, ${stats.documents}개 청크`,
              ))
            },
          })
          return
        }

        spinner.start('파일 스캔 중...')
        const result = await indexService.indexCode(options.service, {
          onScanComplete: (count) => {
            spinner.succeed(`${count}개 파일 발견`)
          },
          onBatchProgress: (processed, total) => {
            spinner.start(`처리 중... ${processed}/${total} 파일`)
          },
          onComplete: (stats) => {
            spinner.succeed('인덱싱 완료')
            console.info(chalk.green(`\n✓ 인덱싱 완료: ${result.processedCount}개 파일, ${stats.codeChunks}개 청크`))
          },
        })
      } catch (error) {
        spinner.fail('인덱싱 실패')
        const message = error instanceof Error ? error.message : String(error)
        console.error(chalk.red(`오류: ${message}`))
        process.exit(1)
      }
    })
}
