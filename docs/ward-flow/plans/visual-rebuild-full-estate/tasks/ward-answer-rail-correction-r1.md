# Ward Answer rail correction r1

## Scope

Applied the reviewed P2 correction from `F01-F02-F13-visual-review-r16.md` to the Ward answer breadcrumb and shell rail. The answer nav now wins the answer presentation display cascade with `display: flex`, so its existing gap/justification separates `Ward overview` from the current ward name while the existing phone column rule remains in force. The rail now uses a narrow predicate: exact href matches remain active, plus only `entry.id === "ward"` with the exact `${entry.href}/answer` child path. This promotes the same concrete ward entry and applies `data-active`, `aria-current`, and announcement state without broad prefix matching.

## Files

- `src/components/ward-management/ward/ward.module.css`
- `src/components/ward-management/shell/ward-rail.tsx`
- `tests/ward-shell-third-edition.dom.test.tsx`

The test adds the concrete `/ward/rph-adult-secure/answer` case and verifies the base ward link is active while `/wards` is not. Existing route/content behavior is preserved.

## Before snapshots

Saved under `C:/Users/joshs/AppData/Local/Temp/ward-answer-rail-before/`:

- ward.module.css: `DF1F488735A0A1809823EE3B69FD37B30A898FF5833EC956CADD29672DFEF8F9`
- ward-rail.tsx: `C498C31D14D8A1D12515003241B35FBCC9631A8D314695C9D1A9D9332D33CFB2`
- test: `4F3FED1A4E9A1785CBA7487C8AA1AA4156D4934F95375F8FE02D33F927BD12AE`

## Verification

`node .superpowers/sdd/2026-09-12-visual-rebuild-wave-one/run-focused.mjs tests/ward-shell-third-edition.dom.test.tsx` — 1 file ran, 36 collected, 36 passed, 0 failed, 1 batch. Report: `C:/Users/joshs/AppData/Local/Temp/ward-tests-FqEL6k/report-0.json`.

PostCSS parsing of `ward.module.css` passed; TypeScript `transpileModule` reported 0 syntax errors for `ward-rail.tsx`; `git diff --check` was clean. No browser/server checks run.

Current hashes: ward.module.css `5AA831BAA30019C2921575714F236E2F9B4A653ADFCC208DAD5D73D2BFFD2359`; ward-rail.tsx `D708CB7F832A028B36E15F5D64051EF72C94721FAE5BEE89622F7173265A7F64`; test `005C921A14C450B012C506F7BADE13831153577739770C6F4358A3CCA9FB414E`.
