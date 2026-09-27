# Retired PsychSift leftovers (26 September 2026)

Josh typed "yes delete the 7 PsychSift files" in the Fix the working system thread. Six were deleted, copied here word for word first (file names flattened, .txt added so no tool runs them):

- .github/workflows/live-web-vitals.yml and .github/workflows/ops-digest.yml: measured PsychSift's live website and search canary. Nothing here is pushed, so they never ran.
- _wt_list.txt, _wt_count.py, _wt_anti.py: scratch files from a worktree count, committed by mistake.
- .audit-reports/adversarial-audit-report.json: an old generated report with PsychSift screens; the audit writes a new one when it runs.

Kept on purpose: .github/actions/setup-lighthouse-chromium/action.yml, because .github/workflows/ci.yml's performance job still uses it. It goes with that job in the larger PsychSift clean-up.
