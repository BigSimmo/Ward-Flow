---
name: one-fact-filed-under-two-questions
description: "The same measured fact, filed under two different questions, stays unjoined — both measurements correct, neither retrievable from the other, and it takes a third framing to see they are one cause"
metadata:
  node_type: memory
  type: project
  originSessionId: 375480d8-c65a-4a85-9c03-411b49e19410
  modified: 2026-09-10T19:30:21.323Z
---

Ward Flow, 2026-09-11. Two blocking questions went to the owner separately:

    A-6   a gender mix cannot be derived for a ward           filed as ARITHMETIC
    A-8   a privacy guard forbids a page reaching movements   filed as PRIVACY

**Both have one cause:** `Admission` and `Referral` carry no `patientId`, so nothing joins a bed's
occupant to a person. The mix cannot be counted without that join, and the guard was written broad
**because of the same absence** — its own comment says a guard resting on today's missing link
_"would go quiet the day the link lands, which is precisely the day it is needed."_

🔴 **So they can be answered separately but not independently: answering A-6 in the direction that
adds the link is the day A-8's guard starts to matter.**

⚠️ **Nobody was careless, and that is the point.** I measured the absent `patientId` twice, in two
separate investigations, and read it both times without joining them. The lead had both questions
open and wrote one about arithmetic and one about privacy. **Two people each holding both halves,
neither joining them.** It took a third framing — the two questions arriving in one message — to
make the join visible.

**The measurements were correct both times. The FILING is what kept them apart:** a fact filed under
_"why the mix cannot be derived"_ is not reachable from _"why the guard is broad"_. Retrieval, not
observation, is the failure.

**How to catch it:** when a blocker's cause is a MISSING FIELD, a MISSING LINK or a MISSING
CAPABILITY, go looking for the other consequences of that same absence before writing the question
up. **Absences have wide blast radii and no call sites** — a missing field cannot be found by
grepping for its own name, which is exactly why each investigation rediscovers it locally and files
it locally. Related: [[fields-with-no-producer]], [[a-written-diagnosis-does-not-sweep]],
[[reachability-is-not-containment]], [[the-suite-never-tests-the-absence]].

## 🔴 CORRECTION 2026-09-11 — HALF OF THIS EXPIRED, AND ONLY HALF

Re-measured against `ward-model.ts` while starting Lane C task 15. **`Referral` now DOES carry
`patientId?: PatientId`** — owner ruling 2026-09-02, _"Yes to the referral remembering its patient"_,
and `ALLOWED_REFERRAL_FIELDS` was widened by that decision rather than defeated. So the sentence
above — _"`Admission` and `Referral` carry no `patientId`"_ — **is now false for `Referral`.**

**`Movement` still carries none.** Checked the same way, same session: `id: MovementId` and no
person link of any kind.

⚠️ **So the asymmetry, not the absence, is the live fact:** a person can be joined to their
REFERRALS and cannot be joined to their MOVEMENTS. A feature spanning both — "what is already open
for this person" — is half-buildable, and the half that works is the half you notice first. Writing
the signature to take both and quietly using one is
[[fields-with-no-producer]] wearing a parameter list.

🔴 **The lesson is about this file, not about the model.** I wrote this memory, appended
_"absences have wide blast radii"_, and then **came back to it as a source three weeks later and it
was half wrong** — in the direction that would have made me declare a task blocked when it was not.
A memory recording that something is ABSENT is the most perishable kind there is, because the whole
point of recording it is that somebody will fix it. **Never act on a recorded absence; re-measure
it.** That is already the standing rule for recalled memories and this is what it is for.

See [[observations-expire]], [[a-status-claim-about-someone-else-expires]], [[self-invalidating-pins]].
