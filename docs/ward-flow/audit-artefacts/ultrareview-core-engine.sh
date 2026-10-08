#!/usr/bin/env bash
# ultrareview-core-engine.sh
#
# Prepares a LOCAL-ONLY branch so two `/code-review ultra` runs cover Ward Flow's core engine
# (about 14,850 lines) inside the 8,000-line-per-run limit.
#
# What it does:
#   1. Checks that origin is BigSimmo/Ward-Flow and fetches origin/main.
#   2. Builds four scaffold commits on top of origin/main, on a new branch:
#        A  remove slice 1   (reducer lines 1..split-1, ward-model.ts)
#        B  restore slice 1  (tree identical to main)
#        C  remove slice 2   (reducer lines split..end, engine helper files)
#        D  restore slice 2  (tree identical to main)
#      Diff A..D is slice 1 only; diff C..D is slice 2 only. The branch tip is exactly main.
#   3. Checks the branch out in a separate worktree next to this checkout.
#   4. Prints the two prompts to paste into Claude Code, with the real commit SHAs.
#
# Safety:
#   - Never pushes. Does not touch your current checkout, branch or uncommitted work.
#   - The commits are built with git plumbing (commit-tree), so the repository's pre-commit
#     hooks do not run. That is deliberate: commits A and C contain half a reducer and would
#     fail typecheck by design. They exist only as review bases and are never published.
#   - Clean up afterwards with the two commands printed at the end.
#
# Run from inside your Ward-Flow checkout, in Git Bash (Windows) or any bash:
#   bash ultrareview-core-engine.sh

set -euo pipefail

BRANCH="review/core-engine-ultrareview"
D="src/components/ward-management"
REDUCER="$D/ward-flow-reducer.ts"
SLICE1_FILES=("$D/ward-model.ts")
SLICE2_FILES=(
  "$D/ward-eligibility.ts"
  "$D/ward-admissions.ts"
  "$D/ward-inbox-reducer.ts"
  "$D/alerts/ward-broadcast-model.ts"
  "$D/alerts/ward-broadcast-reducer.ts"
  "$D/referrals/referral-submission.ts"
  "$D/ward-bed-states.ts"
)
SPLIT_MARKER='case "TRANSPORT_ACCEPTED": {'
LIMIT=8000

die() { echo "ERROR: $*" >&2; exit 1; }

# --- 1. Repository checks ------------------------------------------------------------------
ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || die "run this from inside your Ward-Flow checkout"
cd "$ROOT"
ORIGIN=$(git remote get-url origin)
case "$ORIGIN" in
  *BigSimmo/Ward-Flow|*BigSimmo/Ward-Flow.git) ;;
  *) die "origin is '$ORIGIN', expected BigSimmo/Ward-Flow" ;;
esac
git show-ref --verify --quiet "refs/heads/$BRANCH" && die "branch $BRANCH already exists; run the cleanup commands first"
WT="$(dirname "$ROOT")/Ward-Flow-ultrareview"
[ -e "$WT" ] && die "$WT already exists; run the cleanup commands first"

echo "Fetching origin/main..."
git fetch --quiet origin main
MAIN=$(git rev-parse origin/main)
MAIN_TREE=$(git rev-parse "$MAIN^{tree}")

for f in "$REDUCER" "${SLICE1_FILES[@]}" "${SLICE2_FILES[@]}"; do
  git cat-file -e "$MAIN:$f" 2>/dev/null || die "$f not found on origin/main; the engine layout has changed"
done

# --- 2. Work out the split -----------------------------------------------------------------
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
git show "$MAIN:$REDUCER" > "$TMP/reducer"
TOTAL=$(wc -l < "$TMP/reducer" | tr -d ' ')
SPLIT=$(grep -nF "$SPLIT_MARKER" "$TMP/reducer" | head -n 1 | cut -d: -f1)
[ -n "$SPLIT" ] || die "split marker '$SPLIT_MARKER' not found in the reducer"
MODE=$(git ls-tree "$MAIN" -- "$REDUCER" | cut -d' ' -f1)

