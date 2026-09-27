# Tasks open-movement navigation correction

Owned files only:

- `src/components/ward-management/shell/ward-bar.tsx`
- `tests/ward-shell-third-edition.dom.test.tsx`

`openMovement` now clears `openPanel` before calling `router.push`, so a Tasks Sheet cannot remain over the destination movement route. The regression uses the real `WardFlowProvider` fixture, opens Tasks, clicks `ward-task-bed-pull-WF-004`, asserts `/mockups/ward-flow/movements/WF-004`, and asserts the Tasks Sheet is gone.

Actual-before snapshots:

- `before-tasks-open-movement-ward-bar.tsx`: `694DC869018FF4B765810D11B07650C71460D164BF17A09ACBEBAC1E4A8B6781`
- `before-tasks-open-movement-ward-shell-third-edition.dom.test.tsx`: `005C921A14C450B012C506F7BADE13831153577739770C6F4358A3CCA9FB414E`

Current hashes:

- `ward-bar.tsx`: `1854A78F5CCCF06BBCE9C70D6D3E5AF74D5AD202BD3E6F59D9407C77FF82F0A5`
- `ward-shell-third-edition.dom.test.tsx`: `85A69AF46A621206C226ED6E1C090FF709BEB8D0FA5CEA5D0333D366A7A119BD`

`git diff --check` passed. Focused command attempted once:
`node .superpowers/sdd/2026-09-12-visual-rebuild-wave-one/run-focused.mjs tests/ward-shell-third-edition.dom.test.tsx`

The runner was blocked before test collection by `DATABASE_HEAVY_RUN_ADMISSION_BUSY`: current owner PID 31576 in the rag-local-build worktree running U04 `U04-result-semantics-1`. No test result is claimed.
