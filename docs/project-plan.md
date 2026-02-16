# rag-kit 프로젝트 플랜

## 1. 프로젝트 개요

**rag-kit**은 코드베이스와 문서를 대상으로 한 범용 RAG(Retrieval-Augmented Generation) 도구다.
로컬 LLM(Ollama)과 클라우드 LLM(OpenAI/Anthropic)을 모두 지원하며, 프로젝트별 독립 설정으로 복수 프로젝트를 동시에 관리할 수 있다.

### 핵심 가치

| 가치 | 설명 |
|------|------|
| **로컬 우선** | 기본값은 Ollama — 인터넷 없이 동작, API 키 불필요 |
| **프로젝트 격리** | `.rag-kit/` 디렉토리로 설정/데이터/캐시 완전 분리 |
| **인터페이스 독립** | 서비스 레이어를 통해 CLI·REST·MCP 모두 동일 로직 재사용 |
| **확장 가능** | 프로바이더 패턴으로 임베딩/LLM/벡터DB 교체 가능 |

---

## 2. 아키텍처

### 2.1 레이어 구조

```
┌─────────────────────────────────────────────────┐
│  Interface Layer (CLI / REST / MCP)             │
│  · CLI commands (commander)                     │
│  · [planned] REST API (Hono/Express)            │
│  · [planned] MCP Server                         │
├─────────────────────────────────────────────────┤
│  Service Layer                                  │
│  · QueryService   — RAG 파이프라인              │
│  · IndexService   — 인덱싱 오케스트레이션       │
│  · ChatService    — 대화 + 히스토리 관리        │
├─────────────────────────────────────────────────┤
│  Domain Modules                                 │
│  · config      — 프로젝트 경로, 스키마, 기본값  │
│  · embedding   — Ollama / OpenAI 임베딩         │
│  · ingestion   — 파일 스캔, 청킹, 파서          │
│  · retrieval   — 하이브리드 검색, 리랭킹        │
│  · generation  — LLM 프로바이더, 프롬프트       │
│  · vectorstore — LanceDB 추상화 (VectorStore)   │
├─────────────────────────────────────────────────┤
│  Infrastructure                                 │
│  · LanceDB, Ollama, OpenAI/Anthropic APIs       │
└─────────────────────────────────────────────────┘
```

### 2.2 데이터 흐름

```
[init]
  사용자 → init <path> → .rag-kit/ 생성 (config.json, data/, cache/)

[index]
  대상 경로 → FileScanner → Chunker → EmbeddingProvider → VectorStore (LanceDB)
             (코드/문서)    (분할)      (벡터화)            (저장)

[ask / chat]
  질문 → QueryAnalyzer → HybridSearcher → Reranker → ContextAssembler → LLM → 답변
         (의도 분석)       (벡터+키워드)    (재정렬)    (컨텍스트 조합)    (생성)
```

### 2.3 프로젝트 로컬 설정 모델

```
~/project-a/
├── .rag-kit/
│   ├── config.json      ← 프로젝트 설정
│   ├── data/            ← LanceDB 벡터 데이터
│   └── cache/           ← 임베딩 캐시 등
├── src/
└── ...

~/project-b/
├── .rag-kit/            ← 완전히 독립
│   ├── config.json
│   ├── data/
│   └── cache/
└── ...
```

CWD에서 상위로 올라가며 `.rag-kit/`을 탐색하는 git 방식.

---

## 3. 모듈 상세

### 3.1 config (`src/config/`)

| 파일 | 역할 |
|------|------|
| `project-paths.ts` | `.rag-kit/` 탐색, `ProjectPaths` 인터페이스 |
| `config-schema.ts` | Zod 스키마로 설정 유효성 검증 |
| `defaults.ts` | `DEFAULT_CONFIG` 기본값 정의 |
| `config-manager.ts` | `loadConfig`, `saveConfig`, `getConfigValue`, `setConfigValue` |

### 3.2 embedding (`src/embedding/`)

| 파일 | 역할 |
|------|------|
| `embedding-provider.ts` | 팩토리: `createEmbeddingProvider()` |
| `ollama-embedder.ts` | Ollama 임베딩 (nomic-embed-text) |
| `openai-embedder.ts` | OpenAI 임베딩 |
| `batch-embedder.ts` | 배치 처리 유틸리티 |

### 3.3 ingestion (`src/ingestion/`)

| 파일 | 역할 |
|------|------|
| `file-scanner.ts` | 글로브 기반 파일 목록 생성 |
| `chunker.ts` | 코드 파일 청킹 (파일 요약 + 사이즈 기반 분할) |
| `code-parser.ts` | 코드 구조 분석 |
| `document-scanner.ts` | 문서 파일 스캔 |
| `document-chunker.ts` | PDF/Excel/Markdown 청킹 |
| `document-converter.ts` | DocumentChunk → VectorRecord 변환 |
| `pdf-parser.ts` | PDF 파싱 (pdf-parse) |
| `excel-parser.ts` | Excel 파싱 (xlsx) |
| `markdown-parser.ts` | Markdown/텍스트 파싱 |
| `metadata-extractor.ts` | 파일 메타데이터 추출 |
| `nestjs-analyzer.ts` | NestJS 프레임워크 분석기 |

