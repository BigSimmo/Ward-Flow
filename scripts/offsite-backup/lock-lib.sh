# acquire_lock <lockdir>: 0 = acquired, 75 = not.
STALE_SECS="${STALE_SECS:-21600}"; TOKEN_SECS="${TOKEN_SECS:-120}"
pid_start() { stat -c %Y "/proc/$1" 2>/dev/null; }
write_owner() { printf '%s\n%s\n%s\n' "$$" "$(date +%s)" "$(pid_start $$)" > "$1/owner"; }
record() { cat "$1/owner" 2>/dev/null; }
judge_stale() { # lock -> 0 if stale
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
token_live() { # 0 if a non-stale clearing token exists; a stale one is renamed away (one winner)
  local tok="$1.clearing" now born; now="$(date +%s)"
  [[ -d "$tok" ]] || return 1
  born="$(stat -c %Y "$tok" 2>/dev/null || echo "$now")"
  if [[ $(( now - born )) -gt "$TOKEN_SECS" ]]; then mv -- "$tok" "$tok.stale.$$.$now" 2>/dev/null; return 1; fi
  return 0
}
acquire_lock() {
  local lock="$1" tok="$1.clearing" now judged; now="$(date +%s)"
  token_live "$lock" && return 75                        # someone is mid-clear: never create
  if mkdir -- "$lock" 2>/dev/null; then write_owner "$lock"; return 0; fi
  judge_stale "$lock" || return 75
  judged="$(record "$lock")"
  mkdir -- "$tok" 2>/dev/null || return 75               # only the token holder may clear
  if [[ "$(record "$lock")" == "$judged" ]] && judge_stale "$lock"; then   # same record, still stale
    if mv -- "$lock" "$lock.stale.$$.$now" 2>/dev/null && mkdir -- "$lock" 2>/dev/null; then
      write_owner "$lock"; rmdir -- "$tok"; return 0
    fi
  fi
  rmdir -- "$tok" 2>/dev/null; return 75
}
