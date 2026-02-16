# rag-kit

범용 코드베이스 & 문서 RAG CLI 도구.

TypeScript 기반, 로컬(Ollama) + 클라우드(OpenAI/Anthropic) LLM 지원, 한국어 UI.

## 설치

```bash
git clone https://github.com/LittleGiantBaek/rag-kit.git
cd rag-kit
bun install
bun run build
```

### 원클릭 설치 (Ollama + 모델 + 빌드 + 초기화)

```bash
bash scripts/setup.sh
```

## 빠른 시작

```bash
# 1. 초기화 (코드베이스 경로 지정 — 해당 프로젝트에 .rag-kit/ 생성)
rag-kit init ~/my-project --profile code --name "MyProject" --description "프로젝트 설명"

# 2. 프로젝트 디렉토리로 이동
cd ~/my-project

# 3. 인덱싱
rag-kit index

# 4. 질문
rag-kit ask "User 엔티티의 컬럼 목록"

# 5. 대화형 모드
rag-kit chat
```

## 복수 프로젝트

각 프로젝트에 독립적인 `.rag-kit/` 디렉토리가 생성되므로, 복수 프로젝트를 동시에 사용할 수 있습니다.

```bash
# 프로젝트 A 초기화
rag-kit init ~/project-a --name "ProjectA" --profile code

# 프로젝트 B 초기화
rag-kit init ~/project-b --name "ProjectB" --profile document

# 각 프로젝트에서 독립적으로 사용
cd ~/project-a && rag-kit index && rag-kit ask "API 엔드포인트 목록"
cd ~/project-b && rag-kit index && rag-kit ask "문서 요약"
```

## 프로필

`--profile` 옵션으로 기본 파일 패턴과 청크 크기를 선택합니다.

| 프로필 | 파일 패턴 | 청크 크기 |
|--------|-----------|-----------|
| `code` | `*.ts, *.tsx, *.js, *.py, *.go, *.java, *.rs` | 1500 |
| `document` | `*.pdf, *.md, *.txt, *.xlsx, *.csv` | 2000 |
| `hybrid` | code + document 합집합 | 1500 |

## 프로바이더 전환

```bash
# 기본: 로컬 Ollama
rag-kit ask "질문"

# 클라우드 LLM 사용 (사전 설정 필요)
rag-kit config set cloud.llm.provider openai
rag-kit config set cloud.llm.model gpt-4o-mini
rag-kit config set cloud.llm.apiKey sk-...

rag-kit ask "질문" --cloud
rag-kit chat --cloud
```

임베딩은 인덱싱과 동일한 모델 사용 (`--cloud`는 LLM만 전환).

## 주요 명령어

```bash
rag-kit init <path>           # 코드베이스 초기화 (.rag-kit/ 생성)
rag-kit index                 # 인덱싱
rag-kit index --docs <path>   # 문서 인덱싱
rag-kit index --clear         # 기존 인덱스 삭제 후 재인덱싱
rag-kit ask "질문"            # 단발 질문
rag-kit ask "질문" --cloud    # 클라우드 LLM
rag-kit chat                  # 대화형 모드
rag-kit config show           # 설정 표시
rag-kit config get llm.model  # 특정 설정값 조회
rag-kit config set llm.model qwen2.5-coder:7b  # 설정값 변경
```

## 설정

`<프로젝트>/.rag-kit/config.json`에 프로젝트별로 저장됩니다.

```json
{
  "project": { "name": "MyProject", "description": "설명" },
  "profile": "code",
  "llm": { "provider": "ollama", "model": "qwen2.5-coder:7b" },
  "embedding": { "provider": "ollama", "model": "nomic-embed-text", "dimensions": 768 },
  "cloud": { "llm": { "provider": "openai", "model": "gpt-4o-mini", "apiKey": "sk-..." } },
  "index": { "targetPath": "/path/to/project", "services": [] },
  "prompts": {
    "systemContext": "추가 시스템 컨텍스트",
    "answerGuidelines": ["한국어로 답변하세요."]
  }
}
```

## 아키텍처

```
CLI ─┐
REST ─┤→ services/ → 모듈들 (embedding, retrieval, generation, vectorstore)
MCP  ─┘
```

- **서비스 레이어** (`src/services/`): CLI/REST/MCP 공통 비즈니스 로직
- **VectorStore** (`src/vectorstore/`): LanceDB 추상화 레이어
- **프로젝트 로컬 설정**: 각 프로젝트의 `.rag-kit/` 디렉토리에 설정/데이터 격리

## 기술 스택

- **런타임**: Node.js 20+
- **패키지 매니저**: bun
- **벡터 DB**: LanceDB
- **임베딩**: Ollama (nomic-embed-text) / OpenAI
- **LLM**: Ollama / OpenAI / Anthropic
- **언어**: TypeScript (ES2022)

## 설정 초기화

```bash
# 프로젝트 내 설정 삭제
rm -rf .rag-kit/
```

## 클린업

```bash
bash scripts/cleanup.sh
```
