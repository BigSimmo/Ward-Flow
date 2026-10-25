/**
 * Western Australian public holidays, as Perth `YYYY-MM-DD` dates, with the additional weekday a
 * holiday falling on a weekend brings. Public reference data, checked on 25 October 2026 against the
 * WA Government's list (wa.gov.au, "Public holidays in Western Australia"), which publishes 2026
 * and 2027 only. Add the next year once it is published: `tests/ward-public-holidays.test.ts` fails
 * from 1 September of the last year listed, so the list cannot quietly run out.
 *
 * Shared by the discharges board (which services close) and the forecast (which days are holidays).
 */
export const WA_PUBLIC_HOLIDAYS: readonly { readonly date: string; readonly name: string }[] = [
  { date: "2026-01-01", name: "New Year's Day" },
  { date: "2026-01-26", name: "Australia Day" },
  { date: "2026-03-02", name: "Labour Day" },
  { date: "2026-04-03", name: "Good Friday" },
  { date: "2026-04-05", name: "Easter Sunday" },
  { date: "2026-04-06", name: "Easter Monday" },
  { date: "2026-04-25", name: "Anzac Day" },
  { date: "2026-04-27", name: "Anzac Day (additional day)" },
  { date: "2026-06-01", name: "Western Australia Day" },
  { date: "2026-09-28", name: "King's Birthday" },
  { date: "2026-12-25", name: "Christmas Day" },
  { date: "2026-12-26", name: "Boxing Day" },
  { date: "2026-12-28", name: "Boxing Day (additional day)" },
  { date: "2027-01-01", name: "New Year's Day" },
  { date: "2027-01-26", name: "Australia Day" },
  { date: "2027-03-01", name: "Labour Day" },
  { date: "2027-03-26", name: "Good Friday" },
  { date: "2027-03-28", name: "Easter Sunday" },
  { date: "2027-03-29", name: "Easter Monday" },
  { date: "2027-04-25", name: "Anzac Day" },
  { date: "2027-04-26", name: "Anzac Day (additional day)" },
  { date: "2027-06-07", name: "Western Australia Day" },
  { date: "2027-09-27", name: "King's Birthday" },
  { date: "2027-12-25", name: "Christmas Day" },
  { date: "2027-12-26", name: "Boxing Day" },
  { date: "2027-12-27", name: "Christmas Day (additional day)" },
  { date: "2027-12-28", name: "Boxing Day (additional day)" },
];
