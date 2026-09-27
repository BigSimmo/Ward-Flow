# F00 Tasks drawer correction r15

Date: 2026-09-13  
Implementer: `/root/hub_inventory`

## Scope and evidence

The correction is confined to:

- `src/components/ward-management/ward-tasks-drawer.tsx`
- `src/components/ward-management/ward-tasks-drawer.module.css`

The supplied `tasks-app-1440-light-r15.png` and `tasks-mock-1440-light-r15.png` were viewed at original detail. The app showed dark legacy danger/warning fills inside a light Sheet and blank white acknowledgement controls. The authoritative drawer keeps a light, flat list with explicit Notices and Work open sections.

Actual input bytes were saved before editing under
`.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/before-F00-tasks-r15/`.

| File                           | Before SHA-256                                                     | After SHA-256                                                      |
| ------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `ward-tasks-drawer.tsx`        | `CEB15977C06FAACC1B1690362E81BDF652735B425251402961044B30022A89BB` | `C834E313794628EE29B30F83B740B4977BB71E668280F0D619D49467B741E45A` |
| `ward-tasks-drawer.module.css` | `63BE3771E09A16B47751CD8C2D6217AC9992D462899919AC67D2D274BE64B94D` | `F3FA390534BDF25A268721B343711843BDB5AA93BFB96E25D9CF3560A59BB049` |

## Implementation

The portalled drawer now bridges every legacy Ward role it consumes to the canonical shell palette on its own root. Danger and warning remain explicit through their icon and words, while rows use the reference's flat surface and hairline separators. Acknowledge, complete, and reopen controls retain a 48px minimum and now paint explicit canonical foreground, edge, hover, and focus-compatible colors.

The content is split into two labelled sections:

- **Notices** truthfully states that this component is not connected to the reducer's separately authored notice feed. It does not relabel derived inbox facts as notices or claim that no notices exist.
- **Work open** contains the same `items` array and reports its exact length. Every existing row remains selectable and retains its title, detail, owner, tone icon, Standing fact/Task label, acknowledgement history, completion history, and action handlers.

Acknowledgement remains a record of responsibility with no clinical effect: it neither changes the row tone nor removes the standing fact. The existing reducer-authoritative commitment branch remains intact for any future item classified as a commitment.

No change was needed in `ward-tasks-panel.module.css` or any shared Sheet/bar source.

## Focused source checks

- TypeScript parser: zero diagnostics for `ward-tasks-drawer.tsx`.
- CSS Modules local-by-default parser: purity check passed.
- CSS-class reference scan: every `styles.*` reference resolves to a local class.
- Before/after AST comparison: all four existing `data-testid` attributes remain; no dispatch action literal was removed or added.
- `npx prettier --check` over both owned files: `All matched files use Prettier code style!`
- `git diff --check` over both owned files: passed.

No tests, browser checks, server operations, or Git mutations were run under the controller-owned verification boundary. Runtime light/dark rendering, Sheet overflow, and acknowledgement interaction remain for controller verification.
