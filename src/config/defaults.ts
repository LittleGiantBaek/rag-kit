import type { AppConfig } from '../types/config.js'
import { homedir } from 'node:os'
import { join } from 'node:path'

const home = homedir()

export const DEFAULT_CONFIG: AppConfig = {
  project: {
    name: '',
    description: '',
  },
  profile: 'code',
  llm: {
    provider: 'ollama',
    model: 'qwen2.5-coder:7b',
    baseUrl: 'http://localhost:11434',
    temperature: 0.1,
    maxTokens: 4096,
  },
  embedding: {
    provider: 'ollama',
    model: 'nomic-embed-text',
    dimensions: 768,
    baseUrl: 'http://localhost:11434',
  },
  index: {
    targetPath: '',
    services: [],
    includePatterns: [
      '**/*.ts',
      '**/*.tsx',
    ],
    excludePatterns: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/coverage/**',
      '**/*.spec.ts',
      '**/*.test.ts',
      '**/*.d.ts',
      '**/*.stories.ts',
      '**/*.stories.tsx',
      '**/migrations/**',
      '**/__mocks__/**',
      '**/__tests__/**',
    ],
    chunkSize: 1500,
    chunkOverlap: 200,
  },
  prompts: {
    systemContext: '',
    answerGuidelines: [
      '질문이 한국어이면 한국어로 답변하세요.',
      '코드 참조 시 파일 경로와 코드 스니펫을 포함하세요.',
      '간결하고 정확하게 답변하세요.',
      '제공된 컨텍스트가 부족하면 부족한 정보를 명시하세요.',
    ],
  },
  dataDir: join(home, '.rag-kit', 'data'),
  cacheDir: join(home, '.rag-kit', 'cache'),
}

export const CONFIG_FILE_PATH = join(home, '.rag-kit', 'config.json')
