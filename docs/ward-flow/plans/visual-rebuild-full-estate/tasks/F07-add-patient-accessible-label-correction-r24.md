# F07 Add patient accessible-label correction r24

Date: 2026-09-13  
Owner: `/root/hub_inventory`

## Scope

Owned and inspected:

- `src/components/ward-management/patients/add-patient.tsx`
- `src/components/ward-management/patients/add-patient.module.css`

Actual-before copies are under
`.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/before-add-patient-labels-r24/`.
Only the TSX changed; the page CSS remains byte-identical.

## Failure and correction

The integrated Ward run reported 21 `tests/ward-add-patient.dom.test.tsx` failures where exact
`getByLabelText("Record number")`, `Given name`, `Family name`, or `Date of birth` queries no longer
matched. The visible r19 correction placed an aria-hidden **Required** span inside each associated
`label`; Testing Library's label-text lookup still matched the label node's full rendered text, so the
old exact base query stopped resolving the input.

Each of the four governed identity inputs now has an explicit base `aria-label` matching its stable
field name exactly:

- `Record number`
- `Date of birth`
- `Given name`
- `Family name`

The associated visible labels, visible Required markers, `aria-required="true"`, ids, test ids,
values, handlers, autocomplete behavior, input types, four-field availability gate, duplicate check,
and submission behavior are unchanged. Gender remains optional and unchanged. This restores the
pre-marker accessible names without weakening the visible requirement cue or changing validation.

## Hashes and static checks

| File                     | Before SHA-256                                                     | After SHA-256                                                      |
| ------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `add-patient.tsx`        | `BA341929ED4F257B41BB9A5F3884D9B4C6407EF691292DE63D43F325798CC06F` | `0A7AA2E44FEC5CC0D0B02582C3CADE587BD5E80F703B59AFDE95452DFD1A3D0B` |
| `add-patient.module.css` | `5C550545EAA7C300D26DD285C265A55D6DEBEB99F5D9EF8C169B1D627211E5F3` | `5C550545EAA7C300D26DD285C265A55D6DEBEB99F5D9EF8C169B1D627211E5F3` |

Static counts confirm exactly four governed base `aria-label` attributes, four
`aria-required="true"` attributes, and four visible `requiredMarker` uses.

No test or browser command was run by this worker. Controller target:

`node .superpowers/sdd/2026-09-12-visual-rebuild-wave-one/run-focused.mjs tests/ward-add-patient.dom.test.tsx`

The Statistics index-entry visual gap is separate: the r24 files named for the index showed hidden
disclosure descendants could not be captured while the **Explore statistics by ward, department,
service or community team** details element was closed. No Statistics source changed in this task.
