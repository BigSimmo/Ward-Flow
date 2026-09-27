# Ward Flow handover — 2026-09-16

> **SUPERSEDED on 17 Sept 2026 by `docs/ward-flow/STATUS.md`.** Kept for history; do not follow.

> ⚠️ **SUPERSEDED the same day. Read [`WARD-LEAD-START-HERE-2026-09-16.md`](WARD-LEAD-START-HERE-2026-09-16.md) instead.** This was accurate when written, but the folder changed within the hour: engine work described here as missing has since landed, and fourteen approved drawings were replaced in committed history. Kept as a record only — do not act on it.

**Written for the owner, in plain English. Every decision that is now settled, everything built
under those decisions, and the short list of things still waiting on him.**

⚠️ **This document records work done by earlier sessions on 14–16 September. The session writing
it has re-read the commits and the decision records, but has NOT re-run any test or gate. Where
something below says "proven", that is the earlier session's own measurement, quoted — not a
fresh one.**

---

## 1. Where things stand, in one paragraph

Between 14 and 16 September, thirty-eight questions that had been waiting on the owner were
written down, put to him, and answered. Eight real defects in the ward engine were fixed under
those answers, each with tests. A large body of drawing and screen work sits alongside it,
unfinished and undecided. All of it exists as commits — nothing is at risk of being lost — but it
is spread across two folders, and the ward line itself has not moved since 12 September.

---

## 2. What the owner settled — all thirty-eight

The full verbatim record, including exactly how each question was put, is in
`docs/ward-flow/owner-decisions-2026-09-15.md`. This is the plain summary.

### The clinical and safety rulings

| #      | Settled                                                                                                                                                                                                                    |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WLQ-1  | **Keep the approved drawings.** An outside tool rewrote twelve approved drawings plus Patient search. The committed versions remain the design, and the rewrites must not replace them when work is folded together.       |
| WLQ-2  | A forensic unit is **not** excluded from bed matching. Show the forensic flag as a fact about the ward and let the coordinator decide.                                                                                     |
| WLQ-3  | A locked bed **may** be overridden by a named coordinator with a reason, exactly as authorisation now can.                                                                                                                 |
| WLQ-4  | When an examination is revoked after transport is booked or the patient is moving, the bed is **not** released automatically.                                                                                              |
| WLQ-5  | Booking transport for an involuntary patient with no Form 4A gives a **warning, never a block**.                                                                                                                           |
| WLQ-6  | Once a bed can be linked to a person, gender reads on the bay-mix check as well as the bed-type check.                                                                                                                     |
| WLQ-7  | The Patient screen shows **no** current movement, to anyone, until the app can enforce who is looking.                                                                                                                     |
| WLQ-10 | A discharge held up for days **keeps counting** in its ward's held-up figure.                                                                                                                                              |
| WLQ-11 | Whoever booked transport may cancel it. The receiving ward may not.                                                                                                                                                        |
| WLQ-13 | Withdrawal by the referrer is its own record, not a decline reason.                                                                                                                                                        |
| WLQ-14 | The ED access clock starts when the **referral is received**. Medical clearance is shown beside it, never as the start.                                                                                                    |
| WLQ-34 | The Mead Centre (Armadale), written four ways across eight suburbs, is **one** community service.                                                                                                                          |
| WLQ-35 | A person with no recorded gender may be placed on a ward that takes either gender, and is refused on a single-gender ward until gender is recorded.                                                                        |
| WLQ-36 | Where some occupants' gender is not recorded, the bay-mix check says it **cannot tell**, and a coordinator may override with a recorded reason after confirming with the ward. Unknown occupants are never counted by sex. |
| WLQ-38 | The **referring doctor, as well as the coordinator**, may revoke the referral and stop the transport.                                                                                                                      |

### The design and product rulings

