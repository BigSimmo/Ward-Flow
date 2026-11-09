# Ward page polish: status (1 Nov 2026, 08:56 UTC)

- STOPPED (Josh, 08:56): stop all work except Transport. #1212 is left to auto-merge, and the release is on hold until Josh resumes it. No further action from this thread.
- State: the approved design plus the CI fixes are pushed to PR #1212 (branch claude/project-thread-19jsgq, commit e8fdb8c4f). Hosted CI is re-running, and auto-merge is armed.
- Fixed: the three failing tests (bed filter button names, the stay bar scale listed as not clinical, and the missing --wf-fs-18 token). The five affected test files pass locally (64 tests).
- Next: once #1212 merges and main's push CI passes, run .github/workflows/daily-release.yml manually (Josh approved this at 08:32), then check the live Ward page.
- Files: final-pr1212-vs-main.patch (the change before the CI fix), round patches, viewer.html and screenshots/.
