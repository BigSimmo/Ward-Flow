# The second path, and the shell-mount census

**Ward Verifier, 2026-09-11**, at line `a387cdbdfb`, merged into this branch by SHA before measuring.

## 1 · `teamForRegion` — the second path HOLDS, and the claim gains its boundary

I flagged this and explicitly did **not** verify it: `ward-board.tsx` reaches `COMMUNITY_TEAMS`
through `teamForRegion()` rather than through the hub's `hubEntries()`. **Same source, a different
path.** Rendered:

    /board/rph-adult-secure, an occupied tile selected
    team names found on the page                8
    carrying "(placeholder)"                    8
    BARE (no marker)                            0

The destinations panel, verbatim:

> _"Kimberley 3 people · soonest due now or overdue **Kimberley Community Mental Health Team
> (placeholder)** South West 2 people · soonest due now or overdue **South West Community Mental
> Health Team (placeholder)** …"_

⚠️ **The probe's pattern makes the marker OPTIONAL** — it matches a team name with or without the
suffix and sorts the two. **So a bare name would have appeared in its own bucket rather than being
missed.** That is the discrimination; `anyTeamStringSeen: 8` is the floor that says it saw anything
at all.

✅ **So "safe by construction" survives a second, independent call path on a different screen.** The
marker is part of the string, so every path that reads the string carries it. **The boundary is now
measured rather than assumed.**

## 2 · The shell-mount census — 36 of 36

    ROUTES DECLARED 36   MEASURED 36   ERRORS 0
    distinct rail counts per route        [1]     <- one rail everywhere, never two
    distinct <h1> counts per route        [1]     <- one heading everywhere
    control selector (must find nothing)   0 on all 36

**The mount that was reverted for putting two search boxes on every screen has not returned.**

### ⚠️ Two routes carry TWO visible search inputs, and I am not calling it a defect

    /community   "Search patients, movements, wards"   +  "Search team names"
    /hub         "Search patients, movements, wards"   +  "Search wards, EDs and community teams"

**These are not duplicates of each other.** One is the shell's global search; the other is a
page-scoped filter with its own distinct label and subject. **That is a different thing from the
defect that was reverted, which was the shell reproducing the per-screen chrome it had replaced.**

🔴 **But it is not mine to rule on.** `AGENTS.md` carries a one-composer rule — _"A page either uses
the shell/dashboard composer, owns an in-flow hero composer… Do not stack a second fixed search
bar"_ — and whether that rule governs these mockup routes, and whether a page-scoped filter counts
as a second composer, is a judgement **Ward Lead or the owner holds, not me.** **Reported as a
measurement with the labels quoted, so whoever rules has the actual strings.**

### 🔴 An instrument caveat, because the number would otherwise mislead

**My `ward-bar` count varied 5–7 across routes and it is NOT a count of bars.** The selector was a
**prefix** match, `[data-testid^="ward-bar"]`, so it also counts the bar's own children —
`ward-bar-activity-trigger` and siblings. **A prefix selector answers "how many testids begin with
this", never "how many of these components are mounted."** The meaningful figures above are the
rail and `<h1>` counts, which are exact-match.

## 3 · What is NOT covered

- **One viewport, 1440×900.** The reverted defect was visible at desktop width, so this is the right
  width to check it at — but a width-conditional duplicate would not be seen.
- **Default render only.** A composer that mounts after an interaction was not exercised.
- **The two uncovered surfaces remain uncovered.** The hub's pinned and recently-opened lists have
  **no community-team test coverage** — their existing tests use ward fixtures only. I established by
  rendering that the behaviour is correct today. **Nothing holds it there, and recording that is the
  most I can do: I assess, I do not build.**