### 3.4 retrieval (`src/retrieval/`)

| 파일 | 역할 |
|------|------|
| `retriever.ts` | 최상위 검색 오케스트레이터 |
| `hybrid-searcher.ts` | 벡터 + 키워드 하이브리드 검색 |
| `semantic-search.ts` | 벡터 유사도 검색 |
| `keyword-search.ts` | 키워드 기반 검색 |
| `query-analyzer.ts` | 질의 의도 분석 (서비스/파일타입 필터) |
| `reranker.ts` | 검색 결과 재정렬 |
| `context-expander.ts` | 인접 청크 확장 |

### 3.5 generation (`src/generation/`)

| 파일 | 역할 |
|------|------|
| `llm-provider.ts` | 팩토리: `createLlmProvider()` |
| `ollama-llm.ts` | Ollama LLM |
| `openai-llm.ts` | OpenAI LLM |
| `anthropic-llm.ts` | Anthropic LLM |
| `prompt-templates.ts` | 시스템/RAG 프롬프트 빌더 |
| `context-assembler.ts` | 검색 결과 → 컨텍스트 조합 |

### 3.6 vectorstore (`src/vectorstore/`)

| 파일 | 역할 |
|------|------|
| `lance-store.ts` | LanceDB 래핑 (`VectorStore` 인터페이스) |
| `index-manager.ts` | 테이블 관리, 검색, 통계 |
| `schema.ts` | Apache Arrow 스키마 정의 |

### 3.7 services (`src/services/`)

| 파일 | 역할 |
|------|------|
| `query-service.ts` | RAG 파이프라인: retrieve → generate/stream |
| `index-service.ts` | 인덱싱 오케스트레이션 (콜백 기반 진행률) |
| `chat-service.ts` | 대화 히스토리 관리 + QueryService 위임 |
| `index.ts` | 배럴 export |

### 3.8 CLI (`src/cli/`)

| 파일 | 역할 |
|------|------|
| `index.ts` | 진입점, 커맨드 등록 |
| `commands/init-command.ts` | `init <path>` — 프로젝트 초기화 |
| `commands/index-command.ts` | `index` — 코드/문서 인덱싱 |
| `commands/ask-command.ts` | `ask <question>` — 단발 질문 |
| `commands/chat-command.ts` | `chat` — 대화형 모드 |
| `commands/config-command.ts` | `config show/get/set` — 설정 관리 |

---

## 4. 기술 스택

| 카테고리 | 기술 | 선택 이유 |
|----------|------|-----------|
| 런타임 | Node.js 20+ | LanceDB napi-rs 호환, 넓은 생태계 |
| 패키지 매니저 | bun | 빠른 설치/빌드, TypeScript 지원 |
| 언어 | TypeScript (ES2022, strict) | 타입 안전성, 인터페이스 기반 설계 |
| 벡터 DB | LanceDB | 임베디드, 서버 불필요, 파일 기반 |
| 임베딩 | Ollama (nomic-embed-text) / OpenAI | 로컬 우선, 클라우드 옵션 |
| LLM | Ollama / OpenAI / Anthropic | 3사 프로바이더 지원 |
| CLI 프레임워크 | Commander.js | 성숙한 CLI 파서 |
| 스키마 검증 | Zod | TypeScript 네이티브 검증 |
| 문서 파싱 | pdf-parse, xlsx | PDF/Excel 지원 |
| 데이터 스키마 | Apache Arrow | LanceDB 테이블 스키마 정의 |

---

## 5. 로드맵

### Phase 0 — 초기 구현 (완료)

- [x] CLI 도구 기본 구조 (init, index, ask, chat, config)
- [x] Ollama/OpenAI/Anthropic 프로바이더
- [x] LanceDB 벡터 저장소
- [x] 코드/문서 인덱싱 파이프라인
- [x] 하이브리드 검색 + 리랭킹
- [x] 프로필 시스템 (code, document, hybrid)

### Phase 1 — 프로젝트 로컬 설정 + 서비스 레이어 (완료)

- [x] 글로벌 설정 → 프로젝트별 `.rag-kit/` 로컬 설정
- [x] `ProjectPaths` 인터페이스 (git 방식 탐색)
- [x] `LanceStore` → `VectorStore` 리네이밍
- [x] 서비스 레이어 추출 (QueryService, IndexService, ChatService)
- [x] CLI 커맨드 간소화 (서비스 위임)

### Phase 2 — 테스트 + 품질 (예정)

- [ ] 단위 테스트 (config, chunker, retriever 등)
- [ ] 통합 테스트 (인덱싱 → 검색 파이프라인)
- [ ] E2E 테스트 (CLI 커맨드)
- [ ] 커버리지 80%+ 달성
- [ ] ESLint 설정 및 CI 연동

