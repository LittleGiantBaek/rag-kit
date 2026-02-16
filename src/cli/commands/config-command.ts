import type { Command } from 'commander'
import chalk from 'chalk'
import { loadConfig, getConfigValue, setConfigValue } from '../../config/config-manager.js'
import { CONFIG_FILE_PATH } from '../../config/defaults.js'

export function registerConfigCommand(program: Command): void {
  const configCmd = program
    .command('config')
    .description('설정 확인/변경')

  configCmd
    .command('show')
    .description('현재 설정 표시')
    .action(async () => {
      try {
        const config = await loadConfig()
        console.info(chalk.cyan('현재 설정:\n'))
        console.info(JSON.stringify(config, null, 2))
        console.info(chalk.dim(`\n설정 파일: ${CONFIG_FILE_PATH}`))
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(chalk.red(`오류: ${message}`))
        process.exit(1)
      }
    })

  configCmd
    .command('get <path>')
    .description('특정 설정값 조회 (예: llm.model)')
    .action(async (path: string) => {
      try {
        const value = await getConfigValue(path)
        if (value === undefined) {
          console.info(chalk.yellow(`설정값 없음: ${path}`))
        } else {
          const display = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)
          console.info(display)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(chalk.red(`오류: ${message}`))
        process.exit(1)
      }
    })

  configCmd
    .command('set <path> <value>')
    .description('설정값 변경 (예: llm.model gpt-4o-mini)')
    .action(async (path: string, value: string) => {
      try {
        let parsed: unknown
        try {
          parsed = JSON.parse(value)
        } catch {
          parsed = value
        }

        await setConfigValue(path, parsed)
        console.info(chalk.green(`✓ ${path} = ${value}`))
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(chalk.red(`오류: ${message}`))
        process.exit(1)
      }
    })
}
