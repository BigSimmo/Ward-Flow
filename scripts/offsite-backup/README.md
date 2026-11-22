# Offsite backup script (Ward Flow bundles)

`ward-flow-offsite-backup.sh` makes the nightly git bundles of the legacy and dedicated sources, restore-checks each, copies them to the OneDrive backup folder and keeps the newest seven. It is installed by hand outside this repository (Windows task "Ward Flow offsite backup"); this folder is the reviewed copy.

Changes in this version (22 Nov 2026):

- **Race-safe lock.** A lock is a directory made by one atomic `mkdir` with an owner file. A lock is cleared automatically only when it is older than 6 hours and its owner process is gone; clearing is serialised by a `.clearing` token and a re-read of the same owner record, so two late runs cannot both win. A young or live lock still exits 75. The same functions are in `lock-lib.sh` for the race test.
- **Locks are released before the slow staging delete.** On 21 and 22 Nov the run was stopped at the end and left both locks behind; leftover staging folders older than 1 day are now tidied at the start of the next run.
- **No `cmd.exe /c tasklist`.** The OneDrive check hung for 11 minutes on 22 Nov; it now uses the shell's own process list and a 20 second limit on `attrib`.

Tests: `N=200 bash scripts/offsite-backup/lock-race-test.sh` (synthetic folders only; last run 22 Nov: 200 races, 0 double winners). The script was run end to end on scratch repositories and on the real ones (a dry run, then a scheduled-task run: restore PASS for both sources, task result 0).

No patient data is involved: the sources are git history of this synthetic-data project.
