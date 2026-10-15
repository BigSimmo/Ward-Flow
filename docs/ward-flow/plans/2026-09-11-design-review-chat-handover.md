# Design-review chat — handover, 2026-09-11 evening

**Branch `claude/wardflow-design-review-43df97`, worktree
`D:/Repos/Database/.claude/worktrees/ward-flow-phase-5-resume-166ecb`, tip `17f3674d26` + this file.**
Docs only. Ward Lead folds by SHA; nothing here is pushed. The owner asked for this update to reach
every Ward Flow chat.

## What exists, and where it is

| Document                                                            | State                                                                                                                          |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `2026-09-11-third-edition-build-master-plan-v2.md`                  | **Plan of record.** Adopted by Ward Lead at `db912ee458`; on the line since `f2420d8cd4`. An errata entry newer than it wins.  |
| `2026-09-10-third-edition-build-master-plan.md`                     | First edition, kept as the record of 2026-09-10; superseded.                                                                   |
| `2026-09-11-o7-shell-stylesheet-exemption-finding.md`               | On the line. 29 of 32 gate findings have no token; both substitutions built by Ward Lead; `999px` → `--radius-pill` ruled yes. |
| `2026-09-11-standard-clause-draft-every-layer-carries-the-words.md` | Draft §8.8 for the standard. **Ward Mockups' to place**; Ward Lead has told them it is coming.                                 |
| `research-2026-09-10/` (A1–A5, A2b, B1, B3 + README)                | On the line. Dated extraction reports; every claim is about its read-SHA. A4's `referralId` claim annotated false since 09-10. |
| `2026-09-11-type-floor-rendered-enumeration.md`                     | **This branch only, `81b7749904`/`17f3674d26`.** Awaiting the owner's ruling; then Ward Lead folds.                            |

## What is decided

- **D-3 stands:** 12px floor, adopted; raised screen by screen as each is rebuilt, not as a sweep;
  invented-figures notice raised everywhere now; flow map unchanged; ratchet.
- **O-7:** three shell stylesheets exempted from the design-system gate (mechanism: Ward Lead's
  hand-edited per-line allowlist that names the missing token category and fails when a token
  appears). `0.18s` → `--duration-base` and `999px` → `--radius-pill` built.
- **The widened D-31 sourcing check is withdrawn** — 37 reached, 9 flagged, 9 false; not a gate.
- **Handover is the seventeenth screen** (O-6); **the check-list append path is built this phase**
  (O-9); **the two funnels and ED wait bands** are computed locally, not imported (v2 §6).

## What is waiting on the owner — nobody acts until he rules

1. **The type-floor question.** Measured in Chromium at `528bb60708`: only 10px and 11px exist below
   the floor, nothing below 10px; 1,873 visible 10px elements on 31 screens; the decision-carrying text
   on Delays (four columns, 43 rows) and Command (tier, score) is at 10px, as is the invented-figures
   banner on 23 screens. **Recommendation put to him:** keep 12px with no uppercase exception; pull
   forward only the Delays columns and Command tier/score. **Until he answers, inherit 10px where a
   screen already has it — do not be the one odd panel** (Ward Lead's instruction to the lane that
   found it).
2. **Reduced motion versus the in-app "full motion" opt-in** on the rail (Ward Lead's finding, recorded
   beside the line, not repaired). Not yet put to him.

## For each chat

- **Ward Lead:** fold `17f3674d26` (+ this file) when the owner has ruled on the type floor, or
  earlier docs-only if you prefer; the enumeration is the only thing not on the line.
- **Ward Builder (lane A: coordinator, delays, movements, capacity):** the Delays and Command text is
  the subject of the pending ruling; if he agrees, those two screens' raise comes before their rebuild
  and is yours. Do not start it on this document.
- **Ward Builder Two (lane B: ward, board, ED, community), Three (lane C: search, hub, patients,
  referrals), Four (lane D: statistics):** plan v2 §6 is the contract; §2 has the shell facts (patientId
  exists and is set on one occupant deliberately; the append path is unimplemented and is O-9's work);
  the research reports under `research-2026-09-10/` are inputs with a read-SHA, not rulings. Referral sources are the model's `REFERRAL_SOURCES` — six values (`ward-model.ts:1226–1234`); the owner ruled only that GP is not among them (_"NO. They come through ED or community"_ answered _"is GP a source?"_, not _"what are the sources?"_) [L Lane C, 2026-09-11].
- **Ward Verifier:** two measurement records to check against, both dated and SHA-pinned: the O-7
  counts (read, not run — `node scripts/check-design-system-contract.mjs` settles them) and the
  type-floor enumeration (rendered, Chromium, 1600×1200). Two test files sit within a bad minute of their 30 s ceiling on a quiet machine — `ward-override-register-render.dom` (13/13 alone in 28.6 s) and `ward-mutation-harness-reachable` (28.1 s alone, against a doc comment saying ~3 s) — so a red on either at ~30–36 s with `STACK_TRACE_ERROR` and no assertion is starvation, not a defect, and a passing re-run is not the fix; the ceiling raise is [L Ward Verifier, 2026-09-11].
- **Ward Mockups:** the §8.8 clause draft is yours to place or refuse; the standard's four floor
  sentences are quoted verbatim in the enumeration §1 and were found consistent.

## What this chat will do next

Nothing without the owner's word. It acts on Ward Lead's requests only when he approves them.
