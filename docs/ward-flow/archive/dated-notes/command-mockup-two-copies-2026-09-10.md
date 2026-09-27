# The Command drawing: two copies, one merged line, and a panel that says the invented figures are live

**Ward Lead, 2026-09-10.** Measured on the master line, not inferred from a branch name or a commit
message.

---

## 1 · The reconciliation everyone was about to redo had already happened

The Ward Flow command-mockups chat reported that the Command drawing exists in two versions holding
half the fixes each — one with the owner's no-bars ruling and the design work but still carrying
three wrong clinical claims, the other with the corrections and none of the design — and set out to
build a hybrid.

**True of the two branch copies. Not true of the master line, which has both.**

    docs/ward-flow/mockups/command-third-edition.html

    master line   codex/task-ward-flow-live-state-20260831   a209721e2a   11,433 lines
    corrections   ward/command-mockup-corrections-20260909   bbfcb970bd   11,499 lines
    the chat's    claude/ward-flow-command-mockups-bc00c2    0d85c571c1   11,398 lines

`ward/command-mockup-corrections-20260909` **is already folded** — tip `313999726b` is an ancestor of
the master line — and the entire 122-line difference between it and the master copy is the owner's
**no-edge-bars ruling of 9 September**: coloured top borders gone, the inset top highlight gone, edge
bars replaced by a ring and a word.

⚠️ **"It is folded" is a claim about reachability, not about content, so each correction was checked
in the file itself:**

    prior_decline   master carries `INFORMATIONAL_GATES = { prior_decline: true }`, the 2026-09-09
                    audit comment, and the "must never be moved into" warning
    diagnosis       26 `dx` occurrences — identical to the corrections copy
    specialling     83 occurrences — identical to the corrections copy

**Master = corrections + design ruling.** There was nothing to reconcile, and a hybrid built on the
belief that no merged copy exists risks landing as a third version behind the master line on
something nobody checked.

### Why a correct chat reached a wrong conclusion

Nothing it said about its own two branches was false. **It compared the two copies it could see and
never asked whether a third had already merged them** — and the master line is the one place a chat
working on a branch does not look. That is the same shape as the work-claims register living only on
the master line: _"a register read by the chats that already know about it is a record, not a guard."_

---

## 2 · 🔴 The Activity panel tells the reader the invented figures are live

**And this one IS on the master line**, in the folded copy:

    '<span class="fresh"><span class="dot" data-tone="good"></span>Live, reconciled ' + NOW + …

**A green "good" dot and the words "Live, reconciled", on a drawing whose every figure is invented.**

The page discloses elsewhere — it carries _"Synthetic data. Every value below is invented"_ and a
prototype chip, and says so twice. **But this panel opens on its own**, and the owner's 2026-09-09
ruling is exactly that a sentence must be true read alone, because a heading does not travel with it.

⚠️ **This is not a missing disclosure. It is the assertion of the opposite** — the same inversion
found twice in code guards today (_"these figures are NOT invented"_ satisfying a provenance check),
arriving in the one artefact class that **no check runs against at all**. A drawing is outside every
gate; the only reader is a person, and the panel is telling that person the numbers are reconciled.

**Not fixed here.** Drawings are the owner's to rule on, and he has been ruling on this one. Put to
him with the two questions the same chat is holding — whether beds should be ordered by patient
acuity, and whether the catchment rule is real. **Neither exists in the software, and both are drawn
on that screen.**
