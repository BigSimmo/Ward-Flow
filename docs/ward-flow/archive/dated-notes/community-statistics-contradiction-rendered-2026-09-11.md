# The community-statistics contradiction, rendered

**Ward Verifier, 2026-09-11.** Ward Builder Four found this by reading source and stated its own
limit first: _"a STATIC read… NOT a contradiction observed on screen"_, with one half depending on a
state it had not confirmed fires. Ward Lead asked for the other half. **This is the render.**

⚠️ **This reports what a reader sees and under what conditions. It forms no view on what the fix
should be, and it surveys nothing else in the statistics family.**

---

## The answer in three lines

1. **Under the current seed the guarded sentence never fires — 0 of 64 teams.** Four's half 1 is
   **latent**, and not merely unobserved: it is unreachable while the seed holds no dangling referral.
2. **Forced, the contradiction is real and a reader sees both halves without scrolling — 29 pixels
   apart.**
3. **The trigger is global, not per-team.** One dangling referral anywhere flips **every** memberless
   team at once.

## 1 · The census — 64 of 64, not a sample

Every community-team statistics page rendered in Chromium against this project's own dev server
(identity confirmed at `/api/local-project-id`), settled per Ward Lead's policy: `load`, wait for the
screen element, then **8s** — the figure community routes needed elsewhere.

    TEAMS DECLARED: 64
    TEAMS MEASURED: 64
    not-computable sentence PRESENT on: 0
    measured-empty sentence PRESENT on: 62
    neither sentence (i.e. the team has members): 2
    RECONCILE: 0 + 62 + 2 = 64
    comparison panel present on: 64
    comparison table carrying ANY caveat wording: 0
    distinct comparison row counts across all pages: [64]

The two teams with members: **Midland** (9 in a bed, 7 with a discharge date) and **Inner City
Clinic** (1 discharged into the area).

⚠️ **FOUR PAGES TIMED OUT ON THE FIRST PASS AND I DID NOT REPORT THEM AS CLEAN.** They were the
first four in the queue, hitting a cold compile with four workers running. **A timeout is
unmeasured, not empty.** They were warmed and re-measured serially, and the numbers above are the
full 64.

## 2 · Corroborated by a second instrument, not by a second look

A subagent (**Sonnet, extraction**) executed the repository's own derivations against the real seed
— `COMMUNITY_TEAM_PAGES`, `admissionBelongsToTeam`, `admissionsWithUnresolvableReferral`,
`communityMembershipResolution` — and reported **2 members / 62 measured-empty / 0 not-computable**,
the same two teams by name.

🔴 **`admissionsWithUnresolvableReferral` is explicitly ZERO**, with all ten referral-carrying
admissions listed and each resolving to a real referral. **That is why nothing fires — a structural
fact about the seed, not a sampling result.**

**These are two different instruments** — a rendered DOM and a direct execution of the derivations —
**so they corroborate. They are not one observation made twice.**

## 3 · 🔴 FORCED — and this is the part that answers the question

**An absence measured by a probe never shown to produce a positive is worth nothing.** So the state
was forced, deliberately and reversibly: one seeded admission's `referralId` was changed to a
dangling value (`ward-admissions-seed.ts:837`, `RF-010` → `RF-DELIBERATELY-DANGLING`).

**The guarded sentence rendered.** Verbatim:

> This team's figures are not a measurement. 1 admission carries a referral that point at no referral
> held here, so the join that puts a person on a team cannot run for that record. **A zero above would
> be a confident answer over a question that was never asked.**

**And in the same view, that team's own row in the comparison table read:**

    ["Albany", "0", "0", "0"]
    ["Inner City Clinic", "0", "0", "0"]

**A bare zero. No caveat. No reference to the resolution state. The comparison table carried no
caveat wording anywhere on the page, in either state.**

### The geometry — this is the finding

    guard sentence top   629
    comparison panel top 706
    viewport height      900
    gap                   29px

🔴 **Twenty-nine pixels.** The sentence saying a zero here would be _"a confident answer over a
question that was never asked"_, and the zero itself, **are in the same screenful with no scrolling.**
Source adjacency turned out to be visual adjacency. **A reader does not have to hunt for the
contradiction; it is one glance.**

## 4 · The trigger is GLOBAL, and that changes the shape of it

`admissionsWithUnresolvableReferral` counts across **all** admissions, not the team's own. So the
state is all-or-nothing: **one dangling referral anywhere flips every memberless team into
`not-computable` simultaneously** — 62 of the 64 today.

**Measured, not inferred:** `albany` — an ordinary empty team with no connection to the record that
was broken — showed the sentence too.

⚠️ **A NOTE ON SEVERITY, BECAUSE I MEASURED SOMETHING NARROWER THAN THE STATIC FINDING CLAIMED.**
Four's half 2 was put as _"every other team's figure is printed with its computability unchecked… the
difference is only which team you happened to open."_ **The structural gap is real — `resolution` is
computed for this team only (line 97) while `allTeams` computes counts without it (line 99).** But
because the trigger is global, **the table and the page can never disagree about WHICH teams are
computable; they are all computable or none are.** What differs is only that the page **says so** and
the table **does not**. **Today every figure in that table is truthful, because no team is
not-computable.** That is a smaller claim than "wrong without a broken join", and it is the one the
render supports.

## 5 · Restoration, proved three ways

    1. line restored     referralId: "RF-010",
    2. blob hash         before 4af5f1612a9f203b13cf3d7ab5ca014c681a1df8
                         after  4af5f1612a9f203b13cf3d7ab5ca014c681a1df8   MATCH
    3. whole tree        0 changed files

⚠️ **A matching hash proves the file is back. It does not prove the running app is.** So the pages
were re-rendered after restoring: `albany` back to **measured-empty**, `inner-city-clinic` back to
**members**. **The perturbation is gone from the file, the index and the served page.**

## 6 · Two incidental observations, neither chased

- **A grammar defect in the guarded sentence's singular branch**, visible in the quote above:
  _"1 admission carries a referral **that point** at no referral held here"_. Plural agreement is
  correct in the plural branch. Observation only.
- The subagent flagged that a doc comment above `communityTeamOptions()` states _"71 distinct strings
  for 65 clinics"_ while the function returns **64**. **Its finding, not mine**, and it correctly
  declined to investigate. Recorded so it is not lost.

## 7 · What this does NOT establish

- **Nothing about the rest of the statistics family.** Not surveyed, by instruction.
- **No view on the fix.** Not mine, and two chats forming views on one screen is the failure that
  produces no conflict and is found at the fold.
- **Nothing about screen readers or keyboard reach.** `visible` here is geometry and computed style.
  Whether the guarded sentence is announced, and in what order relative to the table, is a §U
  question and is not answered here.
