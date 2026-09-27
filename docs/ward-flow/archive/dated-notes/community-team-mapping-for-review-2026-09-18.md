# Community team mapping — Ward Lead has marked the obvious ones

**Drafted 2026-09-18. Marked 2026-09-18 by Ward Lead on Josh's instruction: "mark the obvious ones".**
**Nothing here is wired into the app.** No code reads this file.

## What this is for

Ward Flow shows **64 community team names**, taken from the 2015 catchment table. They are place
words: `Bentley`, `Joondalup`, `Alma Street (Central)`.

The research pack holds **25 real WA services with published phone numbers**. They are directory
names: `Bentley Community Mental Health Service`.

**Exact-name matches between the two lists: zero.** So the phone numbers are in the app and render
nowhere. This document is the missing link.

🔴 **Why this needs a person at all.** `Bentley` → `Bentley Community Mental Health Service` is
obvious to a reader. It is also precisely the match the pack forbids by name — never on suburb,
postcode, LGA or proximity — because **a coordinator will ring the number.** Attached to the wrong
clinic, that is a real call to a real service about a patient who is not theirs.

---

## 🔴 THE RULE I APPLIED, so you can reject the rule rather than argue 8 rows

**Every one of the 64 app names comes from an ADULT catchment table.** So where a place word has
both an adult service and a child or older-adult service of a similar name, the adult one is the
match and the others are refusals. That single rule decides Groups A and D and most of E.

⚠️ **I checked cohort from the pack's own `cohort_normalised` and `service_kind` fields, not from
whether "CAMHS" appears in the name.** All eight Group A services read `Adult` / `adult_geographic`;
Clarkson and Swan read `Child/adolescent` / `camhs_geographic`; the Osborne Park and Fremantle
entries read `Older adult` / `older_adult_service`.

**If that rule is wrong, say so once and I will redo all of it.** Everything below follows from it.

---

## A. Marked YES — one app name, one adult service, no competing candidate (8)

|     | App name     | Service                                                  | Phone        | Marked | Override |
| --- | ------------ | -------------------------------------------------------- | ------------ | ------ | -------- |
| A1  | `Bentley`    | Bentley Community Mental Health Service                  | 08 9416 3800 | ✅ YES |          |
| A2  | `Midland`    | Midland Community Mental Health Service                  | 08 9237 8600 | ✅ YES |          |
| A3  | `Mirrabooka` | Mirrabooka Community Mental Health Service               | 08 9344 5400 | ✅ YES |          |
| A4  | `Subiaco`    | Subiaco Community Mental Health Service                  | 08 9489 7200 | ✅ YES |          |
| A5  | `Osborne`    | Osborne Community Mental Health Service                  | 08 6457 8350 | ✅ YES |          |
| A6  | `Peel`       | Peel Community Mental Health Service                     | 08 9531 8080 | ✅ YES |          |
| A7  | `Rockingham` | Rockingham Kwinana Community Mental Health Service       | 08 9528 0600 | ✅ YES |          |
| A8  | `Armadale`   | Armadale community mental health / Orchard Avenue Centre | 08 9398 6600 | ✅ YES |          |

⚠️ Five of these eight have a **child service at the same place** (Armadale CAMHS, Peel CAMHS,
Rockingham CAMHS, Swan CAMHS at Midland, Clarkson CAMHS) and one has an **older-adult service**
(Osborne Park). The rule above is what separates them; without it, five of these eight are ambiguous
rather than obvious.

---

## B. Marked YES where the PACK says so — and two I have downgraded (2 marked, 2 for you)

The register record for **City East Community Mental Health Service** carries an `aliases` field
authored in the source: `["Inner City", "City East CMHS", "ICC (historical source label)"]`. That is
somebody else's recorded decision, not my inference.

|     | App name               | Service                                   | Marked                                                | Override |
| --- | ---------------------- | ----------------------------------------- | ----------------------------------------------------- | -------- |
| B1  | `Inner City`           | City East Community Mental Health Service | ✅ YES — **exact alias in the source**                |          |
| B2  | `ICC`                  | City East Community Mental Health Service | ✅ YES — source alias `ICC (historical source label)` |          |
| B3  | `Inner City (central)` | City East Community Mental Health Service | ⬜ **FOR YOU** — not an alias                         |          |
| B4  | `Inner City Clinic`    | City East Community Mental Health Service | ⬜ **FOR YOU** — not an alias                         |          |

🔴 **B3 and B4 were marked YES in my first draft and I have downgraded them on re-reading.** I had
described all four as "the pack already says these are the same service". **It says it about two of
them.** `Inner City (central)` and `Inner City Clinic` are my inference from name similarity, which
is the exact move this document exists to avoid, and grouping them under a heading that claimed
source backing would have borrowed authority they do not have.

⚠️ **Whichever of these you accept, every one of them points at the SAME service.** Say yes to B1 and B2 and two pages carry the same phone number; say yes to all four and four pages do. That is not wrong — the catchment table genuinely spells one clinic several ways — but it is worth seeing before rather than after.

---

## C. Still for you — genuinely ambiguous (3)

