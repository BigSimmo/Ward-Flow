# B3 — Shell stylesheet raw literals vs. available tokens

TIP (ward master line) = `a387cdbdfb3ef7cb688c7fb7359e08ea25f32b65`
(`git rev-parse codex/task-ward-flow-live-state-20260831`)

All file reads below are `git show a387cdb...:<path>` from
`D:/Repos/Database/.claude/worktrees/ward-flow-phase-5-resume-166ecb`. No file outside this
report was written; no build/lint/gate was run.

## 1. What the gate actually counts (read, not run)

Source: `scripts/check-design-system-contract.mjs` (557 lines) + the functions it imports from
`scripts/design-system-contract-utils.mjs` (2476 lines). Command:
`git show <TIP>:scripts/design-system-contract-utils.mjs`.

For a `.css` file, `analyzeCssContractsInSource` (utils.mjs:2006-2052) walks every declaration
and:

- **Raw padding/radius/gap/margin** (`recordRawScaleLiteralProperty`, utils.mjs:812-831): any
  `padding*`, `border*-radius`, `gap`/`row-gap`/`column-gap`, or `margin*` declaration whose value
  is not all-zero/keyword AND contains no CSS function call (`isRawScaleLiteralValue`,
  utils.mjs:790-793: `if (/\w\(/.test(trimmed)) return false`). So `var(...)`, `calc(...)`,
  `clamp(...)` etc. are automatically exempt; a bare literal like `0.75rem`, `999px`, or `50%` is
  counted. `margin: 0` / `padding: 0` are not counted (all-zero).
- **Raw line-height** (utils.mjs:829-830): same predicate, `line-height` property only.
- **Hardcoded motion durations** (utils.mjs:2039-2043): any `transition`/`animation`
  (or `-duration`/`-delay`) declaration containing a bare `<number>(ms|s)` token — `var(--x)` alone
  doesn't match, but a value that mixes a literal duration with a `var()` easing still matches on
  the literal number.
- **Layout-transition exceptions** (utils.mjs:847-869, 2046-2049): the first token of each
  `transition` layer is checked against `SAFE_TRANSITION_PROPERTIES` (color/background-color/
  border-color/opacity/box-shadow/transform + the individual transform props/filter/
  backdrop-filter/visibility/scrollbar-color/none). Anything else — including `width` — is flagged
  as a layout-triggering transition.
- **Raw colour** has a separate, file-scoped `RAW_COLOR_EXEMPTIONS` allowlist (utils.mjs:71-119).
  None of the three shell files or `ward-flow-shell-tokens.module.css` appears in it, and none
  needs to: they use `var(--surface)` etc., not literal hex/rgb.

No exemption/allowlist mechanism exists for the padding/radius/margin/line-height/duration
categories — they are pure ratchets with no per-file override, unlike raw colour.

## 2. The three stylesheets: every literal the gate would count

`git show <TIP>:src/components/ward-management/shell/{ward-bar,ward-rail,ward-reconciliation-line}.module.css`

### `ward-bar.module.css` (575 lines)

| Line    | Selector                        | Declaration                            | Category        |
| ------- | ------------------------------- | -------------------------------------- | --------------- |
| 55      | `.bar`                          | `padding: 0.5rem 1rem;`                | padding         |
| 81      | `.mark`                         | `border-radius: 999px;`                | radius          |
| 86      | `.mark`                         | `padding: 0.125rem 0.625rem;`          | padding         |
| 123     | `.drawerTrigger`                | `padding: 0 0.75rem;`                  | padding         |
| 169     | `.servicePanel`                 | `padding: 0.75rem;`                    | padding         |
| 176     | `.popoverHead`                  | `margin: 0 0 0.25rem;`                 | margin          |
| 197     | `.serviceOption`                | `padding: 0 0.625rem;`                 | padding         |
| 221     | `.popoverNote`                  | `margin: 0.375rem 0 0;`                | margin          |
| 224     | `.popoverNote`                  | `line-height: 1.4;`                    | line-height     |
| 244     | `.dot`                          | `border-radius: 50%;`                  | radius          |
| 279     | `.primary`                      | `padding: 0 1rem;`                     | padding         |
| 313     | `.primaryPanel`                 | `padding: 0.75rem;`                    | padding         |
| 324     | `.primaryMenuItem`              | `padding: 0 0.625rem;`                 | padding         |
| 352-353 | `.toolsSection + .toolsSection` | `margin-top: 1rem; padding-top: 1rem;` | margin, padding |
| 384     | `.activityTile`                 | `padding: 0.5rem 0.625rem;`            | padding         |
| 441     | `.activityFeed li`              | `padding-bottom: 0.375rem;`            | padding         |
| 463     | `.toolsNote`                    | `line-height: 1.4;`                    | line-height     |
| 477     | `.toolsLink`                    | `padding: 0 0.75rem;`                  | padding         |
| 498     | `.appearanceButton`             | `padding: 0 0.875rem;`                 | padding         |

