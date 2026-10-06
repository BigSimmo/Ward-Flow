#!/usr/bin/env bash
# Start or reuse this checkout's Ward Flow dev server and print its URL.
set -euo pipefail

export PATH="/usr/local/cargo/bin:${PATH}"
hash -r
echo "Ward Flow cloud start: node $(node -v)"
npm run ensure
