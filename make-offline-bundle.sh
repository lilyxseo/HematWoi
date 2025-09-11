#!/usr/bin/env bash
set -euo pipefail

NODE_VERSION="${NODE_VERSION:-22.0.0}"
PNPM_VERSION="${PNPM_VERSION:-9.0.0}"
TOOLS_DIR="tools"
STORE_DIR=".pnpm-store"

mkdir -p "$TOOLS_DIR" "$STORE_DIR"

if [ ! -d "$TOOLS_DIR/node" ]; then
  echo "Downloading Node.js v$NODE_VERSION..." >&2
  curl -fsSL "https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-linux-x64.tar.xz" \
    | tar -xJf - -C "$TOOLS_DIR"
  mv "$TOOLS_DIR/node-v$NODE_VERSION-linux-x64" "$TOOLS_DIR/node"
fi

if [ ! -f "$TOOLS_DIR/pnpm" ]; then
  echo "Downloading pnpm v$PNPM_VERSION..." >&2
  curl -fsSL "https://github.com/pnpm/pnpm/releases/download/v$PNPM_VERSION/pnpm-linux-x64" -o "$TOOLS_DIR/pnpm"
  chmod +x "$TOOLS_DIR/pnpm"
fi

export PATH="$(pwd)/$TOOLS_DIR/node/bin:$PATH"
export PNPM_HOME="$(pwd)/$TOOLS_DIR"
export PNPM_STORE_DIR="$(pwd)/$STORE_DIR"

"$TOOLS_DIR/pnpm" install

TARBALL="offline-bundle.tar"

tar -cf "$TARBALL" $TOOLS_DIR "$STORE_DIR" pnpm-lock.yaml \
  .eslintrc.cjs vitest.config.ts tailwind.config.ts postcss.config.js package.json .npmrc .yarnrc.yml

echo "Created $TARBALL"