(`margin: 0;` at lines 361/367/415/422/429/452/460 and `padding: 0;` at 430 are all-zero — not
counted. Every `border-radius: var(--r1|--r2|--r1i)` — 8 sites — is exempt: contains `var(`.)

### `ward-rail.module.css` (290 lines)

| Line | Selector                                       | Declaration                                  | Category                                         |
| ---- | ---------------------------------------------- | -------------------------------------------- | ------------------------------------------------ |
| 29   | `.rail`                                        | `transition: width 0.18s var(--ease, ease);` | hardcoded duration + layout transition (`width`) |
| 51   | `.brand`                                       | `padding: 0.875rem 1.125rem;`                | padding                                          |
| 92   | `.railList`                                    | `padding: 0.25rem 0.625rem 0.75rem;`         | padding                                          |
| 103  | `.railLink`                                    | `padding: 0.5rem 0.625rem;`                  | padding                                          |
| 171  | `.railCheck`                                   | `padding: 0.5rem 1.125rem;`                  | padding                                          |
| 178  | `.railFoot`                                    | `padding: 0.75rem 1.125rem 1rem;`            | padding                                          |
| 189  | `.disclaimer`                                  | `line-height: 1.4;`                          | line-height                                      |
| 259  | `.railList` (inside a phone-width media query) | `padding: 0.5rem 0.75rem;`                   | padding                                          |

(Line 38 `transition: none;` — not counted: no digit, and `none` is in `SAFE_TRANSITION_PROPERTIES`.
`border-bottom-right-radius: var(--r1i)` at 179, and the two `border-radius: var(--r2)` sites, are
exempt. `margin: 0;` at 91/186 is all-zero.)

### `ward-reconciliation-line.module.css` (50 lines)

| Line | Selector | Declaration           | Category    |
| ---- | -------- | --------------------- | ----------- |
| 16   | `.line`  | `line-height: 1.4;`   | line-height |
| 27   | `.dot`   | `border-radius: 50%;` | radius      |

(`margin: 0;` at 12 is all-zero.)

**Totals the gate would report**: raw padding literals 18 (14 in ward-bar, 4 in ward-rail — wait,
counted per line not per value/side, i.e. one row above = one finding); raw margin literals 4
(all in ward-bar); raw radius literals 3 (`999px`, `50%` ×2); raw line-height literals 4 (`1.4`
×4); hardcoded motion durations 1 (`0.18s`); layout-transition exceptions 1 (`width`).

## 3. What tokens exist to substitute

### The two claims put to the plan author

1. **"`transition: width 0.18s` has an identical token `--duration-base` at 180ms."** — **TRUE.**
   `src/app/globals.css:701` (`git show <TIP>:src/app/globals.css`): `--duration-base: 180ms;`,
   inside the `:root { … }` block (the "Motion ladder" comment at line 696-697 pins these as
   "exact observed production timings"). `0.18s === 180ms` exactly. This is a real, global,
   `:root`-scoped custom property — reachable from any element in the DOM (custom-property
   inheritance, not CSS-Modules `composes`), so it needs no import to be visible to
   `ward-rail.module.css`. There is no reachability caveat here: an identical, already-used
   token was available.

2. **"`999px` is used where the canonical radius token is `9999px`."** — **TRUE, and it is a
   value decision, not a typo-substitution.** `globals.css:113` (inside the `@theme { … }` block,
   itself emitted at document-root scope): `--radius-pill: 9999px;`, commented "Fully-round role
   (chips, pills, avatars)." `ward-bar.module.css:81` (`.mark`, a status/badge dot) declares
   `border-radius: 999px;` — same intent (a fully-round badge), different literal value from the
   app's one canonical "pill" token. `999px` and `9999px` render identically for any element under
   ~1000px wide, so visually indistinguishable, but they are not the same declared value.

### Radius family — full picture

- `var(--r1)` (0.625rem) and `var(--r2)` (0.375rem) — the shell's own local tokens, already used,
  not raw. `--r1` is numerically identical to `globals.css`'s `--radius-md: 0.625rem`; `--r2` is
  numerically identical to `--radius-sm: 0.375rem`. (Not claimed as a defect — these are already
  tokenised, just via a shell-local name rather than the app-global one.)
- `border-radius: 50%` (ward-bar `.dot`, ward-reconciliation-line `.dot`) — **an identical-value
  token exists elsewhere in the codebase**, `--ward-radius-round: 50%`
  (`src/components/ward-management/ward-tokens.module.css:164`), **but it is not reachable from
  these three files as written**. That token is declared inside `.wardTokens { … }`
  (`ward-tokens.css:14`), a class-scoped custom property, not `:root`. None of the three shell
  files (or `ward-flow-shell-tokens.module.css`) has a `composes: wardTokens from …` line — they
  compose only `wardShellTokens` (`git grep composes` at TIP, confirmed by reading all three
  files). So `--ward-radius-round` would resolve to nothing on these elements today; using it
  would require also composing the v2 `wardTokens` layer, which is exactly the class of trap this
  repo's memory calls "declared somewhere is not resolvable here."
