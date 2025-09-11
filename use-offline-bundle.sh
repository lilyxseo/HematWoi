#!/usr/bin/env bash
set -euo pipefail

BUNDLE="${1:-offline-bundle.tar}"

if [ ! -f "$BUNDLE" ]; then
  echo "Bundle $BUNDLE not found" >&2
  exit 1
fi

tar -xf "$BUNDLE"

export PATH="$(pwd)/tools/node/bin:$PATH"
export PNPM_HOME="$(pwd)/tools"
export PNPM_STORE_DIR="$(pwd)/.pnpm-store"

"$(pwd)/tools/pnpm" install --offline
"$(pwd)/tools/pnpm" lint
"$(pwd)/tools/pnpm" test
"$(pwd)/tools/pnpm" dev
