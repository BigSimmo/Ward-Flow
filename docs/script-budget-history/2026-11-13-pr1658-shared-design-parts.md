# 13 Nov 2026, shared design parts (PR E, D-192)

Every limit is raised, on top of `main` at `ea4cd8b` (after PR #1657 merged), each by less than the 5 KB a PR may add:

- Home `/ward-flow`: 585.2 to 586.6 (+1.4)
- Referrals `/ward-flow/referrals`: 589.9 to 591.9 (+2.0)
- ED `/ward-flow/ed`: 538.5 to 540.1 (+1.6)
- Ward `/ward-flow/ward/rph-adult-secure`: 618.2 to 621.6 (+3.4)
- Movement `/ward-flow/movements/WF-001`: 616.9 to 618.5 (+1.6)
- Capacity `/ward-flow/capacity`: 662.4 to 666.0 (+3.6)
- ED site `/ward-flow/ed/arm-ed`: 677.9 to 681.9 (+4.0)
- Bed meeting `/ward-flow/bed-meeting`: 596.3 to 599.0 (+2.7)
- Statistics `/ward-flow/statistics`: 636.4 to 639.1 (+2.7)

After merging `main` at `ea4cd8b`, measured in KB: Home 586.4, Referrals 591.7, ED 539.9, Ward 621.4, Movement 618.3, Capacity 665.8, ED site 681.7, Bed meeting 598.8 and Statistics 638.9; each limit is the measurement plus 0.2. The figures below are the first measurement, on top of `92630b1`.

Measured with a local `next build --webpack` and `scripts/check-script-budget.mjs`. In KB: Home 583.5, Referrals 588.0, ED 538.1, Ward 618.3, Movement 615.3, Capacity 663.5, ED site 678.1, Bed meeting 596.5 and Statistics 636.4. The shared shell every route loads is 483.2 KB. Each limit is the measurement plus 0.2.

Why it grew: the shared kit parts every screen uses carry the D-192 behaviour. Compared module by module with a bundle-analyser build of `main`: the Field's row layout and its control error line (`form.tsx`, 1.7 KB raw, on screens with a form), the date box's own error words (`date-field.tsx`, 1.2 KB raw, Capacity), the Live chip publishing its pause to the Demo panel (`live.tsx`, 0.6 KB raw), a box opening on its heading instead of a drop-down (`use-modal-focus.ts`, 0.5 KB raw), count time windows (`primitives.tsx` and `choice.tsx`, 1 KB raw), the touch reason under a disabled button (`button.tsx`, 0.4 KB raw), Undo until a clock time (`toast.tsx` and `toast-timing.ts`, 0.5 KB raw), the stack keeping a re-registered layer in its place (`sheet-focus.ts`, 0.2 KB raw) and the Viewing as gate in the app frame (0.3 KB raw; the bar itself loads only when a role demo starts).

What was trimmed first, about 0.6 to 0.9 KB on every route: the loading placeholder's grey rows are drawn by the server and passed into the client shape, so the boundary that loads on every navigation no longer carries them; the dialog-only scroll body hook has its own file, so every hero and phone figure strip stopped carrying it; and the See it as session store has its own file, so the app frame's Viewing as gate no longer loads the role switching code.

Second step, same PR: the fixes that make the built screens match the approved pictures (count and window on one line, the not-yet reason drawn on the patient card, the synthetic tag placed by width on the full-screen timeline) added 0.5 to 1.0 KB on three routes. Measured: Referrals 589.0, Ward 619.0, ED site 678.8; each limit is the measurement plus 0.2. Every rise stays within 5 KB of `main`.