- `999px` (ward-bar `.mark`) — different-value token exists: `--radius-pill: 9999px` (see above).

### Line-height — is there any scale at all?

`git show <TIP>:src/app/globals.css` — inside `@theme`, two named tokens only:
`--leading-display: 1.05` (large display headings) and `--leading-prose: 1.65` (68ch body copy),
explicitly commented as NOT a general scale ("These do NOT redefine
leading-tight/-snug/-normal/-relaxed"). Both are `@theme`-scoped (document-root), so reachable.
Neither equals `1.4`; `1.4` sits roughly midway between them (0.35 above display, 0.25 below
prose) — a **different nearby value on both sides**, not a match. `ward-tokens.module.css:140` has
`--ward-leading-prose: 1.55` — also different from 1.4, and (like `--ward-radius-round`)
class-scoped to `.wardTokens`, unreachable here. **No generic line-height scale exists anywhere in
the token set** — only these two single-purpose named steps.

### Spacing/padding/margin — is there any generic scale at all?

Searched `globals.css` (5499 lines) and `ward-tokens.module.css` (412 lines) for any
`--space-*`/`--gap-*`/`--pad-*` custom property, or a Tailwind base-`--spacing` multiplier
override: **none exists** (`grep -n -- "--space-\|--gap-\|--pad-"` and `grep -n -- "--spacing:"`
both empty). Tailwind v4's own default spacing scale (utility classes like `p-3`) is available in
principle, but these are CSS Modules with plain declarations, not Tailwind utility classes, so
that scale is not something a `padding: 0.625rem;` line could reference directly. Every rem-valued
custom property that does exist in `globals.css` is either the radius ladder above, the type-scale
(`--text-3xs` etc., a font-size token, not spacing), the icon-size scale
(`--spacing-icon-xs/sm/md/lg/xl`, purpose-locked to icon glyphs), or a one-off component-private
token (`--patient-details-fab-padding`, `--therapy-compare-tray-gap`,
`--smart-search-phone-ticker-*`, `--pwa-*`). Several of these happen to share a numeric value with
one of the shell files' raw paddings (e.g. `0.75rem` also appears as `--radius-lg` and
`--spacing-icon-xs`; `0.375rem` also appears as `--radius-sm`), but none is semantically a
padding/margin primitive, and each private one is scoped to its own unrelated component — none of
these coincidences is a genuine substitute. **Conclusion: every raw padding/margin literal in the
three shell files has NO token of its kind available at all** — not "different value," but no
generic spacing scale exists in this token set for a CSS declaration to draw from.

## PROVEN BY READING

- The exact list of raw padding/margin/radius/line-height declarations and their selectors in all
  three shell files, and the one hardcoded-duration + one layout-transition finding, by reading
  the files at TIP directly.
- The gate's exact predicates (`isRawScaleLiteralValue`, the property regexes,
  `SAFE_TRANSITION_PROPERTIES`, the motion-duration regex) by reading
  `scripts/design-system-contract-utils.mjs` at TIP.
- Claim 1 (`--duration-base: 180ms` = `0.18s`) — confirmed true, value and global reachability
  both verified.
- Claim 2 (`999px` vs. canonical `9999px`) — confirmed true; framed correctly as a value
  difference, not an identical substitute.
- That `--ward-radius-round: 50%` and `--ward-leading-prose: 1.55` exist with matching/near values
  but are unreachable from these three files (class-scoped to `.wardTokens`, never composed here).
- That no generic spacing scale or generic line-height scale exists anywhere in
  `globals.css`/`ward-tokens.module.css` — verified by exhaustive grep of custom-property
  declarations.

## NOT CHECKED

- Whether `ward-flow-shell-tokens.module.css` or the shell files were run through the actual gate
  script (`npm run check:design-system-contract` or equivalent) — I did not run it, per the brief.
  My counts are derived from reading the gate's source predicates by hand, not from executing them.
- Whether any other file in the repo (outside `globals.css` and the two `ward-*-tokens.module.css`
  files) declares a token that would match these values — I limited the token-set search to the
  three named token layers the brief specified.
- Whether the `999px` vs `9999px` difference has any visible rendering consequence at the actual
  element sizes these badges render at (I did not measure/screenshot; both round fully at typical
  badge widths).

## QUESTIONS

- None — the brief's two claims are both confirmed, and every literal in the three files is
  enumerated above with its token status. I did not encounter a decision this brief doesn't cover.
