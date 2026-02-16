import type { ProfileType } from './config.js'

export interface ProfileDefaults {
  readonly includePatterns: readonly string[]
  readonly chunkSize: number
  readonly excludePatterns: readonly string[]
}

export const PROFILE_PRESETS: Readonly<Record<ProfileType, ProfileDefaults>> = {
  code: {
    includePatterns: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.js',
      '**/*.jsx',
      '**/*.py',
      '**/*.go',
      '**/*.java',
      '**/*.rs',
    ],
    chunkSize: 1500,
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
      '**/__pycache__/**',
      '**/target/**',
      '**/vendor/**',
    ],
  },
  document: {
    includePatterns: [
      '**/*.pdf',
      '**/*.md',
      '**/*.txt',
      '**/*.xlsx',
      '**/*.xls',
      '**/*.csv',
    ],
    chunkSize: 2000,
    excludePatterns: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.git/**',
      '**/build/**',
    ],
  },
  hybrid: {
    includePatterns: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.js',
      '**/*.jsx',
      '**/*.py',
      '**/*.go',
      '**/*.java',
      '**/*.rs',
      '**/*.pdf',
      '**/*.md',
      '**/*.txt',
      '**/*.xlsx',
      '**/*.xls',
      '**/*.csv',
    ],
    chunkSize: 1500,
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
      '**/__pycache__/**',
      '**/target/**',
      '**/vendor/**',
      '**/.git/**',
    ],
  },
}
