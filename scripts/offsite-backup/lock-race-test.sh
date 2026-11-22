#!/usr/bin/env bash
# Race test for the offsite backup lock (lock-lib.sh). N races of 3 staggered runs on a stale lock; expect 0 double winners.
# Usage: N=200 bash scripts/offsite-backup/lock-race-test.sh   (synthetic folders under a temp directory only)
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"; W="$(mktemp -d)"; N="${N:-50}"; fails=0; zero=0
cat > "$W/racer.sh" <<RACER
source "$HERE/lock-lib.sh"
sleep "0.0\$((RANDOM % 9))" 2>/dev/null
acquire_lock "\$1"; rc=\$?
[[ \$rc == 0 ]] && echo "WIN \$\$" >> "\$2" || echo "LOSE \$rc" >> "\$2"
RACER
for i in $(seq 1 "$N"); do
  d="$W/r$i"; mkdir -p "$d/lock"; printf '99999\n%s\n1\n' "$(( $(date +%s) - 30000 ))" > "$d/lock/owner"
  bash "$W/racer.sh" "$d/lock" "$d/res" & bash "$W/racer.sh" "$d/lock" "$d/res" & bash "$W/racer.sh" "$d/lock" "$d/res" & wait
  w=$(grep -c WIN "$d/res"); [[ $w -le 1 ]] || fails=$((fails+1)); [[ $w == 1 ]] || zero=$((zero+1))
done
echo "RESULT races=$N double_winner_races=$fails zero_winner_races=$zero"
[[ $fails == 0 ]]