|     | App name       | Candidates                                         | Why I will not choose                                                                                                                                                                                                 | Your call |
| --- | -------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| C1  | `Kwinana`      | Rockingham Kwinana Community Mental Health Service | Same service as A7. Is Kwinana a separate site with its own number, or one service named twice?                                                                                                                       |           |
| C2  | `Mills Street` | Bentley Community Mental Health Service            | The register's address for Bentley is _"Bentley Health Service, Mills Street"_. Same service under two names — or a distinct clinic on that campus?                                                                   |           |
| C3  | `Osborne Park` | Osborne CMHS **or** Osborne Park Older Adult MHS   | 🔴 **08 6457 8350 vs 08 6457 8300 — one digit apart.** The adult rule would pick Osborne CMHS, but this name carries "Park", which is the older-adult service's name. The rule and the name disagree, so it is yours. |           |

---

## D. Marked NO — cohort mismatch (3)

|     | App name                                                                                                                    | Near-name in the register                    | Marked                              |
| --- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ----------------------------------- |
| D1  | `Clarkson`                                                                                                                  | Clarkson CAMHS — Ainsbury Parade             | ❌ NO — recorded `Child/adolescent` |
| D2  | `Swan`                                                                                                                      | Swan CAMHS — Midland Community Hub           | ❌ NO — recorded `Child/adolescent` |
| D3  | `Armadale (Mead Centre)`, `Armadale (Mead)`, `Mead Centre (Armadale)`, `Meade Centre (Armadale)`, `Mead Centre (Kelmscott)` | none — the register has no Mead Centre entry | ❌ NO — no candidate at all         |

---

## E. Marked NO — Alma Street, with one question left open (5)

`Alma Street`, `Alma Street (Central)`, `Alma Street (Cockburn)`, `Alma Street (Fremantle)`,
`Alma Street (Melville)`.

The register's only Alma Street entry is **Fremantle Older Adult Mental Health Service**
(08 9431 3333, _L Block, Alma Street, Fremantle_), recorded `Older adult`. The adult Alma Street
clinics the catchment table names are not in the register at all.

**❌ Marked NO for all five** by the adult rule.

⬜ **One question I am leaving for you:** should `Alma Street (Fremantle)` alone show the
older-adult number? It is the one row where the address matches exactly and the cohort does not.

---

## F. Closed — no candidate exists (41)

Nothing to decide. These stay as they are: a name, no phone number. The pack's community records are
**metro only**.

`Albany` · `Bunbury` · `Central Great Southern` · `Central Wheatbelt` · `Central Wheatbelt H.S.` ·
`East Wheatbelt` · `East Wheatbelt HS` · `Eudoria Street (Gosnells)` · `Eudoria Street (Thornlie)` ·
`Gascoyne` · `Gascoyne H.S.` · `Gascoyne HS` · `Geraldton HS` · `Great South` · `Great Southern` ·
`Joondalup` · `Kimberley` · `Kimberley HS` · `Lower Great Southern` · `Merredin` · `Midwest H.S.` ·
`Murchison HS` · `Narrogin` · `North West` · `North. Goldfield H.S.` · `Northam` ·
`Nth Goldfield H.S.` · `Nth Goldfield HS` · `Pilbara` · `South East Coastal` ·
`Southern Coastal HS` · `Upper Great Southern` · `West Pilbara` · `Western H.S.` · `Western HS` ·
`Wheat Belt` · `Wheatbelt HS`

⚠️ **`Joondalup` is the one worth a second look, and it is not a gap I can close.** The register has
**Butler** (08 6372 1500) and **Wanneroo** (08 9406 7100), both in that area, and the pack's own
catchment note on them reads `shared_joondalup_area_internal_split_unresolved` — **the pack is
explicitly saying it does not know** which of the two covers which part of Joondalup.

---

## Where that leaves it

|                            | Count                                                                    |
| -------------------------- | ------------------------------------------------------------------------ |
| ✅ Marked YES by Ward Lead | **10** (A1–A8, B1, B2)                                                   |
| ❌ Marked NO by Ward Lead  | **8 names** (D1, D2, D3's five names, E's five → 13 names across 8 rows) |
| ⬜ Still for you           | **6** — B3, B4, C1, C2, C3, and the Alma Street (Fremantle) question     |
| Closed, no candidate       | 41                                                                       |

**So there are six decisions left, not sixty-four.**

---

## What happens after you settle the last six

1. The YES pairs go into one authored mapping table, with your name and the date on it — **a
   recorded decision, not an inference**. My marks above are a recommendation until you have seen
   them; the table will say which rows were mine and which were yours.
2. Each mapped team's page shows the published phone, hours and referral email, captioned with the
   date the record was taken and the line already written for it: _"Published contact detail from a
   service directory. Not call-tested, and not confirmed by the service."_
3. Everything unmapped is unchanged.

⚠️ **Nothing here becomes a routing rule.** A phone number is a way to ring somebody. It does not
mean a patient belongs to that team — that association comes from the team named on the referral,
which is your ruling of 2026-08-31 and is not affected by any line above.
