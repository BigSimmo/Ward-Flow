# `tests/helpers/` — what is already written, in the words you would search for

**Read this before writing a helper. One search here is cheaper than the fifth copy of something
that already exists.**

🔴 **WHY THIS FILE EXISTS, AND IT IS NOT AN ARGUMENT FROM PRINCIPLE ABOUT DUPLICATION.** On
2026-09-07 five sessions independently hand-rolled the same CSS-comment blanker. Two of the five
were written by one chat, in one day, and a sixth was about to be. Nobody was careless: one searched
`withoutComments`, another searched `style-contracts.ts`, a third searched _"strip comments from
CSS"_. **The function is `blankCssComments`, in a file called `strip-source-comments.ts`, and none of
those searches reach it.**

⚠️ **AND THIS IS WORSE THAN AN UNREAD NOTE.** A note nobody finds merely fails to inform. **A helper
nobody finds gets re-implemented — worse — by everybody who misses it, and each copy is then
maintained by somebody unaware of the others.** Both 2026-09-07 hand-rolls re-derived the exact
implementation `strip-source-comments.ts` records _at the top of its own file_ as superseded,
complete with the reason it is worse. **We independently rebuilt the known-worse version, in a file
that says why it is worse.**

⚠️ **Duplicated effort is invisible by construction.** When two sessions solve one problem the same
way, git keeps one copy and raises no conflict; when they solve it differently, both copies land and
nothing says they are the same thing. **No gate in this repository can see either case.** An index is
the only mechanism that acts before the duplication rather than after it.

**So the tables below are written in searched-for words, not in function names.** If you searched for
something and did not find it, add the words you typed to the row you eventually wanted. That is the
maintenance this file needs, and it is the only kind it needs.

---

## Reading source text as CODE rather than as prose

**The trap this whole group exists for: a guard that greps source text reports the COMMENT
EXPLAINING a defect as the defect.** That punishes writing the defect down — the next person either
deletes the explanation or stops trusting the guard, and both are losses.

| You would search for                                                                                                     | It is called                                                                      | Where                      |
| ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- | -------------------------- |
| strip comments from CSS · blank CSS comments · remove `/* */` · ignore comments in a stylesheet · comment-aware CSS scan | `blankCssComments`                                                                | `strip-source-comments.ts` |
| strip comments from TypeScript · ignore commented-out code · comment-aware TSX scan · literal-aware comment strip        | `stripSourceComments` (keeps trailing `//`), `stripAllComments` (strips them too) | `strip-source-comments.ts` |
| every string in a file · string literals · template literals · what text does this file contain · AST literals           | `literalsIn`                                                                      | `ast-string-literals.ts`   |
| assert on part of a file · source window · between two markers · slice source text · contract test on raw text           | `sourceSegment`, `sourceFrom`                                                     | `source-contract.ts`       |

⚠️ **`blankCssComments` BLANKS RATHER THAN DELETES, and that is the whole reason to prefer it over a
regex.** Every newline and every column survives, so a `file:line` report still points at the real
line. **A guard that names the wrong line is worse than one that names none** — the reader goes
there, finds nothing, and concludes the guard is broken rather than that the file is.

⚠️ **It is NOT literal-aware, and an earlier note in this repository said it was.** It scans for `/*`
without modelling strings, exactly as a regex would. The TS strippers beside it ARE literal-aware but
DELETE their comments, shifting every line beneath the first. **Line-exactness and literal-awareness
are a real trade; choose by whether your guard reports line numbers.** The reason to reuse
`blankCssComments` is that it is the one shared implementation with ~20 callers — not that it closes
the literal hole. **That hole is open in every copy; concentrating it in one function is what makes
it closable at all.**

🔴 **NEVER POINT A CSS BLANKER AT `.tsx`. Measured with an injected mutation on 2026-09-07.** A
trailing `//` comment containing `/*` — a path like `/differentials/diagnoses/*` is enough — opens a
block that runs to the next `*/` and swallows every line between, real code included. In
`global-search-shell.tsx` that silently removed six `var()` references from a guard's scan, three of
them live Tailwind classes. An undeclared token injected into that range: **whole-file blanking, 48
passed; `.css`-scoped blanking, 1 failed and named the exact line.** A silent false negative inside a
safety guard is the worst shape a defect in a check can take. `strip-source-comments.ts` names this
class in its own header under "UNSAFE DIRECTION", recorded as not occurring "in either scanned tree
today" — **true of the two trees it was written for, and false the moment a guard points the same
function at all of `src/`.**

## Proving a guard actually catches its defect

| You would search for                                                                                                                          | It is called                                       | Where                  |
| --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ---------------------- |
| does my guard actually fire · positive and negative control · test the test · prove a guard is not vacuous · anti-vacuity floor               | `guardControls`, `controlPairsFor`                 | `guard-control.ts`     |
| shallow clone · Git guard test fails in a container · identity anchor missing · skip without full history · fixture repo borrows real commits | `HAS_WARD_FLOW_HISTORY`, `NEEDS_WARD_FLOW_HISTORY` | `ward-flow-history.ts` |

**Reach for this whenever you narrow a guard.** The 2026-09-05 failure it was written for: a guard
narrowed correctly was then green on the very defect it had been narrowed to keep catching, and
nothing said so.

## Imports, modules and architecture boundaries

