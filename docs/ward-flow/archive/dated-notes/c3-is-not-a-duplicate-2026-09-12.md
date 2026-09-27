# Task C3 is a clinical loss, not a route change — stop before deleting the ED's inline form

**Measured 2026-09-12 in `D:/Worktrees/Database/ward-builder-two` at `780222addd`. Nothing has been
deleted. This document is the reason it has not been.**

## What the plan says, and why it is wrong

Lane B, Task C3 (`docs/ward-flow/plans/2026-09-1x-lane-b-ward-board-ed-community.md`):

> **Measured:** the inline form dispatches `RAISE_REFERRAL` with `role: "ed"`, `edId: department.id`
> and a full draft, passing **no patient or movement identifier** — it raises a new referral scoped
> to the department. The bar's New referral goes to `/mockups/ward-flow/referrals/new` with
> `source=ed` and `originEdId` prefilled…
>
> 🔴 **This is a route change, not a loss.**

**Every sentence before the conclusion is true. The conclusion does not follow from them**, because
the comparison stopped at the first form and never asked what the _second_ one dispatches.

🔴 **They are not two routes to one act. They are two different events, to two different reducer
cases, for two different moments.**

|              | inline ED form                                                               | the bar's route                                                                                                   |
| ------------ | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| dispatches   | `RAISE_REFERRAL` (`ed-screen.tsx:1024`)                                      | `RECEIVE_REFERRAL` (`referral-intake.tsx:1288`)                                                                   |
| reducer case | `ward-flow-reducer.ts:1089`                                                  | `ward-flow-reducer.ts:2878`                                                                                       |
| the moment   | an ED raising psychiatric review for somebody **already in that department** | the **front door** — a referral entering the system from community, police, ambulance, crisis or another hospital |

## What would actually be lost

**Three clinical fields exist on the inline form and NOWHERE else in the app.** Verified by grep
against `referral-intake.tsx` with a positive control — `legalStatus|legalForm|specialling` returns
**0**; `transportNeeded`, chosen because it is known to be present, returns **21**, so the pattern
can find things that are there:

1. **`legalStatus`** — voluntary or involuntary.
2. **`legalFormCode` and `legalFormDueAt`** — which Mental Health Act form, and the time a transport
   or transfer order runs out. ⚠️ **The reducer writes that due-by time as an actual legal deadline**
   (`ward-flow-reducer.ts:1108-1136`).
3. **`specialling`** — one-to-one nursing. ⚠️ **Two reducer gates read it**, so removing the only
   place it can be answered leaves those gates permanently deciding on an unanswered value.

⚠️ **`highAcuity` is the trap in this list and I nearly repeated it.** The route form _does_ carry
`highAcuityNursingNeeded` — but that is a **requirement of the bed being asked for**, sitting on the
psychiatric-ward destination. The ED form's `highAcuity` is an attribute of **this patient, now**.
Same words, two different facts. An inventory taken by field name would have called this one covered.

## The producer question, answered honestly

`RAISE_REFERRAL` has **two** dispatch sites, not one:

- `ed-screen.tsx:1024` — the inline form.
- `morning-tour.tsx:87` — **the demo tour**, whose own comment says its beats are "the five beats'
  real reducer events, as pure data".

🔴 **So deleting the inline form does not make the event unreachable — it makes it reachable only
from a demonstration.** That is worse than unreachable, because the event keeps a caller and keeps
passing every gate while no clinician can raise it.

## What I did not check

- Whether any **drawing** shows these three fields on another screen. If a third edition puts legal
  status somewhere else, this changes from "do not delete" to "do not delete _yet_".
- Whether `ui-ward-referrals.spec.ts`'s two owner-deferred failures touch these fields.

## Recommendation

**Hold C3.** Re-pointing the route is fine; **deleting the inline form is not, until the three fields
above have somewhere to live.** The smallest honest version of C3 is: keep the form, and change only
what the bar's button does.

---

## Summary

    DID        Checked whether the ED screen's inline referral form is a duplicate of the bar's
               route before deleting it. It is not. The two dispatch different events to different
               reducer cases for different moments, and the inline form is the only place in the app
               where legal status, a Mental Health Act form and its deadline, and one-to-one nursing
               can be recorded.

    ISSUE      Serious, and it is a clinical one. Task C3 as written would delete the only capture
               point for a patient's legal status and for one-to-one nursing, and would leave
               `RAISE_REFERRAL` raisable only by the demo tour. The plan's own measurement was
               accurate; the conclusion drawn from it was not, because the comparison never asked
               what the second form dispatches.

    GAPS       I did not check whether any third-edition drawing relocates those three fields to
               another screen — if one does, this is "not yet" rather than "not at all". I did not
               check the two owner-deferred failures in `ui-ward-referrals.spec.ts`.

    NEED       Whether to hold C3 entirely, or do the route half only.

    RECOMMEND  Hold the deletion; do the route half only. Keep the form until the three fields have
               somewhere else to live, and treat "where do legal status and specialling get recorded"
               as its own question rather than a side effect of tidying a duplicate.
