#!/usr/bin/env bash
set -Eeuo pipefail

# --- localizza il repo anche se doppio-click da Finder ---
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# --- Homebrew nel PATH (ARM/Intel) ---
[ -d "/opt/homebrew/bin" ] && export PATH="/opt/homebrew/bin:$PATH"
[ -d "/usr/local/bin" ] && export PATH="/usr/local/bin:$PATH"

# --- nvm (se presente) e Node 20 ---
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh" || true
[ -s "/opt/homebrew/opt/nvm/nvm.sh" ] && . "/opt/homebrew/opt/nvm/nvm.sh" || true
if command -v nvm >/dev/null 2>&1; then
  nvm install 20 >/dev/null
  nvm use 20 >/dev/null
fi
command -v node >/dev/null 2>&1 || { echo "❌ Node.js non trovato (consigliato Node 20)."; exit 1; }

echo "▶️ Installo dipendenze (solo al primo avvio)..."
for dir in backend frontend; do
  if [ -d "$dir" ]; then
    pushd "$dir" >/dev/null
      if [ -f package-lock.json ]; then npm ci || npm install; else npm install; fi
      [ -f .env ] || [ ! -f .env.example ] || cp .env.example .env
    popd >/dev/null
  fi
done

# --- apri il browser quando è pronto ---
open_when_ready() {
  local url="$1" ; local tries=30
  for i in $(seq 1 $tries); do
    curl -fsS "$url" >/dev/null 2>&1 && { open "$url"; return 0; }
    sleep 1
  done
  return 1
}
( open_when_ready "http://localhost:5173" || open_when_ready "http://localhost:3000" ) &

echo "🚀 Avvio backend e frontend..."
npx concurrently --kill-others --names "backend,frontend" \
  "cd backend && (npm run dev || npm start)" \
  "cd frontend && (npm run dev || npm start)"
