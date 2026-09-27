# F13 Ward Answer panel correction r26

## Scope

Changed only `src/components/ward-management/ward/ward.module.css` after exclusive ownership was returned. Existing TSX, reducers, handlers, data, privacy rules, tests, shell, and shared tokens were untouched.

## Corrections

- Recent-answer entries now retain their four real values inside individually bordered, rounded record cards with spacing between records. The existing phone rule still stacks those values in DOM order. No person, role, shift, or time was added.
- At the phone breakpoint only, the Answer capacity form now places its numeric input and `Confirm capacity` action on separate full-width rows. Desktop and tablet retain the drawing-consistent long action alongside the numeric input.
- The selectors are scoped through the Answer presentation and capacity body, so the many other Ward capacity forms keep their existing layout.

## Verification

- `prettier --write src/components/ward-management/ward/ward.module.css` — completed; file formatted.
- No tests or browser runs were performed, per controller ownership.
- Visual closure checked separately against `ward-answer-panels-app-1440-light-r26.png`: the shared rail/background seam is closed. Fresh captures of the two CSS corrections remain controller-owned.

## Hashes

- Before CSS: `2a1f259935f56800a7a4d4d3d9c939025617bdb8cf5776de0e074ca8d664f775`
- After CSS: `1d525ccaf984e6188b9c62f9477e905b0e5d600b6b7c64e0dfafeec0455c2f8c`
- r26 rail closure image: `be89b2050c1d1a9cea6d40744a3e61a98b4aa6b60b3911c13cb51e93566d31db`

## Refreshed six-cell visual closure

I inspected the six refreshed r26 lower-panel captures at original detail after the Answer CSS correction.

- **Phone capacity layout: closed.** At 390 in Light and Dark, the numeric input and full-width `Confirm capacity` action occupy separate rows with clear spacing and no clipping.
- **Recent-answer card: closed at all three captured widths.** The real record is visibly bounded as one card and its four truthful values remain aligned and readable in both themes. The two targeted 390 history captures show the values stacked in reading order without clipping or overflow.
- **Rail track: closed.** At 1440 in Light and Dark, the rail surface reaches the viewport bottom and no black/light discontinuity remains. The refreshed 1440 Light image supersedes the earlier same-name rail-only capture hash above.
- No new P1 or P2 spacing, contrast, overflow, or control defect is visible in these six refreshed cells.

```text
ward-answer-panels-app-1440-dark-r26.png 8104cc0e23e722e2315fa9eeb01af8e49cd001295a97d2c49663a4f27b97e8b6
ward-answer-panels-app-1440-light-r26.png b05ac495c2124fa2dd316313be7aceb1996761cf7858745ed55fdbe23e3acdbe
ward-answer-panels-app-390-dark-r26.png d9be3b178d13ea528bbb15a59deccd3818bcf8c1261fe2656ad794645083fada
ward-answer-panels-app-390-light-r26.png 806a12821934a2cb8cab4e78edecc9dc0cc6c3ce51cf30e3af2ce27025e4bcf1
ward-answer-panels-app-820-dark-r26.png 6109392a94c1adf15b5ebe83544eb56a9dca76bd2bb894f2ed7d728ef0ba4d37
ward-answer-panels-app-820-light-r26.png a935967567f908cc4e1b785d7d884182c7f4addf9314d2a0f160953083da7c74
ward-answer-history-app-390-dark-r26.png 6df9e34a92c9cfb2cc940290a7230a0076d34d03db7670b47d63d961cc7d3452
ward-answer-history-app-390-light-r26.png addf11392ca39340760f4ccb61a0d8679521d4d7bb062e4702e5f0458ec53fbf
```
