# F06 Network correction r21

Date: 2026-09-13  
Implementer: `gpt-5.6-sol / medium`

## Scope

Changed only `src/components/ward-management/ward-management-network-third-edition.module.css` plus this report. Shared Command CSS and component behavior were not changed.

## Before evidence

The source was copied in place before editing to:

`.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/before-network-r21/ward-management-network-third-edition.module.css`

Before SHA-256: `8CEEDD33CDA48943137D66A8A44D06FF7E022054B906EAB4B3D1A0ECCC21D8B5`

## Correction

- At `max-width: 48rem`, the Network-owned pressure frame now restores its direct `PressureStrip` section to `display: grid`. The selector is scoped through `.pressureFrame` and is more specific than Command's shared `.pressureStrip { display: none; }` rule, so Network again shows its existing waiting, longest-wait, and breach facts without changing Command's phone layout or duplicating data.
- The two Network view tabs now use two equal `minmax(0, 1fr)` columns. Each tab fills its column and may wrap its label while retaining the existing `min-height: var(--ward-tap)`, tab semantics, handlers, and focus treatment. The tab row no longer owns a horizontal scroller at phone width.

After SHA-256: `F8F9F8381AF2627E8EDCB502E564DC60243A357BB562D112A894FC0C32260957`

## Verification

- `npx prettier --check src/components/ward-management/ward-management-network-third-edition.module.css` — passed (`All matched files use Prettier code style!`).
- Reviewed the exact before/after diff: only the two phone-scoped corrections above are present.
- Tests and browser checks were not run, as assigned. Runtime visual closure remains with the controller.
