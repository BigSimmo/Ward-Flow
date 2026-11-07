---
name: looking-at-the-screen-misattributes
description: "A screenshot shows a property is present but not which element carries it — an adjacent node made a whole line look monospace"
metadata:
  type: feedback
---

This session's whole method was _look at the rendered screen, do not trust the tests_. It found four
real defects. **Then it produced a false one, and the falseness was invisible in the image.**

A bar legend read `Under 4 hours 10 · 4 to 12 hours 25` and plainly looked monospace. Both Ward Lead
and I read the **label** as being in the code face. Measured per node with `getComputedStyle`:
the label is the body face; only the number — a separate element, 6 nodes across two screens, every
one a bare digit string — is monospace. **A figure column in a figure face is what the face is for.**
Acting on the screenshot would have removed it, one file away from a comment in the same stylesheet
warning against exactly that.

**A screenshot is honest about what is on the page and silent about which element owns it.** Adjacency
reads as shared styling: a monospace number beside body-face text pulls the whole line's appearance
with it, because the eye attributes a property to the phrase rather than to the span.

**Why:** the failure is not "I looked", it is "I stopped at looking". The image answers _is this
wrong?_ — it does not answer _what is wrong and where_, and the second question is the one an edit
needs. Rendering caught the defects; only per-node measurement could say which rule to change.

**How to apply:** when a screenshot motivates a CSS or DOM change, before editing enumerate the
matching nodes and print the computed property and the class per node — never the phrase, always the
element. Check the two directions: how many nodes with this class are prose, and how many are bare.
A class that is 100% one kind is a design; a class that is mixed is the bug. And read the rest of the
stylesheet first: a comment warning against the change you are about to make is common, because
somebody already had this idea. Related: [[tests-that-assert-rendering-not-truth]],
[[a-property-that-does-not-discriminate]], [[measure-the-thing-not-a-proxy]].
