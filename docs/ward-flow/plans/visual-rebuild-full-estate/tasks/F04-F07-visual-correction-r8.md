# F04/F07 visual correction — r8

## Scope and evidence

Exclusive source scope was limited to:

- `src/components/ward-management/referrals/referral-intake.tsx`
- `src/components/ward-management/referrals/referral-board.tsx`
- `src/components/ward-management/referrals/referrals.module.css`
- `src/components/ward-management/patients/add-patient.tsx`
- `src/components/ward-management/patients/add-patient.module.css`

The r8 app/drawing pairs at 1440px and 390px were reviewed before implementation. Exact before bytes and hashes are stored in `.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/before-F04-F07-visual-r8/manifest.json`.

| File                     | Before SHA-256                                                     | After SHA-256                                                      |
| ------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `referral-intake.tsx`    | `96E6624AAE6CF8555535EF72F964C1EFB730CA8CD94BEB0D04E51C89A621C8BF` | `84F6C42AF80312CAD8A87A657525A54D754EF465795A789F83BA859B1E994A6F` |
| `referral-board.tsx`     | `C21AC58D6278E08E617E1F9B02F4F7ECE64BCE29750930B275CB308A2FC65855` | `C21AC58D6278E08E617E1F9B02F4F7ECE64BCE29750930B275CB308A2FC65855` |
| `referrals.module.css`   | `C124E408D4747AEEAE301BBDFD040544D2CA1E51075E4C6A3A4E6B400F18225D` | `446F2517E2AD602A6D85EE90E08E3AC54E1121B4814A74B1AF297CE65C3E4A8F` |
| `add-patient.tsx`        | `3EDB5A3D22EBA181CA3938622331F7C4C938F242159A70BA981EE86F0E43AA21` | `DB36FF393236D15B66A47CC97BB7F0B0A40DCE3E8D95C61AA213BF399B18E181` |
| `add-patient.module.css` | `B6C5D035784AE54BA32CCAF79EFF8BF8FB9749CA58BA64888A2FC93C00DB8BDC` | `CD7BC353BADDC4769E0A19EB229DCB33C3290B0715DE954517DAD89D71511D3C` |

## Implemented correction

### Referral register

- Reused the register's existing selectable card rendering at desktop instead of squeezing the wide table into the left workspace column.
- The card buttons retain the existing referral ids, wait/tier/request facts, selected state and `onSelect` callback. The explicit empty detail remains until the user selects a referral; no referral is preselected.
- The existing table remains mounted and is restored for print. The phone card behavior is unchanged.
- `referral-board.tsx` required no edit because it already rendered both representations from one queue and one selection handler.

### Referral intake

- Grouped the three existing step fieldsets into a sequential question column and the existing destination fields, result messages, Send button and unavailable reason into a decision column.
- At desktop the form now matches the drawing's proportions: vertically stacked Step 1/2/3 at left, `Where to refer` and Send at right. Progress, record summary and sending explanation follow as a three-card context row rather than displacing the decision workflow.
- At phone width the DOM remains one readable sequence: person context, questions, destinations, Send, then context cards. No fixed or overlaid action was introduced.
- When the generic intake route has no `patientId`, it now renders a truthful `The person — Not linked` panel stating that no identity is inferred. The existing linked-person branch, pointer, duplicate status and every form field remain unchanged.
- The wrappers sit inside the existing `<form>`, so validation, submit, refusal/confirmation state, destination ordering and dispatch remain owned by the same handlers.

### Add a patient

- Paired the four existing required identity fields into two desktop rows: record number/date of birth and given/family name.
- The optional Gender field and its existing explanation span the full form width. Submit, rejection and unavailable reason remain full-width.
- The established single-column phone form is unchanged.

## Behaviour retention and deviations

- No engine, reducer, provider, shared shell, primitive or test file changed.
- Referral queue order, selection, destination options, validation, rejection and submission actions were not changed.
- The drawing's named referral subject is not fabricated on the generic route. It appears only when the existing `patientId` resolves; otherwise the new panel states the absence.
- Add patient still has no Sex input because the current `ADD_PATIENT` model does not accept that field. This remains an explicit engine/design deviation requiring separate behaviour authority.
- The register uses the existing app card anatomy rather than copying drawing-only referral prose. Its richer engine population remains authoritative.

## Verification

- TypeScript syntax parsing with the installed compiler reported `syntax ok` for `referral-intake.tsx` and `add-patient.tsx`.
- `git diff --check` over all five owned files produced no errors.
- Snapshot-relative change sizes were bounded: intake TSX `+18/-1`, referrals CSS `+43`, Add-patient TSX `+1/-1`, Add-patient CSS `+15`; referral-board TSX is byte-identical.
- Tests, typecheck, server and browser runs were not performed, per controller ownership. Served visual closure at both widths and lower-phone reachability remain pending.
