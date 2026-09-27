# Build contracts and measurements, 2026-09-12

**Eighteen documents, every one produced by reading the code rather than the plan.** They exist
because the owner asked for eighteen drawings to be built, and because this project has repeatedly
built screens that state things the data cannot support.

⚠️ **THEY WERE WRITTEN INTO ONE CHAT'S TEMPORARY SCRATCHPAD AND ARE COMMITTED HERE BECAUSE LANE A
ASKED WHY IT SHOULD BUILD FROM A FILE THAT LIVES NOWHERE.** 🔴 **It was right. Five separate
diagnoses were found in this codebase on 2026-09-11 that were correct, load-bearing, and reachable
only by somebody who already knew where to look. A sixth was being created here.**

---

## What each one answers

**A build contract asks six things of one screen, and cites a `file:line` for every claim:**

1. **Does it already exist?** — enumerated, not grepped for expected names
2. **What are its sections?**
3. **What data does each need, and does the model have it?**
4. 🔴 **What cannot be built honestly?** — the most important answer
5. **Which owner decisions bind it, and does the drawing contradict any?**
6. **What would the catcher be?**

**Where a screen already exists, the contract is a THREE-WAY DIFF instead** — in both, drawing only,
and 🔴 **APP ONLY**, the dangerous list. **A screen rebuilt to a drawing silently loses whatever
the drawing forgot, and this project has a recorded incident where a merge dropped 30 of 42 facts a
previous screen carried.**

## 🔴 The findings that should be read even if nothing else here is

    out-of-area    the app shows "This board is NOT A MEDICAL DEVICE" as a standing, always-visible
                   sentence. The drawing carries that wording only inside a HOVER TOOLTIP —
                   invisible on a phone and until a mouse lingers. Built as drawn, every
                   phone-using coordinator loses the disclaimer.
    discharges     the drawing was REPRODUCED FROM the built screen, by its own admission. Nothing
                   to build — and a rebuild would lose the phone card layout, a clinical-safety
                   sentence, and the subtitle.
    governance     the drawing's "Access record" claims it records "every time somebody opened a
                   person's record… across the whole network." FALSE. The only access log lives in
                   one page's temporary memory, is never saved, and deliberately has no "who".
    legal-forms    Forms 1A and 3B carry NO EXPIRY AT ALL (owner instruction, 2026-08-23), so a
                   screen sorted "by time remaining" has nothing to sort by for the two most
                   legally serious form types.
    on-call        the model holds NO staff concept — no name, no number, no shift. Buildable only
                   as a fully disclosed mockup; a roster that is wrong is worse than no roster.
    settings       the drawing's appearance control writes a DIFFERENT storage key from the real
                   one, while its own copy claims "changing it here changes it there too."
    alerts         four items cannot be built honestly, including an alert naming a gate the
                   override record never stores and a reminder for a handover time nothing records.
    referrals      🔴 the contract could NOT differentiate this screen from the existing referral
                   board. Reported as a finding rather than resolved by guessing.
    wards          same — the drawing is, by its own comments, a redraw of the existing screen.

## ⚠️ The measurements beside them

    drawing-vs-app        all sixteen earlier drawings against the built screens. 62 present,
                          27 RENAMED, 33 ABSENT, 20 cannot-tell across ~142 checks. 🔴 The 16 are
                          built but NOT complete. The RENAMED list is the most useful part: every
                          one is a case where a name-matching check would wrongly say "missing".
    drawing-staleness     all 18 drawings are CURRENT by their own git history — contradicting the
                          owner's recollection that ten were stale. His memory was of which LINKS
                          he had shared, not which files are behind.
    branch-verdicts       five unfolded branches classified OWED or SUPERSEDED, with the
                          supersession test run in both directions before any verdict.
    diagnosis-index       26 load-bearing diagnostic comments, indexed BY THE MISTAKE THEY PREVENT
                          rather than by file. ⚠️ Its three most alarming entries were all checked
                          and are ALREADY FIXED — see below.

## 🔴 Two cautions about reading these

**1. A FIXED DEFECT AND AN OPEN ONE READ THE SAME AT A GLANCE.** The diagnosis index surfaced three
alarming findings; all three turned out to be already repaired, each saying so in a quiet clause
after a vivid paragraph describing the defect. **A reader skimming — or a tool extracting — takes
the description and not the disclaimer.** Verify before acting on anything here that reads as live.

**2. EVERY DOCUMENT STATES ITS OWN LIMITS AT THE END. READ THAT SECTION.** Several compare NAMES
and not BEHAVIOUR; a section can be present and wrong. None of these was produced by running the
app.
