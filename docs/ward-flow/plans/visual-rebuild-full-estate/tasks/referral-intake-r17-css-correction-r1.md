# Referral Intake / Register CSS correction r1

Reviewed fresh `referral-intake-app-1440-light-r17.png` and `referral-intake-mock-1440-light-r17.png` before editing. The app showed four Step 1 and Step 2 questions as large individually framed, single-column cards; the drawing uses a denser two-column, unboxed field treatment. The app register view also had plain section headings and a nested queue frame unlike the drawing's surface headers and edge-to-edge rows.

## Change

Owned only `src/components/ward-management/referrals/referrals.module.css`.

- At `min-width: 64rem`, intake Step 1/2 field cards now form two columns with the step legend spanning both columns; field card border/background/padding are removed in this wide treatment. Phone layout remains governed by existing one-column rules. Choice cards and destination options remain intact and boxed.
- Wide intake form columns now use a 2.4-to-1 flexible ratio with the existing minimum widths.
- Register section headings now use the canonical surface-2 header treatment. The live queue removes duplicate outer padding and nested side borders so its table/card rows reach the queue panel edges; scope is gated to `data-referral-view="register"`.

No TSX, engine, destination behavior, or tests were changed.

## Static verification

`postcss.parse` passed for the stylesheet; `npx prettier --write src/components/ward-management/referrals/referrals.module.css` reported unchanged formatting; `git diff --check` passed. No tests, browser, or server checks run. This is source-only evidence pending root's fresh captures.

Actual-before snapshot: `C:/Users/joshs/AppData/Local/Temp/referral-intake-r17-before/referrals.module.css`, SHA-256 `6B2725211DF5FB6BD4D52AA3D785ACFB1F9DC279E12F435C19225632AFE9D459`.
Current stylesheet SHA-256: `FDE277C97D3098296E8870B8F4BD409D887E2113A4626B8F15575234ABB6F53B`.

## r18 follow-up

Fresh r18 review found wide-grid stretch: tall help text in Suburb/Sending team stretched neighboring selects. Added wide-only `align-self: start` and `align-content: start` to field and choice fieldsets, plus a 48px minimum height for select/history controls. Existing secure/involuntary choice fieldsets now share the two-column unboxed step layout; their inner choice options retain their own bordered full hit areas. Before r18 SHA-256: `FDE277C97D3098296E8870B8F4BD409D887E2113A4626B8F15575234ABB6F53B`. Current SHA-256: `599A315CB706BDC8F8DADE44581C3886B721207345E890E92C83825AF8AEC4FA`. PostCSS and diff check pass; no tests/browser run.
