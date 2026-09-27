# Q003 focused checks

Working directory: `D:/Worktrees/Database/ward-lead`.

```powershell
node .superpowers/sdd/2026-09-12-visual-rebuild-wave-one/run-focused.mjs tests/ward-delays-screen.dom.test.tsx tests/ward-movements-screen.dom.test.tsx tests/ward-handover.dom.test.tsx tests/ward-referral-screens.dom.test.tsx tests/ward-capacity-screen.dom.test.tsx tests/ward-screen-overview-and-entry.dom.test.tsx tests/ward-ed-screen.dom.test.tsx tests/ward-alerts-screen.dom.test.tsx tests/ward-discharge-board.dom.test.tsx tests/ward-governance-registers.dom.test.tsx tests/ward-hub-screen.dom.test.tsx tests/ward-patient-search.dom.test.tsx tests/ward-on-call-screen.dom.test.tsx tests/ward-legal-forms-screen.dom.test.tsx
```

Initial attempt was lease-blocked before collection. Once the competing audit ended: 14 handed in, 14 ran, 336 collected, 333 passed, 3 failed. Output: `.superpowers/sdd/dashboard-layouts/focused-final.log`.

```powershell
node .superpowers/sdd/2026-09-12-visual-rebuild-wave-one/run-focused.mjs tests/ward-capacity-screen.dom.test.tsx tests/ward-on-call-screen.dom.test.tsx
```

After the documented corrections: 2 handed in, 2 ran, 32 collected, 32 passed, 0 failed. Output: `.superpowers/sdd/dashboard-layouts/focused-corrections.log`. Other twelve passing files were unchanged and reused.

```powershell
node .superpowers/sdd/2026-09-13-visual-rebuild-full-estate/run-typecheck-r26.mjs
```

First attempt lease-blocked. After the competing audit ended: exit 0, no diagnostics. Output: `.superpowers/sdd/dashboard-layouts/typecheck-final.log`.

```powershell
node scripts/ward-flow/screen-verification.mjs
```

Generated record: 5 of 34 looked at, 0 structural problems. This generator checks record structure, not visual quality. Prior 29 affected screen records are preserved before reopening them for the Q003 layout delta.
