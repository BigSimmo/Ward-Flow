#!/usr/bin/env bash
# Scheduled local Ward Flow bundle backup; OneDrive upload is a separate service.
# Required sources: historical Ward/backup branches in PsychSift/Database, and
# all local branches in the dedicated BigSimmo/Ward-Flow repository.
# No fetch/push, repository mutation, dirty/untracked-file backup, or cloud call.
# DRY_RUN=1 builds, restores and locally copy-checks BOTH sources, writes local
# staging/logs, and never creates/writes/prunes the destination.
# Manual paths: SOURCE_REPO, DEDICATED_REPO, BACKUP_HOME, BACKUP_DEST. Git identity
# and path separation are enforced for overrides as well as defaults.
# Restore: (cd <destination> && sha256sum --check <bundle>.sha256)
#          git clone <destination>/<bundle> <new-restore-directory>
set -uo pipefail

SOURCE_REPO="${SOURCE_REPO:-D:/Worktrees/Database/ward-lead}"
DEDICATED_REPO="${DEDICATED_REPO:-D:/Repos/Ward-Flow}"
DEST="${BACKUP_DEST:-C:/Users/joshs/OneDrive/Backups/Ward Flow}"
HERE="${BACKUP_HOME:-C:/Users/joshs/Backups/ward-flow-offsite}"
KEEP=7
DRY_RUN="${DRY_RUN:-0}"
[[ "$DRY_RUN" == 0 || "$DRY_RUN" == 1 ]] || { echo 'FAIL: DRY_RUN must be 0 or 1'; exit 2; }

# Canonicalize before writes; refuse broad roots and overlapping source/output
# trees. A source may be a linked worktree (.git file); Git validates it below.
for name in SOURCE_REPO DEDICATED_REPO DEST HERE; do
  value="${!name}"
  [[ -n "$value" && "$value" != *$'\n'* && "$value" != *$'\r'* ]] || exit 2
  value="$(realpath -m -- "$value")" || exit 2
  [[ "$value" != / && ! "$value" =~ ^/[a-zA-Z]$ ]] || { echo "FAIL: broad path $name"; exit 2; }
  printf -v "$name" '%s' "$value"
done
overlaps() { [[ "${1,,}/" == "${2,,}/"* || "${2,,}/" == "${1,,}/"* ]]; }
for source in "$SOURCE_REPO" "$DEDICATED_REPO"; do
  for output in "$HERE" "$DEST"; do
    overlaps "$source" "$output" && { echo 'FAIL: source/output overlap'; exit 2; }
  done
