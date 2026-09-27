# Owner question, 2026-09-11 — is a GP referral its own thing?

**Raised by Lane C, measured not recalled, at `b9c97f8fd8`. Routed by Ward Lead.**

This started as a two-character bug fix and turned into a question about who gets told when a
referral is turned down. I could have made the small fix invisibly. It would have been wrong, and it
would have hidden the real question underneath it.

## What the software knows today

Ward Flow records **how a referral arrived** — it calls this the referral's _source_, and it is a
fixed list of six:

    community · crisis service · police · ambulance · inter-hospital · ED medical

**There is no GP.** Not hidden under another name, not disabled, not planned — the word does not
appear anywhere in the model. I searched the whole thing.

So a GP referral today has to be filed as one of the six. Most likely _community_.

## Why that is not just a missing label

The source is not decorative. It decides **one thing that matters: who is told when a referral is
declined.**

Reading the code that makes that decision, at `ward-flow-reducer.ts:1023`:

- **ED medical** referrals resolve to a real addressee — the emergency department that sent it. If
  the referral is declined, that ED can be told.
- **The other five sources resolve to nobody**, deliberately. The code's own comment says each names
  _"a channel this application has no seat for"_, and that guessing an address would risk sending a
  decline to a team that never made the referral. It chooses to send **no notice at all rather than
  a wrong one**.

⚠️ **So a GP referral, filed as community, is declined and nobody tells the GP.** Not because anyone
decided that about GPs — because GPs were never a category, and the category it borrows is one of
the five that reach nobody.

## Why adding "GP" to the list would not, on its own, fix it

Adding a seventh source would let the software **record** that a GP referred someone. It would not
create a way to **reach** that GP: the five unresolved sources are unresolved because there is
nobody inside the hospital network to address, and a GP is further outside it than any of them.

So the honest version of the question is not _"add a value?"_ but:

> **When a bed request from a GP is turned down, does that GP need to be told — and if so, is that
> something this software should be responsible for, or something that happens by phone or letter
> outside it?**

That is a question about how referrals actually work in Perth, and about what you want this tool to
take responsibility for. It is not a coding decision and I have not made it.

## What happens either way

There is a **separate, unambiguous defect** that is being fixed regardless of your answer, so it is
not waiting on you. Two different lists of referral sources exist under the same name — one in the
model (the six above) and one in a newer navigation layer (`ed`, `community`, `gp`). The menu emits
values the model refuses. Ward Lead has ruled that the navigation layer must quote the model's list
rather than restate it, and is routing that. **Nothing about that fix requires deciding anything
about GPs**; it only stops the two lists disagreeing.

---

## Summary

**DID** — Measured the referral-source list in the model (six values, no GP), traced what the value
actually drives, and found it gates exactly one behaviour: whether a declined referral can be
addressed back to whoever sent it. Confirmed ED medical is the only one of the six that resolves to
a real recipient, and that the other five are deliberately left unresolved rather than guessed.
Wrote this up rather than making the two-character fix that would have buried it.

**ISSUE** — A GP referral has no category, so it is filed as something else, and every category it
could borrow is one that notifies nobody on a decline. **The practical effect today is that a GP who
refers a patient is not told when the request is turned down.** Nobody decided that; it fell out of
a missing category. I do not know whether it matters in practice — that is the question below.

**GAPS** — I did not check whether a decline notice reaches anyone by another route outside this
code, and I have not looked at how GP referrals arrive in your actual service. I also have not
checked whether the other five unresolved sources have the same practical problem as badly; I only
traced the GP case because that is what surfaced. **This is a prototype with invented data; nothing
here has been tested against how referrals really flow.**

**NEED** — Should a GP be a referral source in its own right? And separately: when a GP's bed
request is declined, should this software be responsible for telling them?

**RECOMMEND** — My view is only on the software half, because the other half is yours. If the answer
to the second question is _"no, that happens by phone"_, then adding a GP source is still worth
doing for record-keeping and costs nothing risky. If the answer is _"yes, they should be told"_,
then this is materially bigger than a list entry and should be scoped as its own piece of work
rather than slipped into a naming fix. **I would not add the value quietly as part of the naming fix
either way** — that would make the list look complete while the notification gap stayed hidden.

