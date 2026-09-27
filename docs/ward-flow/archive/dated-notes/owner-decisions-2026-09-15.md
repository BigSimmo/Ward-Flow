# Owner decisions, 2026-09-15 — the thirty-three questions

**Recorded by Ward Lead.** The questions were put as one list, each with one recommendation, in the
ledger (`docs/ward-flow-ledger.md` §B, "Owed by the owner — the complete list, 2026-09-15 (`WLQ-`)").
The owner answered all thirty-three in one message. **His answer is quoted verbatim beside each; the
question as put is summarised beside it so the answer is never applied to a different question.**
Each ID below is the `WLQ-` ID the question carried, so a citation leads back to the question.

🔴 **The owner answered by the numbers in the chat list, and for items 18 to 27 that list was ordered
differently from the ledger.** Items 1–17 and 28–33 are the same in both. For the rest:

    chat 18 = WLQ-22    chat 19 = WLQ-21    chat 20 = WLQ-25    chat 21 = WLQ-27    chat 22 = WLQ-18
    chat 23 = WLQ-19    chat 24 = WLQ-20    chat 25 = WLQ-23    chat 26 = WLQ-24    chat 27 = WLQ-26

**Every answer below is recorded against the question it answered by CONTENT**, checked item by item
(for example his "Drop it" was chat 19, the "Due within 2 hours" tile, which is `WLQ-21`). Some
2026-09-15 worker briefs and commit messages cite chat numbers for items 18–27; read them through this
table. Found by a research worker that cross-checked the IDs it was given, not by the chat that wrote them.

