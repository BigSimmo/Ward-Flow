#!/usr/bin/env bash
# Serial harness run over all sixteen third-edition pages, from the repository root.
# Usage: bash <scratchpad>/run-all-checks.sh <output file>
# Emits the same shape as third-edition-kit/check-output.txt: a "### check.mjs <page>" heading,
# the script's output, then "exit N". Pages are run one after another to spare the machine.
set -u
OUT="${1:?output file}"
cd "D:/Repos/Database/.claude/worktrees/ward-flow-phase-5-resume-166ecb" || exit 2
K=docs/ward-flow/mockups/third-edition-kit
M=docs/ward-flow/mockups
PAGES="command delays statistics-community statistics capacity ward bed-board search-hub raise-a-referral patient-search community-team statistics-ward movement emergency-department statistics-emergency-department patient-now"
: > "$OUT"
for p in $PAGES; do
  f="$M/$p-third-edition.html"
  echo "### check.mjs $p" >> "$OUT"
  node "$K/check.mjs" "$f" platinum >> "$OUT" 2>&1
  echo "exit $?" >> "$OUT"
done
echo "### check-shell.mjs command" >> "$OUT"
node "$K/check-shell.mjs" "$M/command-third-edition.html" platinum >> "$OUT" 2>&1
echo "exit $?" >> "$OUT"
echo "### check-standard.mjs design system" >> "$OUT"
node "$K/check-standard.mjs" "$M/design-system-third-edition.html" platinum >> "$OUT" 2>&1
echo "exit $?" >> "$OUT"
echo "### summary" >> "$OUT"
grep -nE '^### |ALL GREEN|^exit ' "$OUT" | grep -B1 -E 'exit [^0]|ALL GREEN' >> "$OUT" || true
