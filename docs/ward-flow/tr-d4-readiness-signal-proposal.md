# `TR-D4` — the transport readiness signal: proposal

**From:** Ward Builder Two · **To:** Ward Lead · **Date:** 2026-09-06
**Status:** PROPOSAL. **Nothing is built. No reducer event has been written**, per the instruction
that this goes to Ward Lead first.

**The two questions asked:** who may signal readiness, and what happens when a ward signals ready
and then cannot honour it.

**Everything below marked MEASURED was run against the real reducer from `seedWardFlowState()` and
the output read back.** Everything marked READ is a direct quotation from source. Nothing here is
inferred from a document.

---

## The headline, which changes the shape of the work

> ⚠️ **The readiness signal already exists. It is `PULL_PATIENT`. What does not exist is the
> PROMPT — and `TR-D4`'s own wording is about the prompt, not the signal.**

`TR-D4` says: _"THE RECEIVING WARD NOTIFIES THE REFERRING CLINICIAN WHEN TO BOOK."_ The
2026-09-06 status audit reads that as _"no mechanism at all"_ and says _"The middle step does not
exist."_ **The first half of that is right and the second half is not**, and the difference decides
whether this build adds an event or a screen.

**MEASURED — the sequence `TR-D4` describes is already enforced in the reducer:**

| `TR-D4`'s step         | What exists                                     | Enforcement                                                                     |
| ---------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------- |
| ward accepts           | `ACCEPT_IN_PRINCIPLE` → `accepted_awaiting_bed` | role `["ward"]`                                                                 |
| **ward signals ready** | **`PULL_PATIENT` → `pulled`**                   | role `["ward", "coordinator"]`; refused unless stage is `accepted_awaiting_bed` |
| sending team books     | `BOOK_TRANSPORT`                                | **refused unless `movement.stage === "pulled"`** — READ, `ward-flow-reducer.ts` |
| patient leaves         | `HANDOVER_READY` → `moving` → `arrived`         | job stays on the sending board throughout                                       |

**The sending team literally cannot book before the ward has pulled.** The ordering `TR-D1` needed
is not a convention anybody could forget — it is a refusal.

