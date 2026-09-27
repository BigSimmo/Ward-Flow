---
name: a-property-set-on-the-element-itself
description: An ancestor rule can never override a property the element declares on itself — one mechanism behind the print blank-page defect and composes immunity
metadata:
  node_type: memory
  type: reference
  originSessionId: b1ace96a-832b-4e38-9f46-6c2896334ea0
  modified: 2026-09-03T23:45:42.776Z
---

**An ancestor's rule cannot override a property the element sets on itself, at ANY specificity.**
It is not a contest the ancestor narrowly loses; it is one the ancestor was never in. Obvious once
stated, and it was described as two unrelated facts for a whole night.

**Two consequences that look unrelated and are the same thing:**

1. **Print resets do not reach a screen root.** `globals.css` sets `body { color: #000 }` for print.
   Every ward `.screen` sets `color: var(--text)` on itself, so the reset never applies. Ward Flow
   dark tokens are scoped by the CLASS `.ckb-v2.dark.ckb-v2`, **not a media query**, so the class
   survives into the print medium and `--text` stays `#f4f6f8`. Measured 2026-09-04: `.screen`
   colour `rgb(244, 246, 248)` on `rgba(0, 0, 0, 0)` — **near-white ink on white paper, a blank
   page.** Removing the root's opaque background during token adoption is what exposed it; before,
   it printed as an obviously-wrong dark band, which is _safer_ because someone reports it.
   Fix must be per-screen: `color-scheme: light` (so `CanvasText` resolves black) **plus**
   `color: CanvasText` (which actually overrides `var(--text)`). **`color-scheme` alone does
   nothing** — it governs UA chrome and `light-dark()`, not a class-scoped token.
2. **`composes: wardTokens` is immune to a screen's forced-colors block** for the same reason: the
   composed declarations land on the primitive's own element.

**Where else to look:** anywhere a root sets a property on itself. Ward roots also set
`min-height: 100dvh`, which `coordinator.module.css`'s print block documents as fatal on paper —
the page clips to one viewport instead of paginating. Not checked across the other screens.

**Method note:** read this off the live CSSOM (`[...document.styleSheets]` → the rule's
`style.color`), not from the source. Source tells you what was written; the CSSOM tells you what
compiled and shipped. See [[a-shared-layer-inherits-responsibilities-not-just-properties]].
