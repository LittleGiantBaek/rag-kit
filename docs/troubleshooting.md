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
# 데이터 디렉토리 삭제 후 재인덱싱
rm -rf ~/.rag-kit/data
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

## 설정 초기화

```bash
rm -rf ~/.rag-kit
```
