#!/usr/bin/env bash
# Ward Flow Cloud Agent install. Idempotent. Node 24 is required; the base image ships Node 22.
set -euo pipefail

NODE_VERSION=24.21.0
PREFIX="${HOME}/.local/node-v${NODE_VERSION}-linux-x64"

if [ ! -x "${PREFIX}/bin/node" ]; then
  mkdir -p "${HOME}/.local"
  curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz" | tar -xJ -C "${HOME}/.local"
fi

sudo ln -sfn "${PREFIX}/bin/node" /usr/local/cargo/bin/node
sudo ln -sfn "${PREFIX}/bin/npm" /usr/local/cargo/bin/npm
sudo ln -sfn "${PREFIX}/bin/npx" /usr/local/cargo/bin/npx
sudo ln -sfn "${PREFIX}/bin/corepack" /usr/local/cargo/bin/corepack
hash -r
export PATH="/usr/local/cargo/bin:${PATH}"

echo "Ward Flow cloud install: node $(node -v) npm $(npm -v)"
npm ci
npm ci --prefix backend/ward-flow
