# Community team page: build instructions

_Updated 2026-11-01 - first edition, written when Josh locked the design; Design owns._

**In one line:** how to turn the locked mock-up in this folder into the real community team page, one small PR at a time. This file plans work. It authorises no release or data change. Josh approved the build on 1 November 2026 at 08:33.

Read first: [AGENTS.md](../../AGENTS.md), [HOW-WE-WORK §6](../../docs/ward-flow/HOW-WE-WORK.md#6-owner-rules-that-fail-builds-or-reviews), [building-ui.md](../../docs/agents/building-ui.md) and [design-system-v9.md](../v9/design-system-v9.md). Compare every screen against the screenshots in `screenshots/` and the interactive mock-up linked in [README.md](README.md).

## 1. The page in one picture

Top to bottom, at desktop width:

1. **Hero** (dark band, real `wf/hero`): eyebrow "Midland · Community mental health · East Metro · Adult"; title "142 on the caseload" with muted "9 in hospital · 5 waiting for a case manager"; Switch team; Demo pill and "Refer from team"; four count chips (Act now, Referrals to answer, Leaving hospital in 7 days, CTO reviews due), each opening its tab; "11 of 12 working today · Clinicians" on the right.
2. **At a glance strip** (the Waiting page pattern): Duty officer with extension, Oldest referral, Next home. Opening hours sit at the right.
3. **Tab row** (the ward page's tab bar): Team home, Caseload 142, In hospital 9, Referrals 3, Clinicians 12. On the right: Find client or clinician (`/` focuses it), Record contact, and More (CTO register, Catchment counts, How to reach the team, Demo samples, About this data).
4. **The chosen tab's body.**
5. **Footer:** the one "Synthetic prototype" line and the Mock-up notes link. Under Q107 (#1215), a caveat that changes a decision stays as one visible line; background goes in the collapsed "About this data".

## 2. What each tab holds

### Team home

- **Summary tiles in one container** (Waiting and Capacity pattern): Caseload (stacked bar: case managed, psychiatrist only, unallocated), In hospital, Referrals, Follow-up within 7 days. Key: On track, Other, Needs a look.
- **Team list card** with a To do / Today's log switch, built like Home's My list: uppercase group headers (ACT NOW, THIS WEEK), each row with a time column and one button.
- **Caseload by case manager:** one bar per case manager against an agreed-limit marker. A click opens Caseload filtered to that person.
- **Right rail:** Team flow card (Referrals, Admitted, Leaving), reusing the ward home flow card, and How to reach the team.

### Caseload

- Segment filters: All, In hospital, On a CTO, CTO review due, Not seen in 4 weeks, No case manager. A case manager picker beside them.
- Table: Client (surname first, UMRN, age and sex), Case manager, Psychiatrist, Legal, Where now, Last seen, Next, Open.
- Only "Not seen in 4 weeks" and "No case manager" carry a warning mark. Everything else is plain text.

### In hospital

- **In hospital now:** Ward, Case manager, Legal, In bed, Expected out, Team contact, and Follow-up with a Book button.
- **Back home: 7-day follow-up:** clients discharged in the last 14 days. Only the single most urgent row (due today) may take the soft 6% danger tint.

### Referrals

- **Queue card** with To answer / Sent by team / Answered segments. To answer columns: Client, Since referral (time plus "1h overdue" or "Due in …"), From (place, kind and suburb), Asking for (plus needs), and Open.
- **Side panel** for the selected row: avatar, name and UMRN, urgency tag; a time card with a progress bar (danger colour only when overdue); four facts (From, Asking for, Lives in with catchment, Needs); why referred; a "Full referral" link; case manager picker; Accept and Decline.

### Full referral page (opened from Open or "Full referral")

Modelled on the ward Answer page (`ward/ward-answer-view.tsx`):

- **Top bar:** Back to Referrals, breadcrumb with the person's name, "N of 3 to answer", previous and next arrow buttons. Opening the page focuses the name heading (no visible ring on Back).
- **Summary header card:** 48px avatar, name with UMRN, age, sex, suburb, catchment and earlier contact; urgency and legal tags; one strip with Asking for, From, Interpreter, Transport and First contact asked. Nothing in the strip repeats elsewhere.
- **Left column:** Handover (Situation, Background, Assessment, Recommendation, with referrer and time); Risk summary (harm to self, harm to others, vulnerability, safety plan; only Moderate or higher is tagged) beside Treatment and health (medicine, allergies, physical health, GP); Documents with View (opens a preview dialog) and "Ask for more"; People (client, carer, referrer, GP) with phone numbers and call buttons; With this team before (years, why it closed, earlier case manager and whether they still have room).
- **Right column:** Answer card with the time card, the team checks (pass ticks, information rows, a Book button when an interpreter is not booked), then the choice: **case manager cards** showing caseload room with labels such as "Most room" or "Knew him 2015–2023" (for a psychiatrist review: clinic slots, labelled "Soonest" or "Saw her in 2020"), plus Allocate later; First contact; Accept for Midland full width; Ask for more and Decline side by side; and one line saying who is told on accept. After Accept the actions become a success line with Undo. Below: Timeline with an "Add a note for the team" box.

### Clinicians

- Three cards: Today's cover, This week, Rooms and cars.
- Full-width table: Clinician, Role, Today (tag), Caseload (bar against limit), Extension, Call. Segments: All, At base, In the field, Away. The counts must agree with the hero ("11 of 12 working today").

## 3. Reuse, do not copy

| Need                     | Use                                                                                                                           |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Hero and its curve       | `src/components/wf/hero.tsx` and `hero.module.css`                                                                            |
| Tab row                  | The ward tab bar in `ward/ward-screen-top-bar.tsx` (`tabBarWrap`, roving arrow keys via `moveBetweenWardTabs`)                |
| Cards, segments, buttons | The kit (card, choice segments, `button` variants, primitives count)                                                          |
| Tables                   | `ward-table/ward-table.tsx`                                                                                                   |
| Team list and flow card  | `ward/ward-home-tab.tsx` patterns and Home's My list                                                                          |
| Referral answer layout   | `ward/ward-answer-view.tsx`                                                                                                   |
| Referral documents       | `referrals/referral-document-links.tsx` (bed referrals already carry charts and documents)                                    |
| Today's page and lists   | `community/community-screen.tsx` and its tab files (`-caseload-tab`, `-in-bed-tab`, `-waiting-tab`, `-sent-tab`, `-back-tab`) |

Fold the existing lists into the new tabs rather than writing parallel ones: the waiting list becomes Referrals → To answer; sent becomes Sent by team; in-bed and leaving lists become In hospital; caseload stays Caseload. Delete each replaced piece in the same PR and report each deletion (standing yes for dead code an approved redesign replaces).

## 4. Fix that comes with the build

**White lip on the hero curve.** `src/components/wf/hero.module.css` paints the curve's `::after` with `var(--wf-page-canvas, var(--wf-canvas))` (around lines 628, 671 and 709). Where a page's canvas is grey, a white sliver shows under the curve. The mock-up fixes it by painting the curve with the canvas behind the hero. Check every page that uses the hero, in light and dark, because this is shared.

## 5. Data the app does not hold yet

Today the team page only knows people linked to the team by an accepted referral (`community-screen-helpers.ts` `caseloadRowsForTeam`, `community-derivations.ts` `admissionBelongsToTeam`). The clinician list is the fixed `SAMPLE_ROSTER` in `community-screen-panels.tsx`. Missing, all of which must stay synthetic:

1. A full caseload per team, with case manager, psychiatrist, last seen, next appointment.
2. CTO end and review dates (only the form is recorded today).
3. Discharge date, so the 7-day follow-up clock can run.
4. A team staff list the team leader can edit: role, today's status, extension, caseload and agreed limit.
5. On community referrals: the handover text, risk summary, treatment and health, documents, client, carer, referrer and GP contacts, earlier episodes, intake checks, team notes, and psychiatrist clinic slots.
6. Which team sent a referral (most are unattributed).

Where a figure has no source yet, show it from labelled demo data (as today's roster does) or leave the block out. Never compute legal times (D5, D-70).

## 6. Decisions Josh must make before the matching PR

1. **The team accepts its own referrals as itself.** Today the community role can only Decline on its page; Accept exists only as the coordinator. The reducer already allows the community role to accept. Recommendation: yes, because the page is built around the team's Accept.
2. **Where caseload records come from** in the prototype: seeded demo data now, with the real feed left for the separate clinical, privacy and legal review. Recommendation: seeded demo data.

## 7. PR order

One PR each, from verified `main`, each with its own claim, screenshots against this folder, and Josh's yes before merge:

1. **Frame:** hero (with the curve fix), at-a-glance strip, tab row and empty tab bodies; existing lists placed in their tabs unchanged.
2. **Team home.**
3. **Caseload and In hospital** (needs decision 2).
4. **Referrals queue and side panel** (needs decision 1).
5. **Full referral page,** reusing the ward Answer layout and the referral document links.
6. **Clinicians.**

## 8. Acceptance checks for every PR

- Matches the screenshots in light and dark at 1440px, and has a designed phone layout (the mock-up is desktop only; the phone layout is designed in PR 1 and shown to Josh).
- Josh's rules: no coloured side edges; 40px controls (Accept and Decline 48px on phones); text 12px or larger; surname first with UMRN; minimal warnings; at most one 6% danger-tinted item.
- Keyboard: tabs move with arrow keys; `/` focuses search; Esc closes dialogs and returns focus; every button has an accessible name.
- Phone script size within `script-budget.json` (a raise up to 5 KB per screen after trying a trim; more needs Josh's yes).
- Focused tests for changed behaviour; hosted CI is the full gate.
