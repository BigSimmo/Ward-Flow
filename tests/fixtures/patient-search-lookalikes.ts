import type { Patient } from "@/components/ward-management/ward-patients";

/*
 * Audit 3 (issue #1566): a look-alike set for "search picks the right patient". Every name, record
 * number and date of birth is invented. The two exact "Alex Morgan" records sit LAST, behind six
 * longer names that also contain "alex morgan", so a search that keeps list order on a tie, or cuts
 * the group at six, loses the exact record.
 */
function person(id: string, givenName: string, familyName: string, umrn: string, dateOfBirth: string): Patient {
  return { id: `PT-LA-${id}`, umrn, givenName, familyName, dateOfBirth };
}

export const LOOKALIKES: readonly Patient[] = [
  person("01", "Alex", "Morgans", "UM900001", "1991-02-03"),
  person("02", "Alex", "Morgan-Hale", "UM900002", "1988-04-05"),
  person("03", "Alex", "Morganson", "UM900003", "1979-06-07"),
  person("04", "Alex", "Morgana", "UM900004", "1995-08-09"),
  person("05", "Alex", "Morganfield", "UM900005", "1983-10-11"),
  person("06", "Alex", "Morganti", "UM900006", "1970-12-13"),
  person("07", "Alexandra", "Morgan", "UM900007", "1986-01-14"),
  person("08", "Alana", "Morgan", "UM900008", "1999-03-15"),
  person("09", "A.", "Morgan", "UM900009", "1964-05-16"),
  person("10", "Alex", "O'Morgan", "UM900010", "1992-07-17"),
  person("11", "Sam", "Alexander", "UM900011", "1981-09-18"),
  person("12", "Alex", "Morgan", "UM900012", "1990-11-19"),
  person("13", "Alex", "Morgan", "UM900013", "1975-12-20"),
];

export const EXACT_ALEX_MORGAN_IDS = ["PT-LA-12", "PT-LA-13"];
