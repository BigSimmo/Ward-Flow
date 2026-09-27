# Task 4 implementation report — Command

Date: 2026-09-13  
Source baseline: `1ef9ed3975078b789e9b5d70b3f000c64edc3809`  
Plan SHA-256: `9ECE16E99228AF0B4053D7C6ED75CF694354EE9BBCBA9D0EC48A20F55573201E`

## Result

Command now opts into the third-edition root recipe and the canonical `wardShellTokens` layer. Its route-local frame no longer reserves the retired internal rail column. At desktop width, the emergency-department pressure strip spans the workspace above a three-column operational area: a 14rem priority queue, a flexible flow-and-registers column, and a 23rem shortlist. The queue, diagram, active register and shortlist each retain their own scrolling region within the viewport-height workspace.

The served drawing was inspected at 1440px and 390px before the visual edit. These are reference captures rather than post-change acceptance evidence.

## Changed paths and hashes

- `src/components/ward-management/coordinator/coordinator-screen.tsx` — marks the screen as third edition.
- `src/components/ward-management/coordinator/coordinator.module.css` — composes the canonical tokens, removes all `--text-*` references, and rebuilds the five-panel responsive presentation.
- `src/components/ward-management/coordinator/pressure-strip.tsx` — places the existing ordering rule in the pressure header so its hierarchy matches the drawing.
- `docs/ward-flow/plans/visual-rebuild-wave-one/tasks/task-4-report-r1.md` — this report.

Pre-report source hashes:

- `coordinator-screen.tsx`: `3A3ED8DFCA64042E8DB4CD510167F3CE15E6118BD3817998F5B9987EE70384EF`
- `coordinator.module.css`: `C3BF5A24CBA10986213FBB83AF9A70A1A725C3B3AFB4F2C74CC854FA85558B33`
- `pressure-strip.tsx`: `30C2414ED844450383FF33709706CAAD6A05BB3FD8D76C834A5A15C85755302A`

## Behavior and app-only surfaces retained

- ED pressure values, worst-first ordering and filter selection still come from the existing derivation and handler.
- The queue keeps its Patients and Referrals tabs, counts, ED filter notice, movement/referral selection, urgency tier, operational score, legal timing and clinical flags.
- The statewide diagram keeps the existing real departments, services, units, selection, recorded destinations, parallel referrals, eligibility outcomes, restrictive-placement warnings, capacity states and overflow notice.
- Declines, Overrides, Exceptions and Refused actions remain four mounted tabpanels. The phone collapse, keyboard tab movement, coverage caveat, unrestricted coordinator registers and persistent refusal count remain intact.
- The shortlist keeps its movement and referral modes, candidate selection, all gate explanations, legal and urgency controls, referral action, override form, release-pull flow, cancel-transport flow, confirmation, escalation and refusal records.
- The synthetic-prototype and medical-device disclosure stays above the operational workspace. The accessible local `h1` remains present because the shared bar route title is not a heading.
- Phone targets and the existing fixed shortlist action row remain 3rem minimum targets. Print restores content controls that carry records, removes viewport height constraints and releases all independent scrolling regions.

No engine, seed, derivation, sorting, state transition or action handler changed.

## Design departures and reasons

- The app retains four register tabs rather than the drawing's smaller example set because declines, overrides, detected exceptions and refused actions are distinct existing records.
- The queue retains its Patients and Referrals tabs and real count labels because referral placement is existing Command behavior absent from the drawing example.
- The diagram continues to show the engine's recorded destination, referral, eligibility and restrictive-placement facts. It does not add drawing-only acuity ordering, catchment filtering, ED-node state edge bars or other unsupported calculations.
- At 1001–1399px, the layout uses the drawing's intermediate two-column arrangement: the queue remains beside the center column and the shortlist follows beneath the center. At 1000px and below, the shared shell and Command workspace stack.
- The flow diagram remains omitted below the existing 48rem runtime breakpoint. The component already avoids mounting its measurement and connector work there, and the phone drawing's visible first viewport prioritizes pressure and queue content. Changing that runtime policy would exceed a presentation rebuild.
- The pressure cards use the existing site-code and pressure facts. Their canonical top status rule derives only from the already-rendered breach count; no new pressure category is inferred.

## Source checks and acceptance handoff

Formatting ran once:

```text
npx prettier --write src/components/ward-management/coordinator/coordinator-screen.tsx src/components/ward-management/coordinator/coordinator.module.css src/components/ward-management/coordinator/pressure-strip.tsx
```

All three files were unchanged. `git diff --check` reported no whitespace errors for the coordinator directory. A static class-reference inventory found every `styles.*` name used by the coordinator TSX files in `coordinator.module.css`, and `rg` found zero `--text-*` references or font sizes below the third-edition 12px floor.

No tests, browser work or server work were run because those acceptance steps are controller-owned. Pending evidence is the focused Command DOM contract, existing selection/action/refusal journeys, and mounted light/dark comparisons at 390px, 820px and 1440px. Human visual acceptance is pending those post-change captures.
