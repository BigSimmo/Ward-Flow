# The sending-team question — owner authorised, specified for build, 2026-09-12

**Owner decision, given directly to Ward Builder Two on 2026-09-12:** add the sending-team question
to the referral form — **optional, free text, and displayed wherever a referral's origin already
appears.**

🔴 **THIS SPECIFICATION IS NOT A CLAIM ON THE FILE.** `referral-intake.tsx` belongs to Lane C, which
is live, and `Referral.sendingTeamName` is not in this branch's tree (`e00718f281` is not an ancestor
of `48a0a8c757`). Writing code here would mean editing another live branch's file to set a field this
tree does not have. So this is a brief, handed over, so that whoever holds the file executes a build
task rather than re-deriving a design.

---

## What already exists, measured rather than assumed

| Thing                               | State                                                                       |
| ----------------------------------- | --------------------------------------------------------------------------- |
| `Referral.sendingTeamName?: string` | Exists at `e00718f281` (`ward-model.ts`)                                    |
| `RECEIVE_REFERRAL` carries it       | Yes — `ward-flow-events.ts`                                                 |
| The reducer writes it               | Yes — `ward-flow-reducer.ts:3252`                                           |
| `SENDING_TEAM_NAME_LIMIT`           | **120**                                                                     |
| Tests                               | `tests/ward-referral-sending-team.test.ts`, with a floor on its own fixture |
| **An intake control**               | 🔴 **NONE.** Today only a direct dispatch can set one                       |
| **A display anywhere**              | 🔴 **NONE.** No screen in the ward, board, ED or community set renders it   |

✅ **Lane C recorded this gap itself** — `ward-model.ts` says, in the field's own doc comment: _"The
remaining gap is stated rather than hidden: no INTAKE CONTROL offers it yet, so today only a dispatch
can set it."_ This brief closes that gap; it does not report a concealed one.

---

## The build

### 1 · The question

- **Optional.** Send must stay enabled when it is blank. It is not an `AnsweredDraft` member in the
  required sense — leaving it empty is a complete answer, not an unanswered question.
- **Free text**, single line. ⚠️ **Not a picker.** This application holds no registry of WA teams or
  services, which is the same reason `ReferralDestination`'s `community_team` arm carries `teamName`
  and not an id. A picker here would require inventing that registry.
- **Placement:** beside the existing origin question (`originSiteCode`), because it answers the same
  question — where the referral came from — at a different granularity.
- **Wording** should say _team or service_, not _referrer_: 🔴 **it is NOT a referrer.**
  `referral-referrer.ts` answers WHO, a person, and D-12 forbids an organisation standing in a field
  labelled as one.

### 2 · 🔴 The one contract that will bite: OMIT, never send an empty string

The reducer **rejects** a present-but-blank value:

> `RECEIVE_REFERRAL sendingTeamName is present but blank — omit the field to record no sending team,
rather than sending an empty one`

So the dispatch must be `trimmed === "" ? undefined : trimmed` — the field absent from the event, not
present and empty. ⚠️ **An untouched optional text input yields `""`, so the naive wiring sends the
rejected shape on every referral that leaves the box blank** — which is most of them. This is the
single most likely defect in the change, and it turns an optional field into a form that refuses to
send.

### 3 · The length limit, and why the form must not truncate

`SENDING_TEAM_NAME_LIMIT` is **120**, and the reducer refuses rather than shortens, for a stated
reason: _"a truncated team name is a different team's name."_

✅ **The form must hold the same line.** Block or warn at 120; never silently trim. A form that
truncates and a reducer that refuses would disagree about the same value, and the form would win
silently.

### 4 · The display half

Render it wherever a referral's origin is already shown, next to the origin site rather than in place
of it — a site and a team are different facts and the site is not redundant.

⚠️ **Nothing in the ward, board, ED or community screens renders it today** (grepped for
`sendingTeam` / `referringTeam` / `fromTeam` / `sourceTeam`: zero hits). Whoever builds the display
half should say which screens they covered, because "displayed wherever origin appears" is a claim
about a population, and an uncounted population is how a half-built feature reads as finished.

---

## 🔴 One comment will become false, and deleting it would lose the reasoning

`referral-intake.tsx` (around line 893) currently says:

> _"`teamId` IS IN THE CONTRACT AND IS DELIBERATELY NOT READ… this form has no question a team id
> answers — its origin question is a hospital SITE, and a community team is not one… a referral
> records the hospital it came from and never the team."_

**Half of that stops being true the moment this question lands** — a referral will record a team.

⚠️ **But do not delete the paragraph, because its REASON still holds and is load-bearing:** the
refusal is about a team **id**, and it stands. There is no registry, so there is no id to record, and
inventing a landing place for `teamId` would still be guessing at an origin. What changes is that a
team **NAME** is now recordable, which is precisely the distinction the owner was asked about.

✅ **Rewrite it to say: the form records a team NAME and still refuses a team ID, and why.** A blanket
deletion would remove the only written defence against someone later wiring `teamId` through.

---

## The other owner decision of 2026-09-12, recorded so it is not re-raised

🔴 **NO fresh below-12px crawl is commissioned.** The clinical/chrome classification
(`type-floor-clinical-classification-2026-09-12.md`) leaves ~800 elements unclassified because its
source record groups by CSS class. Resolving them needs a re-crawl keyed on element-and-route. The
owner's decision: **not now** — O-15.1 means each screen is examined at its own rebuild anyway, so
completeness bought in advance is spent on a list nobody acts on until then.

✅ **Revisit only if a rebuild finds the existing list too thin.** That is the trigger; absent it,
this is settled.

---

**Tier:** written in-session by Ward Builder Two (Opus), from files opened and commits read, not from
description. Every figure above was measured against `48a0a8c757` and `e00718f281`; both are named so
the next reader can tell whether they still hold — see
`scripts/ward-flow/check-text-size-floor.mjs`'s header for why a figure without its tree is not
checkable.