| You would search for                                                                                                   | It is called                                                                           | Where                     |
| ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------- |
| import graph · who imports this · module resolver · is this file reachable · dead file · `"use client"` · RSC boundary | `runtimeGraph`, `resolveModule`, `moduleSpecifiersFromSource`, `hasUseClientDirective` | `module-graph.ts`         |
| Ward Flow import graph · Ward module specifiers · transitive imports under `ward-management`                           | `wardModuleSpecifiers`, `collectWardModuleGraph`                                       | `ward-module-graph.ts`    |
| dead-end routes · broken `href` in Ward Flow · scan `src/app` routes · orphan link check                               | `scanAppRoutes`, `hrefResolvesToRoute`, `scanWardFlowRoutes`, `escapeRegex`            | `ward-dead-end-routes.ts` |

**One resolver, deliberately.** Two that drift apart are worse than one — a boundary guard is only as
trustworthy as its agreement with the other guard reading the same graph.

## Ward Flow

| You would search for                                                                                                                  | It is called                                                                              | Where                           |
| ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------- |
| qualifying caption · the sentence under a figure · does this screen say · assert wording · retired wording must never come back       | `expectSays`, `expectCaption`, `expectNeverSaysAgain`, `screenText`                       | `ward-caption.ts`               |
| place-name leak · hospital name · FD-23 privacy · does this text name a real ward                                                     | `namesRealPlace`, `escapeForRegExp`                                                       | `ward-place-names.ts`           |
| capacity ward table · network table · open the Table layout · bed map Table view                                                      | `showWardTable`                                                                           | `capacity-ward-table.ts`        |
| typed text in storage · D-18 privacy · every typed-text event with marker text · free-text leak · typed field fixtures                | `TYPED_TEXT_FIXTURES`, `typedTextFixtureClock`                                            | `ward-typed-text-fixtures.ts`   |
| referral history character limit · free-text cap · one character too long · boundary fixture                                          | `FIXTURE_HISTORY`, `oneCharacterTooLong`, `exactlyAtTheLimit`                             | `ward-referral-history.ts`      |
| delays screen interactions · render all delays · expand every delay row · open delay person drawer                                    | `renderAllDelays`, `showEveryDelayRow`, `inspectDelayPerson`                              | `delays-interactions.tsx`       |
| ED inbox referral fixture · raise into movement form · open ED raise-into-movement panel                                              | `EdInboxReferralFixture`, `openRaiseIntoMovementForm`                                     | `ed-raise-into-movement.tsx`    |
| ED screen source · read ed-screen.tsx · split screen files · whole screen source text · ed-screen-\* sibling files                    | `edScreenSource`, `edScreenSourceFiles`                                                   | `ed-screen-source.ts`           |
| referral drawer sample person · pick a synthetic referral person for drawer tests                                                     | `chooseSampleReferralPerson`                                                              | `referral-drawer-person.ts`     |
| statistics screen presentation · assert statistics figures and qualifying captions                                                    | `assertStatisticsPresentation`                                                            | `statistics-presentation.tsx`   |
| invented clinical figures · figure provenance guard · does a number state its own provenance                                          | `statesItsOwnProvenance`, `provenanceFailure`                                             | `ward-invented-figures.ts`      |
| legal figure provenance sweep · `dueAt` / Mental Health Act statutory deadline guard sweep                                            | `runLegalFigureProvenanceSweep`                                                           | `ward-legal-figure-sweep.ts`    |
| made-up forensic ward fixture · Broome forensic test fixture · inject synthetic forensic unit                                         | `madeUpForensicWard`, `withMadeUpForensicWard`, `markBroomeForensicForThisFile`           | `ward-made-up-forensic-ward.ts` |
| ward screen panel order · list section/panel headings in DOM order                                                                    | `panelTitlesInOrder`                                                                      | `ward-panels.ts`                |
| reducer refusal/reason checks · scan `ward-flow-reducer.ts` for required reason guards                                                | `scanReducerReasonChecks`                                                                 | `ward-reducer-reason-checks.ts` |
| community screen source · read `community-screen.tsx` and its split files · whole community team screen text                          | `COMMUNITY_SCREEN_FILES`, `communityScreenSource`, `communityScreenFilesOnDisk`           | `community-screen-sources.ts`   |
| release gate · axe check in a Playwright journey · accessibility scan · go to a desk · phone and desktop navigation · reload sentinel | `expectAccessible`, `goToDesk`, `goViaNav`, `openWardFlow`, `wardFigure`, `capacityReady` | `ward-release-gate.ts`          |

> **Note on retired or elsewhere-located test utilities:** If you are searching for older PsychSift or environment preload helpers (`dom-environment-preload.ts`, `next-Config-Eval.ts`, `node-test-env.ts`, `playwright-route-contracts.ts`, `source-scan-cache.ts`, `ward-accessibility-axe.ts`, `ward-flow-test-fixtures.ts`, `ward-screen-render.tsx`), they are not separate files under `tests/helpers/`; check `tests/setup.ts`, `src/components/ward-management/ward-flow-fixtures.ts`, and `vitest.config.ts`.

🔴 **`ward-caption.ts` exists because pinning a sentence pins the RENDERING, not the truth.**
`expect(text).toContain("…")` passes for any string containing those words — including one whose
surrounding claim has been inverted. Reach for these before writing `toContain` on a caption.

## Adding a helper

1. **Search this file first**, for the words you would type — not for the name you would pick.
2. **Add the row in the same commit as the helper.** A helper landed without a row here is one
   nobody after you can find, which is the failure this file exists for.
3. **Say what it is for in the file's own header — the observed failure, not the principle.** Every
   helper here that has earned its keep names the incident that produced it, and that is what tells
   the next reader whether it fits their case.
