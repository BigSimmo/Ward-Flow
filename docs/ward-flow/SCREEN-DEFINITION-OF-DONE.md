# Screen definition of done

> **Q004 owner-approved amendment, 2026-09-13:** For the current product-refinement commission, use [lean visual review](plans/product-refinement/VISUAL-REVIEW.md) instead of the blanket six-view coverage below. Compare every changed page at desktop in light/dark; phone/tablet coverage is by shared layout, with individual checks for complex or materially changed responsive screens. Record actual checked cells and explicitly identify reused family evidence/deferred cells. Numerical scoring is inactive; preserve historical scores for future polishing. Behavioral safeguards and honest evidence requirements remain. The baseline checklist below does not reinstate superseded Q004 coverage requirements.
>
> **Owner speed rule, 2026-09-21:** For all active visual work and styling fixes, use focused single-view verification while building (target viewport in default theme, at most one screenshot). Never run full backend suites for pure visual/styling edits. Perform responsive (mobile) and dark appearance checks at most once at final completion, and only where responsive layout changed.

## Why this exists

The previous build produced screens that pass 5,039 tests and **do not look like their
mockups**. Six screens were reported "not started" when they had in fact been built; two
were recorded "complete and browser-verified" and were not. The root cause was simple:
**there was no written definition of done for a screen, and nothing in this repository can
see that a screen does not look like its drawing.** Tests check behaviour and markup, not
layout. The old build plan had a visual-comparison step. It was never run.

This checklist is what "done" means for one screen. Tick every box, per screen, before you
call it finished. If you cannot tick a box, the screen is not done — say so, do not round up.

---

## ① Design fidelity — against the mockup

- [ ] **Panel order matches the mockup.** Same panels, same top-to-bottom (or left-to-right)
      sequence.
- [ ] **Panel TYPE matches, not just its content.** 🔴 A card grid is **not** a table. A
      filled swatch is **not** an outline box. A KPI band is **not** a label/value list.
      All three of these substitutions actually happened in the previous build and still
      passed every test.
- [ ] **Every panel the mockup shows is present.** No panel silently dropped because it
      looked optional or redundant.
- [ ] **Tabbed panels stay tabbed.** Three screens in the previous build turned one tabbed
      panel into stacked sections. If the mockup tabs it, the build tabs it.
- [ ] **The disclosure footer is present** — the line telling the reader what is invented
      (demo/synthetic) and what is real. 🔴 **Treat this as clinical, not cosmetic.** A
      screen that looks finished but is silent about what's real is the exact failure mode
      this product exists to avoid.

## ② Somebody has LOOKED at it

- [ ] The mockup is open in a real browser, side by side with the running screen — not
      described from memory, not diffed by eye from a screenshot taken an hour apart.
- [ ] Checked at the **target viewport (default: 1440px desktop)** in the default theme (light).
- [ ] Responsive (390px mobile) and dark appearance checked **at most once at final completion**, and only if responsive/theme layout rules were actually modified (Owner speed rule, 21 September 2026).
- [ ] ⚠️ **The mockup builds its navigation with JavaScript.** Opened as a static file
      (double-clicked, or `file://`) instead of served and rendered, it looks like a
      different design entirely — chrome missing, panels in the wrong place. A false
      "does not match" finding was reported from exactly this mistake. Serve it; do not
      open the file directly.
- [ ] 🔴 **Write it down in [`screen-verification.json`](screen-verification.json)** — date, who,
      which widths, which themes, the verdict, and the drawing's hash from
      [`mockups/MANIFEST.json`](mockups/MANIFEST.json). Then regenerate
      [`SCREEN-VERIFICATION.md`](SCREEN-VERIFICATION.md).

      ⚠️ **Recording the drawing's hash is what makes the verification age honestly.** Without it,
          "verified" stays true-looking forever; with it, editing that drawing flips the screen's
          **Drawing** column to STALE and tells the next person to look again. **An unrecorded check
          and a check that never happened are the same artefact** — which is precisely how the last
          build reported two screens as browser-verified when they were not.

          🔴 **Two separate states age two separate facts, and neither one stands in for the other.**
          The **Drawing** column (`mockupSha256`, above) says only whether the DRAWING has moved since
          you looked — it has never compared a single source file. Whether the BUILT screen has moved
          is a second, optional fact: run `node scripts/ward-flow/screen-verification.mjs --hash
          <mockup>` and record the result as `implementationSha256` if you want that tracked too;
          leaving it out just means the generated page's **Implementation hash at look** column keeps
          reading "not recorded". **The word "CURRENT" is retired everywhere in this record** — a
          matching hash, drawing or implementation, proves only that nothing moved since the look, not
          that the screen is right. This is WF-35: several screens once read "deviates" next to
          "CURRENT" at the same time, because a drawing-hash match was being read as a claim about the
          built screen it never actually compared.

## ③ Reachability

- [ ] The screen has a real route under `src/app/mockups/ward-flow/`.
- [ ] Something in the running app links to that route. 🔴 A route or component that exists
      but that nothing points to is not reachable by a user, no matter how correct it is —
      `ed-home.tsx` is exactly this: it exists, nothing imports it, and it has no route.

## ④ Behaviour

- [ ] Existing behaviour is unchanged unless the screen genuinely required a change to work.
- [ ] Every deviation from the design baseline is **written down, with its reason**, next to the
      screen (in the commit or a note in this folder) — not left for someone to rediscover later.
- [ ] 🔴 **Owner ruling, 25 September 2026: The app as rendered from the latest folded ward-line
      commit is authoritative on design; the working engine is authoritative on behaviour.** The
      drawings in `docs/ward-flow/mockups/` are background reference only; disregard older mockup
      discrepancies where the live code has advanced. Write down any intentional behavioral or layout
      changes and why they were made.

## ⑤ The usual gates

- [ ] **Focused tests pass:** `node scripts/run-vitest.mjs <files>` running only the test files
      created or edited, plus up to 3 directly importing test files (Owner speed rule, 17 September 2026).
      Styling and layout edits alone must **never** trigger the full ward suite.
- [ ] `npx tsc -p tsconfig.typecheck.json --noEmit`
- [ ] **Ward Lead fold gate (once, at the fold):** `node scripts/check-ward-expected-reds.mjs` and
      `npm run test:e2e:ward-journeys`. Summary line must show "files handed in" equal to "files that ran."
- [ ] ⚠️ **Never read an exit code as the verdict.** Read the runner's own printed summary.
      An exit code can be right for the wrong reason (or wrong for the right one); the
      summary line says what actually happened.

---

## What this checklist CANNOT catch

Ticking every box above is not proof the screen is right — it is proof someone did the
checking a machine cannot do. Be honest about its limits:

- **No automated check in this repository sees layout.** Passing tests, a clean typecheck,
  and a green test-runner summary say nothing about whether the screen looks like its
  mockup. Section ② — an actual human, actually looking — is the only thing in this list
  that catches a visual mismatch, and it only catches what that person happened to notice.
- It cannot catch a mismatch at a breakpoint nobody checked, or a dark-mode-only bug if the
  reviewer only looked in light mode.
- It cannot catch a deviation the builder didn't think to write down — section ④ only works
  if the person doing the work is honest about what they changed and why.
- It does not replace a second person's review. One builder ticking their own boxes is
  weaker evidence than a second person independently opening the mockup and the screen.
- It says nothing about whether the mockup itself was right. If the mockup is wrong, a
  screen that matches it perfectly is still wrong.
