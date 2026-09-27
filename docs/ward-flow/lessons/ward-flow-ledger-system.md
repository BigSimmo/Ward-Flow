---
name: ward-flow-ledger-system
description: "Ward Flow's single tracking ledger and its twelve rules — where decisions, open questions and refusals live, and why"
metadata:
  node_type: memory
  type: project
  originSessionId: a4cba676-33d6-41bc-b103-192a7416261b
  modified: 2026-08-29T05:35:51.565Z
---

Ward Flow tracks everything cross-cutting in **`docs/ward-flow-ledger.md`** (created 2026-08-29 on
branch `claude/Ward-design`, commit `506d77c33`). It holds **identity and status only** — mission,
open questions owed by the owner, items owed by the build, a 93-row decision index, permanent
refusals with their reasons, risks, and branch state. **Reasoning stays in the specs.**

**Why:** the project records decisions faster than anything tracked them. A design sweep on
2026-08-29 found four faults, all invisible to every gate — decision IDs collide (every ID from D4 to
D9 names five different decisions); WB-DB-10 and WB-DB-11 contradict each other with neither marking
the other; a free-text field escalated to the owner on 2026-08-25 sat on no list for four days; and
the "still owed" list showed an item answered ninety minutes earlier.

**How to apply:** before recording any Ward Flow decision, cite by namespaced ID (`P6-D5`, never a
bare `D3`), state what it supersedes even if nothing, and update the superseded entry in the same
edit. Quote the prior decision's own words when reversing one — if they are not in the decision you
cited, you cited the wrong one. Register a question in the ledger the moment it is escalated to the
owner. Section C is generated from the specs, never hand-maintained; the command is in the file.
The ledger reports and never decides — where it and a spec disagree, the spec wins.

**Identity is owned by ONE session (owner ruling, 2026-08-29).** That session assigns every decision
number; everyone else cites. Two series exist and no third may be opened: product decisions (`WB-`,
`WB-DB-`, `P3-`…`P8-`, `MET-`) live in the specs; process decisions (`PROC-`) in the process
documents. Section G of the ledger is the identity register — it records assigned-but-unwritten
numbers so the gap between a number existing and its reasoning being written stays visible, and it
lists burned numbers. **A withdrawn number is burned, never reused:** `WB-DB-15` was broadcast to two
sessions for a draft that was then withdrawn, the spec later used `DB-15` for a different decision,
and the old reference silently resolved to the wrong one.

**Concurrent sessions independently write the SAME document, and nothing structural catches it.**
Twice on 2026-08-29: two decision registers, then two clinician-check method pages with four
identical sections under different names. The second was written by the session that had authored the
rule against it that morning — so it is not carelessness. A session working alone with a clear idea
writes the natural document for that idea, and the idea supplies no signal that anyone else is having
it. Neither the ledger nor the numbering rule detected either one. **A message did, both times** —
announcing what you just wrote, in enough detail that another session recognises its own document in
the description. That is the only defence that has demonstrably worked.

**Four times on 2026-08-29 two sessions disagreed about a plain fact and both were right** — one had
read a document before it was corrected and one after; one counted routes on its own branch and one on
another; one read what the docs say about a lint rule and one read the config. Each looked like a
disagreement about fact and was a disagreement about _when_, _where_, or _which artefact_. Pin a
quotation to a commit, say which branch, and read the config rather than prose about the config.

**A CHECK THAT PICKS ONE CANDIDATE CANNOT REPORT THAT IT PICKED THE WRONG ONE** (rule 12, 2026-08-30).
`head -1`, "the first match", "the obvious file" — each discards the alternatives and returns a
confident answer about something you did not ask about, with no error and no ambiguity marker. A
re-check of a peer's evidence returned 0 on every branch and was about to call its verified claim
false; the pattern matched **two** files and `head -1` took the one **added by the very commit under
examination**. So landing a fix displaced the check for the fix. **Print every match before using one;
if the count is not 1, the question is not properly asked.** Same defect as the worktree registry's
branch-name trap in prose form: _a check phrased "which of these is it?" cannot answer "none of
them", and one phrased "take the first" cannot answer "there were two"._

**A FINDING'S STATE IS PER-REF UNTIL IT REACHES THE WORKING LINE** (R26, open). One OPEN/CLOSED column
cannot express "fixed on an unmerged branch AND live on the line everyone reads" — two sessions held
those two states, both accurate about different refs, and burned hours reconciling. **The states need
different actions: fixed-elsewhere needs a MERGE, never-fixed needs a BUILD.** Compounds the
SHA-pinning rule, since a per-ref status without its SHA is unfalsifiable twice over.

**The expiry rule is hardest to apply to a finding you are pleased with.** Both sessions in that
exchange checked the _other's_ claim sceptically and their own not at all — and the sceptical check
was itself broken in the direction that would have confirmed its author. **Scepticism aimed at the
other session is not the safeguard; the check that cannot be narrower than the question is.**

**Namespaces now: `WB-`, `WB-DB-`, `P3-`…`P9-`, `MET-`, `FD-` (referral front door), `PD-`
(person data — what identifiable information any record may hold), `CM-` (catchment), `PROC-`.**
A series opens deliberately with a stated boundary and only when no existing one fits.

**TWO GROUP A REFUSALS WERE REVERSED BY THE OWNER ON 2026-08-30** — free text on the referral
(exactly ONE story field, labelled, optional, last, never feeding eligibility/matching/ranking), and
person data (name, UMRN, dob, age permitted; **`address` and narrative `history` stay closed**).
**Record a reversal AS a reversal, never as the refusal own escape route being met** — the free-text
refusal offered a governed alternative with retention, access control and audit, and a prototype
story field is none of those. **A register that cannot say a rule was broken is not a register.**
Widen a guard by adding a NAMED allowlist entry carrying owner, date and reason; never by deleting a
stem. ⚠️ **Boundary distinction (ledger allowlist vs test scanner exemption):** A named allowlist entry
in the governance ledger or a status register is permitted when widening an operational policy. In
contrast, adding silent checker exemptions to silence a test scanner is forbidden (see
[[wrong-on-purpose-and-load-bearing]] and [[self-invalidating-pins]]); a test exemption must carry its
own self-invalidating test. And **a ruling that widens a boundary gets read afterwards as widening the PRINCIPLE** — a
suburb is not an address, and the entries most at risk are those sounding like a rounding error from
what was permitted.

**RE-OPENING A SETTLED DECISION IS WORSE THAN MISSING WORK: missing work looks like a gap, and
re-opening looks like diligence.** It happened to the coordinator because an owner answer lived in a
thread it was not in — and a re-opened decision **drifts toward the cheaper build**, which is the
shape that most needs a signature rather than a silence. **Remedy, and it is the argument for the
ledger existing: owner answers belong in the ledger, and a coordinator reads there before asking.**

**AGREEMENTS MADE IN MESSAGES DO NOT SURVIVE THE SESSION THAT MADE THEM.** A coordinator that lost
context could see eight commits on a branch and not know what any of them were, having coordinated
all evening by message. **Git holds artefacts, not agreements.** The allocation belongs in a file —
and note `worktree-ownership.md` has TWO tables, so being in the chat-identity one is not being in
the ownership one; **a whole-file presence check answered the wrong question and returned success.**

Related: [[ward-flow-coordination-state]], [[ward-flow-verification-lessons]],
[[ledger-rows-lag-reality]], [[measure-the-thing-not-a-proxy]],
[[assert-only-about-code-you-opened]].
