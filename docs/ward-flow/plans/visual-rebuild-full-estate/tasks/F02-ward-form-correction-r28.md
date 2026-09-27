# F02 Ward maintenance form correction r28

Date: 2026-09-13  
Scope: `ward/ward.module.css` and `ward/ward-screen.tsx` only

## Changes

- `.capacityRow` now uses `align-items: flex-end`, so the release action retains its existing minimum target height instead of stretching to the multiline Waiting-on field group.
- `.capacityRow select.capacityInput` now uses `width: min(16rem, 100%)`. Number and time inputs retain the existing 6rem width; waiting-on and blocker select values gain enough room to remain readable and still shrink inside a narrow container.
- The bed-count explanation now includes an explicit JSX word boundary before **Confirmed**, fixing the rendered `disagree.Confirmed` collision without changing the wording.

All controls, labels, option values, validation, events, visibility, order, and engine actions are unchanged.

## Evidence

- Before snapshots: `.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/before-ward-form-r28/ward.module.css` and `ward-screen.tsx`
- CSS before SHA-256: `1D525CCAF984E6188B9C62F9477E905B0E5D600B6B7C64E0DFAFEEC0455C2F8C`
- CSS after SHA-256: `855648CF9F99148700E1A49240B91780A0034A748D55C55630F88F07850AB831`
- TSX before SHA-256: `12BA611F2CF2CBB2DFF238D3ABEF65B93C60D76D6C4C033929390CE6649908A6`
- TSX after SHA-256: `DB5DB4B56EAE47BAD6FAE8F70E1F164FF2F858FF372D69F1FC93E0035514EEC9`
- Formatting: Prettier was run once over both owned files; CSS was unchanged by formatting and the edited JSX paragraph was normalized.
- `git diff --check` completed without errors for both files.

Tests and browser checks were not run by instruction. The select text, 1440 px action height, and word boundary still require controller-owned served visual closure.
