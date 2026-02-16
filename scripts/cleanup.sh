#!/bin/bash
# rag-kit 완전 클린업 스크립트

echo "=== rag-kit 클린업 ==="

# 1. 사용자 설정 및 캐시 삭제
if [ -d "$HOME/.rag-kit" ]; then
  echo "[1/4] 사용자 설정 삭제: ~/.rag-kit/"
  rm -rf "$HOME/.rag-kit"
fi

# 2. 전역 CLI 심볼릭 링크 삭제
if [ -L "/usr/local/bin/rag-kit" ]; then
  echo "[2/4] CLI 심볼릭 링크 삭제: /usr/local/bin/rag-kit"
  rm -f /usr/local/bin/rag-kit
fi

# 3. Ollama 모델 삭제 (선택)
read -p "[3/4] Ollama 모델도 삭제할까요? (y/N): " del_models
if [ "$del_models" = "y" ]; then
  ollama rm nomic-embed-text 2>/dev/null
  ollama rm qwen2.5-coder:7b 2>/dev/null
  echo "Ollama 모델 삭제 완료"
fi

# 4. 프로젝트 디렉토리 삭제
SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
read -p "[4/4] rag-kit 프로젝트 전체 삭제? ($SCRIPT_DIR) (y/N): " del_project
if [ "$del_project" = "y" ]; then
  rm -rf "$SCRIPT_DIR"
  echo "프로젝트 삭제 완료"
fi

echo "=== 클린업 완료 ==="
