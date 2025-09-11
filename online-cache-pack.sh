#!/usr/bin/env bash
set -euo pipefail

# Generate a pnpm cache archive on an online machine
corepack enable >/dev/null 2>&1 || true
corepack prepare pnpm@9 --activate

PNPM_STORE_DIR=${PNPM_STORE_DIR:-.pnpm-store}
export PNPM_STORE_DIR

pnpm install
pnpm fetch

tar --zstd -cf pnpm-cache.tar.zst pnpm-lock.yaml "$PNPM_STORE_DIR"
echo "Created pnpm-cache.tar.zst with lockfile and store"

