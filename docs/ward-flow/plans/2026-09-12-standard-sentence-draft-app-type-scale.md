# Draft sentence for the standard — which type scale the app screens use, and when they move

**A draft for Ward Mockups to place in `WARD-FLOW-DESIGN-SYSTEM.md`**, written 2026-09-12 by the
design-review chat at Ward Lead's request. The standard is Ward Mockups' file; this is not an edit to
it. **Proposed home: §4 (type), directly after the `--t-N` table and its sentence "every size is one
of the seven t steps", as a short addendum headed _In the app_.** A cross-reference belongs in §9
(accessibility floor) beside "Nothing below 12px in HTML", because that sentence is read as a rule
about the app and the addendum says when it becomes one.

**Authority:** owner ruling O-17.1, 2026-09-11, relayed by Ward Lead, taking this chat's recommendation
verbatim: _screens move to `--t-N` at their own rebuild and never before — and only once `--t-N`
resolves on a screen, which today it does not_ [R owner O-17.1]. Facts it rests on, measured: the
seven-step `--t-N` scale is declared inside `.wardShellTokens`, a CSS-module class composed by exactly
three shell files (bar, rail, reconciliation line); the ward screens are on the older `--text-*` scale
(`--text-3xs`, 10px, 299 uses; `--text-2xs`, 88 uses); `--t-0` and `--text-xs` are the same value,
0.75rem [L Ward Lead, 2026-09-11/12].

---

## 4.x In the app (draft)

> **Two scales are live in the app on purpose, and this is the ruled state, not drift.** The shell —
> the bar, the rail and the reconciliation line — is set on the seven `--t-N` steps of this section,
> declared on `.wardShellTokens`. Every screen stays on the app's older `--text-*` scale, including its
> grandfathered `--text-3xs` and `--text-2xs` uses, until that screen is rebuilt. **A screen moves to
> `--t-N` at its own rebuild and never before, and only once `--t-N` resolves on that screen** — the
> tokens declared or composed at the screen's own root, and each ruled element measured on its real
> route to equal the target size. Until then `--t-0` written on a screen paints the inherited size and
> looks like success; that is why the order is mechanism first, rename second. Nobody builds the
> mechanism until a screen rebuild needs it [R owner O-17.1, 2026-09-11].
>
> **How a reader checks it.** A screen is on `--t-N` when, and only when, all three hold on its real
> route under the root layout: (1) `getComputedStyle(document.querySelector('<screen root>'))
.getPropertyValue('--t-0')` returns `0.75rem`, not an empty string; (2) every element the screen's
> contract names computes to exactly its `--t-N` target — equals, never "bigger than before"; (3) the
> screen's stylesheet has no remaining `--text-*` reference. Until all three are true the screen is on
> the older scale, whatever its stylesheet says.

## What the sentence does not do

- It does not change the floor. D-3 and O-15.1 stand: no new text below 12px in HTML; existing sizes
  raised screen by screen; no uppercase exception; the flow map's 10.5/11.5px unchanged.
- It does not commission the mechanism (compose at the screen root, or declare on the ward layout
  root). That is a lane decision when a rebuild needs it, and Ward Lead has said it is not commissioned.
- It does not say the two scales are equivalent. `--t-0` and `--text-xs` coincide at 0.75rem; the
  other steps are not asserted to, and nobody should map one scale onto the other by value.
- **It does not, by itself, update the standing prohibition on screens using `--t-N`.**
  `docs/ward-flow/build-contracts-2026-09-12/AGENT-BRIEF-COMMON.md` §4 tells every screen agent
  "Never use `--t-0`, `--t-1`, `--t-2` on a screen… `var(--t-0)` resolves to nothing… falls back to
  inherited — which is BIGGER." That rule is true today for exactly the reason it states, because
  today nothing composes or declares `--t-N` at a screen root. **Whoever builds the migration
  mechanism this draft deliberately leaves uncommissioned MUST edit that brief's §4 in the same
  change — the rule text and its stated reason, not the rule alone** — otherwise the brief keeps
  telling the next agent a now-false thing with a reason that used to be true.

**Added 2026-09-12, Step 4: does the MUST above bind this draft's author?** No. This document is
written by the design-review chat to propose wording for Ward Mockups' standard; it does not build
the migration mechanism and will not be the one editing `AGENT-BRIEF-COMMON.md` §4. The MUST binds
whoever eventually commissions and builds that mechanism — a lane, per Ward Lead's assignment — not
the chat drafting this sentence.

## Why it is one paragraph and not a rule with a check

The check that matters already exists and is the acceptance standard Ward Lead ruled for any type
change: a real route under the root layout, per element by name, computed size **equals** the target —
never "bigger than before", because an unresolved token is also bigger. A sentence in the standard
tells a builder which scale to reach for; the browser gate is what proves they reached it.

_Tags as in the master plan's second edition: [R] ruling, [L] recorded by a lane or Ward Lead._
