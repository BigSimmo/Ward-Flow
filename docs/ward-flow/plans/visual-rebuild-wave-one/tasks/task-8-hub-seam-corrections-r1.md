# Task 8 Hub seam corrections — revision 1

Date: 2026-09-13  
Source baseline: `1ef9ed3975078b789e9b5d70b3f000c64edc3809`

## Corrected result

- Added a Ward-local `usePrintableDisclosures` hook. It responds only to `details.source-print`, temporarily removes each disclosure's `name`, opens it for printing, and restores the exact prior `open` and `name` state after print or effect cleanup. Document Viewer remains outside the Ward Flow seam.
- Switched Hub, Community and Statistics overview to the Ward-local hook. Community and Statistics received import-path changes only in this correction.
- Added a focused jsdom test covering one initially-open and one initially-closed named Ward disclosure. It checks temporary expansion and name removal, exact restoration, and that a Document Viewer named disclosure outside `.source-print` remains untouched.
- Replaced Hub's native overview table shell with `WardTable`. The health-service rows, total footer, values and numeric-column classes are unchanged. Hub now uses the canonical table wrapper and cell padding/border rules; its existing local header, footer and numeric typography remain. No selectable result, link, handler or test id changed.

The table migration removes the duplicate Hub cell padding/border declaration instead of exempting, disguising or weakening the single-source guard. The primitive already accepts caller-owned table children and a local class, so no shared primitive change was needed.

## Output hashes

- `src/components/ward-management/use-printable-disclosures.ts`: `02BBD3EBC17A102EA57522C5DE3A5322483B8032889572DA37DDDAA3A7C73DB6`
- `tests/ward-printable-disclosures.dom.test.tsx`: `4D3D62B8D04D56E5FEAAD75CAF7D3AA81193E8EB9933714EBDFC0F038D3C240D`
- `src/components/ward-management/hub/hub-screen.tsx`: `A045BED6A0F7DD334DDF1732266231D776BAC759EF39421AA2C8A95F56CDDE02`
- `src/components/ward-management/hub/hub.module.css`: `5DF8F5878C3E9B62DD9DB27A231C7F4D919338879B2570B323952EB957AB927B`
- `src/components/ward-management/community/community-screen.tsx`: `9268AC97766F3BAA702DF49F1B4F8AD68ECF9A0C537451D83F6DD48EB5892294`
- `src/components/ward-management/statistics/statistics-overview-screen.tsx`: `CFCAB7EAF962CBDAC3C75CB086FCC5F93659E1B29BEDF11997B31FD10C646BDA`

## Verification boundary

Prettier reported all four implementation/test files it was asked to format as unchanged. `git diff --check` over the six source/test paths produced no output. Source inspection confirms the three screens no longer import the Document Viewer hook and Hub no longer emits a native table or declares cell padding/borders locally.

Per controller instruction, no test, browser or server command was run. The new hook test is authored but unexecuted; the controller retains integrated verification and runtime acceptance.
