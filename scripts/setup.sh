#!/bin/bash
set -euo pipefail

# rag-kit 통합 설치 스크립트
# Ollama 설치 → 모델 다운로드 → 의존성 설치 → 빌드 → init → 인덱싱

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "=== rag-kit 통합 설치 ==="
echo ""

# ─── 1. Ollama ───────────────────────────────────────────
echo "[1/6] Ollama 확인..."
if command -v ollama &>/dev/null; then
  echo "  ✔ Ollama 이미 설치됨 ($(ollama --version 2>/dev/null || echo 'version unknown'))"
else
  echo "  Ollama가 설치되어 있지 않습니다."
  if [[ "$(uname)" == "Darwin" ]]; then
    read -p "  brew install ollama 로 설치할까요? (Y/n): " install_ollama
    install_ollama=${install_ollama:-Y}
    if [[ "$install_ollama" =~ ^[Yy]$ ]]; then
      brew install ollama
    else
      echo "  Ollama 없이는 진행할 수 없습니다. https://ollama.com 에서 설치 후 다시 실행하세요."
      exit 1
    fi
  else
    echo "  https://ollama.com 에서 Ollama를 설치 후 다시 실행하세요."
    exit 1
  fi
fi

# Ollama 서버 확인 및 시작
if ! curl -sf http://localhost:11434/api/tags &>/dev/null; then
  echo "  Ollama 서버 시작 중..."
  if [[ "$(uname)" == "Darwin" ]]; then
    brew services start ollama 2>/dev/null || ollama serve &>/dev/null &
  else
    ollama serve &>/dev/null &
  fi
  sleep 3
  if ! curl -sf http://localhost:11434/api/tags &>/dev/null; then
    echo "  Ollama 서버를 시작할 수 없습니다. 수동으로 'ollama serve' 실행 후 다시 시도하세요."
    exit 1
  fi
fi
echo "  ✔ Ollama 서버 실행 중"

# ─── 2. 모델 다운로드 ────────────────────────────────────
echo ""
echo "[2/6] 임베딩 모델 다운로드 (nomic-embed-text, ~274MB)..."
if ollama list 2>/dev/null | grep -q "nomic-embed-text"; then
  echo "  ✔ 이미 다운로드됨"
else
  ollama pull nomic-embed-text
fi

echo ""
echo "[3/6] LLM 모델 다운로드 (qwen2.5-coder:7b, ~4.7GB)..."
if ollama list 2>/dev/null | grep -q "qwen2.5-coder:7b"; then
  echo "  ✔ 이미 다운로드됨"
else
  ollama pull qwen2.5-coder:7b
fi

# ─── 3. 의존성 설치 ──────────────────────────────────────
echo ""
echo "[4/6] 의존성 설치..."
if [ -d "node_modules" ]; then
  echo "  ✔ node_modules 존재, 스킵 (재설치: bun install)"
else
  bun install
fi

# ─── 4. 빌드 ─────────────────────────────────────────────
echo ""
echo "[5/6] TypeScript 빌드..."
bun run build

# ─── 5. init ──────────────────────────────────────────────
echo ""
echo "[6/6] 프로젝트 초기화..."
read -p "  인덱싱할 코드베이스 경로를 입력하세요: " target_path

if [ -z "$target_path" ]; then
  echo "  경로가 입력되지 않았습니다. 나중에 'rag-kit init <path>'로 설정할 수 있습니다."
else
  # ~ 확장
  target_path="${target_path/#\~/$HOME}"

  read -p "  프로필을 선택하세요 (code/document/hybrid) [code]: " profile
  profile=${profile:-code}

  read -p "  프로젝트 이름: " project_name

  node dist/cli/index.js init "$target_path" --profile "$profile" ${project_name:+--name "$project_name"}

  echo ""
  read -p "  바로 인덱싱을 시작할까요? (Y/n): " do_index
  do_index=${do_index:-Y}
  if [[ "$do_index" =~ ^[Yy]$ ]]; then
    node dist/cli/index.js index
  else
    echo "  나중에 'rag-kit index'로 인덱싱할 수 있습니다."
  fi
fi

echo ""
echo "=== 설치 완료 ==="
echo ""
echo "사용법:"
echo "  rag-kit ask \"질문\"              단발 질문"
echo "  rag-kit ask \"질문\" --cloud      클라우드 LLM으로 질문"
echo "  rag-kit chat                    대화형 모드"
echo "  rag-kit config show             설정 확인"
echo ""