| #           | Settled                                                                                                              |
| ----------- | -------------------------------------------------------------------------------------------------------------------- |
| WLQ-12      | A referral records the team or service that sent it. No decline notification to that team yet.                       |
| WLQ-15      | Keep all six capacity figures until one is named for removal.                                                        |
| WLQ-16      | The ward's constraints box stays free text until something downstream needs to read it.                              |
| WLQ-17      | The screen map's drawing is the ED hub design.                                                                       |
| WLQ-21      | Drop the Command tally's "Due within 2 hours" tile — no clock exists to feed it.                                     |
| WLQ-22      | On Out of area, the primary action already wired on the built screen stays primary.                                  |
| WLQ-23 / 37 | The three withdrawal names **stay as they are**. The original approval to rename rested on a wrong description.      |
| WLQ-24      | Remove the unused fourth referral state.                                                                             |
| WLQ-25      | Keep the legal forms design as built.                                                                                |
| WLQ-26      | Wire the small-text check, pin it per file, compare file counts, widen what it scans — all four.                     |
| WLQ-27      | Decide which small text is clinical and which is decoration **before** Ward Flow is shown to a real bed coordinator. |
| WLQ-33      | Remove the chat-control machinery once the fixes are folded.                                                         |

### The process rulings

| #      | Settled                                                                                                                                                                                |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WLQ-18 | Queued ward requests are filed straight into the Ward Flow ledger.                                                                                                                     |
| WLQ-19 | Revisit ED-to-community referral routing when the community referral screens are next rebuilt.                                                                                         |
| WLQ-20 | The lost community questions are reconstructed from the code and brought back with one recommendation each.                                                                            |
| —      | **Standing instruction, 2026-09-14:** the chat the owner is talking to leads this project; other sessions are workers it directs. Ward Flow's own chat-coordination notes are retired. |

---

## 3. What Ward Lead settled on its own

These were not asked. They are recorded here so the owner can overturn any of them.

### Recorded as assumptions at the time

1. The coordinator's placement panel may show the patient it is placing — bounded to that one
   referral's person, coordinator only.
2. Patient search offers Voluntary, Involuntary, and each recordable form under its register
   title. A queued referral matches no legal filter. The Form 5A chip is gone.
3. A high-acuity pull into a full ward is refused unless the coordinator picks one of the five
   existing override reasons.
4. The retired chat-control documents were kept with a notice rather than deleted.

### Judgement calls made while building

5. The acuity check was deliberately **not** added to the main suitability gates — doing so would
   have made a different, static question overridable.
6. Under WLQ-4, nothing happens automatically once transport is committed: no bed refund, no
   deletion, and the movement is deliberately **not** closed, because closing it would block every
   action that could finish the release. A visible flag is added instead.
7. That flag was reworded to "Awaiting a coordinator to release the bed, because the examination
   was revoked" — the first wording instructed an act the app refuses once a patient has been
   collected.
8. The capacity screen says "oldest was expected", not "held up since". Nothing records when a
   release _became_ held up, so the second would claim a fact the data does not hold.
9. The three transport-stop reasons were written by Ward Lead: "The examination was revoked",
   "The referral was withdrawn", "The receiving ward can no longer take the patient".
10. "The referrer" is scoped by **role alone**, because no ED event carries which ED is acting.
11. The bed-release logic was pulled into one shared function rather than copied three times, and
    the refund gated on the movement's stage rather than its admission id — which fixed a real bug
    the first draft had introduced.
12. One new small-text occurrence was ruled a token remap, not a floor violation, and pinned.
13. Three uncommitted drawings were registered as references so the screen map would stop flagging
    them, without promoting any of them to "the design".
14. **WLQ-23 was refused, not built.** The question described the event wrongly, so renaming would
    have written a false claim into the code. It was raised back as WLQ-37, and the owner then
    agreed to leave the names.
15. The community half of WLQ-11 was handed back rather than guessed at.
16. Before WLQ-1 was ruled, a 1,398-line "master ledger" appended by an outside session was removed
    — it had pre-filled approval on twelve decisions the owner never made, three of them
    contradicting rulings he had already given — and the Patient search drawing was restored to its
    committed version.
17. A commit that wrongly claimed three test files passed was corrected by the next commit, which
    says so plainly.

---

## 4. What was built

Eight fixes to the ward engine — roughly 700 lines of engine and 1,700 lines of tests.

1. **High-acuity staffing was ignored.** A ward staffed for one high-acuity patient could have any
   number pulled into it. Now refused without an override reason.
2. **Withdrawn referrals stayed actionable.** A destination the referrer had withdrawn could still
   be accepted or declined. Both now refused.
3. **A bed could be taken twice.** Stepping a pulled patient back and pulling again created a
   second admission and took a second bed. Now refused.
4. **A phantom occupant.** Revoking an examination on a pulled bed gave the bed back to the count
   but left the admission standing, so the board showed somebody in a bed the count called free.
   Now cleaned up.
