# F02 Wards and Emergency department correction r11

Date: 2026-09-13  
Implementer: `/root/hub_inventory`  
Plan: `2194350e1ad66ed47049cf7eaa115db7789d8bebae18ab06c465559b253b4155`

## Scope and inputs

This bounded correction implements the five findings in
`F02-wards-ed-visual-review-r11.md`. Product changes are confined to:

- `src/components/ward-management/wards/ward-index.tsx`
- `src/components/ward-management/wards/ward-index.module.css`
- `src/components/ward-management/ed/ed-screen.tsx`
- `src/components/ward-management/ed/ed.module.css`

Byte-for-byte inputs were saved before editing under
`.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/before-F02-wards-ed-r11-correction/`.

| File                          | Before SHA-256                                                     | After SHA-256                                                      |
| ----------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `wards/ward-index.tsx`        | `7FDE8803CECB37622FF47C6337EE613AE81DDFA626D04B98F041BAF2889F4E9D` | `902D04CE3E21D9287122A720D42EAFE0F5E0D9E6B5F29DFE6BC6718E7B16566C` |
| `wards/ward-index.module.css` | `B174206B8C13CC91513438C074D8D68EFB2455ECAAFD577341C4BAA0F612523D` | `B6B0CAE1FDE0EA2AD32B35BA4A497653EAC61E158867DCDE64166A461EA6838A` |
| `ed/ed-screen.tsx`            | `605BE9D5F5452102564ACCA87F25058734AB74B9100D02B213818E0E8C43F135` | `D91156AB8283A4592C4190018E7E35B42D7013FA81BAF65C24CF8598702D088C` |
| `ed/ed.module.css`            | `ED452ED86D04DA8FDB9A2D796AED2762087C47E44D9F7B9E45D8DF80A5481496` | `3919D980FD16C1331F65094081B9C09591393AF057DB743605AB815A1E67BBFD` |

## Implementation

The Wards directory now states that it always shows the whole prototype network and is not filtered by the shared service choice. Each existing ward link is a discrete bordered card with a gutter, while the service headings use a lighter section-label treatment. The existing catalog, grouping, order, names, kinds, hrefs, empty groups, unplaced fallback, and minimum target geometry are unchanged.

The ED selected-department identity is now attached to its department switcher. Four compact readings use only existing arrays: expected, referrals here, recently answered, and still to be moved. The working area groups the existing Expects and Referrals populations under **Needs attention**, and the existing answered and outbox populations under **Department lists**. All original rows, explanations, empty states, clocks, mutations, and ordering remain inside those groups.

The ED page's canonical token layer now supplies the legacy text and border aliases still consumed by its existing cards and controls. This restores explicit colors for referral clocks and `Mark arrived in department` without changing the 48px target or handler.

## Deliberate design differences

- The ED group headings are always-visible instruments rather than interactive tabs. This preserves simultaneous access to every existing population without adding hidden state, print behavior, or keyboard behavior that the engine does not require.
- The department switcher reports only the screen's existing open-movement count, and the attached identity reports only existing population lengths. No wait, breach, urgency, or worst-first claim was added.
- The Wards directory keeps all 23 current engine/catalog entries and adds no capacity figures or ranking.

## Focused source checks

- TypeScript parser: both TSX files parsed with zero diagnostics.
- CSS Modules local-by-default parser: both CSS files passed purity processing.
- Prettier check over the four owned files: `All matched files use Prettier code style!`
- Before/after AST comparison: Wards retained all 6 `data-testid` attributes; ED retained all 77. No dispatch action literal present in the before files was removed or added.
- Source-order check: ED is ordered as switcher + attached identity, then Needs attention (`Expects`, `Referrals`), then Department lists (`Recently answered`, outbox), followed by the existing referral-entry and later panels.

No tests, browser checks, server operations, or Git mutations were run under the controller-owned verification boundary. Rendered light/dark, responsive overflow, focus, and mutation acceptance remain for controller verification.
