# Pre-pilot site checklist

Owner decision, 26 September 2026 (Josh, "All yes" to question 4): the ward facts nobody has confirmed
stay as a checklist for each site to confirm before any pilot. They are not decisions for Josh, and
**no seed data changes until a site answers.**

Every ward figure in `src/components/ward-management/ward-sites.ts` is made-up sample data: bed
numbers, locked beds, single-sex or mixed, authorisation for involuntary patients, one-to-one
(specialling) and high-acuity places, and some ward names. The values below were read from the
ward line at 00d72ca371. When a site answers, change `ward-sites.ts` in its own reviewed branch
and tick the line here.

Already settled, so not asked again: Broome's Mabu Liyan is not forensic (owner ruling 1A,
25 Sept 2026), and CAHS includes Perth Children's.

## First: the five facts the placement rules lean on

These decide who the app offers a bed to, so a wrong value here gives a wrong offer.

1. **Geraldton: is the adult ward female-only?** The app has "Geraldton Adult Open" as a 7-bed
   female-only ward with no locked beds. It is one of only two single-sex wards in the app.
2. **Fiona Stanley: is the secure ward male-only?** The app has "FSH Adult Secure" as an 18-bed
   male-only ward with 12 locked beds. It is the app's only male-only ward, so the gender checks
   lean on it.
3. **Kununurra: settled.** Public sources confirm there is no mental health ward; Kimberley patients
   go to Broome. The app's Kununurra ward was removed (Josh, 26 Sept 2026).
4. **Royal Perth's secure ward: how many beds, and how many locked?** Ward 2K is an open ward, so the
   app's secure ward is now named Dabakarn, Royal Perth's real secure unit (Josh, 26 Sept 2026). The
   app still says 20 beds, all 20 locked, mixed sex; the published figure for Dabakarn is 12 beds.
5. **Sir Charles Gairdner and Fiona Stanley open wards: any locked or seclusion beds?** The app says
   none on SCGH Mental Health Unit (24 beds), SCGH Older Adult (16), or FSH Older Adult (12), all mixed sex.

## Then: every ward, by site

For each ward, ask the site to confirm or correct these:

- staffed beds;
- locked beds;
- single-sex or mixed (including any single-sex bays);
- authorised for involuntary patients;
- one-to-one places;
- high-acuity places;
- plus the ward name staff use.

Each line below gives the app's current values in that order: beds, locked beds, sex, authorised, one-to-one places, high-acuity places.

### East Metro

- [ ] **Royal Perth, Dabakarn** (adult, secure): 20, 20, mixed, yes, 2, 3. See item 4.
- [ ] **Royal Perth, "RPH Older Adult"**: 14, 0, mixed, yes, 1, 2. The name is a placeholder.
- [ ] **Armadale, Moodjar** (adult): 19, 0, mixed, yes, 2, 2.
- [ ] **St John of God Midland, "SJGM Adult Open"**: 16, 0, mixed, yes, 1, 2. The name is a placeholder.
- [ ] **Bentley, "BTY Adult Secure"**: 17, 4, mixed, yes, 2, 3. Only 4 of 17 beds are locked, while other secure wards lock every bed. Please confirm.
- [ ] **Bentley, "BTY Older Adult"**: 11, 0, mixed, yes, 1, 1. The name is a placeholder.
- [ ] **Bentley, East Metropolitan Youth Unit** (youth): 8, 0, mixed, yes, 1, 2.

### North Metro

- [ ] **Sir Charles Gairdner, Mental Health Unit** (adult): 24, 0, mixed, yes, 3, 3. See item 5.
- [ ] **Sir Charles Gairdner, "SCGH Older Adult"**: 16, 0, mixed, yes, 1, 2. See item 5.
- [ ] **Graylands, "Graylands Adult Secure"**: 15, 15, mixed, yes, 1, 2. Are all 15 beds locked?
- [ ] **Graylands, "Graylands Older Adult"**: 10, 0, mixed, yes, 0, 1.

### South Metro

- [ ] **Fiona Stanley, "FSH Adult Secure"**: 18, 12, male only, yes, 2, 3. See item 2.
- [ ] **Fiona Stanley, "FSH Older Adult"**: 12, 0, mixed, yes, 1, 2. See item 5.
- [ ] **Rockingham, "RGH Adult Secure"**: 14, 14, mixed, yes, 1, 2. Are all 14 beds locked?
- [ ] **Fremantle, Maali (Ward 4.2), open** (adult): 22, 0, mixed, yes, 2, 2.
- [ ] **Fremantle, Wardong (Ward 4.3)** (older adult): 13, 0, mixed, yes, 1, 1.

### WACHS

- [ ] **Albany, Great Southern Acute Psychiatric Unit** (adult): 8, 0, mixed, yes, 0, 1.
- [ ] **Bunbury, Bunbury Acute Psychiatric Unit** (adult): 9, 0, mixed, yes, 1, 1.
- [ ] **Broome, Mabu Liyan** (adult, not forensic): 13, 6, mixed, yes, 0, 2. 13 beds and the 2-room high-dependency area are confirmed; how many beds are locked?
- [ ] **Geraldton, "Geraldton Adult Open"**: 7, 0, female only, yes, 0, 0. See item 1.

### Private

- [ ] **St John of God Subiaco, "SJGS Adult Open"**: 10, 0, mixed, not authorised, 1, 2.
- [ ] **St John of God Subiaco, "SJGS Adult Secure"**: 8, 8, mixed, not authorised, 0, 2. Does Subiaco ever take involuntary patients?

### CAHS

- [ ] **Perth Children's**: the app has no psychiatric ward there yet. Ask whether the pilot needs one, and its details if so.

Sources: `drafts/pre-pilot-confirm-list-2026-09-26.md` (the "Split gender and sex fields" thread) and
the unit values read from the line. Change nothing in the seed from this list alone.
