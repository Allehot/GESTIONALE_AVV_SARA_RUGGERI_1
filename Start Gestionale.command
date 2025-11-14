#!/usr/bin/env bash
set -Eeuo pipefail

# --- localizza il repo anche se doppio-click da Finder ---
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# --- Homebrew/Volta nel PATH (ARM/Intel) ---
[ -d "/opt/homebrew/bin" ] && export PATH="/opt/homebrew/bin:$PATH"
[ -d "/usr/local/bin" ] && export PATH="/usr/local/bin:$PATH"
[ -d "$HOME/.volta/bin" ] && export PATH="$HOME/.volta/bin:$PATH"

# --- nvm (se presente) e Node 20 ---
NODE_VERSION="20"
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh" || true
[ -s "/opt/homebrew/opt/nvm/nvm.sh" ] && . "/opt/homebrew/opt/nvm/nvm.sh" || true
if command -v nvm >/dev/null 2>&1; then
  nvm install "$NODE_VERSION" >/dev/null
  nvm use "$NODE_VERSION" >/dev/null
fi

command -v node >/dev/null 2>&1 || { echo "❌ Node.js non trovato (consigliato Node ${NODE_VERSION})."; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "❌ npm non trovato."; exit 1; }

# --- apri il browser quando è pronto ---
open_when_ready() {
  local url="$1" ; local tries=30
  for i in $(seq 1 $tries); do
    curl -fsS "$url" >/dev/null 2>&1 && { open "$url"; return 0; }
    sleep 1
  done
  return 1
}
if command -v open >/dev/null 2>&1; then
  ( open_when_ready "http://localhost:5173" || open_when_ready "http://localhost:3000" ) &
else
  echo "ℹ️ Impossibile aprire automaticamente il browser (comando 'open' non trovato)."
fi

# --- avvia l'ambiente di sviluppo ---
echo "🚀 Avvio backend e frontend..."
EXECUTABLE_DIR="$SCRIPT_DIR/dist"
ARCH="$(uname -m)"
EXECUTABLE_NAME=""
case "$ARCH" in
  arm64|aarch64) EXECUTABLE_NAME="gestionale-dev-macos-arm64" ;;
  x86_64) EXECUTABLE_NAME="gestionale-dev-macos-x64" ;;
  *) EXECUTABLE_NAME="" ;;
esac

if [ -n "$EXECUTABLE_NAME" ] && [ -x "$EXECUTABLE_DIR/$EXECUTABLE_NAME" ]; then
  echo "▶️ Avvio dell'eseguibile compilato ($EXECUTABLE_NAME)..."
  "$EXECUTABLE_DIR/$EXECUTABLE_NAME"
else
  echo "▶️ Eseguibile non trovato: fallback a npm run dev"
  npm run dev
fi
