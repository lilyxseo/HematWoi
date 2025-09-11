# CashNote

Scaffold for the CashNote web app built with React, Vite, TypeScript, and Tailwind CSS.

## Strategy A – Air‑gapped kit (Node v22 + Yarn 4)
Prepare everything on a machine with internet, then run fully offline.

### 1. Online machine (build kit once)
```bash
mkdir -p airgap-kit/{tools,.yarn/{cache,plugins,releases}}
cd airgap-kit

# Node v22 portable
#   download the tar/zip from nodejs.org and extract to ./tools/node
#   final binary: ./tools/node/bin/node

# Yarn 4 standalone + plugins (download all files manually)
#   yarn-4.x.cjs            -> ./.yarn/releases/
#   @yarnpkg/plugin-essentials.cjs -> ./.yarn/plugins/@yarnpkg/
cat > .yarnrc.yml <<'YML'
yarnPath: .yarn/releases/yarn-4.x.cjs
nodeLinker: pnp
enableGlobalCache: true
enableTelemetry: false
checksumBehavior: ignore
plugins:
  - path: .yarn/plugins/@yarnpkg/plugin-essentials.cjs
    spec: "@yarnpkg/plugin-essentials"
YML

# project files
mkdir app && cd app
npm init -y >/dev/null 2>&1 || true
export PATH="$(cd ..; pwd)/tools/node/bin:$PATH"
node ../.yarn/releases/yarn-4.x.cjs add react react-dom react-router-dom \
  @tanstack/react-query zod react-hook-form zustand jotai dayjs clsx recharts
node ../.yarn/releases/yarn-4.x.cjs add -D typescript vite @types/react @types/react-dom \
  tailwindcss postcss autoprefixer eslint @eslint/js typescript-eslint \
  eslint-plugin-react eslint-plugin-react-hooks eslint-config-prettier prettier \
  vitest @testing-library/react @testing-library/jest-dom jsdom @vitest/ui happy-dom

# minimal configs
cat > .eslintrc.cjs <<'CJS'
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint','react','react-hooks'],
  extends: ['eslint:recommended','plugin:react/recommended',
    'plugin:react-hooks/recommended','plugin:@typescript-eslint/recommended',
    'plugin:react/jsx-runtime','prettier'],
};
CJS

cat > vitest.config.ts <<'TS'
import { defineConfig } from 'vitest/config'
export default defineConfig({ test: { environment: 'jsdom' } })
TS

cat > tailwind.config.ts <<'TS'
import type { Config } from 'tailwindcss'
export default {
  content: ['./index.html','./src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
} satisfies Config
TS

cat > postcss.config.js <<'JS'
export default { plugins: { tailwindcss: {}, autoprefixer: {} } }
JS

# project scripts
node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json','utf8'));p.scripts={dev:'vite',build:'vite build',preview:'vite preview',lint:'eslint . --ext ts,tsx',test:'vitest run'};fs.writeFileSync('package.json',JSON.stringify(p,null,2))"
cd ..

cd ..
# pack everything
 tar -czf airgap-kit.tar.gz airgap-kit
```

### 2. Offline machine (no internet)
```bash
tar -xzf airgap-kit.tar.gz
cd airgap-kit/app
export PATH="$(cd ..; pwd)/tools/node/bin:$PATH"
node ../.yarn/releases/yarn-4.x.cjs --version
node ../.yarn/releases/yarn-4.x.cjs install --immutable --inline-builds
node ../.yarn/releases/yarn-4.x.cjs lint
node ../.yarn/releases/yarn-4.x.cjs test
node ../.yarn/releases/yarn-4.x.cjs dev
```
If Yarn tries to download anything, ensure every path in `.yarnrc.yml` points to local files and that `.yarn/cache` is populated.

## Strategy B – Docker “devkit” image
```bash
cat > Dockerfile <<'DOCKER'
FROM node:22-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml* yarn.lock* package-lock.json* ./
RUN corepack enable && corepack prepare pnpm@9 --activate || true
RUN npm i -g pnpm@9 || true
RUN pnpm install || true
COPY . .
EXPOSE 5173
CMD ["pnpm","dev","--host","0.0.0.0"]
DOCKER

docker build -t cashnote-devkit:latest .
docker save cashnote-devkit:latest -o cashnote-devkit.tar
```
Offline machine:
```bash
docker load -i cashnote-devkit.tar
docker run --rm -it -p 5173:5173 -v "$PWD":/work -w /work cashnote-devkit:latest
```

## Strategy C – `node_modules` zip
```bash
# online
pnpm install
zip -r node_modules.zip node_modules

# offline
unzip node_modules.zip
pnpm run lint
pnpm run test
pnpm run dev
```

## Troubleshooting
- 403 errors usually mean a blocked registry or missing credentials.
- Check active registry: `npm config get registry --location=project`.
- Ensure `.yarnrc.yml` references only local files.
- Clean caches if corrupt: `rm -rf node_modules pnpm-lock.yaml .pnpm-store && pnpm fetch`.

## Verification
After using any strategy run:
```bash
node -v
pnpm -v || true
pnpm lint || true
pnpm test || true
```
