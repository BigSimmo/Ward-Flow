# Ward Flow design review, October 2026

_Updated 2026-10-30 - React mock-ups built from the app's own components: 38 pages, 31 popups, 6 states and 36 views as other roles, all polished in a second round; Design owns._

**Status: mock-ups for Josh's review. No real screen has changed.** Under the
[D-74 standing rule](../../docs/ward-flow/decisions.md#d-74-owner-answers-to-the-21-october-open-questions-21-october-2026),
no screen changes until Josh approves these mock-ups. Approving one page does not approve the others.

## What it is

The mock-ups live at `/mockups/ward-flow-redesign` (a viewer with every page and popup) and
`/mockups/ward-flow-redesign/<page>` (one page; add `?pop=<name>` for a popup and `?theme=dark` for dark).
Like every `/mockups` route, they are blocked in production. Each one runs inside the real app: the real
`WardFlowProvider` with its synthetic world (clock fixed at 10:42), the real rail, app bar, toasts and
overlays, and real wiring, so buttons work as they do in the app.

Each redesigned page or popup is a copy ("fork") of today's component in `src/components/ward-redesign/`,
with the design changes applied. Comparing the copy with the original shows exactly what would change, so an
approved design can be built by applying that difference to the real file. Role differences are commented branches on the desk's role inside the same copy. The viewer shows each one at desktop, laptop, tablet and phone widths, in
light or dark, with the review notes and build notes beside it. A Redesign / Today switch shows a picture
of today's coordinator page beside each redesign in the shareable copy.

The shareable copy is built by `node scripts/ward-flow/build-redesign-preview.mjs` into
`output/redesign-preview/` (not committed) and published privately for Josh.

| Group                   | What is drawn                                                                                                                                                                                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Coordinator             | Home, Capacity, Movements, Waiting, All EDs, Referrals, New referral, Handover                                                                                                                                                                          |
| Desks                   | My ward, Stays and discharges, ED board, Transport                                                                                                                                                                                                      |
| Work and reports        | Patients, Discharges, All wards, Statistics                                                                                                                                                                                                             |
| Reference               | Alerts, Legal forms, Out of area, On-call, Seclusion, Governance                                                                                                                                                                                        |
| Bed meeting and reports | Bed meeting TV, Meeting agenda, Downtime pack, Patient chronology                                                                                                                                                                                       |
| Places and records      | Places, Community, Community team, Patient record, Add a patient, Ward answer, Settings, Sign in                                                                                                                                                        |
| Statistics pages        | Compare, Ward list, One ward, Weekly (these four cover all ten statistics pages)                                                                                                                                                                        |
| Shell popups            | Alerts drawer, Activity, Tools, Search, Help, Shortcuts, Demo menu, phone Menu, Create, ward switcher, shift brief, Go to a desk, service picker, More pages, tour                                                                                      |
| Page popups             | Bed meeting sheet, Try a scenario, Capacity ward panel, Movement drawer, phone bed forecast, Bed record, Confirm beds, Broadcast, Ward notices, Refer to a ward, ED actions, Log transport, officer job panel, Record a form, Record exam, Add the time |
| States                  | Loading, Empty, Error, Offline, Toast, Not wired                                                                                                                                                                                                        |
| As other roles          | 36 views as the nurse in charge, ED clinician, community clinician, transport officer, site bed manager, executive and access admin                                                                                                                     |

Addresses that only forward to another page (for example `/ward-flow/command` and `/ward-flow/queue`) are
not drawn. The movement record opens the same screen as the patient record, so one mock-up covers both.

The earlier single-file mock-up, [`ward-flow-core-pages.html`](ward-flow-core-pages.html), drawn on 28 and 29
October from screenshots, is kept as the review record. It is superseded by the React mock-ups.

## Where it comes from

This meets the [D-75 evidence rule](../../docs/ward-flow/decisions.md#d-75-ux-audit-follow-up-page-caching-community-gaps-and-the-extra-travel-bed-hold-21-october-2026):
the review was drawn from the running app, and the React mock-ups are built from the app's own components
and synthetic data only. [HANDOVER.md](HANDOVER.md) records how they are built, what each page changes and
what is still open.

## The main findings

1. **Capacity's bed forecast is squeezed into a narrow side column.** At 1280 px it is about 300 px wide and
   holds about ten panels and four caveat paragraphs, while the main column ends early. The mock-up gives the
   forecast its own full-width panel with a 7-day chart. The ward-by-day table goes behind a "By ward"
   switch, and the caveats become one line with a "How this is worked out" link.
2. **The same facts are shown more than once.** Capacity lists every ward twice. The ED board lists the same
   nine people twice, and the community team page lists its caseload twice. Each mock-up keeps one copy.
3. **Names and places are cut off with "…"**, including patient names on the ward bed tiles, which D-83 says
   are shown in full. Several pages and popups (Transport, Out of area, the agenda, the TV, the Alerts drawer)
   write names first name first. The mock-ups wrap text and put the surname first everywhere.
4. **Panels sit empty until you click.** Home's Placement panel, Governance's review pane, Stays' "Who is in a
   bed" and the chronology all wait for a choice. The mock-ups open on the first useful item.
5. **Narrow centred columns on wide screens.** Seclusion and the meeting agenda use an 850 px column. The
   mock-ups use the full width.
6. **Too many equal buttons.** The Alerts drawer has a filled button on every row, the bed record has six
   actions, and the agenda has about 20 "Add action" buttons. The mock-ups keep one main action and put the
   rest under More.
7. **Tablet used the phone layout stretched to 768 px.** The mock-ups use two columns at tablet width.

The notes beside each mock-up list every issue with the device it affects, and what is kept as it is.

## Open points for Josh

Josh agreed every recommendation on 30 October (see [HANDOVER.md](HANDOVER.md)), and a second polish
round followed the same evening; its questions are in HANDOVER.md under "Questions for Josh from round 2".
Still open:

- **Discharges totals.** The header says 207 open, the filter says 63 and the list says 59 listed. The totals
  need one agreed meaning before build.
- **"Chase all" for grouped alerts** needs a new command, so it is not built.
- The questions each popup raises are in its build notes ("Still open").
