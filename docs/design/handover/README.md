# Ward Flow redesign: continue from here (state at 09:24 UTC, 1 Nov 2026)

Paste this into a new chat and say: "Continue the Ward Flow redesign from /mnt/project-files/ward-flow/handover/README.md."

## Read first

1. This file, then each screen's handover file in this folder.
2. /mnt/project-files/ward-flow/PLAN.md and the STATUS.md, memory and rules files in /mnt/project-files/ward-flow/.
3. Local files on Josh's PC (get folder access to D:\Repos\Ward-Flow):
   - D:\Repos\Ward-Flow\mockup-backup-2026-11-01\HANDOVER.md (screen states, Q log) and ARTIFACTS.md (28 mock-up links; build only from those marked current).
   - Zips 1-5: one folder per screen with mock-up, screenshots, patch, STATUS.md. 5b: memory and rules.
   - 6-artifacts.zip: BL86 component viewer, the source of all components and tokens. Read-only.
   - /mnt/project-files/Ward Flow Redesign Forms.zip: latest Forms mock-ups.
4. Repo github.com/BigSimmo/Ward-Flow: read AGENTS.md before any change.

## Screens (approved), all pushed, all stopped

| Screen     | PR(s)                                                                      | Where it stopped                                                                    | Handover           |
| ---------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------ |
| Ward       | #1212                                                                      | All checks green, auto-merge on; GitHub shows blocked waiting on one required check | ward.md            |
| Transport  | #1221 (+ follow-up to restore Needs transport on all four desks, Q127)     | Bugs fixed, review threads resolved                                                 | transport.md       |
| Movements  | #1222                                                                      | Fix CI, update 35 tests to new wording, mark ready                                  | movements.md       |
| ED         | #1223, draft #1231                                                         | 2 old tests still failing; hosted CI not read yet; Q128 open                        | ed.md              |
| Alerts     | #1225 (docs), #1230 (step 1, auto-merge on), draft #1233 (step 2, stacked) | Steps 3-6 still to build                                                            | alerts.md          |
| Forms      | #1228                                                                      | Auto-merge on, CI running                                                           | forms.md           |
| Handover   | draft #1232                                                                | 172 tests pass locally; watch hosted CI                                             | handover-screen.md |
| Community  | draft #1227                                                                | Frame stage underway; Q125/Q126 answered yes                                        | community.md       |
| Discharges | draft #1229                                                                | Static-check fix in progress                                                        | discharges.md      |
| Pop-ups    | #1226                                                                      | CI fix pushed, auto-merge on; Q122/Q123 answered yes                                | popups.md          |

If a screen's handover file is missing, read its PR description and latest commits.

## Local work pushed from Josh's PC (reference only; not PRs)

save/movement-drawer-audit-and-actions-20261101 (Ward), codex/role-runtime-20261025 (Movements), codex/ward-review-resolution-20261023 (ED), save/p115-p116-alerts-nav-20261101 and wip/alerts-demo-menu-20261101 (Alerts, older nav work), wip/main-checkout-screens-20261101 (uncommitted edits for Movements, ED, Community, Coordinator, Delays, On-call, Reports). Format and static push guards were skipped, so run full checks before reusing any of it.

## How to build

Reuse the mock-up's existing components and tokens and apply them straight to the site. Don't rebuild them. Compare each screen with its current mock-up.

## Rules

- Build only approved designs. Auto-merge counts as Josh's yes. Never merge by hand or turn auto-merge off.
- Merging isn't going live: release runs at 6 am Perth or by manual workflow.
- Claim files on issue #688 (and ownership.md if it exists) before editing.
- Hosted CI is the full gate. No duplicate test runs.
- Design: no coloured side edges; 40px controls (48px Accept/Pull/Decline on phones); 12px minimum text; minimal warnings; surname first with UMRN; times as typed (never default a written time to now).
- Questions: numbered, one recommendation each. Answered: Q122 to Q127 and ED's written time optional (all as recommended). Open: Q128 (ED: leave Clear out, put Decline back inside the opened referral). Next free: Q129. Record each new Q in HANDOVER.md.
- To hold a PR, add the `hold` label (Q373); never write an auto-merge note. Base every PR on `main`; never stack PRs. (The old Q129 hold on #1230 ended when it merged on 1 Nov.)
- Not approved, don't build: Patients #1224, Help, Team search, Statistics/Weekly.
- Josh: plain warm English, answer first, numbered actions, ultra token-conservative, post only finished links and questions.

## Josh's manual tasks

1. Set WARD_FLOW_UPTIME_TOKEN in Railway (backend) and GitHub.
2. Press Discard on Railway's old staged-changes banner.

## Start

Get folder access to D:\Repos\Ward-Flow, read this file and the screen handovers, then run one thread per screen from where its handover stops.
