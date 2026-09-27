# Owner decisions, 2026-09-12 (second set) — one new standing rule, and eight flags

**Recorded by Ward Verifier. The question as put is beside each answer.**
**Companion to `owner-decisions-2026-09-12-four-answers.md`.**

🔒 **Added 2026-09-12, Step 4: does this file bind its own author?** D-5's rule below is superseded
by `D-5-protected-deletion-routing-2026-09-12.md`, which is the precedent for this exact question
and is left unchanged here — see that file, not this section, for whether it binds its own author.
D-6 does not bind Ward Verifier: it is a maintenance obligation on whoever implements O-17.1, with
Ward Lead named to ensure it happens — the same recorder/implementer split as this document's
companion. D-7 is a list of open items, not a rule, so the question does not apply to it.

---

## D-5 · 🔴 A NEW STANDING RULE: PROTECTED-WORK DELETIONS COME TO WARD VERIFIER FIRST

**Asked:** one of the two duplicate legal-forms screens was deleted. **The chat that did it stated
the owner had approved it and that it backed up first. The owner had not said so in the Verifier
chat, and a Ward Flow screen is protected work under `CLAUDE.md` — "never delete without asking".**
**So the question put was simply: did you approve that deletion?**

> 🟢 **OWNER: "I approved it, but in the future have decisions like this sent to you first
> automatically."**

✅ **The deletion was authorised. Nothing to recover.**

### The rule this creates

**Before any deletion or move of protected work, the deciding chat sends it to WARD VERIFIER first,
automatically — not as a courtesy and not only when unsure.**

⚠️ **INTERPRETATION, STATED SO IT CAN BE CORRECTED — "decisions like this" is read as the
`CLAUDE.md` protected list, and nothing wider:**

- anything matching `ward-flow`, `ward-management`, `ward-board`;
- any handover or decision document, **including superseded ones**;
- any git worktree, either unpushed ward branch, the memory store, the backups.

🔴 **AND THE CASE THAT PROMPTED IT IS THE ONE MOST EASILY MISSED: an approval the owner gave in
ANOTHER chat.** ⚠️ **A real approval, correctly obtained, is still unverifiable from here — and
"the owner approved it" arrives already carrying its own authority, which is exactly when nobody
checks.** ✅ **So the routing applies to a deletion the deciding chat believes is approved, not only
to one it is unsure about.**

**What the check is, and what it is NOT:** ✅ **Ward Verifier confirms the approval exists, says what
would be lost, and confirms a backup.** 🔴 **It is not a veto and must not become a bottleneck — the
owner's word stands. The rule exists so an approval given in one chat is visible from another
before an irreversible act, not so a second chat can disagree with him.**

---

## D-6 · 🟢 THE `--t-0` COLLISION — amend the brief in the same change

**Asked:** the Design System chat's parting handover drafts O-17.1's success condition as
_"`--t-0` resolves at the screen root to `0.75rem`"_. **`AGENT-BRIEF-COMMON.md` §4, still governing
ten agents, says: "Never use `--t-0`, `--t-1`, `--t-2` on a screen… On a screen `var(--t-0)`
resolves to NOTHING… So the broken case looks like the fixed case."** **If O-17.1 lands, the brief's
rule stops being true while still reading as authoritative.**

> 🟢 **OWNER: "Yes please tell ward lead and have it amend this and update relevant chat."**

✅ **Ward Lead to ensure whoever implements O-17.1 edits `AGENT-BRIEF-COMMON.md` in the SAME change,
and tells the chats working from it.** ⚠️ **The Design System chat has stopped, so "the relevant
chat" is whichever lane Ward Lead assigns O-17.1 to, plus every lane still holding the brief.**

🔴 **This is D-1's lesson in a second place: the brief IS the specifying artefact for ten agents, and
fixing the token without fixing the brief leaves a false prohibition that reads as authoritative —
with a stated reason that will no longer be true.**

---

## D-7 · 🟢 THE REMAINING SEVEN ARE FLAGGED TO WARD LEAD

> 🟢 **OWNER: "Flag for ward lead"** — on each of the following.

1. **D-1 is not done.** `legal-forms-third-edition.html:8581–8599` still specifies the overruled
   sort. A drawing sits outside every gate.
2. **D-2 is not done.** The three thresholds have not been re-measured. **A run, not an
   investigation** — `ui-ward-table-thresholds.spec.ts` prints the list. Done when it prints empty.
3. **The three skipped tests in the twelve have never been named.** **A skip is not a pass, and
   88/3/0 must not compress to "green".** A JSON-reporter run names them.
4. **Two orphan gates remain unwired** — `check-source-control-chars.mjs`,
   `check-errata-freshness.mjs`.
5. **One test failure is unattributed.** Lane C reported five, accounted for four, and said so
   rather than rounding down. ✅ **Reporting it that way was right; it is still open.**
6. **`cc9b45f17c` — the outstanding-issues inbox request for the deferred sweep — is still
   unfolded.** 🔴 **The one artefact here whose whole purpose is to outlive every chat.**
7. **My own D-1 framing was too wide and is corrected in place** — the reducer writes a deadline for
   `transport`/`transfer` kinds, so a coordinator-entered 4A or 4C with a typed time does carry one.
   **The narrower claim stands: a 1A or 3B never can.**
