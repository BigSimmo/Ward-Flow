#!/bin/bash
# SessionStart hook for Claude Code cloud sessions. Cloud containers ship an
# older Node, so this installs the version pinned in .nvmrc, puts it first on
# PATH for the session, and installs root and backend dependencies from their
# lockfiles. Local sessions are left alone.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}"

node_version="$(tr -d '[:space:]v' < .nvmrc)"
node_dir="${HOME}/.local/node-v${node_version}"

if [ ! -x "${node_dir}/bin/node" ]; then
  echo "Installing Node ${node_version} into ${node_dir}" >&2
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' EXIT
  archive="node-v${node_version}-linux-x64.tar.xz"
  base="https://nodejs.org/dist/v${node_version}"
  curl -fsSL --retry 3 -o "${tmp}/${archive}" "${base}/${archive}"
  curl -fsSL --retry 3 -o "${tmp}/SHASUMS256.txt" "${base}/SHASUMS256.txt"
  (cd "$tmp" && grep " ${archive}\$" SHASUMS256.txt | sha256sum -c - >&2)
  mkdir -p "${node_dir}"
  tar -xJf "${tmp}/${archive}" -C "${node_dir}" --strip-components=1
fi

export PATH="${node_dir}/bin:${PATH}"
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo "export PATH=\"${node_dir}/bin:\$PATH\"" >> "$CLAUDE_ENV_FILE"
fi

# npm ci keeps package-lock.json untouched. Skip it when the installed tree
# already matches the lock, so a cached container starts quickly.
if ! node scripts/check-installed-lock-parity.mjs >/dev/null 2>&1; then
  npm ci --no-audit --no-fund
fi

if [ ! -d backend/ward-flow/node_modules ]; then
  npm ci --prefix backend/ward-flow --no-audit --no-fund
fi

echo "Node $(node -v), npm $(npm -v); dependencies ready." >&2