And `PULL_PATIENT` is a far stronger readiness claim than a bare signal would be. It is refused
when the ward has no allocatable bed, refused when _"every free bed … is still being made ready"_
(owner ruling, 2026-09-01: _"a pull cannot occur unless the bed is actually available and open, not
pending"_), and refused when a one-to-one patient would exhaust the ward's specialling capacity.

### So my recommendation on the first question

> **Who may signal readiness: nobody new. `PULL_PATIENT` is the signal, and it stays exactly as it
> is.**

⚠️ **A new `SIGNAL_READY` event would be a second act meaning the same thing as `PULL_PATIENT`** —
two places for one fact, on a project whose ledger rule is the opposite, and on the one screen where
a coordinator decides whether a bed exists. It would also be strictly weaker than the act it
duplicated, because none of the three refusals above would apply to it. A ward could then "signal
ready" against a bed still being cleaned, which is the exact thing the owner overruled.

**What to build is the notification.** Three specific gaps, below.

---

## 🔴 The answer to the second question is a live defect, and it is worse than a stale record

**The scenario Ward Lead asked about — a ward signals ready and then cannot honour it — is
`RELEASE_PULL`, which exists, is ward-and-coordinator, and takes a reason from
`RELEASE_PULL_REASONS`.** So the unwinding act is built. What it does not do is the problem.

**MEASURED, one run, real reducer, WF-003:**

| Step                                                            | Result                                                                           |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `PULL_PATIENT` (ward)                                           | stage `pulled`                                                                   |
| `BOOK_TRANSPORT` (ed, "Patient transport service", escort true) | stage stays `pulled`, job created                                                |
| `RELEASE_PULL` (ward, `bed_needed_for_another_patient`)         | stage `accepted_awaiting_bed`, `pullExpiresAt` cleared, bed returned to the ward |
| **the transport job**                                           | **`"Patient transport service"` — SURVIVES, untouched**                          |
| `PULL_PATIENT` again                                            | stage `pulled`                                                                   |
| `BOOK_TRANSPORT` again, different provider                      | **REFUSED: `"transport for movement WF-003 is already booked"`**                 |
| provider after that attempt                                     | still `"Patient transport service"` — the stale one                              |

**So the ward gives the bed away, and an ambulance stays booked for a bed that no longer exists.**
The movement's own record still names a provider coming to collect a patient who has nowhere to go.

**And the stale job then blocks the correct one.** When the ward finds another bed and re-pulls, the
sending team cannot book, because `BOOK_TRANSPORT` refuses a second job — correctly, since replacing
a job a provider may already have accepted would destroy its acceptance timestamps. The route out is
`CANCEL_TRANSPORT` first.

### ⚠️ And the team that must clear it may not be allowed to

**READ, `ward-flow-events.ts`:**

- `BOOK_TRANSPORT: ["ed", "ward", "community"]`
- `CANCEL_TRANSPORT: ["coordinator", "ed"]`

**MEASURED — both refusals, verbatim from the reducer:**

- `"CANCEL_TRANSPORT requires role coordinator or ed, but was raised by role ward"`
- `"CANCEL_TRANSPORT requires role coordinator or ed, but was raised by role community"`

**A ward or a community team can book transport and cannot cancel it.** For a ward-to-ward transfer
or a community-initiated move, the sending team is locked out of undoing its own booking and has to
find a coordinator — while the record shows a live job. `TR-D5` is explicit that a ward books too
and not only an emergency department, so this is not a theoretical role.

---

## What I propose building, smallest first

**None of this is started.** Each item names what it changes and what would prove it.

### 1. `RELEASE_PULL` must decide what happens to a booked job — ⚠️ THIS IS A DECISION FOR YOU

The reducer comment on `RELEASE_PULL` says it performs _"the EXACT inverse of `PULL_PATIENT`'s own
writes (ruling P4-1) — every field `PULL_PATIENT` sets, undone, and nothing else touched."_ **That
rule is why the transport job survives, and it was a good rule written before booking could follow a
pull.** So this is not an oversight to patch quietly; it is a ruling meeting a case it did not
cover.

**Three options, and I recommend the third:**

1. **Cancel the job inside `RELEASE_PULL`.** Simplest, and wrong: it makes one act silently do two,
   and destroys a provider's acceptance without the provider being told — the exact thing
   `BOOK_TRANSPORT`'s own comment refuses to do.
2. **Refuse `RELEASE_PULL` while a job exists.** Honest but harmful: the bed is already gone in
   reality, and a refusal does not un-give it. _A rule that cannot be overridden does not stop the
   event; it stops the record of it_ — this project's own words.
3. ✅ **Let the release proceed, and make the orphaned job loud.** The release is a fact; the job is
   now a thing somebody must ring off. Record it, surface it at the top of the sending team's
   screen, and let a person cancel it deliberately. **This keeps every existing ruling intact and
   adds no new authority.**

**With, in the same change, the role fix:** `CANCEL_TRANSPORT` gains `"ward"` and `"community"`, so
whoever `BOOK_TRANSPORT` allows to create a job can also clear it. ⚠️ **I have NOT made this change
and am not proposing to make it without your word** — widening a role gate is exactly the kind of
decision my brief does not cover.

### 2. The prompt itself — the actual `TR-D4` gap

When the ward pulls, **nothing tells the sending team to book.** That is the mitigation `TR-D1`
was promised and never got, and it is a screen, not an event: the pull is already recorded with a
time, so the sending team's board can say _"the ward has a bed ready — book transport"_ from the
record that exists today. **No new event, no new field.**

### 3. The pull expiry is displayed and acted on by nothing

`pullExpiresAt` is set 60 minutes ahead by `PULL_PATIENT`. The movement workspace renders the
expired state well — _"The pull on that bed ran out at 10:32 — 10m overdue. Unless the ward has kept
it anyway, nothing is being kept for this patient"_ — which is honest, and passive. **A pull running
out is the second half of "signalled ready, then could not honour it": the ward has not withdrawn
anything, it has simply stopped holding.** Whether an expiry should prompt anybody is a design
question I am not answering here; I am recording that today it prompts nobody.

---

## What I have deliberately not done

- **No reducer event written**, per the instruction.
- **No role gate widened.** Item 1's second half is a proposal.
- **No wording invented for a ward-facing readiness notice.** `RELEASE_PULL_REASONS` is a ward-read
  list; whether a prompt reuses it is yours to settle.
- **No claim that the status audit was wrong.** Its conclusion — that `TR-D4` is the one to act on,
  because it is the unbuilt mitigation for a cost that shipped — is right, and it is why this was
  looked at. Only the middle sentence needs correcting, and only because it changes the build.
