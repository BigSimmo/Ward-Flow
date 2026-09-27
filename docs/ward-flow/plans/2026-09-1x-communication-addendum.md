# Communication — addendum to the third-edition master build plan

**Path claimed by Ward Lead** (master plan §3.4 discipline). Authorised by owner ruling **D-2**,
2026-09-10 (`docs/ward-flow/owner-decisions-2026-09-1x.md`). Built in **Phase 1, by Ward Lead, on
the line** — it touches the model, the reducer and the shell, which no lane may edit.

---

## 0 · 🔴 The premise this was commissioned on is not quite right, and the difference changes the build

The master plan's §7.1 item 1 says, and the owner repeated back:

> _"There is no message, alert or inbox anywhere."_

**Measured at `31e8e67985` by reading source, not documents — there IS an inbox, and it is
substantial:**

    src/components/ward-management/ward-derivations.ts:984
      buildActionInbox(movements, now, units): InboxItem[]

    reducer actions, all three present and implemented:
      ACKNOWLEDGE_INBOX_ITEM   COMPLETE_INBOX_ITEM   REOPEN_INBOX_ITEM

    read by 9 call sites, including ward-chrome-header.tsx, ward-tasks-drawer.tsx,
    ward-tasks-panel.tsx, coordinator-screen.tsx and ward-sidebar-content.tsx

⚠️ **So the instruction must not be executed literally.** Building "an inbox" beside this one
produces two inboxes, two tallies that disagree, and two places a coordinator must look — the
duplicated-effort failure that is invisible by construction, because nothing conflicts and both
pass.

### What the existing inbox actually is, and precisely what it cannot do

`buildActionInbox` is **the coordinator's work list, derived from movement state**. Its own doc
comment is explicit: _"Every item here is computed from real movement fields — nothing is
authored."_

    InboxItem = { id, tone, icon, title, detail, owner, movementId, kind }

Three properties decide this design:

1. 🔴 **There is no addressee.** `owner` is a display string, not an address. Nothing in the type
   names a role, and nothing filters by one.
2. 🔴 **It is coordinator-only, deliberately.** `ward-flow-events.ts:1418` — _"COORDINATOR-ONLY, ALL
   THREE."_ No other role has an inbox at all.
3. 🔴 **Nothing can be put into it.** It is a pure derivation over `movements` and `units`. A fact
   about a decision that is not a movement field cannot appear in it, and `ACKNOWLEDGE_INBOX_ITEM`
   is pinned by its own test to leave `buildActionInbox`'s output **byte-for-byte identical**.

**Therefore the owner's finding stands, and stands for the right reason:** the system can compute
what the coordinator should do next, and it **cannot tell anybody anything**. A ward that declines,
a coordinator that cancels a pull, an ED whose referral was accepted — none of those reaches the
person who needs to know. `RELEASE_PULL` exists and changes state; nothing carries the news.

**Ruling: EXTEND, never duplicate.** One inbox surface, two sources — the derived work list that
exists, and the addressed notices this addendum adds. **Cost if wrong:** one module and one drawer,
not sixteen screens, because every screen reads it through the facade.

---

## 1 · What is built

### 1.1 The notice — an authored, addressed fact

A second, **stored** list beside the derived one. Authored, because "the referrer was told" is not
derivable from movement state: it is a consequence of a decision at a moment.

    Notice = {
      id            stable, derived from (subject, kind, count) — never a module counter,
                    which would break reducer purity (the existing id rule, reducer:558)
      raisedAt      Instant from the clock. Nothing calls Date.now()
      to            Addressee — see 1.2
      about         { movementId? referralId? patientId? unitId? }
      kind          NoticeKind — a closed union, exhaustive, like WardFlowRole
      sentence      the words a person reads, TRUE READ ALONE
      readAt        Instant | undefined
    }

⚠️ **`sentence` is stored, not derived at render.** A notice is a record of what somebody was told
at a time. Re-deriving the words later would silently rewrite history when the underlying state
moves on — and the state always moves on, because that is what generated the notice.

### 1.2 The addressee — D-2's ruling, made concrete

    Addressee = { role: WardFlowRole; placeId?: string }

`WardFlowRole` already exists and is already exhaustive by design:
`coordinator | ed | ward | officer | demo | community`.

**A notice is seen when the viewer is in that role**, through the role switcher the app already has
— which moves to the Tools drawer under **Q-7**. `placeId` narrows a role to one ward, one ED or one
team, so a ward sees its own notices and not every ward's.

