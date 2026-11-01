# Alerts page redesign, November 2026

**Status: design approved by Josh on 1 November 2026 ("lock in this design"). Not built yet.** This folder holds the build
instructions, the approved mock-up and screenshots. No screen changes until a build PR applies them.

- The app frame was captured from `main` at `90f1ebda` (1 November 2026). Synthetic demo world, clock at 10:42. Build on current `main`, which now includes the Alerts drawer work (#1210, #1220).
- Open `mockup/desktop.html` or `mockup/phone.html` in a browser. Add `?theme=dark` for dark, `?bc=none` for no live broadcast.
  The page is today's real app frame (rail, top bar, styles and fonts, captured from the running app into `app.css`). Only
  `<main>` is new, drawn by `mock.js` with the kit's own class names, so it can be compared with the live page directly.
- Screenshots of every state are in `screenshots/`.

The mock-up is a static drawing, not app code. Build the design into the real components listed below; do not copy `mock.js`.

## Owner decisions this design carries

| Decision                                                                                                          | Where it shows                                   |
| ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Alerts shows "Accepted, bed not pulled" as act now, so Alerts and Home agree (Q111, yes, 1 Nov)                   | Act now: 4 rows, not 3                           |
| Heading reads "4 act now, 9 waiting"; drop "3 new to you", which nothing explains (Q112, yes, 1 Nov)              | Header title                                     |
| No coloured side edges; act now shows with the triangle glyph and the act tint (design rules, 31 Oct)             | Every row and card                               |
| 40px controls, 12px text minimum, surname first with UMRN, minimal warnings, short wording (design rules, 31 Oct) | Throughout                                       |
| Common buttons anchored at the bottom in a tinted bar (Josh, 1 Nov 07:35)                                         | Side panel, composer, live broadcast card        |
| A better broadcast composer for all areas or chosen areas (Josh, 1 Nov 07:34)                                     | Broadcast alert sheet                            |
| Fix the hairline under the header band (Josh, 1 Nov 07:34)                                                        | Header band, every page that uses it (see below) |

## Clinical safety rules (must hold in the build)

1. Act now is always first, in every view (Urgency, Lanes, Owner), and cannot be collapsed.
2. Highlight buttons may dim other rows but never dim an act-now row.
3. Owner view lists act now first inside each owner. Today's page lists two waiting rows above the act-now rows in "You"; that
   is fixed here.
4. A snoozed act-now alert stays listed in Act now with its return time ("Back at 10:57, still listed in Act now").
5. The first-in-line note stays until a row is chosen, and every main button names the person ("Release pulled bed for
   Cadwaller, Rhys").
6. Legal times show only as typed ("15:42 as typed"), never as a countdown.
7. Broadcasts keep an explicit authorisation tick before Send, and Send names how many units it reaches.

## Page layout (desktop)

1. **Header band.** Title `{act} act now, {waiting} waiting`, meta `oldest 1h 12m · {n} yours`. Pills: Act now, Waiting,
   Yours (they highlight; they do not filter act now away). Tools: Demo clock, Notify me, Copy for handover,
   Next alert {count}, Broadcast alert.
2. **Today timeline** in the band (replaces the separate Today card): 07:00 to 13:00, the future hatched, a now line, one mark
   per alert (triangle act now, dot waiting, tick acted on, radio broadcast). Marks stack in rows of 22px so none overlap;
   hour labels within 25 minutes of now are hidden. Clicking an act-now or waiting mark opens that alert. Alerts with no
   raised time are counted, not drawn ("4 with no time, not shown").
3. **At-a-glance line** under the timeline: Checking (8 flagged · 4 clear, opens the checks pop-over), Acted on today,
   Broadcast live with time left, and the no-time count. This replaces their separate rows.
4. **List card.** Tabs (Now, Broadcast, Notices, History) and the view switch (Urgency, Lanes, Owner) share one row. Counts
   show only when above zero.
   - **Urgency:** Act now, then Waiting (oldest first), then Forecast. Rows match Home's act-now rows: title, then
     `Surname, Given UMRN · where`, then age with a short note, then one action. Only the first-in-line row's action is filled.
   - Same-kind alerts are grouped, matching the Alerts drawer (#1210): "Transport awaiting departure · 5 people" and
     "Notifications to record · 3 people" each open to one line per person with its own action.
   - The planned-arrival row shows "Initials RK" with "UMRN not recorded" in plain grey text, never in the mono UMRN face.
   - **Lanes:** Act now (most urgent first), Waiting (oldest first), Forecast, and a Snoozed lane with an empty note.
   - **Owner:** one group per owner, act now first inside each.
5. **Side panel** (sticky). First-in-line note, person head (avatar initials, name, UMRN, legal status, Patient link), a
   state card (act tint for act now; the hold alert shows a wait track from arrival to pull end), four facts in a 2 by 2
   grid, then Act and Activity tabs. The action bar is pinned to the bottom of the window (see Anchored actions).

Phone: the band keeps three figures (Act now, Waiting, Yours) and Next alert, Broadcast and a More button. Owner chips
(All, Yours, Other owners) replace the view switch. Tabs size to their labels so "Broadcast 1" never overlaps. Selecting a
row opens the panel as a bottom sheet.

## Side panel content per alert kind

| Kind                           | State note                                                                   | Facts                                       | Main button                                    | Other buttons                                                             |
| ------------------------------ | ---------------------------------------------------------------------------- | ------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------- |
| Pull expired, bed still held   | The bed is still held at {ward}. Release it or pull again. Wait track.       | From, To, Form due (as typed), Owner        | Release pulled bed for {name} (needs a reason) | Pull again, Snooze, More (Hand back, Acknowledge)                         |
| Accepted, bed not pulled       | {ward} accepted at {time}. Pull the bed to hold it.                          | From, To, Legal status, Owner               | Pull the bed for {name}                        | Open referral, Snooze, More                                               |
| Multiple destinations declined | Three wards have declined. No ward has accepted. Declines listed with times. | At, Asking for, Legal status, Owner         | Find a bed for {name}                          | Escalate (disabled with reason while wards remain eligible), Snooze, More |
| No eligible bed                | No ward in the network is eligible now.                                      | At, Asking for, Wards eligible now, Owner   | Find a bed for {name}                          | Escalate, Snooze, More                                                    |
| Planned arrival not recorded   | Expected at {time}. No arrival recorded.                                     | Planned ward, Expected, Legal status, Owner | Open bookings                                  | Record arrival, Snooze, More                                              |
| Transport (one person)         | Accepted and booked at {time}. Not left yet.                                 | From, To, Provider, Owner                   | Chase transport for {name}                     | Record departure, Snooze, More                                            |
| Notifications (one person)     | Carer, personal support person and advocacy notifications are not recorded.  | Where, Legal status, Owner                  | Record notifications for {name}                | Snooze, More                                                              |
| Forecast                       | Likely {n} short, at worst {m}, with a range bar                             | (none)                                      | See forecast                                   | Change alert level                                                        |

## Anchored actions

- The side panel, the composer and the live broadcast card end in an action bar with a light accent tint
  (`color-mix(in srgb, var(--wf-accent) 7%, var(--wf-surface))`) and a matching top line.
- Desktop side panel: the card is at least the window height minus the top bar; the bar is `position: sticky; bottom: 0`
  so the main buttons are always on screen. The reason ("Choose a reason first") sits above the main button.
- The main button is full width (44px tall). Secondary buttons share one row and wrap rather than truncate.
- A disabled main button is a plain surface with grey text and a solid border, not a faded primary.

## Broadcast composer

A side sheet, 960px wide on desktop: form on the left, preview on the right, action bar along the bottom. On phone it is
one column in a bottom sheet with the same action bar.

1. **What do you need?** Two large choices: _Ask wards for beds_ (a bed call; wards answer Can take, After a discharge,
   Can't) or _Tell areas something_ (a directive; desks acknowledge). Quick starts under each:
   - Ask: Adult beds today, Older adult beds, Youth beds, Secure beds.
   - Tell: HDU full, ED waits over 24h, Transport delayed, Unit closed, Regional flights paused, Blank.
     Each quick start fills the title, message, urgency, end time and audience. These map to `WA_BROADCAST_TEMPLATES` in
     `ward-broadcast-model.ts` (rename the "Demo:" names to these plain labels; keep the demo wording in the message).
2. **Who gets it** (count shown on the right): _Everyone_, _By group_ or _Choose units_.
   - Groups: Metro adult wards, Older adult wards, Youth and CAMHS, Secure and forensic, Regional (WACHS), ED desks, each
     with its unit count. For a bed call, a dashed suggestion "Wards with a bed now" adds the wards Capacity shows with a
     bed ready.
   - Choose units: units listed by group with a tick each, an All/Clear link per group and "{n} of {m}". Wards with a bed
     now carry a small "Bed now" tag.
   - If a bed call to the same wards is already live, one neutral note offers "Extend that one" instead of sending a second.
   - The model today has one `targetScope` per broadcast. Multi-group and chosen-unit audiences need `targetUnitIds`
     (already used by Pull now) on directives and bed calls too. That is the one model change in this design.
3. **Message.** How urgent: Advisory ("For information. No action needed."), Warning ("Needs attention today."), Critical
   ("Needs action now. Use only for safety or gridlock."). Title (60 characters), message (240), Ends after
   30m, 1h, 2h, 4h, 8h, 12h with "Ends at {time}, or when you stand it down."

Preview column: "What each desk sees" draws the banner as the desk will see it (kind, urgency, sender and time, title,
message, the answer buttons or Acknowledge, "until {time}"). Then "Shows on {n} screens" with the first six unit tags and
"+{k} more".

Action bar: the tick "I'm authorised to send this to {n} units.", the reason when Send is unavailable ("Choose who gets
it", "Add a title and message", "Tick the box to send"), Cancel, and "Send bed call to {n} units" or "Send to {n} units".

## Broadcast tab

Each live broadcast is a card: Live, urgency and kind tags, `{audience} ({n}) · sent {time} by you`, time left and end
time; title and message; a stacked bar and key of answers (Can take, After a discharge, Can't, No answer yet) or
acknowledgements; a ward-by-ward table for bed calls. Action bar: Extend 30m, Add units, Copy answers, Stand down.
A broadcast just sent appears at the top with "0 of {n} answered" or "0 of {n} acknowledged". "Earlier today" lists stood-down
broadcasts. With nothing live, an empty state offers Broadcast alert.

## Header band hairline (shared kit fix)

`src/components/wf/hero.module.css`, `.hero[data-band]::after`: the light lip is `bottom: -1px` and the band's dark fill runs
to its exact edge. In any scaled or zoomed view the two edges anti-alias into a grey line across the page. Fix used in the
mock-up and checked at the viewer's scale: keep the lip inside the band (`bottom: 0`) and stop the band's background 4px
early (`background-size: 100% calc(100% - 4px); background-repeat: no-repeat`). This file is the shared kit, so claim it
and tell the kit owner; it changes every page with the band.

## Files to change

| Area                       | Files                                                                                                                                                                                    |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Page, tabs, views          | `src/components/ward-management/alerts/alerts-screen.tsx`, `alerts-tab-panels.tsx`, `alerts-queue.tsx`, `alerts-queue-groups.tsx`, `alerts.module.css`, `alerts-screen-parts.module.css` |
| Header band and timeline   | `alerts-hero.tsx`, `alerts-visuals.tsx`, `alerts-checking.tsx`                                                                                                                           |
| Side panel                 | `alert-detail.tsx`, `alert-release-ownership.tsx`                                                                                                                                        |
| Act-now rule (Q111)        | `alerts-model.ts` (include accepted, bed not pulled, as Home's `my-list-card.tsx` does)                                                                                                  |
| Composer and broadcast tab | `broadcast-composer.tsx`, `broadcast-draft.ts`, `broadcast.module.css`, `global-alert-panels.tsx`, `ward-broadcast-model.ts`, `ward-broadcast-reducer.ts`                                |
| Hairline                   | `src/components/wf/hero.module.css`                                                                                                                                                      |

Suggested order: (1) act-now rule and heading, (2) header band and at-a-glance line, (3) list and views, (4) side panel and
anchored actions, (5) composer and broadcast tab with the audience model change, (6) the kit hairline fix. Each step is
small enough for its own PR. Update the existing Alerts tests for the new wording, and add tests for the safety rules above
(act now first in Owner view, never dimmed, snoozed act now stays listed).