### Phase 3 — 고급 인덱싱 (예정)

- [ ] AST 기반 코드 청킹 (함수/클래스 단위)
- [ ] 증분 인덱싱 (변경된 파일만)
- [ ] 임베딩 캐시 (cacheDir 활용)
- [ ] 멀티 언어 코드 파서 확장

### Phase 4 — 서버 인터페이스 (예정)

- [ ] REST API 서버 (Hono 또는 Express)
- [ ] MCP(Model Context Protocol) 서버
- [ ] 서비스 레이어 재사용 검증
- [ ] 웹 UI (선택적)

### Phase 5 — 고급 검색 (예정)

- [ ] GraphRAG (코드 의존성 그래프)
- [ ] 멀티모달 (이미지/다이어그램)
- [ ] 대화 맥락 기반 검색 개선
- [ ] 커스텀 리랭킹 모델

---

## 6. 설정 스키마

```typescript
interface AppConfig {
  project: { name: string; description: string }
  profile: 'code' | 'document' | 'hybrid'
  llm: {
    provider: 'ollama' | 'openai' | 'anthropic'
    model: string
    baseUrl?: string
    apiKey?: string
    temperature?: number
    maxTokens?: number
  }
  embedding: {
    provider: 'ollama' | 'openai'
    model: string
    dimensions: number
    baseUrl?: string
    apiKey?: string
  }
  cloud?: { llm: LlmConfig }
  index: {
    targetPath: string
    services: ServiceConfig[]
    includePatterns: string[]
    excludePatterns: string[]
    chunkSize: number
    chunkOverlap: number
  }
  prompts: {
    systemContext: string
    answerGuidelines: string[]
  }
}
```

---

## 7. 디자인 원칙

1. **불변성**: 모든 인터페이스 프로퍼티는 `readonly`, 객체 변경 대신 새 객체 생성
2. **팩토리 패턴**: `createXxx()` 함수로 인스턴스 생성, 클래스 대신 인터페이스 + 팩토리
3. **프로바이더 추상화**: 임베딩/LLM/벡터DB를 인터페이스로 추상화, 구현체 교체 가능
4. **경로와 로직 분리**: `ProjectPaths`가 경로 제공, `AppConfig`는 비즈니스 설정만 보유
5. **인터페이스 독립 서비스**: CLI는 UI만, 비즈니스 로직은 서비스 레이어에 집중
6. **콜백 기반 진행률**: 서비스가 진행률을 콜백으로 알리고, UI 레이어가 표시 방법 결정

---

## 8. 파일 구조

```
rag-kit/
├── src/
│   ├── cli/
│   │   ├── index.ts
│   │   └── commands/
│   │       ├── ask-command.ts
│   │       ├── chat-command.ts
│   │       ├── config-command.ts
│   │       ├── index-command.ts
│   │       └── init-command.ts
│   ├── config/
│   │   ├── config-manager.ts
│   │   ├── config-schema.ts
│   │   ├── defaults.ts
│   │   └── project-paths.ts
│   ├── embedding/
│   │   ├── batch-embedder.ts
│   │   ├── embedding-provider.ts
│   │   ├── ollama-embedder.ts
│   │   └── openai-embedder.ts
│   ├── generation/
│   │   ├── anthropic-llm.ts
│   │   ├── context-assembler.ts
│   │   ├── llm-provider.ts
│   │   ├── ollama-llm.ts
│   │   ├── openai-llm.ts
│   │   └── prompt-templates.ts
│   ├── ingestion/
│   │   ├── chunker.ts
│   │   ├── code-parser.ts
│   │   ├── document-chunker.ts
│   │   ├── document-converter.ts
│   │   ├── document-scanner.ts
│   │   ├── excel-parser.ts
│   │   ├── file-scanner.ts
│   │   ├── markdown-parser.ts
│   │   ├── metadata-extractor.ts
│   │   ├── nestjs-analyzer.ts
│   │   └── pdf-parser.ts
│   ├── retrieval/
│   │   ├── context-expander.ts
│   │   ├── hybrid-searcher.ts
│   │   ├── keyword-search.ts
│   │   ├── query-analyzer.ts
│   │   ├── reranker.ts
│   │   ├── retriever.ts
│   │   └── semantic-search.ts
│   ├── services/
│   │   ├── chat-service.ts
│   │   ├── index-service.ts
│   │   ├── index.ts
│   │   └── query-service.ts
│   ├── types/
│   │   ├── chunk.ts
│   │   ├── config.ts
│   │   ├── metadata.ts
│   │   └── profile.ts
│   └── vectorstore/
│       ├── index-manager.ts
│       ├── lance-store.ts
│       └── schema.ts
├── docs/
│   ├── project-plan.md
│   ├── project-plan.yaml
│   └── troubleshooting.md
├── scripts/
│   ├── cleanup.sh
│   └── setup.sh
├── package.json
├── tsconfig.json
└── README.md
```
