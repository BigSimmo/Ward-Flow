---
version: alpha
colors:
  canvas: "#e8ecf0"
  surface: "#fdfdfe"
  ink: "#161a20"
  secondary: "#414953"
  help: "#5b646f"
  controlEdge: "#808892"
  accent: "#245a8c"
  error: "#9a3424"
typography:
  sans:
    fontFamily: "Geist, Segoe UI, system-ui, sans-serif"
  data:
    fontFamily: "Geist Mono, ui-monospace, monospace"
rounded:
  control: "10px"
  panel: "16px"
spacing:
  field: "8px"
  group: "20px"
components:
  field:
    minHeight: "42px"
    mobileMinHeight: "46px"
---

# Ward Flow design context

## Overview

Ward Flow is a synthetic bed-flow prototype. Its existing blue/slate operational
style remains the product identity. Josh approved the Clear slate form direction
and implementation across content-entry areas on 28 October 2026. The approved
change improves question hierarchy, grouping and selection feedback; it does not
change clinical decisions, access, validation rules or what a save records.

The established [v9 standard](design/v9/design-system-v9.md) governs the wider
application. This document records the approved form refinement. Existing runtime
tokens remain canonical; these documented light-theme values mirror them.

## Colors

Use semantic palette tokens from
[ward-flow-v9-tokens.css](src/app/ward-flow-v9-tokens.css). Preserve the existing
dark, forced-colour and glare theme mappings. Selection combines an edge and a
native tick/radio/checkbox with a light tint. Error combines explanatory text and
a glyph with its edge. Neither state relies only on colour.

## Typography

Use the existing local Geist and Geist Mono fonts. Labels are 13 px semibold,
help and format guidance 12 px, and fields use the established body scale.
Phone text-entry fields stay at least 16 px to avoid focus zoom. UMRNs, dates,
times and counts keep their existing formatting and data types. Labels and help
wrap; important questions do not truncate to an ellipsis.

## Form copy and selection

Labels and section headings carry the routine instruction. Add help only when it
explains a required format, a non-obvious choice, missing data, a safety or legal
limit, or the consequence of an action. Remove sentences that restate a heading
or tell someone to review or select an obviously labelled control. Preserve
synthetic-data disclosure, accessible names, validation, recorded-versus-absent
meaning, and save/confirmation effects.

Native controls keep platform keyboard behaviour. Styled button radio groups use
the shared `RadioGroup` for one Tab stop and arrow-key selection. Choices that
open confirmation, navigate, or close their sheet remain explicit action buttons;
`aria-current` identifies the current choice without implying immediate selection.

## Layout

Group related answers under short section headings. Use columns only when each
field remains readable; stack questions on narrow screens. Keep actions and
missing-answer guidance together. Preserve the existing scroll owner, safe-area
and visual-keyboard behaviour of sheets and pages. Do not add viewport-sized
wrappers or sticky sections merely to achieve the drawing.

## Elevation & Depth

Forms use quiet solid surfaces and control edges. Sheets and dialogs use the
existing elevation family over their established scrim. Preserve modal focus,
background isolation and close behaviour; presentation does not add new
confirmation steps.

## Shapes

Entry controls use the 10 px radius already present in the v9 ladder. Panels keep
their existing 16 px family. Native choice marks and switch tracks stay round.
Read-only and disabled states remain distinct and legible.

## Components

The form-specific tokens below are defined once in the existing runtime owner.
They do not enlarge compact navigation, tables or unrelated chart controls.

| Semantic role      | Runtime token                    | Default             | Consumers                                |
| ------------------ | -------------------------------- | ------------------- | ---------------------------------------- |
| Entry height       | `--wf-form-control-height`       | 42 px               | Shared fields and native entry recipes   |
| Phone entry height | `--wf-form-control-height-phone` | 46 px               | Phone/coarse-pointer fields and choices  |
| Entry radius       | `--wf-form-control-radius`       | `--wf-r-sm` (10 px) | Entry boxes and answer rows              |
| Field rhythm       | `--wf-form-field-gap`            | 8 px                | Label/control/help stack                 |
| Group rhythm       | `--wf-form-group-gap`            | 20 px               | Related questions and section boundaries |
| Answer-row height  | `--wf-form-choice-height`        | 42 px               | Radio/choice rows                        |

Existing larger 48 px touch-target floors take precedence. Reuse `wf/Field`,
`TextInput`, `Select`, `Textarea`, choices, buttons and overlays where they already
own behaviour. Referral-local field wrappers and existing native screen recipes
consume the same visual tokens without replacing their domain wiring.

Native simple selects/date/time pickers retain platform-owned popups and keyboard
behaviour. Existing authored ED and search popovers retain their own interaction
contracts and receive the shared visual language. Do not emulate native options
with ad hoc ARIA or add a dependency just to match a static image.

Transport keeps the existing provider vocabulary, blank escort answer, recorded
Legal now prefill, CAD-to-follow and ETA/hold warning rules, missing-answer focus
and explicit Save transport booking action. The shared transport form groups
Collection, Timing, and Escort and legal status consistently in each host.

## Do's and Don'ts

- Keep persistent labels, description/error IDs, focus rings and all native input
  semantics. Preserve entered values, role restrictions and domain validation.
- Keep disabled and busy actions understandable and duplicate saves blocked.
- Preserve existing confirmation triggers and outcomes, dirty-draft exceptions
  and focus restoration. A visual sweep does not replace the domain engine.
- Prefer the smallest shared owner. Avoid a blanket native-input border rule:
  borderless inputs inside shared search/field wrappers would gain double boxes.
- Verify desktop, tablet, 390 px and 320 px phone layouts, long labels, validation,
  selected/focus/disabled states, dark/forced colours and action reachability.

## Existing integration contracts

Ward consumers import shared controls, including `RadioGroup`, through the
`@/components/wf` barrel. Keep the full board caption qualifying tentative
diagnosis categories; shorter individual labels do not replace that qualification.
