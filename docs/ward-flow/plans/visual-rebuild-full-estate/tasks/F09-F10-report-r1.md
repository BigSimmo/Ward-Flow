# F09/F10 Officer, On-call, Alerts and Legal forms report — r1

Date: 2026-09-13  
Worker: `gpt-5.6-sol / medium`  
Plan SHA: `2194350e1ad66ed47049cf7eaa115db7789d8bebae18ab06c465559b253b4155`

## Scope and evidence read

Implemented presentation and panel-structure changes only in the four dedicated screen/CSS pairs.
No shell, primitive, shared token, provider, reducer, derivation, roster, legal model or test file
was edited.

All eight HTTP-served light-theme references were viewed before editing:

- `transport-officer-reference-{1440,390}-light.png`
- `on-call-reference-{1440,390}-light.png`
- `alerts-reference-{1440,390}-light.png`
- `legal-forms-reference-{1440,390}-light.png`

The corresponding four build contracts and the Legal forms ordering ruling at
`owner-decisions-2026-09-1x.md` O-19.1 were read before implementation.

## Before-source evidence

Exact before bytes and `manifest.json` are under
`.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/before-F09-F10/`.

| File                                 | Before SHA-256                                                     |
| ------------------------------------ | ------------------------------------------------------------------ |
| `officer/officer-screen.tsx`         | `AA4BD10A1A8BEE35151C0F8DBE2BA8FCC570FA142B6C27DA40D1D0C2F02F9DE1` |
| `officer/officer.module.css`         | `24379B42A84855C15E05AA57A18C7282AA041686D32123DF783E74EF168FF3A3` |
| `on-call/on-call-screen.tsx`         | `ABFBEDFD771D03397FDE66692B70B87F832CD40CAD4DE2D9BFC7E11C22CCE953` |
| `on-call/on-call.module.css`         | `9B36A984EB55C9493DF2CE21D0783AB45DF08ADC5ACE8B03E4D8E0CF5B206215` |
| `alerts/alerts-screen.tsx`           | `04629956EF26225501FECB654E9BDBEDB13BCBD70283812394F5806362C1DC15` |
| `alerts/alerts.module.css`           | `613F1849B30511A5B8DB40D23C232C0D4ED8F91C2BECC3414530D3C6171B8973` |
| `legal-forms/legal-forms-screen.tsx` | `D88DD4AA9E39915965235913DD7A3B1748510B8D9F6F35E7167ED6D01E1D6347` |
| `legal-forms/legal-forms.module.css` | `62161F5DCE0684D30B1C87C46ADC0014C2AF688BD6171EC3CBBCB9EA17D6B226` |

## Implemented

### Transport officer

- Reshaped the body into the drawing's **Refused actions** and **Transport jobs** panels with
  panel headers, counts, inset rows and strong lower panel edges.
- Moved the existing no-officer-identity explanation into the Transport jobs header so it remains
  adjacent to the population it qualifies.
- Preserved the exact job predicate, every job fact, four-stage stepper, refusal population,
  “Work this job” selection and all four individually gated dispatch controls. The existing fixed
  phone action row and safe-area reserve remain unchanged.

### On-call and contacts

- Added the drawing's responsive four-region grid: **On-call now** full width; **ED liaison** and
  **Reaching a role** side by side on desktop; the disclosure footer full width. It becomes one
  column at `62.5rem`.
- Recast the service roles as a semantic table with Health service, Coordinator on call and Duty
  consultant columns. Every role still comes from `SERVICE_ON_CALL_ROLES`, and every shift still
  carries its own “invented” marker.
- Preserved both network roles, all service gaps, the complete ED table and every no-contact
  statement. The missing-service note remains derived from `servicesWithNoRoleRecorded()`.
- Grouped the existing provenance statements into drawing-shaped inset cells and added a purely
  derived reconciliation sentence from `counts` and `departments.length`.

### Alerts

- Preserved **Needs you**, **For other roles**, and **What is invented and what is real** in the
  drawing's three-panel order.
- Moved the existing handover-timing limitation into **For other roles** as a visibly separate
  condition. It remains a stated absence and was not converted into an alert.
- Made actual alert rows inset bordered records while retaining every condition scope sentence,
  empty-state statement, owner, tone and source population.

### Legal forms

- Kept the established two drawing panels and widened the desktop split at the common `62.5rem`
  breakpoint. The screen component already had the required structure, so its TSX bytes are
  intentionally unchanged.
- Preserved the binding two-group order: deadline-bearing forms are ordered by their deadline;
  forms with no recorded deadline are separately ordered by longest wait. They are never ranked
  against each other.

## Deliberate deviations and missing facts

- Officer retains four action buttons instead of the drawing's single next-action button. The
  existing one-handed workflow and each reducer refusal reason are behavior contracts and remain
  authoritative.
- Officer remains unable to filter jobs to an officer identity. No officer person, vehicle, phone
  or roster exists; every outstanding job stays visible.
- On-call shows no phone number, pager, extension, address or named staff member. Its role slots and
  shift windows remain explicitly invented. Counts may differ from the drawing because the current
  roster includes the model's full health-service set, including Private.
- Alerts does not fabricate the drawing's timed “Handover sheet due” row, a gate name for an
  override, or unsupported addressee roles. The visible limitation explains the missing handover
  timestamp.
- Legal forms renders movement IDs rather than patient names and does not add deadlines for Forms
  1A, 3B or 3D. The right panel does not claim who may renew a form because the model records no
  such authority.
- The screens retain their local synthetic/governance preambles because those visible caveats are
  established safety content. This makes the app content begin lower than the drawings' first
  panels; removing or hiding them was outside a presentation-only preservation pass.

## Output hashes

| File                                                                | Output SHA-256                                                     |
| ------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `src/components/ward-management/officer/officer-screen.tsx`         | `510A9133CBBD3834076BABBCE9F7AD52156E8CC753F539168D8FF929A3CF07D4` |
| `src/components/ward-management/officer/officer.module.css`         | `B42FCAFD3621AEA62E87B9019027103C1D97D1AA4E251AD30E07018FE119147D` |
| `src/components/ward-management/on-call/on-call-screen.tsx`         | `4E713F4D41A60B82C3764EAB5D5C309E1220565C1DC602A56561D04DEFBDB832` |
| `src/components/ward-management/on-call/on-call.module.css`         | `A6917EA7FD0DD277B47451F4A7F1407E1D3E55BD551F4DF0E9C4AFEC53FFCC2F` |
| `src/components/ward-management/alerts/alerts-screen.tsx`           | `22CA628A77B52EDE2E8CB76C25D2F712377BD2827F19BB512A3655F63D64F6BA` |
| `src/components/ward-management/alerts/alerts.module.css`           | `A418A4A729368B6571D85F9A48FB6529951852AC0286A2FD63503D6CC288A5DD` |
| `src/components/ward-management/legal-forms/legal-forms-screen.tsx` | `D88DD4AA9E39915965235913DD7A3B1748510B8D9F6F35E7167ED6D01E1D6347` |
| `src/components/ward-management/legal-forms/legal-forms.module.css` | `9FABEA4DCE5A3A538087F0E6A917300B1854C93560E527F0F72DD05FD583EF7A` |

## Source checks and pending evidence

- TypeScript `transpileModule` syntax parsing passed for all four TSX files.
- PostCSS parsing passed for all four CSS modules.
- `git diff --check` passed for the eight-file scope.
- No test, typecheck, browser, server, print emulation or provider command was run, per controller
  ownership. App/reference comparison, phone fixed-action reachability, table overflow, dark theme,
  forced colours and print remain pending controller evidence.
