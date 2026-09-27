---
name: ward-flow-third-edition-build-plan
description: "Where the master plan for building the sixteen third-edition Ward Flow screens lives, how it is structured, and what it leaves for the owner — written 2026-09-10; its SHAs are floors"
metadata:
  node_type: memory
  type: project
  originSessionId: 29c363eb-169a-4dac-8951-045babf2d37d
  modified: 2026-09-11T13:06:54.822Z
---

**Second edition (2026-09-11):** `docs/ward-flow/plans/2026-09-11-third-edition-build-master-plan-v2.md`
(first at `5869819b9e`, adopted by Ward Lead at `db912ee458` after its D-31 sourcing check passed
34/34, on the line since `f2420d8cd4`; branch tip `d33406ba16` on 2026-09-11 evening carries the type-floor enumeration and the chat handover, not yet folded) on `claude/wardflow-design-review-43df97` is the plan of record. Beside
it on the same branch: the O-7 finding (`2026-09-11-o7-shell-stylesheet-exemption-finding.md` — 29 of
32 shell-stylesheet gate findings have no token; `999px` → `--radius-pill` decided yes by the owner 2026-09-11;
the stylesheet edit is Ward Lead's) and the draft standard clause "every layer carries the words"
(`2026-09-11-standard-clause-draft-every-layer-carries-the-words.md`, Ward Mockups' to place). The
widened D-31 sourcing check was dry-run (37/9/9 false) and withdrawn as a gate. **Open on the owner (2026-09-11 evening):** the type floor — `2026-09-11-type-floor-rendered-enumeration.md` (Chromium, 31 screens at `528bb60708`: only 10px and 11px below the floor, nothing under 10px; Delays' four columns and Command's tier/score at 10px; invented-figures banner 10px on 23 screens); recommendation put to him: keep 12px, no uppercase exception, pull forward only Delays and Command decision text. **Ruled 2026-09-11 evening as O-15.1 (relayed by Ward Lead, answered in Ward Lead's chat, not this one): recommendation taken whole; Ward Lead added the governance banner on their own authority, owner may veto; all three go to lane A.** `d33406ba16` and `047403e81f` folded. **2026-09-12:** tip `40a3e9ce7a` handed to Ward Lead (line `3c169b9d29` merged in first): raw type-floor record committed under `plans/type-floor-record-2026-09-11-528bb60708/` (record, never a baseline); standard sentence draft on the app's two scales (`2026-09-12-standard-sentence-draft-app-type-scale.md`, O-17.1, success condition written in, Ward Mockups to place); `check-type-scale.mjs` header reworded (step, not floor; gate unchanged). The clinical-versus-chrome text census (owner-approved scope `2026-09-12-scope-clinical-text-size-census.md`) is NOT this chat's — owner said "leave census"; Ward Lead assigns it. Owner then said stop. **Close-out 2026-09-12 (Ward Lead, line `b1ba537b64`, `docs/ward-flow/handovers/ward-lead-close-out-2026-09-12.md`):** `40a3e9ce7a` confirmed on the line, nothing owed; network bare-digit raise DEFERRED by the owner (recorded, not dropped); governance banner in the raise-now batch CONFIRMED; the wider small-text raise DEFERRED (D-10) and per-screen raise ruled unmeetable (four sub-floor classes live in one shared file imported by seven); **D-11: two ledgers is the design — Ward Flow work goes in `docs/ward-flow-ledger.md`, never tidied together with `docs/outstanding-issues.md`.** Standing rule adopted from this chat: rendered-element counts and stylesheet-declaration counts are different instruments, never corroboration. Handover to all seven Ward Flow chats sent 2026-09-11 (`2026-09-11-design-review-chat-handover.md`). Its own
rule: an errata entry on the line newer than the edition overrides it until folded. It folds in Ward
Lead's errata (`2026-09-10-master-plan-errata.md`, 4,085 lines, read to §CL at line `ba81fd2109`) and
owner-decisions D-1..D-27; every claim carries an inline tag ([M sha] measured, [L] lane-recorded,
[R owner]/[R lead] ruling, [P] proposed, [U] unverified + command). The first edition's structural
defect — a caveat in one section restated as fact in a task — is what the tags fix. Two v1 claims
were plainly wrong (legalDeadlineMinutes "no reader"; movement figures "unreconciled"), and the four
ED-tally facade names v1 invented never existed and must never be created (errata §CF).

The first edition, `docs/ward-flow/plans/2026-09-10-third-edition-build-master-plan.md` at
`e9c6900e3e` (folded), stays as the record of what was believed on 2026-09-10. Both paths are claimed
in `C:/Users/joshs/.claude/worktree-ownership.md`.

**Shape:** Phase 0 (Ward Lead folds the three unfolded mockup commits `d523d5e3cd..fb7ef96b83`, puts
thirteen owner questions in one message) → Phase 1 (Ward Lead: third-edition shell mounted once in
`layout.tsx`, a facade module `shell/ward-facade.ts`, seed extension) → Phase 2 (four lanes on
disjoint component directories: A Ward Builder = coordinator/delays/movements/capacity; B Two =
ward/board/ed/community; C Three = search/hub/patients/referrals; D Four = statistics) → Phase 3
(integration, end-to-end journey, definition of done for a built screen) → verification with the
exact gate commands (`run-ward-tests.mjs`, `check-ward-expected-reds.mjs`, `test:e2e:ward-journeys`,
`npm run mutate`).

**Why:** the owner named the phase on 2026-09-10 ("implement the behaviour of the new mockups, asking
for clarification rather than inferring"), and no document assigned it. All sixteen mockups already
have routes; the work is rebuild-in-place plus one shared shell, not new routes.

**How to apply:** read the plan before touching any ward screen; do not re-plan. Its planner rulings
that a builder should know: mockup engines are the spec for what is _shown_, never for how data is
_held_ (`WardFlowState` is the truth); an app panel the drawing lacks is neither dropped nor kept
silently — it goes to the owner as Q-12; three history fields on the referral drawing lose to the
owner's one-field ruling until he says otherwise (Q-13). Research reports (six Sonnet extraction
agents, A1–A5 and A2b, read at `20eb850792`, plus the B1/B3 dry runs) are committed under
`docs/ward-flow/plans/research-2026-09-10/` with a README, owner-approved 2026-09-11.
A read-only detached worktree `D:/Worktrees/Database/readonly-plan-20260910` was created for the
research and removed on 2026-09-11 with the owner's explicit approval (it held no work); the fourteen
stray `undefined-*.png` files at the design-review worktree root were deleted the same way.
mockups/_broken-copy.html (gone — scratch broken-copy drawing deleted) is kept by owner decision as the only copy of a broken state. See [[ward-flow-sixteen-mockup-run]], [[ward-flow-coordination-state]],
[[build-after-mockup-standing-permission]].
