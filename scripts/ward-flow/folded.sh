#!/usr/bin/env bash
#
# folded.sh — has this commit actually landed on the ward line?
#
# 🔴 WHY THIS EXISTS, AND IT IS NOT TO SAVE TYPING.
#
# Three chats reported a commit as unfolded when it was folded, twice in one day from one of them,
# using `git log --all -S '<some text from the change>'`. That query answers "which commit
# INTRODUCED this text". It was read as "has this LANDED". Those are different questions, and the
# first one's answer is correct, well-formed, and about the neighbour — which is exactly why nobody
# noticed. A merge has no diff against its first parent unless you pass --diff-merges, so every blob
# a fold carried in is invisible to it and the query manufactures an absence.
#
# That is one instance of nine collected on 2026-09-09/10, all the same defect:
#
#   QUESTION SUBSTITUTION — the instrument answers the adjacent question, and the answer arrives in
#   the right shape. It is not carelessness and it is not merge-blindness. The rigour of the method
#   is what makes the wrong answer persuasive.
#
# ⚠️ AND THE FIX IS NOT "ASK THE RIGHT QUESTION", BECAUSE NOBODY KNOWS THEY ASKED THE WRONG ONE.
# The fix is a control: point the instrument at a case whose answer you already know, and refuse to
# report until it comes back right. That is what this script does, and it is why it is a script
# rather than a note in a document — a lesson that is read has been measured insufficient here four
# separate times.
#
# WHAT IT REFUSES: to answer at all until a commit you name as KNOWN-FOLDED comes back folded.
# A checker that cannot say YES cannot be trusted when it says NO.
#
#   usage:  folded.sh <worktree> <line-ref> <known-folded-control> <sha>...
#   e.g.    folded.sh . codex/task-ward-flow-live-state-20260831 9f8a2040b2 41a98eba90 fb38a9cd4e
#
# Exit: 0 every commit folded · 1 at least one not folded · 2 cannot tell (control failed, or a ref
# or sha did not resolve). ⚠️ 2 is NOT "no" — see below.

set -u

if [ "$#" -lt 4 ]; then
  echo "usage: folded.sh <worktree> <line-ref> <known-folded-control> <sha>..." >&2
  exit 2
fi

worktree="$1"
shift
line_ref="$1"
shift
control="$1"
shift

cd "$worktree" 2>/dev/null || {
  echo "CANNOT TELL: '$worktree' is not a directory this shell can enter." >&2
  exit 2
}

git rev-parse --git-dir >/dev/null 2>&1 || {
  echo "CANNOT TELL: '$worktree' is not inside a git repository." >&2
  exit 2
}

# ⚠️ RESOLVE THE REF AND PRINT WHAT IT RESOLVED TO, never just the name it was given. A branch name
# resolves at read time: this line meant three different commits in one day, and a report naming the
# branch rather than the commit is a claim about a moving target.
line_sha="$(git rev-parse --verify --quiet "${line_ref}^{commit}" || true)"
if [ -z "$line_sha" ]; then
  echo "CANNOT TELL: the line ref '$line_ref' does not resolve to a commit in this repository." >&2
  echo "             Nothing below would mean anything, so nothing below is printed." >&2
  exit 2
fi

control_sha="$(git rev-parse --verify --quiet "${control}^{commit}" || true)"
if [ -z "$control_sha" ]; then
  echo "CANNOT TELL: the control '$control' does not resolve to a commit." >&2
  exit 2
fi

# THE CONTROL. Not a flag, not skippable, and deliberately the first thing that runs.
if ! git merge-base --is-ancestor "$control_sha" "$line_sha" 2>/dev/null; then
  echo "REFUSING TO REPORT."
  echo "  The control $control ($(git rev-parse --short "$control_sha")) is NOT an ancestor of"
  echo "  $line_ref ($(git rev-parse --short "$line_sha"))."
  echo
  echo "  Either the control is wrong or the line is wrong. This checker has not demonstrated that"
  echo "  it can return YES, so its NO would mean nothing. Fix the inputs and run it again."
  exit 2
fi

echo "line:    $line_ref -> $(git rev-parse --short "$line_sha")  $(git log -1 --format=%s "$line_sha" | cut -c1-64)"
echo "control: $(git rev-parse --short "$control_sha") is folded — this checker can return YES"
echo

status=0
for sha in "$@"; do
  resolved="$(git rev-parse --verify --quiet "${sha}^{commit}" || true)"
  if [ -z "$resolved" ]; then
    # ⚠️ THE THIRD VERDICT, AND IT IS NOT A TIDINESS POINT. Collapsing "cannot tell" into "not
    # folded" reports an absence the checker never established — the predicate-for-guard
    # substitution that this project has now paid for four times.
    printf '  CANNOT TELL  %-12s does not resolve to a commit here\n' "$sha"
    [ "$status" -lt 2 ] && status=2
    continue
  fi
  subject="$(git log -1 --format=%s "$resolved" | cut -c1-64)"
  if git merge-base --is-ancestor "$resolved" "$line_sha" 2>/dev/null; then
    printf '  FOLDED       %s  %s\n' "$(git rev-parse --short "$resolved")" "$subject"
  else
    printf '  NOT FOLDED   %s  %s\n' "$(git rev-parse --short "$resolved")" "$subject"
    [ "$status" -eq 0 ] && status=1
  fi
done

exit "$status"
