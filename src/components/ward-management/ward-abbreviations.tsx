import { Fragment } from "react";

import { SrOnly } from "@/components/wf";

import { siteDirectory } from "./ward-sites";

/**
 * DA-17 (design audit 19 Oct 2026, overall review 20 Oct 2026): the codes a screen shows (hospital
 * sites, health services and a few ward terms) spelt out. A known code is wrapped in `<abbr>` with
 * its full name as the hint, and the full name is said once more to a screen reader, which does not
 * reliably read an `<abbr>` hint. Unknown capitals are left exactly as they are, so nothing is
 * guessed. "ED" is left alone on purpose: it is on almost every line and every reader knows it.
 */
const TERM_NAMES: Readonly<Record<string, string>> = {
  CAHS: "Child and Adolescent Health Service",
  EMHS: "East Metropolitan Health Service",
  NMHS: "North Metropolitan Health Service",
  SMHS: "South Metropolitan Health Service",
  WACHS: "WA Country Health Service",
  ECT: "Electroconvulsive therapy",
  NIC: "Nurse in charge",
};

const CODE_NAMES: ReadonlyMap<string, string> = new Map([
  ...siteDirectory.map((site) => [site.code, site.name] as const),
  ...Object.entries(TERM_NAMES),
]);

/** The full name for a code the app knows, or `undefined`. */
export function codeName(code: string): string | undefined {
  return CODE_NAMES.get(code);
}

/** `text` as written, with each known code marked up and spelt out (see the note above). */
export function SpelledCodes({ text }: { text: string }) {
  const parts = text.split(/\b([A-Z]{2,6})\b/u);
  if (parts.length === 1) return <>{text}</>;
  return (
    <>
      {parts.map((part, index) => {
        const name = index % 2 === 1 ? codeName(part) : undefined;
        if (name === undefined) return <Fragment key={index}>{part}</Fragment>;
        return (
          <Fragment key={index}>
            <abbr title={name}>{part}</abbr>
            <SrOnly>{` (${name})`}</SrOnly>
          </Fragment>
        );
      })}
    </>
  );
}
