#!/usr/bin/env bash
set -euo pipefail

# Point npm and pnpm to a Verdaccio registry
REGISTRY_URL=${1:-http://localhost:4873/}

echo "registry=$REGISTRY_URL" > .npmrc
pnpm config set registry "$REGISTRY_URL"

pnpm install

