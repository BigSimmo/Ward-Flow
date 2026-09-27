# Figures with no reader — the mirror of the no-producer census, 2026-09-06

**Read-only. Nothing was changed.** This is the census ruling 12 needs: the owner agreed the
principle — _delete the figure nobody uses_ — and **named no figure**. This turns that from his guess
into a list.

⚠️ **THE DELIVERABLE IS THE CENSUS, NOT A RECOMMENDATION.** _"Renders nowhere"_ is a fact and it is
below. _"Nobody would use it"_ is his judgement and is not.

## The population, stated before any finding

| population                                            | size   |
| ----------------------------------------------------- | ------ |
| Numeric/figure fields declared on ward model types    | **11** |
| Exported ward functions declared to return a `number` | **25** |
| **Total figures examined**                            | **36** |

Scanned across 150 files (`src/components/ward-management/**` + `src/app/mockups/ward-flow/**`), 131
of them reachable from the 33 ward routes. **Comments are stripped before any match**, because a
figure's name appears in the prose of files that do not touch it — the error that cost half an hour
earlier today.

## 🔴 The positive control, and it caught a broken instrument before any negative was believed

**The first run reported all 11 model fields as having NO READER — including `allocatable` and
`sexMix`, which I had watched render that afternoon.**

The cause: the reader pattern was built by string concatenation, and the shell halved its
backslashes, so `\.\s*allocatable` reached Node as `.s*allocatable` and matched nothing.

⚠️ **Every figure would have been reported unused, and the report would have been internally
consistent, confidently formatted, and completely wrong.** When you are hunting an absence, an
instrument that measures nothing returns exactly the answer you are looking for. **The rewritten
version uses `indexOf` and an explicit next-character test — no built regex, nothing for a shell to
halve.** With it, `allocatable`, `sexMix`, `beds`, `empty` and `value` all come back with renderers,
which is what makes the negatives below worth reading.

## The model fields: all 11 have a reader. No finding.

Eight are read directly by a rendering component. The other three — `allocatableLocked`,
`lockedBeds`, `speciallingCapacity` — are read only by logic, **and each was traced by hand to a
screen**: the first two feed `designationSummary` ("N locked, M open", rendered in
`flow-diagram.tsx`), and `speciallingCapacity` feeds both `acceptingBedCounts.specialled` and the
eligibility gate. **A figure read only by logic is not an unused figure**, and separating those was
the point of tracing rather than counting.

---

## 🔴 A · COMPUTED, TESTED, AND READ BY NOTHING — 4 figures

**Each of these appears in `src/` only inside its own declaring file, and in `tests/` only inside its
own test.** Two independent instruments agree: the call-graph scan, and a plain `grep` for the
identifier across both trees.

⚠️ **Every one has a passing test, which is what makes them invisible.** A figure with a green test
reads as a figure in use.

| figure                     | declared in                    | what it computes                                                      |
| -------------------------- | ------------------------------ | --------------------------------------------------------------------- |
| `legalDeadlineMinutes`     | `delays/delays-derivations.ts` | minutes until a patient's legal deadline; negative once it has passed |
| `blockedReleaseCount`      | `ward-discharge-dates.ts`      | how many expected discharges are currently blocked                    |
| `statewideReleaseCount`    | `ward-discharge-dates.ts`      | how many departures went statewide rather than local                  |
| `elapsedMinutesSinceMount` | `ward-clock.ts`                | minutes since the session mounted, correct across midnight            |

### ⚠️ `legalDeadlineMinutes` is not like the other three, and it should be looked at first

Its own docblock says formatting **_"is deliberately left to the screen, per this task's instruction
— this function hands over the fact, not its rendering."_**

**The screen it was left to never came.** The fact is computed correctly, carries a product-owner
correction from 2026-08-23 in its comment, has a test, and reaches nobody. **A figure that says how
long is left before a legal deadline expires is not in the same category as a count of statewide
discharges**, and this census does not decide either — but they should not be presented to the owner
as one row each.

**The other three are counts.** `blockedReleaseCount`'s comment records a real defect it was written
to prevent — a stuck confirmed discharge falling out of a ward's count "at the exact moment the ward
most needed to see it". **The prevention is real and nothing calls it.**

## B · REACHABLE ONLY THROUGH A SCREEN NOBODY CAN OPEN — 3 figures

| figure               | its only caller                               |
| -------------------- | --------------------------------------------- |
| `peopleWaitingCount` | `morning/morning-page.tsx`                    |
| `suburbCountForTeam` | `community/community-home.tsx`                |
| `elapsedOpenMinutes` | `ed/ed-home-derivations.ts`, itself unreached |

⚠️ **These are a different diagnosis from A and must not be merged into it.** They are wired to a
screen, correctly, and the screen was replaced. **If the eleven unreachable screens are retired they
become category A** — so a count taken today and quoted next week will be wrong in a way nobody can
see. This category exists so that movement is visible rather than silent.

## C · REACHES A COORDINATOR ONLY THROUGH ANOTHER FUNCTION — 7 figures

`openBeds`, `lockedBedsFree`, `openBedsFree`, `remainingSpeciallingCapacity`, `minuteOfDay`,
`openBedsNow`, `writtenHistoryCount`.

**These are intermediate values and are NOT findings** — with one exception worth stating, and one
limit worth stating.

**The exception.** `openBedsNow` was traced in full: its only caller is `ward-flow-reducer.ts`, in
the refusal that stops a pull into beds still being prepared. **So it reaches a coordinator as a
refusal message and never as a figure on a screen.** That is arguably correct — it is a gate, not a
display — but it is not the same as "rendered", and counting it as read would hide that.

⚠️ **The limit.** Of the seven, **three were traced to a screen by hand** (`openBeds` →
`designationSummary` → `flow-diagram.tsx`; `remainingSpeciallingCapacity` → `speciallingFree`;
`openBedsNow` → nowhere). **The remaining four were not.** They are in this category because
something reads them, not because a screen was shown to. **Do not report category C as "all fine".**

## D · RENDERED ONLY BEHIND A CONDITION NOTHING SATISFIES — NOT TESTED

⚠️ **This category is empty because it was not measured, not because nothing is in it.**

Deciding it means evaluating whether a rendering condition can ever be true, which static reading
cannot do honestly — and a zero reported from an unmeasured category is the same shape as the broken
positive control above. **The instrument for this one is the runtime crawl** that the unreachable-
screens census already used, extended to record which figures actually painted rather than which
modules did. **That has not been built.**

## The remaining 11 are rendered directly, and are not listed

---

## What this does and does not answer

**It answers ruling 12's factual half.** There are **four figures nothing reads at all**, and three
more that only an unreachable screen reads. Whether any of them should go is the owner's call, and
`docs/agents/dead-code-deletion.md` governs the removal of an exported symbol regardless.

⚠️ **It does not answer the question he was actually asked.** He was asked about a figure **on a
screen** that nobody uses — a number a coordinator ignores. **Nothing in a call graph can see that**;
it needs somebody watching a coordinator, or him naming one. **A figure with no reader and a figure
no reader cares about are different problems, and this census only finds the first.**
