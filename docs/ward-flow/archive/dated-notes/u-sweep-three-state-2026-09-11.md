# The §U sweep, three-state — what it covered

**Ward Verifier, 2026-09-11.** Ward Lead's adjustment: report **AGREE / DISAGREE / ONE SILENT**, and
**state what the sweep covered, not that it passed.**

## The result

    ROUTES DECLARED 36   MEASURED 36   ERRORS 0
    invisible-layer / live-region elements found      155
    of those, carrying an absence or refusal word      52
    distinct absence strings in the invisible layer    16

    DISAGREE     0
    ONE SILENT   1        ", reconciliation not available"   — on ALL 36 ROUTES
    AGREE       15        (14 by the documented title idiom, 1 by a visible sibling)

**The single one-silent carrier is Ward Lead's own specimen.** Confirmed independently, **and its
reach is now measured: every one of the 36 ward routes.**

## 🔴 THE FIRST VERSION OF THIS SWEEP WAS VOID, AND ITS OWN NUMBERS LOOKED BETTER

**Run 1 reported: 15 echoed, 1 one-silent.** It was worthless. `innerText` **does not exclude
`sr-only` content** — screen-reader-only text is clipped, not `display:none` — so every invisible
string appeared to be "echoed by the visible layer", including the specimen.

    KNOWN SPECIMEN ", reconciliation not available"
      run 1:  echoedByVisible = true     <- WRONG. Ward Lead had already measured it invisible.
      run 2:  echoedByVisible = false    <- control passes

> 🔴 **A sweep built to find text that the visible layer omits, whose visible-layer reading silently
> included the invisible layer. It could not have returned a single true positive, and it reported a
> tidy 15-to-1 split.**

**What caught it was running the known specimen through as a mandatory control before reading any
other number.** Run 2 aborts with `RESULTS VOID` if the specimen does not classify one-silent. **The
visible layer is now computed by cloning the body, removing every `sr-only` subtree, and reading the
clone.**

## 🔴 AND RUN 2's HEADLINE WAS ALSO WRONG — 16 one-silent, of which 15 were not

Run 2 said **0 AGREE, 16 ONE SILENT**. **Zero agreements is not a plausible shape for a codebase this
careful, and that is what made me look again.**

**Fourteen were the repository's own documented idiom:** a disabled control carries an `sr-only`
reason **and** a `title` tooltip with the same sentence. The sr-only span exists _because_ a
mouse-only tooltip was a defect once. **The visible layer does carry it — on hover.**

    /ed/rph-ed          9 sr-only absence strings   8 also offered as a title   1 not
    /transport/officer  3                           2                           1
    /network            1                           0                           1
    /hub                1                           0                           1

**The fifteenth had a visible sibling saying it outright.** `ward-console-confirm-unavailable` on the
movement console reads _"Confirming a destination is not built yet…"_ to a screen reader — and the
panel beside it says, in plain visible text:

> **"Confirm a destination — Not built yet. Which record a confirmation writes, and in whose name, is
> a decision the owner still holds — so this control is deliberately inert and says so rather than
> being hidden."**

⚠️ **My idiom check missed that one** because the `title` wording differs from the `sr-only` wording
and the span is a **sibling referenced by `aria-describedby`**, not a descendant — so `closest()`
found no host. **Two different reasons for one false positive, and only opening the page settled it.**

## What is left, and it is one thing

    ", reconciliation not available"      sr-only, on the Activity button, all 36 routes
    no title tooltip · no visible sibling · the visible layer offers only the word
    "Activity" and an aria-hidden coloured dot carrying no words

✅ **This is the case the owner ruled on tonight — the visible layer gets words, colour is never the
only carrier of a state. A build brief is already being written. This sweep adds the reach: 36 of 36
routes, not a screen or two.**

## 🔴 WHAT THIS SWEEP DID NOT COVER — read this before quoting the zero

- **Only carriers PRESENT IN THE DEFAULT RENDER of each route.** A refusal that appears only after an
  action — a rejected search, a declined referral, a blocked submit — **was not exercised and is not
  in the 52.** The enumeration behind this sweep counted **~340 absence strings across ~75 files**;
  this run saw **52 occurrences of 16 distinct strings.** **The gap is not a pass; it is unwalked.**
- **One default viewport, 1440×900.** A carrier that only mounts at another width was not seen.
- **The `aria-live` region on `/network` is a region wrapping visible content**, not a fixed sentence;
  it is counted as AGREE on inspection, not by the automatic rule.
- **Nothing about what a screen reader actually announces.** This is DOM and computed style.

**So: 36 of 36 routes walked, 16 of 16 default-render absence carriers classified, 1 one-silent.**
**Not "the sweep found no contradictions."**