**NEXT** — Nothing waits on this. The two-lists defect is routed and proceeds independently. Lane C
continues on the referral screen.

---

# ADDENDUM, same day, measured by Ward Lead at `df773c9f3e` — 🔴 THE APP ALREADY OFFERS A GP ROUTE, AND IT CANNOT RECORD ONE

**This changes the question. It is no longer "should GP become a seventh source?" It is "the app
already tells a coordinator it can take a GP referral, and it cannot."**

**Found while verifying an unrelated sweep finding. Every line below is quoted from the tree.**

## 1 · There is a "From a GP" entry point, live, in the navigation

    src/components/ward-management/ward-nav.ts:463
      { source: "gp", label: "From a GP or private practice",
        href: raiseReferralHref({ source: "gp" }) }

**A coordinator is offered "From a GP or private practice" as one of the ways to raise a referral.**
It builds a real link, the route resolves, and the form opens.

## 2 · 🔴 TWO DIFFERENT TYPES ARE BOTH CALLED `ReferralSource`

    shell/ward-facade.ts:314   type ReferralSource = "ed" | "community" | "gp"     ← the URL contract
    ward-model.ts:1215         type ReferralSource = (typeof REFERRAL_SOURCES)[number]
                               REFERRAL_SOURCES = community · crisis_service · police ·
                                                  ambulance · inter_hospital · ed_medical

**`Referral.source` (ward-model.ts:1721) uses the SECOND one.** ⚠️ **So `"gp"` is a legitimate value
of a type called `ReferralSource` and an impossible value of the field called `source`.** An import
resolves, the name matches, the editor offers it, and only the contents disagree — **the same
two-types-one-name trap already recorded as errata §BD, now sitting under a clinical question.**

## 3 · The GP-ness is dropped at the door, and this is written down honestly

`raiseReferralHref` writes `?source=gp` into the URL. **`referral-intake.tsx` reads exactly one
parameter — `patientId` — and never reads `source` at all.**

**The facade says so itself, in its own comment, without being asked:**

> _"🔴 THE ROUTE EXISTS AND RESOLVES; NOTHING READS THESE PARAMETERS YET … a link built here lands
> on the intake form with the form empty. That is a stated absence rather than a defect of this
> builder … written down here so that nobody reads a well-formed link as evidence that the form
> arrives pre-filled."_

✅ **That is exemplary. The builder knew, said so, and named where the remaining work belongs.**

## 4 · 🔴 So the three failures are stacked, and each would survive the other two being fixed

1. **The menu advertises a GP route.** A coordinator can reasonably conclude the software handles
   GP referrals.
2. **The route drops the fact.** Even if the form read `source`, it arrives as `"gp"`, which the
   model cannot hold.
3. **The model has no place to put it.** So the coordinator picks one of six, most likely
   _community_ — and per the original question above, a _community_ referral that is declined
   resolves to **nobody**, so the GP who asked for the bed is never told.

⚠️ **Fixing any one of these alone makes it worse, not better.** Consuming the parameter without a
model value means filing GP referrals under a source that is a lie. Adding `gp` to the model without
an addressee means a source that still tells nobody. **Removing the menu entry alone is the only
safe single change — and it removes a capability rather than adding one, which is the owner's call
and not a tidy-up.**

## 5 · What this does NOT establish

**I have not established that anybody has ever filed a GP referral, or that the menu entry is
reachable from a screen a coordinator actually uses.** `ward-nav.ts` builds menus; which surfaces
render this one is unmeasured. **The entry exists in the navigation model; whether it is on screen
today is a separate question I have not answered, and the answer does not change the model gap.**

**And I have not established what a GP should be told.** That is the original question and it is
still entirely the owner's.

## 6 · The question, restated with the new fact

**The original:** _should this software be responsible for telling a GP their bed request was
declined?_

**Unchanged, and now joined by a second that does not need clinical judgement to be urgent:**

> **The software currently offers to take a GP referral and cannot record that it was one. Should
> the offer come out until the rest exists, or does the rest get built?**

⚠️ **Recorded as a question rather than a ruling, deliberately. This one has a clinical consequence —
a GP who asked for a bed and is never told the answer — and the standing rule is that a clinical
judgement is the owner's, not mine, however obvious the engineering looks.**
