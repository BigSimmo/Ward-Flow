# O-7 — why three shell stylesheets are exempted from the design-system contract gate

**Written 2026-09-11 by the design-review chat at Ward Lead's request, on the owner's ruling O-7**
(`docs/ward-flow/owner-decisions-2026-09-1x.md`, _"Exempt those files. A check that fails on correct
work teaches people to ignore it."_) [R owner O-7]. The enumeration below was made by a Sonnet
extraction agent reading the files and the gate's source at `a387cdbdfb` on the ward master line;
every line it cites was then re-read by this chat, and the four files it depends on are byte-identical
at the line's current tip `f486a2a9e1` [M f486a2a9e1]. Nothing was run: these are the counts the gate's
own predicates would produce, derived by reading them, not by executing the gate [U — the command that
settles it is `node scripts/check-design-system-contract.mjs`, a heavy gate not run while lanes are
live].

**Tags as in the master plan's second edition:** [M sha] measured here, [L] recorded by a lane or Ward
Lead, [R] ruling, [P] proposed, [U] unverified with the command that would verify it.

---

## 1 · What the gate counts in these three files

The three files are `src/components/ward-management/shell/ward-bar.module.css`,
`ward-rail.module.css` and `ward-reconciliation-line.module.css`. The gate
(`scripts/check-design-system-contract.mjs`, predicates in `design-system-contract-utils.mjs`) counts,
for a `.css` file, any `padding*`, `margin*`, `gap`, `border*-radius` or `line-height` declaration whose
value is neither all-zero nor a function call; any `transition`/`animation` carrying a bare
`<number>s|ms`; and any transition whose first token is not in its safe list (colour, opacity,
transform and kin). `var(...)` values are exempt automatically because they contain a function call
[M a387cdbdfb, utils 812–869, 2006–2052].

| File                                  | padding | margin | radius             | line-height | duration | layout transition |
| ------------------------------------- | ------- | ------ | ------------------ | ----------- | -------- | ----------------- |
| `ward-bar.module.css` (575 lines)     | 14      | 4      | 2 (`999px`, `50%`) | 2 (`1.4`)   | 0        | 0                 |
| `ward-rail.module.css` (290 lines)    | 5       | 0      | 0                  | 1 (`1.4`)   | 1        | 1 (`width`)       |
| `ward-reconciliation-line.module.css` | 0       | 0      | 1 (`50%`)          | 1 (`1.4`)   | 0        | 0                 |
| **Total**                             | **19**  | **4**  | **3**              | **4**       | **1**    | **1**             |

Thirty-two findings. Every `border-radius: var(--r1|--r2|--r1i)` site (nine across the files) and every
`margin: 0` / `padding: 0` is already clean and is not in the table. No raw colour: the files use
`var(--surface)` and kin throughout [M a387cdbdfb].

## 2 · Why substitution cannot make them green — the finding behind the exemption

- **There is no generic spacing scale in the token set.** `globals.css` (5,499 lines) and
  `ward-tokens.module.css` (412 lines) declare no `--space-*`, `--gap-*` or `--pad-*` property and no
  Tailwind `--spacing` multiplier override. Every rem-valued token that does exist is a radius, a
  font-size step, an icon-size step, or a component-private one-off (`--patient-details-fab-padding`,
  `--therapy-compare-tray-gap`). Several coincide numerically with a shell padding (`0.75rem` is also
  `--radius-lg`), and none of them is a padding token. **So 23 of the 32 findings — every padding and
  margin — have no token of their kind to move to** [M a387cdbdfb].
- **There is no generic line-height scale either.** Two named steps exist, `--leading-display: 1.05` and
  `--leading-prose: 1.65`, commented as deliberately _not_ a scale; the shell's `1.4` sits between them
  and matches neither. **Four more findings with no substitute** [M a387cdbdfb globals.css:267–268].
- **Two tokens that would match are unreachable from these files.** `--ward-radius-round: 50%` and
  `--ward-leading-prose: 1.55` are declared inside `.wardTokens { … }`, a class-scoped block; the three
  shell files compose only `wardShellTokens`, never `wardTokens`, so on these elements the variables
  resolve to nothing [M a387cdbdfb ward-tokens.module.css:14,140,164; composes at bar:48,343 rail:18
  line:8]. Using them would be the "declared somewhere is not resolvable here" failure, which the gate
  cannot see and the eye cannot either. **Two `50%` findings stay as literals for that reason.**
- **The gate has no per-file exemption mechanism for these categories.** Only raw colour has an
  allowlist (`RAW_COLOR_EXEMPTIONS`, utils 71–119); padding, margin, radius, line-height and duration
  are pure ratchets with no override [M a387cdbdfb]. ⚠️ **This means "exempt those files" is not a
  one-line entry in an existing list — it needs a mechanism to be built or the ratchet baseline to be
  moved, and that is Ward Lead's call on how, not the exemption's on whether** [P].

Together: **29 of 32 findings cannot be cleared by substitution.** That is the sense in which the gate
was red on correct work, and the ground of the ruling.

## 3 · The one genuine substitution — take it

`ward-rail.module.css:29` — `transition: width 0.18s var(--ease, ease);` becomes
`transition: width var(--duration-base) var(--ease, ease);`. `--duration-base: 180ms` is declared on
`:root` in `globals.css:701` under the "Motion ladder" comment, so it is reachable from any element with
no import, and `0.18s` is exactly `180ms` [M a387cdbdfb]. Zero visual change; clears the duration
finding.

⚠️ **It does not clear the layout-transition finding on the same line.** The gate flags `width` as a
layout-triggering property whatever the duration token says; that is a judgement about animating the
rail's collapse by width rather than by transform, and it stays inside the exemption unless somebody
chooses to re-animate the rail. Not a substitution; recorded so nobody expects the line to go fully
green after the token change [M a387cdbdfb utils 847–869].

## 4 · The decision for the owner — `999px` against `9999px`

`ward-bar.module.css:81` — `.mark { border-radius: 999px; }`, the fully-round status badge in the bar.
The app's one canonical pill token is `--radius-pill: 9999px` (`globals.css:113`, commented "Fully-round
role (chips, pills, avatars)"). Same intent, different literal. The two render identically on any
element under about a thousand pixels wide, which every badge is; they are not the same declared value,
which is why O-7 calls it a decision rather than a substitution, in the shape of D-24's raw `1.2`
against the canonical `1.15` [R owner O-7].

**Question for the owner:** should the bar's badge move to `border-radius: var(--radius-pill)`?

**Recommendation: yes.** It is the one radius finding that has a reachable token of the right role;
the badge looks the same; and it leaves the shell carrying the app's word for "fully round" instead of
a private one. The cost of saying no is nothing visible today and one more literal the exemption has
to cover. The cost of saying yes is nothing visible either. Choose yes unless you want the shell's
badge to be able to differ from the app's pills later, which nothing currently asks for.

**Decided 2026-09-11: the owner said _"Go ahead"_ to this recommendation. The badge moves to `border-radius: var(--radius-pill)`. The edit is Ward Lead's to make in `ward-bar.module.css:81`; this document records the ruling, not the change** [R owner].

## 5 · What this document does not do

- It does not edit the three stylesheets, the gate, or the exemption list; those are Ward Lead's or a
  lane's files. It records the finding so the change, when made, cites something measured.
- It does not run the gate. The table is what the predicates would count, read by hand; the
  confirming run is named at the top and is the first thing to do when a heavy gate is allowed again
  [U].
- It does not touch `--r1`/`--r2`, the shell's local radius names that equal `--radius-md`/`--radius-sm`
  numerically. They are already tokens; renaming them to the app-global names is tidiness, not a gate
  matter [M a387cdbdfb].
