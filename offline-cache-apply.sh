#!/usr/bin/env bash
set -euo pipefail

# Apply a pnpm cache archive on an offline machine
ARCHIVE=${1:-pnpm-cache.tar.zst}
PNPM_STORE_DIR=${PNPM_STORE_DIR:-.pnpm-store}
export PNPM_STORE_DIR

tar -xf "$ARCHIVE"

corepack enable >/dev/null 2>&1 || true
corepack prepare pnpm@9 --activate || true

pnpm install --offline