🔴 **No user, no account, no person-who-logs-in is created.** The plan's §7.1 item 2 — _"nobody is
anybody"_ — was **not** answered by the owner, and inventing an identity model would answer a
use-gate question with privacy consequences that nobody asked. **A builder who finds themselves
needing a user record has left this addendum and must hand it back.**

⚠️ **`demo` is a role in that union and must never receive a notice.** It is the demonstration
harness, not a person. Exhaustiveness over the union will offer it; refuse it in the reducer, not in
a screen.

### 1.3 Where notices come from

**Generated inside the reducer, from decisions that already happen** — never authored by a screen,
never typed by a user. This phase covers exactly the cases an existing ruling already requires, and
no more:

| The decision                             | Who is told                         | Why it is required                                                         |
| ---------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------- |
| `RELEASE_PULL` — a bed pull is cancelled | the referrer of that referral       | 🔴 The named ruling. A referrer not told goes on believing a bed is coming |
| `DECLINE_REFERRAL` / `DECLINE`           | the referrer                        | `FD-23` — a team sees the decline reason **for its own referrals only**    |
| `ACCEPT_IN_PRINCIPLE`                    | the referrer                        | the answer to the question they asked                                      |
| `ACCEPT_REFERRAL`                        | the referrer and the receiving ward | both sides of a commitment                                                 |
| `CANCEL_TRANSPORT`                       | the officer and the receiving ward  | somebody is expecting a person who is no longer coming                     |
| `WITHDRAW_REFERRAL` after acceptance     | the accepting ward                  | owner ruling `WLQ-38`, 2026-09-15 — the referral it said yes to is revoked |
| `STOP_TRANSPORT` (after collection)      | the receiving ward                  | owner ruling `WLQ-38`, 2026-09-15 — a journey already under way is stopped |

**Added 2026-09-15 by owner ruling, not by a builder.** `WLQ-38` (`owner-decisions-2026-09-15.md`) let the
referrer and the coordinator revoke an accepted referral and stop a collected transport, with the ward told.
The two rows above are that ruling, and the `NoticeKind` union carries them.

⚠️ **`FD-23` is a privacy rule, not a display preference.** The decline notice carries its reason to
the referrer of _that_ referral and to nobody else. A notice list that leaks another team's decline
reason is a defect, not a nicety — and it is the kind that passes every test that only counts rows.

⚠️ **Nothing else generates a notice in this phase.** A case not in the table above, and not carried by a
recorded owner ruling, is a stop-and-hand-back.

### 1.4 Where it is seen

**In the existing shell drawer, beside the derived work list — one surface.** The third-edition bar
carries Activity / Tasks / Tools (master plan §1.3). Notices join **Tasks**, visually separated and
labelled, so a coordinator has one place to look.

⚠️ **The two lists must never be summed into one tally without saying so.** A derived fact
("transport accepted, not departed") and an addressed notice ("your pull was cancelled") are
different things; one number over both, unlabelled, is a figure whose unit nobody can state.

---

## 2 · The catcher

`tests/ward-notices.test.ts` — path claimed here, created by Ward Lead's Phase 1 agents.

    1  each of the five decisions above produces exactly one notice, addressed to the named role
    2  a decision NOT in the table produces none — the anti-vacuity floor, so the test cannot
       pass by generating nothing
    3  FD-23: a decline notice reaches that referral's referrer and NO other team, proved by a
       second team in the same state reading zero
    4  the demo role never receives a notice, over every member of WardFlowRole
    5  buildActionInbox's output is byte-for-byte identical before and after any notice event —
       the existing pin, extended: the derived list must not move when the authored one does
    6  a notice's sentence is stored, and re-reading it after the underlying state changes
       returns the ORIGINAL words
    7  reducer purity: the same (state, event) twice produces identical notice ids

⚠️ **Point 5 is the one that catches the duplicate-inbox failure**, and point 2 is the one that
catches a test that passes because nothing happened.

---

## 3 · What this does NOT do, recorded so no one reads silence as a claim

- **It does not deliver anything outside the browser.** No email, no SMS, no push, no integration.
  A notice is seen by switching role in one demonstration.
- **It does not tell a real person anything.** Nothing here moves the three real-patient gates, and
  a demonstration of telling is not telling.
- **It does not persist.** A reload wipes notices with everything else — **Q-8**, answered: leave
  it this phase.
- **It does not create an identity model**, per 1.2.
- **It does not decide what a notice looks like.** No drawing shows one. The words follow the
  standard's rules — words before colour, true read alone, invented figures marked — and the visual
  treatment is the existing drawer's. **If a drawing for notices is wanted, that is Ward Mockups'
  and the owner's, not a builder's invention.**
