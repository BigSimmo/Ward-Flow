# 13 Nov 2026, shared design parts (PR E, D-192)

Every limit is raised, on top of `main` at `92630b1`, each by less than the 5 KB a PR may add:

- Home `/ward-flow`: 582.3 to 583.7 (+1.4)
- Referrals `/ward-flow/referrals`: 586.8 to 589.2 (+2.4)
- ED `/ward-flow/ed`: 536.4 to 538.3 (+1.9)
- Ward `/ward-flow/ward/rph-adult-secure`: 615.8 to 619.2 (+3.4)
- Movement `/ward-flow/movements/WF-001`: 613.5 to 615.5 (+2.0)
- Capacity `/ward-flow/capacity`: 660.0 to 663.7 (+3.7)
- ED site `/ward-flow/ed/arm-ed`: 674.7 to 679.0 (+4.3)
- Bed meeting `/ward-flow/bed-meeting`: 593.8 to 596.7 (+2.9)
- Statistics `/ward-flow/statistics`: 633.9 to 636.6 (+2.7)

Measured with a local `next build --webpack` and `scripts/check-script-budget.mjs`. In KB: Home 583.5, Referrals 588.0, ED 538.1, Ward 618.3, Movement 615.3, Capacity 663.5, ED site 678.1, Bed meeting 596.5 and Statistics 636.4. The shared shell every route loads is 483.2 KB. Each limit is the measurement plus 0.2.

Why it grew: the shared kit parts every screen uses carry the D-192 behaviour. Compared module by module with a bundle-analyser build of `main`: the Field's row layout and its control error line (`form.tsx`, 1.7 KB raw, on screens with a form), the date box's own error words (`date-field.tsx`, 1.2 KB raw, Capacity), the Live chip publishing its pause to the Demo panel (`live.tsx`, 0.6 KB raw), a box opening on its heading instead of a drop-down (`use-modal-focus.ts`, 0.5 KB raw), count time windows (`primitives.tsx` and `choice.tsx`, 1 KB raw), the touch reason under a disabled button (`button.tsx`, 0.4 KB raw), Undo until a clock time (`toast.tsx` and `toast-timing.ts`, 0.5 KB raw), the stack keeping a re-registered layer in its place (`sheet-focus.ts`, 0.2 KB raw) and the Viewing as gate in the app frame (0.3 KB raw; the bar itself loads only when a role demo starts).

What was trimmed first, about 0.6 to 0.9 KB on every route: the loading placeholder's grey rows are drawn by the server and passed into the client shape, so the boundary that loads on every navigation no longer carries them; the dialog-only scroll body hook has its own file, so every hero and phone figure strip stopped carrying it; and the See it as session store has its own file, so the app frame's Viewing as gate no longer loads the role switching code.

Second step, same PR: the fixes that make the built screens match the approved pictures (count and window on one line, the not-yet reason drawn on the patient card, the synthetic tag placed by width on the full-screen timeline) added 0.5 to 1.0 KB on three routes. Measured: Referrals 589.0, Ward 619.0, ED site 678.8; each limit is the measurement plus 0.2. Every rise stays within 5 KB of `main`.
