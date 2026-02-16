#!/usr/bin/env node

import { Command } from 'commander'
import { registerInitCommand } from './commands/init-command.js'
import { registerIndexCommand } from './commands/index-command.js'
import { registerChatCommand } from './commands/chat-command.js'
import { registerAskCommand } from './commands/ask-command.js'
import { registerConfigCommand } from './commands/config-command.js'

const program = new Command()

program
  .name('rag-kit')
  .description('범용 코드베이스 & 문서 RAG CLI 도구')
  .version('0.1.0')

registerInitCommand(program)
registerIndexCommand(program)
registerChatCommand(program)
registerAskCommand(program)
registerConfigCommand(program)

program.parse()
