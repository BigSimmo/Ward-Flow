# Owner decisions — 2026-09-08

Recorded by Ward Lead as each decision is made, so it survives the chat it was made in.
An owner ruling that lives only in a conversation has been lost before on this programme.

---

## 1. The patient "Now" screen mockup is APPROVED TO BUILD

**Decided:** 2026-09-08, by the owner, in the Ward Lead chat.
**Asked as:** "Is the patient 'Now' screen mockup approved to build?"
**Answer:** Yes — build it.

**The mockup:** https://claude.ai/code/artifact/bbd7c4c2-d2e0-40fb-8450-171813375743

**Who acts on it:** Ward Patient, folder `D:\Worktrees\Database\ward-builder-two`, branch
`ward/patient-now-build-20260908`.

**What the approval does and does not cover.** It approves building the screen. It does not
approve any figure the live data cannot produce. Ward Patient's own brief already requires it to
report, before writing code, which parts of the drawing the model can support and which it cannot —
that step is unchanged by this approval and must still happen.

⚠️ **Ward Lead did not see the mockup.** The artifact is not shared with this session
(`artifact not found — it may have been deleted, or it has not been shared with you`). This record
states the owner's decision; it makes no claim about the drawing's contents. Anyone auditing the
build against the drawing must open the drawing, not this file.

**Standing constraints that this approval does not relax**, all previously ruled and all still
binding: diagnosis, medication, risk scores, progress notes and observations do not exist and were
each refused deliberately; next of kin, carer, phone, email and emergency contact do not exist; two
of the seven journey stages can never carry a timestamp, and "no time was recorded for this step"
is a different sentence from "not reached"; medical clearance has three states and absent means
nobody looked; nothing may be derived from the free-text presentation reason; and a ward may not
see where else a patient has been referred, but the withholding must be **stated**, never a silent
blank — an empty section cannot be told apart from "you may not see this".
