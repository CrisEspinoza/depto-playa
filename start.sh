#!/usr/bin/env bash
# start.sh – Set up venv, install packages, then start API server + React dev server
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
VENV="$ROOT/.venv"

# ── 1. Create virtual environment if it doesn't exist ───────────────────────
if [ ! -d "$VENV" ]; then
  echo "Creating virtual environment at $VENV…"
  python3 -m venv "$VENV"
fi

# ── 2. Activate the virtual environment ─────────────────────────────────────
# shellcheck disable=SC1091
source "$VENV/bin/activate"

# ── 3. Install / upgrade required packages ──────────────────────────────────
echo "Installing Python dependencies…"
if [ "${SKIP_PIP_INSTALL:-0}" = "1" ]; then
  echo "SKIP_PIP_INSTALL=1, skipping pip install step."
else
  # If network/DNS is unavailable, continue startup with currently installed packages.
  if ! pip install --quiet --upgrade pip; then
    echo "Warning: Could not upgrade pip (network/DNS issue). Continuing with existing pip."
  fi

  if ! pip install --quiet -r "$ROOT/requirements.txt"; then
    echo "Warning: Could not install requirements (network/DNS issue)."
    echo "Continuing startup using currently installed packages in the virtual environment."
  fi
fi

echo "Starting Beach Accounting API server on port 5050…"
python3 "$ROOT/server.py" 5050 &
API_PID=$!

echo "Starting React dev server…"
cd "$ROOT/react-app"
npm start &
REACT_PID=$!

cleanup() {
  echo "\nShutting down…"
  kill $API_PID 2>/dev/null || true
  kill $REACT_PID 2>/dev/null || true
}
trap cleanup EXIT INT TERM

wait
