#!/usr/bin/env bash
set -euo pipefail

# Start a local Verdaccio registry on port 4873
npm install -g verdaccio
verdaccio --listen 0.0.0.0:4873 &
PID=$!
echo "Verdaccio running (PID $PID) at http://localhost:4873"
echo "Use npm adduser --registry http://localhost:4873 to create a user"