**Standing instruction given the same day, recorded because it changes how every item below is run:**
the chat the owner is talking to is Ward Lead; other sessions are workers it directs; Ward Flow's own
notes about chat coordination are retired. This supersedes `D-5` in
`owner-decisions-2026-09-12-routing-and-nine-flags.md` ("protected-work deletions come to Ward Verifier
first") for Ward Flow: protected deletions now come to the owner through Ward Lead.

---

## WLQ-1 · Keep the approved drawings

**Asked:** an outside tool rewrote twelve approved drawings and the Patient search drawing, and added two
new drawings; keep the approved drawings until the new ones are compared side by side?
**OWNER: "Keep approved"**
The committed drawings remain the design. The rewrites are preserved in `ward/snapshot-2026-09-14` and
must not replace the committed drawings when the working tree is folded.

## WLQ-2 · A forensic unit is NOT excluded from ordinary bed matching

**Asked:** exclude forensic units from ordinary matching? Recommended no — show the flag as a ward fact
(`D-30`) and let the coordinator decide.
**OWNER: "No as you recommend"**

## WLQ-3 · The `security` (locked bed) gate is overridable, with a recorded reason

**Asked:** may a named coordinator override the locked-bed gate with a reason, as authorisation now can?
**OWNER: "Yes As you recommend"**
The reasoning is `D-9`'s: a gate nobody can override does not stop the placement under pressure, it stops
the placement being recorded. Closes the question `D-9` deliberately left open.

## WLQ-4 · A revoked examination after transport is booked does NOT release the bed automatically

Refined 17 Sept 2026 by `docs/ward-flow/owner-answers-2026-09-17.md` item 6: keep the bed flagged; a person decides whether to release it. R2-5 adds that collection is refused while the withdrawn examination holds the bed.

**Asked:** when an examination is revoked after transport is booked or the patient is moving, keep the
bed and flag it so the coordinator cancels the transport and releases the bed?
**OWNER: "Don’t release, As you recommend,"**

## WLQ-5 · Booking transport for an involuntary patient with no Form 4A recorded: a warning, never a block

**OWNER: "Yes As you recommend"**
Consistent with the 2026-08-24 instruction to avoid hard rules on legal forms. The warning states what the
record holds; it never states what the Act requires and carries no duration.

## WLQ-6 · Once beds are linked to people, gender decides both bed checks

Superseded 17 Sept 2026 by `docs/ward-flow/owner-answers-2026-09-17.md` item 8: gender is recorded at referral and checked now, not "once beds are linked to people".

**Asked:** once a bed can be linked to a person, should the bay-mix check read gender as well as the
bed-type check — built together with its privacy guard (`D-14`)?
**OWNER: "Yes As you recommend"**
Ratifies `D-5` ("gender reaches both bed gates or neither") as the owner's own ruling.

## WLQ-7 · The Patient screen does not show the person's current movement yet

**OWNER: "Ok, As you recommend"** — `D-17` stands until role enforcement reaches that screen.

## WLQ-8 · The regulatory (medical device) question is left for now

**OWNER: "Leave it for now"** — still a gate before any real clinical use; not needed for the prototype.

## WLQ-9 · The Aboriginal cultural safety review: the owner will commission it

**OWNER: "Me later"** — the owner is the named commissioner. Still a hard gate before real-patient use
(`R-2026-09-04-I`).

## WLQ-10 · A held-up discharge keeps counting in its ward's held-up figure while it is held up, and shows since when

**OWNER: "Yes As you recommend"**

## WLQ-11 · Whoever booked transport may cancel it; the receiving ward still may not

**OWNER: "Yes As you recommend"** — closes ledger `Q10`.

## WLQ-12 · A referral records the team or service that sent it; no decline notification is built yet

**OWNER: "Yes As you recommend"** — answers `owner-question-2026-09-11-who-sent-the-referral.md`.

## WLQ-13 · Withdrawal by the referrer is its own record, never a decline reason

**OWNER: "Yes As you recommend"** — `O-17.11` wins the collision with `O-16.6`
(`lessons/two-rulings-that-collide.md`).

## WLQ-14 · The ED access-block clock starts when the referral is received; medical clearance is shown as its own time

**OWNER: "Yes As you recommend"** — resolves `R-B-16`.

## WLQ-15 · The unused capacity figure is named later

**OWNER: "Yes for later"** — all six figures stay until he names one.

## WLQ-16 · The ward's constraints box stays free text

Superseded 17 Sept 2026 by `docs/ward-flow/owner-answers-2026-09-17.md` R2-18: the free-text box is replaced with a fixed list.

**OWNER: "No, keep free text As you recommend"**

## WLQ-17 · Which ED hub drawing is the design: deferred

Superseded 17 Sept 2026 by `docs/ward-flow/owner-answers-2026-09-17.md` item 42: the ED "third edition" drawing is the ED drawing.

**OWNER: "Defer"**

## WLQ-18 · The queued ward-side requests are filed straight into the Ward Flow ledger

**OWNER: "Yes As you recommend"** — answers the item `D-11` recorded as still owed.

## WLQ-19 · ED-to-community referral routing is revisited when the community referral screens are next rebuilt

Superseded 17 Sept 2026 by `docs/ward-flow/owner-answers-2026-09-17.md` item 14: ED to community team referral is built now.

**OWNER: "Yes As you recommend"** — gives ledger `Q9` its reopening trigger.

## WLQ-20 · The six community questions are reconstructed from the code, verified, and brought to the owner

**OWNER: "Yes As you recommend"** — the owner's `O-3` / `O-12.3` request.

## WLQ-21 · No "Due within 2 hours" tile

**OWNER: "Drop it As you recommend"** — `D-15`'s three figures stand.

## WLQ-22 · Out of area keeps the primary action already wired on the built screen

**OWNER: "Yes As you recommend"** — answers `O-18.3`.

## WLQ-23 · The withdrawal names are renamed by who withdrew; the two events are never merged

**OWNER: "Yes As you recommend"** — answers `O-18.2`.

## WLQ-24 · `referralState()`'s unproduced fourth value is deleted, after checking it is not unfinished work

**OWNER: "Yes As you recommend"** — answers `O-18.1`.

## WLQ-25 · The legal forms screen is confirmed as built

**OWNER: "Yes As you recommend"** — answers `O-21.2`.

## WLQ-26 · The small-text check is wired, pinned per file, compares file counts, and scans wider

**OWNER: "Yes as you recommend"** — answers `O-21.3`.

## WLQ-27 · Small text is classified as clinical or decoration before a real bed coordinator sees the app

**OWNER: "Yes As you recommend"** — answers `O-21.5`, on `D-10`'s hard trigger.

## WLQ-28 · Recording statutory authority on legal-status changes: deferred

**OWNER: "Defer As you recommend"**

## WLQ-29 · Real catchment data: deferred; catchment stays a note

**OWNER: "Defer As you recommend"**

## WLQ-30 · The coordinator's placement panel shows the patient it is placing

**OWNER: "Keep As you recommend"** — ratifies Ward Lead's 2026-09-14 allowlist entry, bounded as written in
`tests/ward-patient-link-default-deny.test.ts`.

## WLQ-31 · The Patient search legal filter: Voluntary, Involuntary and each recordable form by its register title

**OWNER: "Keep As you recommend"** — a queued referral matches no legal filter; Form 5A is not offered.

## WLQ-32 · A high-acuity pull into a full ward needs one of the existing five override reasons

**OWNER: "Keep As you recommend"**

## WLQ-33 · The retired chat-control machinery is removed once the fixes are folded

**OWNER: "Ok As you recommend"** — `docs/ward-flow/control/`, `scripts/ward-flow/chat-control.mjs` and
their tests go after the fold, as an approved protected deletion.

---

## Implementation status — 2026-09-15, as built on the lead branches

**Every line below says what was built and how it was proven, or why nothing was built.** Workers were Sonnet
(implementation, each change test-first) and one Opus planning pass for `WLQ-6`; Ward Lead reviewed each diff
and re-ran the affected tests itself.

**Built:**

- `WLQ-3` — the engine already classified `security` as overridable; the reason now sits in design standard §8.4.
- `WLQ-4` — at `handover_ready` or `moving`, a revoked examination keeps the bed, the admission and the
  transport, and sets the blocker "Awaiting a coordinator to release the bed, because the examination was
  revoked". The coordinator releases it by stepping the stage back and releasing the pull, which refunds the bed
  exactly once. ⚠️ **Residual, raised as `WLQ-38`:** once the patient is collected, transport cannot be
  cancelled, so a patient whose examination was revoked can still arrive at the ward. ✅ **Built — see
  `WLQ-38`'s own section and "Built 2026-09-15 (engine only)" below: `STOP_TRANSPORT` now exists for
  this exact case.**
- `WLQ-5` — "No Form 4A (Transport order) is recorded for this patient." beside Book transport on the ED screen
  for an involuntary patient without a 4A; booking stays available.
- `WLQ-10` — a held-up discharge was already counted in its ward's Blocked figure however old; the page falsely
  called it excluded, which is fixed. The Blocked cell now reads "oldest was expected {time}" — the record holds
  no time at which a release became held up, so "since" is not claimed.
- `WLQ-11` — **ward half:** the booking ward may cancel transport it booked; the receiving ward and any other
  ward are refused; jobs booked before the ruling keep the coordinator/ED-only rule. **Community half not
  built:** no event carries which community team is acting (R2, no viewer identity), so a community booker
  cannot be told apart from another team. Community cancellation stays with the coordinator and ED.
- `WLQ-14` — the ED access clock already started when the referral is received (`openedAt`, proven against a
  fixture whose raised, triaged and opened times differ); medical clearance now shows as its own row when
  recorded, and no row when not.
- `WLQ-18` — filed in ledger §E. `WLQ-20` — reconstructed: four community questions evidenced, not six; three
  answered in this list; the fourth is `WLQ-34`. `WLQ-26` — the check was already wired, per-file, file-count
  comparing and wider; its baseline was re-pinned from 379 to today's 225 (commit `25161b8123`).
- `WLQ-6` — **planned, not wired**, by the trigger in the ruling itself: 1 of 259 occupied beds and 0 of 50
  movements link to a person today. `plans/2026-09-15-gender-decides-both-bed-checks.md`; `WLQ-35`, `WLQ-36`.

**Already true, so nothing was built:** `WLQ-12` (the referral already records `sendingTeamName`, as a name
because no registry of teams exists), `WLQ-13` (the community decline reasons already exclude withdrawal),
`WLQ-21` (no "Due within 2 hours" tile exists), `WLQ-24` (`REFERRAL_STATES` has three values and all are
produced; `O-18.1`'s fourth value no longer exists).

**Not built, because the question as put was wrong:** `WLQ-23`. The question described `WITHDRAW_REFERRAL` as
the coordinator's act. It is the referrer's — its own documentation says "the referrer takes the referral back",
its only live dispatch is from the ED screen as the ED, and it sits beside `RECORD_REFERRER_WITHDRAWAL` as two
events for the same actor on two different records. Renaming "by actor" would write a false claim into the code.
Raised again as `WLQ-37`.

**Decisions and deferrals with nothing to build:** `WLQ-1`, `2`, `7`, `8`, `9`, `15`, `16`, `17`, `19`
(trigger recorded in ledger `Q9`), `22` (the wired primary already leads), `25`, `27` (on `D-10`'s trigger),
`28`, `29`, `30`, `31`, `32`. `WLQ-33` runs after the fold.

---

## Second set, same day — `WLQ-34` to `WLQ-38`

**Put as five numbered questions, chat 1–5 = `WLQ-34`–`WLQ-38` in order, each with one recommendation.**
**OWNER, verbatim: "Yes to all recommendations except 5… please explain 5 further"**

- **`WLQ-34` · The Mead Centre (Armadale), written four ways across eight suburbs, is ONE community service.**
  Ratifies the agent's grouping in `community/community-ratified-aliases.ts`; its `decidedByKind` becomes the owner's.
- **`WLQ-35` · When gender decides beds, a person with no recorded gender may be placed on a ward that takes
  either gender, and is refused on a single-gender ward until gender is recorded.** Changes test 3 of
  `tests/ward-gender-gate.test.ts` when the gender plan lands.
- **`WLQ-36` · When some occupants' gender is not recorded, the bay-mix check says it cannot tell who is in the
  bay, and a coordinator may override it with a recorded reason after confirming with the ward.** Unknown
  occupants are never counted by sex.
- **`WLQ-37` · The two withdrawal event names stay as they are.** Closes `WLQ-23` and `O-18.2`.
- **`WLQ-38` · The referring doctor, as well as the coordinator, may revoke the referral and stop the transport.** Answered 2026-09-15, built 2026-09-15.

## WLQ-38 · The referring doctor, as well as the coordinator, may revoke the referral and stop the transport

**Asked, after explanation:** a patient whose examination is revoked after collection can still be recorded as
arriving and admitted; let the coordinator record that the transport was stopped, with a reason, releasing the
bed and telling the receiving ward?
**OWNER, verbatim: "This should also be the referring doctors responsibility as well to be able to revoke the
transport as well as referral in addition to the coordinator"**

**What this rules:** two people may act — the coordinator **and the referrer** — and they may revoke **both the
transport and the referral itself**, not only record a stopped journey.

**How Ward Lead builds it, under that ruling** (reversible by the owner):

1. **Who "the referrer" is.** There is no viewer identity (`R2`), so it is scoped by role: the role that raised
   the referral (for a movement, the emergency department it began in; for a community referral, the community
   role). Where the event cannot say which ED or team is acting, the same limit as `WLQ-11`'s community half
   applies and is stated, never guessed.
2. **Revoking the referral after a ward has accepted** is now permitted to the referrer and the coordinator. It
   releases the bed exactly once, cancels any transport not yet collected, closes the movement as not proceeding,
   and tells the accepting ward. This replaces the earlier rule that a withdrawal cannot undo an acceptance.
3. **Stopping a transport after collection** is permitted to the same two, with a reason chosen from a fixed list
   (never free text). It releases the bed, records the transport as stopped, and tells the receiving ward. The
   software records the decision; it never makes it, and it says nothing about what the law allows.

**Built 2026-09-15 (engine only):** `WLQ-34` — the Mead Centre grouping now records the owner as decider
(`df4420e398`). `WLQ-38` — `WITHDRAW_REFERRAL` after acceptance and a new `STOP_TRANSPORT` after collection, for
the coordinator and the `ed` role, with the three fixed stop reasons, the bed refunded exactly once through one
shared helper, and the ward told through two new notice kinds recorded in the communication addendum
(`f4f22eb66f`). Re-run by Ward Lead before merging: 10 files / 212 tests and 5 files / 50 tests passed.
⚠️ **The referrer is scoped by role alone**: ED events carry no acting ED id, so any `ed` session may act, as with
every other ED action (`R2`). ⚠️ **No screen control exists yet** for either action: they work in the engine and are
proven by test, but nobody can press a button for them until the ED and coordinator screens gain one.
