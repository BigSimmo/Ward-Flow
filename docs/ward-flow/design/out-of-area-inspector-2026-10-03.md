# Out-of-area inspector redesign

Task identity: `out-of-area-inspector-20261003`.
Repository: `BigSimmo/Ward-Flow`.
Base: `d8c1a05c24a55282c90547725ae9f397cf2ef284`, the provided main merge snapshot.
Branch: `codex/out-of-area-inspector`.

The out-of-area register now uses a slim segmented summary bar, a naturally
scrolling table and an inspector that fits its content. The compact overview groups
catchments into clickable rows with proportional bars. It avoids duplicating the
summary strip and presents the longest stay as one compact, actionable record. The longest current stay
is labelled as duration, without asserting clinical priority.

Selecting a patient shows their identity and elapsed stay in one header, followed
by a compact definition list for current placement, home catchment and travel band.
The arrangement and profile actions share one footer row. Previous/next controls follow the visible register;
selection outside the active filters is explicitly labelled. Closing returns
focus to the original row or card. Profile links retain their keyboard behaviour.
An explicit patient selection is required before initiating repatriation, avoiding
an arrangement silently assigned to the first patient in the cohort.

The inspector no longer claims clinical stability, readiness, a specific receiving
unit or a bed-vacancy status absent from the underlying record. The existing
repatriation form and reducer event remain the arrangement workflow. Summary
counts describe the whole cohort; the table count and navigation describe the
filtered register. Travel labels and elapsed time retain the existing derivations.

The inspector is sticky on sufficiently tall desktop viewports and rejoins normal
page flow on shorter screens, tablets and phones. The table keeps all five columns
on tablets and uses the existing patient cards on phones. No nested vertical
scrolling or equal-height inspector is imposed.

The visual refinement reduces the summary to one 52px desktop strip, with compact
figures, subtle dividers and a clear active underline. Travel requirements use plain
text and a small transport symbol, without a filled badge or border. The register
uses quieter metadata links, clearer header contrast and tighter row spacing. The
inspector retains its compact structure with a lightly tinted header and stronger
field labels. All colours continue to use the existing light/dark theme tokens.

Validation is local and synthetic. See the task receipt and browser report in the
private review workspace for executed checks. This design preview does not assert
clinical validation, hosted integration, release readiness or deployment.
