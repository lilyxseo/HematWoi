#!/usr/bin/env bash
set -euo pipefail

REQUIRED_NODE_MAJOR=22
INSTALLED_NODE_MAJOR=$(node -v | sed -E 's/^v([0-9]+).*/\1/')
if (( INSTALLED_NODE_MAJOR < REQUIRED_NODE_MAJOR )); then
  echo "Node.js >=22 is required. Current: $(node -v)"
  exit 1
fi

corepack enable >/dev/null 2>&1 || true

if ! corepack prepare pnpm@9 --activate; then
  echo "corepack prepare failed, attempting manual pnpm download"
  mkdir -p tools
  PNPM_BIN="tools/pnpm"
  if [ ! -x "$PNPM_BIN" ]; then
    curl -fL https://registry.npmmirror.com/-/binary/pnpm/latest/pnpm-linux-x64 -o "$PNPM_BIN" || {
      echo "Could not download pnpm. See README for offline setup.";
      exit 1
    }
    chmod +x "$PNPM_BIN"
  fi
  export PATH="$PWD/tools:$PATH"
fi

echo "Checking registry accessibility"
PRIMARY_REG="https://registry.npmjs.org/"
MIRROR_REG="https://registry.npmmirror.com/"
if npm --registry "$PRIMARY_REG" view react >/dev/null 2>&1; then
  npm config set registry "$PRIMARY_REG" --location=project
else
  echo "Primary registry unreachable, switching to mirror"
  npm config set registry "$MIRROR_REG" --location=project
fi

if [ -f pnpm-lock.yaml ]; then
  if ! pnpm install; then
    echo "pnpm install failed, trying fetch + prefer-offline"
    pnpm fetch && pnpm install --prefer-offline || {
      echo "Install failed. Use cache transfer or local mirror."
      exit 1
    }
  fi
else
  echo "No pnpm-lock.yaml found, installing dependencies"
  pnpm add react react-dom react-router-dom @tanstack/react-query zod react-hook-form jotai zustand recharts dayjs clsx
  pnpm add -D tailwindcss postcss autoprefixer eslint @eslint/js @typescript-eslint/eslint-plugin @typescript-eslint/parser eslint-plugin-react eslint-plugin-react-hooks eslint-config-prettier prettier vitest @testing-library/react @testing-library/jest-dom jsdom @vitest/ui happy-dom husky lint-staged typescript @types/react @types/react-dom @types/node vite @vitejs/plugin-react
fi

pnpm -v
pnpm lint
pnpm test

