# Two token names, one colour — the defect class no gate in this repo can see

**Measured 2026-09-06, recorded 2026-09-07. Ward Builder Four.**
Probe: `scripts/ward-flow/token-collision-scan.mjs --self-test`.

## The shape

**Nothing anywhere compares two design tokens for equality.** So two rules can paint the same
colour through two different names, and every gate stays green: each token exists, each one
resolves, no value is a raw hex. There is no failing state to notice — **a chart with two segments
the same colour looks like a chart with fewer segments.**

Three variants of the family have now been found on this repository, all within one evening:

| variant                                   | found by         | how it surfaced                                     |
| ----------------------------------------- | ---------------- | --------------------------------------------------- |
| a token that resolves to nothing          | Ward Builder Two | four undeclared tokens, browser discarded the rules |
| a token that resolves to its neighbour    | Ward Builder One | two adjacent bar segments painting one block        |
| an alias bypassed by the token it aliases | this scan        | nine sites, latent until someone re-tunes a surface |

## The mechanism, in four lines

```css
--ward-border-strong: var(--text-muted);
--ward-muted: var(--text-muted);
--ward-border: var(--neutral-500);
--ward-divider: var(--neutral-500);
```

**Six names across the border/text family resolve to two values.** A stylesheet can ask for a
"strong" border and a normal one and paint one colour. That is why Ward Builder One's
`.barNotYet` / `.barBlocked` collision was invisible to review: both values are legal tokens, and
the names imply a ladder the values do not have.

## The nine

Each is one stylesheet using a `--ward-*` alias in one rule and reaching **past** it to the token
that alias points at in another. **Identical today.** They diverge the moment anyone re-tunes a
ward surface — a two-tone screen produced by a change that looked complete.

| file                           | alias used           | bypassed by              |
| ------------------------------ | -------------------- | ------------------------ |
| `capacity.module.css`          | `--ward-chrome`      | `--surface-chrome`       |
| `community-index.module.css`   | `--ward-ground`      | `--surface`              |
| `coordinator.module.css`       | `--ward-danger-soft` | `--danger-soft`          |
| `referrals.module.css`         | `--ward-subtle`      | `--surface-subtle`       |
| `referrals.module.css`         | `--ward-canvas`      | `--surface`              |
| `search.module.css`            | `--ward-canvas`      | `--surface`              |
| `statistics.module.css`        | `--ward-subtle`      | `--surface-subtle`       |
| `patient-typeahead.module.css` | `--ward-blue-soft`   | `--clinical-accent-soft` |
| `patient-typeahead.module.css` | `--ward-blue`        | `--clinical-accent`      |

🔴 **One is a live visible defect, not a latent one** — `patient-typeahead.module.css:312`:

```css
.addLink {
  background: var(--clinical-accent);
}
.addLink:hover {
  background: var(--ward-blue);
} /* IS --clinical-accent */
```

**The hover changes nothing.** The add-patient button gives no feedback, and the rule that exists
to provide it reads as though it does. Opened and confirmed, not inferred. Owned by Ward Lead.

## ⚠️ Why the probe requires agreement in BOTH palettes

Re-derive it, do not take it: `node scripts/ward-flow/token-collision-scan.mjs --light-only`
returns **30** groups against the verdict run's **9**. **21 of them are false** — tokens that are all `#ffffff` in
light and diverge correctly in dark. Requiring the collision to hold in both cuts it to 9.

**The light-only version would have reported every legitimate surface pair in the ward layer as a
defect**, which is the same error this repository has already made in the other direction: computing
a contrast ratio from the stylesheet that loses.

## ⚠️ Two traps in resolving a token here, both of which produce plausible wrong numbers

1. **Dark mode is a CLASS** — `.dark`, `.ckb-v2.dark.ckb-v2` — **not a `prefers-color-scheme`
   media query.** Looking for the media query returns the light palette for both modes, and the
   result reads as "nothing differs by theme".
2. **Neither token file always wins.** `ckb-v2-tokens.css` beats `globals.css` on the ~105 names
   both declare, because `.ckb-v2.ckb-v2` is (0,2,0) against `:root`'s (0,1,0) and
   `src/app/layout.tsx` puts `ckb-v2` on the root element. **But globals declares 204 names v2 never
   touches, and the ward layer uses 33 of them today** — `--radius-xs`, `--radius-pill`,
   `--font-sans`, `--neutral-500`, and the whole sub-`xs` type scale. "globals never applies" is as
   wrong as "globals wins".

🔴 **`ward-tokens.module.css:317-320` currently documents itself against the losing values** — four
contrast figures computed on `#fcfdfe` and `#f7f9fc` instead of `#ffffff` and `#fbfcfd`. The figures
are wrong by 0.11–0.27 and no verdict moves; that is not why it matters. **It is the file every ward
chat opens before touching a colour, and on 2026-09-06 a second chat resolved `--surface` to
`#fcfdfe` inside a message correcting somebody else's contrast.** `ward-record-row.module.css`
already records 27 stylesheets that carried contrast measured against the losing file. **Routed to
Ward Lead; not edited here, because that file is shared with several live branches.**

## Calibration — what this is and is not

Every colour here is **arithmetic on hex read from source**, resolved through the real cascade in
both palettes. **These are not rendered measurements.** They say nothing about a value composited
over a translucent surface or an inset, and under `forced-colors` several of these tokens become
`CanvasText`, at which point every relationship above collapses. **Re-derive before quoting.**

The probe self-tests on three planted cases and refuses to report if any verdict is wrong, because
a clean result that has never been contrasted with a known-bad input has not measured anything.
