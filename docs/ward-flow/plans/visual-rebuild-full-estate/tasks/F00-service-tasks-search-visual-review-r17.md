# Service, Tasks and Patient Search visual review r17

Date: 2026-09-13  
Reviewer: `/root/hub_inventory`  
Scope: read-only visual/source review; this report is the only write.

## Evidence inspected

I viewed every supplied PNG at original detail under `.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/`:

- Service menu: `service-menu-{app,mock}-{1440,390}-light-r17.png` — four images.
- Tasks: `tasks-{app,mock}-{390,820,1440}-{light,dark}-r17.png` — twelve images.
- Patient Search: `patient-search-{app,mock}-{390,820,1440}-{light,dark}-r17.png` — twelve images.

These are first-viewport captures. They do not prove focus return, Escape behavior, below-fold content, internal scroll endpoints or screen-reader output. I read the current Service, Tasks and Patient Search presentation source only to distinguish a current defect from superseded r17 appearance.

## Actionable finding

### P2 — the idle desktop Patient Search preview does not hold its intended panel height

In both `patient-search-app-1440-light-r17.png` and `patient-search-app-1440-dark-r17.png`, the idle **Selected person** panel ends immediately after its one-line instruction, leaving almost the entire right side as unframed ground. The drawing uses a stable right-hand record surface, and the source comment/layout also intends a stable preview column.

The current CSS gives `.previewColumn` `min-height: 30rem`, then gives its child panel `min-height: 100%`. A percentage minimum on the child does not resolve to the parent's minimum height, which explains the captured collapse. The smallest correction is to give the direct preview panel the concrete `30rem` minimum at the desktop breakpoint, or make the parent a one-row grid whose child stretches against a definite track. This changes presentation only; selection, preview content and source ordering stay intact.

The Search panel belongs below Results in the left column and the Access record belongs below Selected person in the right column. The supplied app already follows that desktop structure, so moving Search to the right would be a regression.

## No additional P1/P2 finding

- **Service:** the selected All services option has a full fill/outline/check state, the panel is contained at 1440, and its 390 layout wraps the explanatory text without clipping. The app uses the engine's actual service labels and truthfully says the choice is not wired. The drawing's per-service dots and waiting counts are not safe to copy as decoration: the current source does not define a count ownership rule for a corridor that can touch two services. Their absence is therefore not raised as a P2.
- **Tasks:** all four actual work items, their distinct danger/warning icons, standing-fact labels and 48px acknowledgement actions remain readable in light and dark at all three widths. The unavailable notice-feed explanation is visible rather than replaced with invented notices. The r17 captures show the older tall row treatment, but current `ward-tasks-drawer.module.css` has a later screen-density layout that places the action alongside the selectable task content. I did not report the superseded density as current. No clipping or illegible selected state is visible in the supplied cells.
- **Patient Search:** the 390 and 820 app cells contain the consolidated three-population results and keep the page controls before the bounded results console. The truthful empty People section followed by referral/movement matches is denser than the drawing's single-population sample, but it preserves distinct engine populations and does not constitute a design failure. The r17 dark active Everything contrast issue is already controller-owned and is not duplicated here.

No tests, browser session, server, JSON, progress file or product source was changed or run.
