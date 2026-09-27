# Ward Flow — start here (2026-09-16, 16:05)

> **SUPERSEDED on 17 Sept 2026 by `docs/ward-flow/README.md`.** Kept for history; do not follow. Its instruction not to build against the fourteen replaced drawings is retired: the drawings committed at HEAD are the design (see `docs/ward-flow/STATUS.md`). Its §1 clashes and §6 questions are answered in `docs/ward-flow/owner-answers-2026-09-17.md`.

**For a new chat working in `D:\Worktrees\Database\ward-lead`. Checked against HEAD `9839ddec4d`
at 16:05 AWST.**

Read sections 1 to 3 before changing anything. Each one describes something that will lead you to
build the wrong thing if you miss it.

---

## Before you start

**Another tool has been committing in this folder all afternoon** — Antigravity, which records itself
by name in `docs/ward-flow/owner-decisions-2026-09-16-rulings.md`. Its last commit was at 16:04. At
16:05 the folder was clean with no merge in progress.

1. Run `git status` and `git log -5` first. If files you did not touch are staged or modified, **stop
   and ask the owner.** Two sessions cannot commit in one folder — the pre-commit check blocks both.
2. Add files by name. Never `git add -A`. Never `git stash`.
3. Never push. "Fold into main" means this local ward line, never `origin/main`, which would deploy the
   live app and apply migrations to the live clinical database.

**Three other handovers dated today are in `docs/ward-flow/handovers/`.** Two were written by that other
tool at 15:56 (`…-CONSOLIDATED.md`, `…-RESUMPTION-CHECKPOINT.md`) and describe the afternoon's merge as
resolved "with zero loss". **That is not correct** — see section 3. The others are marked superseded.

---

## 🔴 1. Two records of the owner's rulings disagree. Resolve before building.

There are now two decision records:

- `docs/ward-flow/owner-decisions-2026-09-15.md` — the WLQ questions.
- `docs/ward-flow/owner-decisions-2026-09-16-rulings.md` — sixteen rulings, recorded by Antigravity.

**On five subjects they point in different directions.** Do not build on any of these until the owner
has said which stands.

| Subject                                                | 15 September                                                                                                                | 16 September                                                                                                                        |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Examination revoked after transport is booked          | **WLQ-4:** the bed is _not_ released. Owner: "Don't release, As you recommend"                                              | **Ruling 9:** reservations and transport are "atomically cleaned up. Bed capacity is refunded". Owner: "Yes to your recommendation" |
| Legal form durations                                   | **WLQ-5:** a warning that never states a duration. The restyle plan's answer D5 also says no section numbers or time limits | **Ruling 1:** 72-hour clock when a Form 1A is written, 24 hours once received, 72 hours for a Form 3D                               |
| Gender and bed matching                                | **WLQ-6:** designed, deliberately not wired until beds link to people                                                       | **Ruling 5:** gender decides the bed, across movements and referrals                                                                |
| Community teams cancelling transport                   | Not built: no event says which community team is acting                                                                     | **Ruling 11:** "Yes to your recommendation"                                                                                         |
| ED referral straight to a community mental health team | **WLQ-19:** revisit when the community screens are rebuilt                                                                  | **Ruling 16:** "build this … now ASAP as ED to CMHT referrals are very common"                                                      |

**Two things about these that change how you read them:**

- **On the revoked-examination clash, both answers were "yes" to a recommendation an AI session wrote.**
  Neither is the owner's own formulation. The owner has approved two opposite recommendations and has
  probably not seen them side by side.
- **On Ruling 1, the durations are the owner's own words.** The _section numbers_ beside them
  (§34(1)(b), §35, §36, §38 of the WA Mental Health Act 2014) were added by the tool, which was asked to
  "ground this in your understanding of the mental health act in WA". **Those citations are unverified
  clinical-legal content. Do not display them, test against them, or build on them until the owner has
  checked them.** The other tool has already started building from Ruling 1 (commit `03ddb20c31`).

---

## 🔴 2. Stop-transport is built, but this folder's record says it was never ruled

The engine can stop a transport after a patient is collected, and a referrer can revoke a referral after
a ward has accepted. Both are in the reducer and have tests.

**But `owner-decisions-2026-09-15.md`, line 244, still reads "WLQ-38 · NOT answered — the owner asked for
more explanation. Still open."** The owner's verbatim ruling that authorised this work exists only on the
branch `ward/lead-fixes-20260914`, in three commits never brought into this folder: `162debbbdc`,
`b4525dbc8a` and `0d62f779bf`. They also carry the matching updates to `OWNER-RULINGS.md`, the gender
plan, and the two new ward notices in the communication addendum.

**Until those are folded in, this folder's own record contradicts its own code.** The next reader will
conclude the capability was built without authority.

> **Updated 2026-09-16:** this is fixed. Commit `8035fdfa9f` changed `owner-decisions-2026-09-15.md`;
> line 244 now reads _"`WLQ-38` · The referring doctor, as well as the coordinator, may revoke the
> referral and stop the transport. Answered 2026-09-15, built 2026-09-15."_ The WLQ-38 ruling record
> is on that line. `162debbbdc`, `b4525dbc8a` and `0d62f779bf` are confirmed ancestors of the current
> HEAD (`git merge-base --is-ancestor <sha> HEAD`), so all three are folded in.

---

## 🔴 3. The afternoon's merge dropped work the owner had ruled on

Merge commit `224885aba5` (15:55) resolved most of its conflicts wholesale in favour of the visual
rebuild. Two losses are confirmed:

