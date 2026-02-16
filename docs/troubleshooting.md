# 문제 해결 가이드

## Ollama 관련

### Ollama 서버 연결 실패

```
Ollama가 실행 중인지 확인하세요 (ollama serve).
```

**해결:**
```bash
# Ollama 서버 실행
ollama serve

# macOS: brew services로 실행
brew services start ollama

# 서버 상태 확인
curl http://localhost:11434/api/tags
```

### 모델 다운로드

```bash
# 임베딩 모델
ollama pull nomic-embed-text

# LLM 모델
ollama pull qwen2.5-coder:7b
```

## 임베딩 불일치

인덱싱과 검색 시 반드시 동일한 임베딩 모델을 사용해야 합니다.

임베딩 모델을 변경한 경우:
```bash
rag-kit index --clear  # 기존 인덱스 삭제 후 재인덱싱
```

## LanceDB 관련

### 테이블 손상

```bash
# 프로젝트 내 데이터 디렉토리 삭제 후 재인덱싱
rm -rf .rag-kit/data
rag-kit index
```

### napi-rs 바이너리 오류

LanceDB는 Node.js 네이티브 바이너리를 사용합니다. bun 런타임이 아닌 node 런타임으로 실행하세요.

```bash
# 올바른 실행 (node)
node dist/cli/index.js ask "질문"

# 개발용 (tsx - node 기반)
bun run dev -- ask "질문"
```

## OpenAI / Anthropic API

### API 키 오류

```bash
# OpenAI
rag-kit config set llm.apiKey sk-...
# 또는
rag-kit config set cloud.llm.apiKey sk-...

# Anthropic
rag-kit config set cloud.llm.provider anthropic
rag-kit config set cloud.llm.apiKey sk-ant-...
```

### Rate Limiting

대량 인덱싱 시 OpenAI 임베딩 API가 rate limit에 걸릴 수 있습니다.
로컬 Ollama 임베딩을 사용하면 제한 없이 인덱싱 가능합니다.

## 인덱싱 관련

### 파일이 발견되지 않음

```bash
# 현재 include 패턴 확인
rag-kit config get index.includePatterns

# 패턴 변경 (예: Python만)
rag-kit config set index.includePatterns '["**/*.py"]'
```

### 대용량 코드베이스

50KB 이상 파일은 자동으로 건너뜁니다. 인덱싱 시 서비스별로 나누어 실행하면 효율적입니다.

```bash
rag-kit index --service api
rag-kit index --service front
```

## 프로젝트 탐색

### "프로젝트를 찾을 수 없습니다" 에러

rag-kit은 현재 디렉토리에서 상위로 올라가며 `.rag-kit/` 디렉토리를 찾습니다. 프로젝트가 초기화되지 않았거나, 프로젝트 디렉토리 밖에서 실행한 경우 이 에러가 발생합니다.

```bash
# 프로젝트 초기화
rag-kit init ~/my-project --profile code --name "MyProject"

# 프로젝트 디렉토리 내에서 실행
cd ~/my-project
rag-kit config show
```

## 설정 초기화

```bash
# 프로젝트 내 설정 초기화
rm -rf .rag-kit/
rag-kit init . --profile code --name "MyProject"
```

## 레거시 글로벌 설정 마이그레이션

이전 버전에서 `~/.rag-kit/`에 글로벌 설정을 사용했다면, 프로젝트별 설정으로 마이그레이션하세요:

```bash
# 1. 기존 프로젝트를 다시 초기화
rag-kit init ~/my-project --profile code --name "MyProject"

# 2. 기존 설정값 복사 (필요한 경우)
rag-kit config set llm.model <기존 모델>
rag-kit config set cloud.llm.apiKey <기존 API 키>

# 3. 인덱스 재생성
rag-kit index

# 4. 글로벌 설정 삭제
rm -rf ~/.rag-kit
```
