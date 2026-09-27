# F00 rail and plan review — source-only r1

Reviewed the packaged rail delta, current rail TSX/CSS, and the full-estate plan. No actionable rail defect was found in source review; rendered acceptance remains pending.

The collapse control remains one keyboard-reachable `<button>` with a 48px minimum height. Its accessible name is explicitly `Open`/`Close`, while the visible label may collapse to the chevron-only form at desktop closed-rail widths. The full phrase remains in `title` for the expanded form, and the state-specific `aria-label` survives visual hiding of the text. The same `toggleRef` is retained after state changes and `setOpen` returns focus to it. The bracket hint is decorative (`aria-hidden`) and does not replace the control name.

The rail still builds links from `WARD_VIEWS` and `WARD_NAV`, preserving hrefs, labels, counts, active state, route announcements, More-pages contents, and existing Sheet focus refs. The new text truncation is limited to the visual first label span; links retain full `aria-label` values and the open-rail title path. The narrow media rules keep the rail in flow, hide only the toggle/foot where specified, and preserve the wrapped route stream. No new source-level route or content loss is visible. Browser overflow and focus behavior still require root’s actual render check.

Plan-level risks are bounded but should remain explicit: F00 bar owns `.searchWrap` while search owns its internal root/popup, so the independent review must inspect the combined cascade at 390/820/1440 and long Statistics labels; page workers must wait for the frozen shared-shell interface before treating their own captures as final. Overnight resumption must key off the exact claim/progress records and before-task hashes to avoid redispatching completed F00 work or reopening shared files. Ward Answer/Digest remain separately gated by the plan’s source/runtime decision; they must not be counted as operational acceptance until that decision exists.

No tests, browser, server, provider, or Git operations were run.
