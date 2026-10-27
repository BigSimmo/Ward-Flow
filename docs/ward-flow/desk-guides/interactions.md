# Desk guide: Keys and interactions

<!-- last-checked: 2026-10-28 -->

The keys Ward Flow answers to. Each line is copied from Help in the app, under Keyboard shortcuts.

| Key       | What it does                                                        | Where it is handled                                          |
| --------- | ------------------------------------------------------------------- | ------------------------------------------------------------ |
| `/`       | Search, from the box in the header. On Settings it finds a setting. | `search/search-shortcut.ts`                                  |
| `Ctrl+K`  | Search, even with single-key shortcuts off. Cmd+K on a Mac.         | `search/search-shortcut.ts`                                  |
| `Shift+T` | Open Alerts, called Tasks on some desks.                            | `shell/ward-rail-preferences.ts`                             |
| `Shift+A` | Open Activity.                                                      | `shell/ward-rail-preferences.ts`                             |
| `Shift+R` | Start a new referral.                                               | `shell/ward-rail-preferences.ts`                             |
| `[`       | Fold the side menu to icons, or open it again.                      | `shell/ward-rail.tsx`                                        |
| `Esc`     | Close what is open, or step back.                                   | Each dialog and drawer                                       |
| `?`       | On Handover and Referrals, list that page's own keys.               | `handover/handover-page.tsx`, `referrals/referral-board.tsx` |

Paths are under `src/components/ward-management/`.
