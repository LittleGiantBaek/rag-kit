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
# 1. 초기화 (코드베이스 경로 지정)
rag-kit init ~/my-project --profile code --name "MyProject" --description "프로젝트 설명"

# 2. 인덱싱
rag-kit index

# 3. 질문
rag-kit ask "User 엔티티의 컬럼 목록"

# 4. 대화형 모드
rag-kit chat
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
rag-kit init <path>           # 코드베이스 초기화
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

`~/.rag-kit/config.json`에 저장됩니다.

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

## 기술 스택

- **런타임**: Node.js 20+
- **패키지 매니저**: bun
- **벡터 DB**: LanceDB
- **임베딩**: Ollama (nomic-embed-text) / OpenAI
- **LLM**: Ollama / OpenAI / Anthropic
- **언어**: TypeScript (ES2022)

## 클린업

```bash
bash scripts/cleanup.sh
```