5. **WLQ-4 built.** Once transport is committed the bed is not given back automatically; a flag
   appears and the coordinator releases it deliberately.
6. **WLQ-11 built (ward half).** Transport now records who booked it, so the booking ward can
   cancel its own job while the receiving ward still cannot.
7. **WLQ-38 built.** A referral can be revoked after a ward has accepted, and a new stop-transport
   action covers a patient already collected — releasing the bed once and telling the receiving
   ward.
8. **WLQ-5 built.** One plain sentence beside the booking control when no Form 4A is recorded.

Two screen corrections came with them. Patient search was showing "Form 1A (ED 24h)" and "Form 5A
(Involuntary)" — the first tied the ED clock to a legal form, which the model forbids; the second
mislabelled a Community Treatment Order. And the capacity screen was calling a held-up discharge
"excluded from today's figures" while still counting it.

### Two warnings that travel with this work

- ⚠️ **Any ED session can act as the referrer.** There is no way to tell one ED from another, so the
  permission is by role only.
- ⚠️ **No screen has a button for revoke or stop yet.** Both work in the engine and are proven by
  test, but nobody can press them.

---

## 5. What was deliberately not built

- **The gender bed check (WLQ-6)** is planned, not wired. Only 1 of 259 occupied beds and 0 of 50
  movements link to a person, so switching it on would leave nobody placeable. It lands with the
  person links. Design: `docs/ward-flow/plans/2026-09-15-gender-decides-both-bed-checks.md`.
- **The community half of WLQ-11.** No event carries which community team is acting.
- **WLQ-23's rename**, for the reason in section 3.

Four questions turned out to be **already true**, so nothing was built: the referral already
records the sending team, the community decline reasons already exclude withdrawal, no "Due within
2 hours" tile exists, and the unused referral state was already gone.

---

## 6. Still waiting on the owner

1. **Is Ward Flow a regulated medical device?** Someone outside this project must answer. Screens
   currently say it is not.
2. **Who commissions the Aboriginal cultural safety review, and when?** A hard gate before any
   real-patient use. It cannot be done inside this project.
3. **Which of the six capacity figures does a coordinator not use?** He agreed one should go; none
   has been named.
4. **Should a legal-status change record who holds statutory authority, not only the role?**
   Deferred, not this phase.
5. **The real catchment data**, which he said he would confirm later.
6. **Which small text is clinical and which is decoration** — due before any real coordinator sees
   the app.

---

## 7. The one thing that must be handled deliberately

WLQ-1 settled that the approved drawings stay the design and the rewrites must not replace them
when work is folded together. **That has not been carried out.** As of 2026-09-16:

- In the `ward-lead` working folder, **fifteen drawings on disk are 80–95% smaller than their
  approved versions** — legal forms is down from about 12,200 lines to 1,000, discharges from
  11,800 to 760. That is the rewrite, sitting uncommitted.
- The same rewrites also sit on the `ward/lead-fixes-20260914` branch, which was built on top of a
  snapshot of that working folder. Only Patient search was restored there.

So whichever way the two are brought together, the approved drawings have to be put back on
purpose. Nothing does it automatically, and no test will catch it.

---

## 8. Where everything lives

| What                                    | Where                                                                                       |
| --------------------------------------- | ------------------------------------------------------------------------------------------- |
| The ward line (last moved 12 September) | branch `codex/task-ward-flow-live-state-20260831`, folder `D:\Worktrees\Database\ward-lead` |
| The 34 commits described here           | branch `ward/lead-fixes-20260914`, folder `D:\Worktrees\Database\ward-fixes`                |
| Backups of the loose working folder     | branches `ward/snapshot-2026-09-14` and `ward/snapshot-2026-09-15`                          |
| Every owner answer, verbatim            | `docs/ward-flow/owner-decisions-2026-09-15.md`                                              |
| The question list and its status        | `docs/ward-flow-ledger.md` §B                                                               |

**Measured 2026-09-16 by the session writing this document:** all 8,625 files in the 15 September
backup are present in the `ward-lead` folder; none is missing. Of the 659 files the 34 commits
touched, 581 are already identical in `ward-lead`; 78 differ, of which 21 are simply older here and
48 carry local edits.

**Ward Flow is never pushed to a remote, so both branches exist on this disk alone.**
