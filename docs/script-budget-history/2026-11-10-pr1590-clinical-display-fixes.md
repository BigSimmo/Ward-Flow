# 10 Nov 2026, Clinical display fixes from the 10 Nov audit (PR #1590)

Raised on top of `main` at `3f4b957`: ED `/ward-flow/ed` 529.4 to 529.6 and ED arm `/ward-flow/ed/arm-ed` 664.5 to 664.7. Within the 5 KB per-screen allowance in HOW-WE-WORK section 6.

Measured by hosted CI on the merged branch: ED 529.4 KB (main alone 529.2) and arm-ed 664.5 KB (main alone 664.4), each on its line. Every other route stayed under its limit.

Why it grew: D-122 adds four synthetic entries to the clinical values register (forecast alerts and the handover prompt), and the help copy now reads the access grant length from the register. The register is shared code that every ED route carries.

Trim tried: the growth is 0.1 to 0.2 KB of register data that D-122 requires; no safe trim was found. Each limit is the measurement plus 0.2 KB. Re-measure on hosted CI and lower if it reads lower.
