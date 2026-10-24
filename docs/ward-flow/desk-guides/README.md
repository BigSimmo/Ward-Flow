# Ward Flow desk guides

<!-- last-checked: 2026-10-24 -->

One printable page for each desk. Each guide says what the desk sees first, the jobs it does most,
what it cannot do, and how to tell that a change was saved.

_Written 2026-10-24 from source on `main`; Documentation owns. Button and screen names were read
from the app's code, not checked in a browser. Re-check every guide after clinician testing, and
whenever a step on screen changes._

| Desk                                | Guide                                              | Lands on    |
| ----------------------------------- | -------------------------------------------------- | ----------- |
| Flow coordinator                    | [flow-coordinator.md](flow-coordinator.md)         | My list     |
| Site bed manager                    | [site-bed-manager.md](site-bed-manager.md)         | Capacity    |
| Ward (nurse in charge)              | [ward.md](ward.md)                                 | My ward     |
| ED mental health clinician          | [emergency-department.md](emergency-department.md) | My ED board |
| Community clinician                 | [community-team.md](community-team.md)             | My team     |
| Transport officer                   | [transport-officer.md](transport-officer.md)       | My jobs     |
| Executive (read only)               | [executive.md](executive.md)                       | Statistics  |
| Access admin                        | [access-admin.md](access-admin.md)                 | Settings    |
| Bed meeting TV board (display only) | [tv-board.md](tv-board.md)                         | Bed meeting |

## Where these come from

- The desks and what each may open are in the role access table,
  `src/components/ward-management/ward-role-access.ts`, and the actions each desk may record are in
  `src/components/ward-management/ward-flow-event-roles.ts`.
- The menu names are in `src/components/ward-management/shell/ward-rail-entries.ts`.
- Access rules follow decision D-80 in [decisions.md](../decisions.md). The longer
  [coordinator guide](../coordinator-guide-v2.md) has more background.
- What changed for staff recently is in [STAFF-RELEASE-NOTES.md](../STAFF-RELEASE-NOTES.md).

## Keeping them true

- A change that alters a step on screen updates the matching guide in the same change
  ([definition of done](../definition-of-done.md)).
- Keep each guide to one printed page. Use the app's own words for buttons and screens.
- Never add risk scores, suggested wards, automatic placement, queue re-sorting, computed legal
  times or patient details. Ward Flow does none of these.
- A bed kept for an incoming patient is **Pulled**, with a pull time limit. "Held" is only for a
  patient's own bed while they are on leave or absent.

_Prototype on synthetic data. Not for real patients._