lines_of() { local n=0 f; for f in "$@"; do n=$((n + $(git show "$MAIN:$f" | wc -l))); done; echo "$n"; }
S1=$(( (SPLIT - 1) + $(lines_of "${SLICE1_FILES[@]}") ))
S2=$(( (TOTAL - SPLIT + 1) + $(lines_of "${SLICE2_FILES[@]}") ))
echo "Reducer: $TOTAL lines, split before line $SPLIT"
echo "Slice 1: ~$S1 lines   Slice 2: ~$S2 lines   (limit $LIMIT per run)"
[ "$S1" -le "$LIMIT" ] && [ "$S2" -le "$LIMIT" ] || die "a slice is over $LIMIT lines; the split needs adjusting"

# --- 3. Build the scaffold commits (temporary index; working tree untouched) --------------
export GIT_INDEX_FILE="$TMP/index"
build_tree() { # $1 = blob for reducer remainder, rest = files to drop
  local blob=$1; shift
  git read-tree "$MAIN"
  git update-index --cacheinfo "$MODE,$blob,$REDUCER"
  git update-index --force-remove -- "$@"
  git write-tree
}
REST1=$(tail -n +"$SPLIT" "$TMP/reducer" | git hash-object -w --stdin)       # drop lines 1..SPLIT-1
REST2=$(head -n $((SPLIT - 1)) "$TMP/reducer" | git hash-object -w --stdin)  # drop lines SPLIT..end
TREE_A=$(build_tree "$REST1" "${SLICE1_FILES[@]}")
TREE_C=$(build_tree "$REST2" "${SLICE2_FILES[@]}")
unset GIT_INDEX_FILE

A=$(git commit-tree "$TREE_A" -p "$MAIN" -m "Review scaffold 1/4: remove core-engine slice 1 (local only, never push)")
B=$(git commit-tree "$MAIN_TREE" -p "$A" -m "Review scaffold 2/4: restore core-engine slice 1")
C=$(git commit-tree "$TREE_C" -p "$B" -m "Review scaffold 3/4: remove core-engine slice 2 (local only, never push)")
DTIP=$(git commit-tree "$MAIN_TREE" -p "$C" -m "Review scaffold 4/4: restore core-engine slice 2")

git branch "$BRANCH" "$DTIP"

# --- 4. Verify ------------------------------------------------------------------------------
[ "$(git rev-parse "$BRANCH^{tree}")" = "$MAIN_TREE" ] || die "branch tip does not match main (should never happen)"
echo
echo "Run 1 diff (A..tip):"; git diff --stat "$A" "$BRANCH" | tail -n 3
echo "Run 2 diff (C..tip):"; git diff --stat "$C" "$BRANCH" | tail -n 9

git worktree add --quiet "$WT" "$BRANCH"

# --- 5. Instructions ----------------------------------------------------------------------
cat <<EOF

==========================================================================================
Ready. Branch $BRANCH (local only) is checked out at:
  $WT

1. Open Claude Code in that folder:
     cd "$WT"
     claude

2. Paste run 1, confirm the dialog (expect ~$S1 changed lines, 2 files):

/code-review ultra $A core engine slice 1: ward-flow-reducer.ts lines 1-$((SPLIT - 1)) and ward-model.ts. Focus on state transitions, bed and referral invariants, and actions that can leave records inconsistent.

3. After run 1 has launched (it runs in the background), paste run 2 (expect ~$S2 lines, 8 files):

/code-review ultra $C core engine slice 2: ward-flow-reducer.ts lines $SPLIT-$TOTAL (transport, arrival and later actions) plus eligibility, admissions, inbox, broadcast, referral-submission and bed-state helpers. Focus on state transitions and cross-module consistency.

Check each dialog's line count before confirming. If it is far above these numbers, cancel.
Use /tasks to watch progress. Keep the session open until both finish.

Cleanup when done:
  git worktree remove "$WT"
  git branch -D $BRANCH
==========================================================================================
EOF