- **WLQ-10's wording is gone from the capacity screen.** The screen no longer shows "oldest was
  expected {time}" beneath a ward's held-up count. The test that asserts it,
  `tests/ward-capacity-view.dom.test.tsx`, is still there — **so that test should now fail.** (Read, not
  run.)
  _(Updated 2026-09-16: the wording is back, but not as ruled. Commit `8035fdfa9f` restored a
  Blocked-cell line in `capacity-screen.tsx`, but it reads "held up since {time}", not "oldest was
  expected {time}". `docs/ward-flow/owner-decisions-2026-09-15.md` ~:198 says explicitly that the
  record holds no time at which a release became held up, so "since" is not a claim the data can
  back — this is a wording defect, not a re-loss. Re-check `tests/ward-capacity-view.dom.test.tsx`
  against the current wording before trusting either "fails" or "passes".)_
- **The ledger's list of owner questions is gone.** `docs/ward-flow-ledger.md` holds no WLQ entries,
  although the 15 September record points readers to "ledger §B" for them.

`PROJECT-ISSUES.md`, `README.md`, `SCREEN-VERIFICATION.md`, `SCREEN-MAP.md` and `NEW-CHAT-PROMPT.md` were
also resolved to the rebuild's side. Nobody has checked what each of those lost.

---

## 🔴 4. The drawings

**Fourteen approved drawings were replaced in committed history** by commit `883ecfdfb4` (15:30):

add a patient · alerts · discharges · governance · legal forms · on call · out of area · patient · patient
search · settings · sign in · transport officer · ward answer · wards

Thirteen are now 7–12% of their approved size. Those thirteen carry no "invented" disclosure, no shared
shell, and no self-calculating figures; they hand-type their numbers, carry self-awarded "QA 100/100" and
"PERFECTED" badges, and Discharges says "Blocked Releases", which breaks the owner's ruling that the stage
is _discharged_, never _released_. **Patient search is the exception** — 22% of its size, and it keeps its
disclosure and calculated figures.

**What the owner has said about this, in order:**

1. **15 September, WLQ-1:** "Keep approved." The rewrites must not replace the committed drawings.
2. **16 September:** he answered seven design questions on a restyle plan, then said **"Ok go"**. That
   plan starts from the approved drawings (`1ef9ed3975`) and moves the new look onto them, rather than
   keeping the rewrites.

So the direction is settled: **approved drawings plus the new look.** It is being done in a separate
folder, `D:\Worktrees\Database\ward-restyle`, claimed at the owner's go.

**Do not build or verify any screen against these fourteen drawings.** The approved versions are intact:

```bash
git show 1ef9ed3975:docs/ward-flow/mockups/discharges-third-edition.html
```

⚠️ **This folder's copy of that plan is older and does not contain the owner's answers or his "Ok go".**
Only the copy in `ward-restyle` does, and it is uncommitted there.

> **Updated 2026-09-16:** `ward/restyle-drawings-20260916` and `ward/lead-fixes-20260914` are now
> folded into `ward/audit-fixes-20260916` (merge commits `2a63854057` and `49aba2926b`). This does
> not by itself confirm the `ward-restyle` worktree's uncommitted plan copy or the owner's "Ok go"
> answers were carried across — re-check that folder before relying on this note for that claim.

---

## 5. Two traps in finished-looking work

- **Revoke and stop-transport have no button.** No screen dispatches `STOP_TRANSPORT`, and the ED screen
  hides withdrawal once a ward has accepted. They work and are tested, and nobody can use them.
- **"The referrer" means any ED session.** No event records which emergency department is acting, so
  permission is by role alone. A community referrer is refused after acceptance.

---

## 6. Still waiting on the owner

**Needs an answer:**

1. Which ruling stands on each of the five clashes in section 1.
2. Whether the Mental Health Act section numbers in Ruling 1 are correct.
3. Ruling 7, on separating transport cancellation from the referral — he said "explore this further i am
   confused".
4. Ruling 12, the permissions matrix — he asked for an explanation.
5. Ruling 13 / WLQ-17, which ED hub drawing is the design — he deferred it as "a big decision".
6. Which of the six capacity figures a coordinator does not use.

**Deferred by the owner's choice:** whether Ward Flow is a regulated medical device; recording who holds
statutory authority on a legal-status change; the real catchment data.

**The Aboriginal cultural safety review** — the owner will commission it himself ("Me later"). Only the
timing is open. It is a hard gate before any real-patient use.

**Work, not a decision:** sort which small text is clinical and which is decoration, before any real bed
coordinator sees the app.

---

## 7. Outside this folder, and worth bringing in

- **The three commits on `ward/lead-fixes-20260914`** named in section 2 — the WLQ-38 ruling record.
- **In `ward-restyle`, uncommitted and existing nowhere else:** the plan copy holding the owner's seven
  answers and "Ok go"; `tests/ward-drawing-rules.test.ts`, which currently fails because the checker it
  imports (`scripts/ward-flow/check-drawing-rules.mjs`) has not been written; and the reference drawings
  in `docs/ward-flow/mockups/reference/gemini-2026-09-15/`.

**If `ward-restyle` is discarded, the owner's own answers on the drawings are lost with it.**

Nothing else on any other Ward Flow branch or folder is worth taking. That was checked across roughly
thirty branches earlier today.

---

## How this was checked

An independent reviewer checked every claim in an earlier draft against the repository and found it unsafe
to hand over. This version was rewritten from those findings. The clinical items — both records, WLQ-4,
Rulings 1, 5, 7, 9, 11, 12, 13 and 16, the WLQ-38 status, the dropped capacity wording and its test, and
the restyle "Ok go" — were then opened and confirmed by hand at 16:05 against HEAD `9839ddec4d`.

**No test or gate was run.** This folder was still being committed to while it was checked. Re-check any
figure before relying on it.
