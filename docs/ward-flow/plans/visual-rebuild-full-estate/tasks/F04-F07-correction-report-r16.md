# F04/F07 correction report r16

Date: 2026-09-13  
Writer: `/root/hub_inventory`

## Exact ownership

This correction owned only:

- `src/components/ward-management/referrals/referral-intake.tsx`
- `src/components/ward-management/referrals/referral-board.tsx`
- `src/components/ward-management/referrals/referrals.module.css`
- `src/components/ward-management/patients/add-patient.tsx`
- `src/components/ward-management/patients/add-patient.module.css`

Exact pre-edit bytes were copied beneath
`.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/before-F04-F07-r16/`, preserving each source
path. No drawing, model, provider, shared shell, primitive, or test file was changed.

## Changes

- Added page-root canonical-to-legacy semantic bridges for Referral intake, Referral board, and Add
  patient. Existing nested labels, fields, buttons, row surfaces, warning/success states, and muted
  copy now resolve from the active third-edition light/dark palette without changing global tokens.
- Reset the two page-owned legacy phone-bar reserves to zero on rebuilt roots. The in-flow shell and
  rebuilt main padding now provide the single gap before content.
- Moved Add patient's existing two-pair identity layout to a tablet breakpoint while keeping the
  page's two-panel desktop layout at 64rem. Phone remains one column; Gender and submission feedback
  continue to span the form. No Sex field or new model fact was introduced.
- Converted Referral board's mounted selectable cards into compact triage rows with one enclosing
  surface, separators, an inline wait reading, selected-row accent, and bounded tablet scrolling.
  Phone retains stacked reading at narrow widths. IDs, urgency wording, waits, person facts,
  refusals, fixed queue order, selection handler, test IDs, and the truthful no-selection detail
  prompt are unchanged.
- Applied Prettier to all five owned files. `referral-intake.tsx` had no behavioral edit; its hash
  changed only because the requested formatter normalized the previously unformatted file.

## File hashes

| File                     | Before SHA-256                                                     | After SHA-256                                                      |
| ------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `referral-intake.tsx`    | `84F6C42AF80312CAD8A87A657525A54D754EF465795A789F83BA859B1E994A6F` | `32B1D0BB4BF0570004717F19AF167EBBD09DCC7954B974C2A147529A505ED9B8` |
| `referral-board.tsx`     | `C21AC58D6278E08E617E1F9B02F4F7ECE64BCE29750930B275CB308A2FC65855` | `A44BCA50C38CA5D7F8C3D5CFD4197BB0FCCCE53996E014785D6CD33371F91D6E` |
| `referrals.module.css`   | `446F2517E2AD602A6D85EE90E08E3AC54E1121B4814A74B1AF297CE65C3E4A8F` | `6B2725211DF5FB6BD4D52AA3D785ACFB1F9DC279E12F435C19225632AFE9D459` |
| `add-patient.tsx`        | `DB36FF393236D15B66A47CC97BB7F0B0A40DCE3E8D95C61AA213BF399B18E181` | `DB36FF393236D15B66A47CC97BB7F0B0A40DCE3E8D95C61AA213BF399B18E181` |
| `add-patient.module.css` | `CD7BC353BADDC4769E0A19EB229DCB33C3290B0715DE954517DAD89D71511D3C` | `94209C96236B975EFD7BF6C3E900EE1ACE7A30E576EAEB46C184162C44251098` |

## Static checks

- `npx prettier --check` on all five owned files: passed.
- PostCSS parsed both owned CSS modules without an error.
- New CSS selectors are rooted in local module classes; no bare attribute/global selector was added.
- No tests or browser checks were run, per controller instruction. Fresh served light/dark and
  responsive QA remains controller-owned.
