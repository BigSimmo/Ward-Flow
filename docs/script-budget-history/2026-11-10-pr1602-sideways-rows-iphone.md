# 10 Nov 2026, Sideways rows on iPhone (PR #1602)

Changed on top of `main` at `9e62ee8`: Home `/ward-flow` raised 570.9 to 571.6; ward `/ward-flow/ward/rph-adult-secure` raised 609.2 to 609.8. Each raise is under 1 KB, within the 5 KB per-screen allowance in HOW-WE-WORK section 6.

Measured on hosted CI (production build of the PR head `14b27bb`): Home 571.2 KB, ward 609.4 KB. Each limit is the measurement plus about 0.4.

Why it changed: `usePanelFit` in `wf/menu.tsx`, shared by every menu and popover, now pins a panel opened from a sideways-only chip row to the window (it was cut to the row's height and scrolled the row out of view on phones). About 0.3 KB gzipped on each route that carries the kit menu.

Trim tried: the pinning code is already the smallest that places the panel and follows scrolling; loading it lazily would delay a menu's first open. No other safe trim was found.
