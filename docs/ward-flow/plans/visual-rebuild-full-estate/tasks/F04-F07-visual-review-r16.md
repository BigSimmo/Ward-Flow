# F04/F07 visual review r16

Date: 2026-09-13  
Reviewer: `/root/hub_inventory`  
Mode: independent read-only visual and narrow source review

## Evidence inspected

All 36 app/mock captures were viewed at original detail: `referral-intake`, `referrals`, and
`add-patient`, each at 390, 820, and 1440 pixels in light and dark themes. The files were the
`*-app-*-r16.png` / `*-mock-*-r16.png` pairs under
`.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/`.

Source inspection was limited to the relevant page CSS and Add patient model comments to distinguish
presentation defects from deliberate engine differences. Counts, current records, referral states,
required identity fields, selection, and mutations remain authoritative.

## Actionable findings

### P1 — all three app screens lose essential text contrast in light theme

This is visible in every light app width and is most severe at 1440:

- Referral intake paints the step titles, question labels, states, destination titles, and most
  right-column copy as white or very pale blue on white/pale panels. At 820 the empty controls are
  visible mainly by their borders; their labels and placeholders almost disappear.
- Referral board paints every queued and decided row as a near-black card on the light canvas while
  tier/state text remains near-black. Section headings and explanatory copy on the surrounding white
  panels are also nearly invisible. The same records are readable in all dark captures.
- Add patient paints the four field labels, the five names in `Already on the board`, and much of the
  supporting copy nearly white on white. The inputs remain discoverable as empty rectangles, but a
  light-theme user cannot reliably identify them.

The current page roots compose the canonical shell tokens, but descendant rules still consume legacy
roles such as `--text`, `--text-heading`, `--text-muted`, `--ward-text`, `--ward-muted`, and legacy
surface/chrome roles. The rebuilt roots do not provide a complete page-local bridge for those existing
consumers. Dark theme happens to leave compatible pale values; light theme exposes the mismatch.

Smallest maintainable fix: on each owned rebuilt root, bridge every still-consumed legacy ink,
muted, surface/chrome, border, and warning role to the canonical `--ink`, `--ink-soft`, `--muted`,
`--surface`, `--surface-2`, `--line`, `--line-strong`, and semantic warning roles. Then remove any
page-local row fill that still resolves to a dark legacy surface in light mode. Keep the existing
semantic status colours and 48px controls. This should be corrected before further spacing polish.

### P2 — an obsolete phone-bar reserve creates an empty band before page content

In all six 390px app captures the shared controls end around 670–731px, then roughly 5rem of bare
ground appears before the first page panel. The paired drawings use an ordinary panel gap of about
1rem. The defect repeats on Referral intake, Referral board, and Add patient, but is absent at 820.

Both `referrals.module.css` and `add-patient.module.css` still apply
`padding-top: var(--spacing-ward-phone-bar)` to the page `.screen` below 40rem. The current phone shell
is in normal document flow, so this reserve duplicates space instead of protecting fixed chrome.

Smallest fix: remove only these two page-owned legacy phone reserves. Keep the later rebuilt `.main`
padding as the single content gap. Do not alter shared shell geometry.

### P2 — Add patient collapses a usable 820px form to one long column

`add-patient-app-820-*-r16.png` gives every identity input the full panel width and pushes the submit
state toward the bottom of the first viewport. The paired drawing uses two compact pairs at the same
width: record number/date of birth and given/family name. The app already uses that two-column anatomy
at 1440, so this is a responsive presentation gap rather than a model difference.

The rebuilt CSS introduces the two-column form only inside `@media (min-width: 64rem)`, even though
820px has ample room for two controls with their 48px heights. Smallest fix: separate the form's
two-column breakpoint from the page's two-column panel breakpoint. Enable two identity columns at the
existing tablet threshold (about 40–48rem), retain one column at 390, and keep Gender, the unavailable
reason, and Submit spanning the form. Do not add the drawing's separate Sex field: current source
deliberately requires four identity facts and permits only optional Gender.

### P2 — Referral board replaces the drawing's triage instrument with oversized generic cards

At 820 the app shows six tall, independently rounded cards and no detail in the first viewport. The
paired drawing shows a bounded `Triage list` with compact rows, explicit tier chips, a selected-row
surface, and the start of `Referral detail` below. At 1440 the app's left column likewise reads as a
stack of dark cards rather than a dense queue; in light theme this compounds the P1 inversion. The
current card bodies preserve the referral ID, tier, wait, age/sex/region and selectable action, so the
missing piece is presentation rather than data.

Smallest fix after repairing tokens: use the existing selectable card rendering as compact triage
rows at tablet and desktop—shared outer queue panel, separators, tier badge, selected-row fill, and a
bounded independent scroll region. Preserve the current fixed engine order and every fact/handler.
Phone may keep the stacked selectable-card adaptation and 48px targets. Do not auto-select a referral
solely to reproduce the drawing's sample state; an empty detail prompt is truthful when no selection
has been made.

## Accepted content and state differences

- The app captures show six queued referrals and current waits while the drawing shows seven sample
  records. Current engine records and ordering prevail.
- The intake app captures are an unlinked, unanswered draft; the drawing is a linked, partly answered
  referral. The blank fields, full destination explanations, and blocked Send state are therefore
  expected and must remain reachable.
- Add patient intentionally requires record number, date of birth, given name, and family name, with
  optional Gender. The drawing's additional required Sex control is not supported by the current
  model and should not be invented in a presentation correction.
- The app's full 23-route shell and current counts differ from the smaller drawing registry by design.

## Evidence limits

These are first-viewport image comparisons. They do not prove below-fold order, scroll ends, focus,
keyboard operation, live selection/mutation states, validation, print, or forced colours. No browser
interaction or tests were run. No product source was changed.