done
overlaps "$SOURCE_REPO" "$DEDICATED_REPO" && { echo 'FAIL: source overlap'; exit 2; }
overlaps "$HERE" "$DEST" && { echo 'FAIL: staging/destination overlap'; exit 2; }
mkdir -p -- "$HERE/staging" || exit 1
exec >>"$HERE/backup.log" 2>&1
echo "=== $(date '+%Y-%m-%d %H:%M:%S %z') start DRY_RUN=$DRY_RUN"
# --- Lock handling (lane I, 22 Nov 2026; tested 200 races, 0 double winners) ---------------------------------
# A lock is a directory made by one atomic mkdir, holding an owner file (pid, start epoch, process start time).
# A lock is stale only when older than STALE_SECS (6 h) AND its owner process is not alive. A stale lock is cleared
# only by the holder of a "<lock>.clearing" token (one atomic mkdir), after re-reading the same owner record; then it is
# renamed away and a fresh lock is made. A live or young lock is never touched: the run exits 75 as before.
STALE_SECS="${STALE_SECS:-21600}"; TOKEN_SECS="${TOKEN_SECS:-120}"
pid_start() { stat -c %Y "/proc/$1" 2>/dev/null; }
write_owner() { printf '%s\n%s\n%s\n' "$$" "$(date +%s)" "$(pid_start $$)" > "$1/owner"; }
record() { cat "$1/owner" 2>/dev/null; }
judge_stale() {
  local lock="$1" now owner_pid born owner_start cur; now="$(date +%s)"
  if [[ -f "$lock/owner" ]]; then
    { read -r owner_pid; read -r born; read -r owner_start; } <"$lock/owner" || true
    [[ $(( now - ${born:-$now} )) -gt "$STALE_SECS" ]] || return 1
    cur="$(pid_start "${owner_pid:-0}")"; [[ -n "$cur" && "$cur" == "$owner_start" ]] && return 1
    return 0
  fi
  born="$(stat -c %Y "$lock" 2>/dev/null || echo "$now")"
  [[ $(( now - born )) -gt 120 && $(( now - born )) -gt "$STALE_SECS" ]]
}
token_live() {
  local tok="$1.clearing" now born; now="$(date +%s)"
  [[ -d "$tok" ]] || return 1
  born="$(stat -c %Y "$tok" 2>/dev/null || echo "$now")"
  if [[ $(( now - born )) -gt "$TOKEN_SECS" ]]; then mv -- "$tok" "$tok.stale.$$.$now" 2>/dev/null; return 1; fi
  return 0
}
acquire_lock() {
  local lock="$1" tok="$1.clearing" now judged; now="$(date +%s)"
  token_live "$lock" && return 75
  if mkdir -- "$lock" 2>/dev/null; then write_owner "$lock"; return 0; fi
  judge_stale "$lock" || return 75
  judged="$(record "$lock")"
  mkdir -- "$tok" 2>/dev/null || return 75
  if [[ "$(record "$lock")" == "$judged" ]] && judge_stale "$lock"; then
    if mv -- "$lock" "$lock.stale.$$.$now" 2>/dev/null && mkdir -- "$lock" 2>/dev/null; then
      write_owner "$lock"; rmdir -- "$tok"; echo "NOTE: cleared a stale lock (older than ${STALE_SECS}s, owner gone)"; return 0
    fi
  fi
  rmdir -- "$tok" 2>/dev/null; return 75
}
release_lock() { rm -f -- "$1/owner"; rmdir -- "$1" 2>/dev/null; }
LOCK="$HERE/backup.lock"
acquire_lock "$LOCK" || { echo 'FAIL: another run or a recent lock; a lock older than 6 hours with no live owner is cleared automatically'; exit 75; }
# tidy leftover staging run folders older than 1 day (this script's own artifacts only)
find "$HERE/staging" -maxdepth 1 -type d -name 'run.*' -mtime +1 -exec rm -rf {} + 2>/dev/null
RUN=''
DEST_LOCKED=0
cleanup() {
  # Release the locks FIRST: the slow delete of the staging folder below was where the 21 Nov run was killed and left
  # both locks behind. A leftover staging folder is harmless and is tidied at the start of the next run.
  [[ "$DEST_LOCKED" == 0 ]] || release_lock "$DEST/.ward-flow-backup.lock"
  release_lock "$LOCK"
  if [[ -n "$RUN" && "$RUN" == "$HERE/staging/run."* && -d "$RUN" && ! -L "$RUN" ]]; then
    rm -rf -- "$RUN"
  fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
RUN="$(mktemp -d "$HERE/staging/run.XXXXXXXX")" || exit 1
RUN="$(realpath -- "$RUN")" || exit 1
RUN_ID="$(basename "$RUN")"
STAMP="$(date -u '+%Y-%m-%dT%H%M%SZ')-${RUN_ID#run.}"
if [[ "$DRY_RUN" == 0 ]]; then
  mkdir -p -- "$DEST" || exit 1
  acquire_lock "$DEST/.ward-flow-backup.lock" || { echo "FAIL: destination locked; a lock older than 6 hours with no live owner is cleared automatically"; exit 75; }
  DEST_LOCKED=1
fi

hash() { sha256sum -- "$1" | cut -d' ' -f1; }
fail() { echo "FAIL: $*"; return 1; }

backup_source() {
  local source="$1" repo="$2" prefix="$3"
  local phase=identity dir="$RUN/$1" top origin objects refs count bundle check sha size out old
  trap 'echo "source='"$source"' status=FAIL phase=$phase"' ERR
  mkdir -- "$dir"
  top="$(git -C "$repo" rev-parse --show-toplevel)"
  top="$(realpath -- "$top")"
  [[ "${top,,}" == "${repo,,}" ]] || fail 'source is not its own Git worktree root'
  origin="$(git -C "$repo" config --get remote.origin.url)"
  case "$source:$origin" in
    dedicated:https://github.com/BigSimmo/Ward-Flow|dedicated:https://github.com/BigSimmo/Ward-Flow.git|dedicated:git@github.com:BigSimmo/Ward-Flow|dedicated:git@github.com:BigSimmo/Ward-Flow.git) ;;
    legacy:https://github.com/BigSimmo/PsychSift|legacy:https://github.com/BigSimmo/PsychSift.git|legacy:git@github.com:BigSimmo/PsychSift.git|legacy:https://github.com/BigSimmo/Database.git|legacy:git@github.com:BigSimmo/Database.git) ;;
    *) fail 'unexpected repository identity (origin value withheld)' ;;
  esac
  phase=refs
  refs="$dir/refs.txt"
  git -C "$repo" for-each-ref --format='%(objectname) %(refname)' refs/heads > "$dir/all-refs.txt"
  if [[ "$source" == legacy ]]; then
    awk 'tolower($2) ~ /ward|backup/ {print}' "$dir/all-refs.txt" > "$refs"
  else
    cp -- "$dir/all-refs.txt" "$refs"
  fi
  count="$(wc -l < "$refs" | tr -d ' ')"
  [[ "$count" -gt 0 ]] || fail 'no selected local branches'

  # Keep the legacy shallow-marker workaround without changing the source:
  # a throwaway bare view borrows its objects but has no shallow marker.
  phase=build
  objects="$(git -C "$repo" rev-parse --path-format=absolute --git-path objects)"
  objects="$(realpath -- "$objects")"
  git init --bare -q "$dir/view.git"
  printf '%s\n' "$objects" > "$dir/view.git/objects/info/alternates"
  awk '{print "create " $2 " " $1}' "$refs" | git -C "$dir/view.git" update-ref --stdin
  bundle="$dir/$prefix-$STAMP.bundle"
  git -C "$dir/view.git" bundle create "$bundle" --branches
  phase=restore
  check="$dir/restore.git"
  git clone -q --bare "$bundle" "$check"
  git -C "$check" fsck --full --no-reflogs
  git -C "$check" for-each-ref --format='%(objectname) %(refname)' refs/heads > "$dir/restored-refs.txt"
  cmp -- "$refs" "$dir/restored-refs.txt"
  [[ ! -e "$check/objects/info/alternates" ]] || fail 'restore depends on source alternates'
  phase=copy-check
  sha="$(hash "$bundle")"
  size="$(stat -c %s "$bundle")"
  cp -- "$bundle" "$dir/bundle.copy-check"
  [[ "$(hash "$dir/bundle.copy-check")" == "$sha" ]] || fail 'copy-hash-mismatch'
  echo "source=$source restore=PASS branches=$count copy-hash=PASS bytes=$size"
  if [[ "$DRY_RUN" == 1 ]]; then
    echo "source=$source publication=SKIP retention=SKIP reason=dry-run"
  else
    phase=publish
    out="$DEST/$(basename "$bundle")"
    # Unique names preserve every previous valid artifact if any new step fails.
    for old in "$out" "$out.partial" "$out.sha256" "$out.sha256.partial" "$out.metadata" "$out.metadata.partial"; do
      [[ ! -e "$old" && ! -L "$old" ]] || fail 'artifact name collision'
    done
    cp -- "$bundle" "$out.partial"
    [[ "$(hash "$out.partial")" == "$sha" ]] || fail 'destination-copy-hash-mismatch'
    printf '%s  %s\n' "$sha" "$(basename "$out")" > "$out.sha256.partial"
    printf 'source=%s\nbranches=%s\nbytes=%s\nsha256=%s\n' "$source" "$count" "$size" "$sha" > "$out.metadata.partial"
    mv -- "$out.partial" "$out"
    mv -- "$out.sha256.partial" "$out.sha256"
    mv -- "$out.metadata.partial" "$out.metadata"
    (cd "$DEST" && sha256sum --check "$(basename "$out").sha256")
    phase=retention
    # Prune only this version's exact unique-name format, never legacy daily
    # bundles, old GitHub versions, key archives, directories or symlinks.
    find "$DEST" -maxdepth 1 -type f -name "$prefix-*.bundle" -printf '%f\n' |
      LC_ALL=C sort -r | awk -v prefix="$prefix" '$0 ~ "^" prefix "-[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{6}Z-[A-Za-z0-9]{8}\\.bundle$" {print}' > "$dir/retention.txt"
    tail -n +"$((KEEP + 1))" "$dir/retention.txt" | while IFS= read -r old; do
      [[ "$old" != */* && "$old" != *\\* && -f "$DEST/$old" && ! -L "$DEST/$old" ]] || fail 'unsafe retention target'
      for suffix in '' .sha256 .metadata; do
        [[ ! -L "$DEST/$old$suffix" && ! -d "$DEST/$old$suffix" ]] || fail 'unsafe retention sidecar'
      done
      rm -f -- "$DEST/$old" "$DEST/$old.sha256" "$DEST/$old.metadata"
      echo "source=$source pruned=$old"
    done
    if [[ -x /c/Windows/System32/attrib.exe ]]; then
      tail -n +2 "$dir/retention.txt" | while IFS= read -r synced; do
        [[ "$synced" != */* && "$synced" != *\\* && -f "$DEST/$synced" && ! -L "$DEST/$synced" ]] || continue
        /c/Windows/System32/attrib.exe +U -P "$(cygpath -w "$DEST/$synced")" >/dev/null 2>&1 || true
      done
    fi
  fi
  echo "source=$source status=PASS"
}

# Deliberately do not put the subshell in an if/&&/||: Bash would suppress
# errexit inside the whole function and allow failed verification to continue.
overall=0
for source in legacy dedicated; do
  if [[ "$source" == legacy ]]; then repo="$SOURCE_REPO"; prefix=ward-flow;
  else repo="$DEDICATED_REPO"; prefix=ward-flow-dedicated; fi
  (set -Ee; backup_source "$source" "$repo" "$prefix")
  status=$?
  [[ "$status" == 0 ]] || overall=1
done
echo "=== done status=$overall"
if ps -W 2>/dev/null | grep -qi "OneDrive.exe"; then
  if timeout 20 cmd.exe /c "attrib \"$DEST\"" 2>/dev/null | grep -q "U"; then
    echo "=== onedrive: OneDrive.exe running (some local files still Unpinned/uploading)"
  else
    echo "=== onedrive: OneDrive.exe running"
  fi
else
  echo "=== WARNING: OneDrive.exe not running; offsite cloud upload will wait until OneDrive starts" >&2
fi
exit "$overall"
