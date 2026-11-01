# Desk guide: Why can't I open this?

<!-- last-checked: 2026-11-01 -->

Each desk opens only the screens its role allows. If you cannot open a screen, check the table for the roles that can, and ask the access admin if you need it.

"Own place" means only your own ward, site, ED, team or officer desk. "Counts only" means numbers with no names. The table comes from `ROLE_SCREENS` in `src/components/ward-management/ward-role-access.ts`, and a test fails if they differ.

| Screen               | Roles that can open it                                                                                                                                                                                      |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `home`               | Bed coordinator                                                                                                                                                                                             |
| `network`            | Bed coordinator                                                                                                                                                                                             |
| `capacity`           | Bed coordinator, Bed manager (own place), Executive (counts only)                                                                                                                                           |
| `wards`              | Bed coordinator, Bed manager (own place)                                                                                                                                                                    |
| `hub`                | Bed coordinator, Bed manager (own place)                                                                                                                                                                    |
| `ward`               | Bed coordinator, Bed manager (own place), Nurse in charge (own place)                                                                                                                                       |
| `board`              | Bed coordinator, Bed manager (own place), Nurse in charge (own place)                                                                                                                                       |
| `discharges`         | Bed coordinator, Bed manager (own place), Nurse in charge (own place)                                                                                                                                       |
| `bed-meeting`        | Bed coordinator, Bed manager (own place), Nurse in charge (own place)                                                                                                                                       |
| `bed-meeting-agenda` | Bed coordinator, Bed manager (own place)                                                                                                                                                                    |
| `ed`                 | Bed coordinator, ED clinician (own place)                                                                                                                                                                   |
| `community`          | Bed coordinator, Community team (own place)                                                                                                                                                                 |
| `officer`            | Bed coordinator, Nurse in charge (own place), ED clinician (own place), Community team (own place), Transport officer (own place)                                                                           |
| `referrals`          | Bed coordinator, Bed manager (own place), Nurse in charge (own place), ED clinician (own place), Community team (own place)                                                                                 |
| `referral-new`       | Bed coordinator, Nurse in charge, ED clinician, Community team                                                                                                                                              |
| `patient-new`        | Bed coordinator, Nurse in charge, ED clinician, Community team                                                                                                                                              |
| `patient`            | Bed coordinator, Bed manager (own place), Nurse in charge (own place), ED clinician (own place), Community team (own place)                                                                                 |
| `movements`          | Bed coordinator, Bed manager (own place), Nurse in charge (own place), ED clinician (own place), Community team (own place)                                                                                 |
| `delays`             | Bed coordinator, Bed manager (own place), Nurse in charge (own place), ED clinician (own place), Community team (own place)                                                                                 |
| `legal-forms`        | Bed coordinator, Nurse in charge (own place), ED clinician (own place), Community team (own place)                                                                                                          |
| `out-of-area`        | Bed coordinator                                                                                                                                                                                             |
| `handover`           | Bed coordinator, Bed manager (own place), Nurse in charge (own place), ED clinician (own place)                                                                                                             |
| `search`             | Bed coordinator, Bed manager (own place), Nurse in charge (own place), ED clinician (own place), Community team (own place)                                                                                 |
| `chronology`         | Bed coordinator                                                                                                                                                                                             |
| `downtime`           | Bed coordinator, Bed manager (own place), Nurse in charge (own place), ED clinician (own place)                                                                                                             |
| `statistics`         | Bed coordinator, Bed manager (counts only), Nurse in charge (counts only), ED clinician (counts only), Community team (counts only), Executive (counts only)                                                |
| `governance`         | Bed coordinator, Access admin (own place)                                                                                                                                                                   |
| `alerts`             | Bed coordinator, Bed manager (own place), Nurse in charge (own place), ED clinician (own place), Community team (own place), Transport officer (own place)                                                  |
| `on-call`            | Bed coordinator, Bed manager, Nurse in charge, ED clinician, Community team, Transport officer                                                                                                              |
| `seclusion`          | Bed coordinator, Bed manager (own place), Nurse in charge (own place)                                                                                                                                       |
| `settings`           | Bed coordinator, Bed manager (own place), Nurse in charge (own place), ED clinician (own place), Community team (own place), Transport officer (own place), Executive (own place), Access admin (own place) |
