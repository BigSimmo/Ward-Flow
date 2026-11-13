import { Badge } from "@/components/wf";

/**
 * F-78 (shared design parts, 13 Nov 2026): a health service is named, never coloured. Its short
 * name goes in a neutral kit tag where the service is not already written beside it; where it is,
 * nothing is added. Service brand colours are not used anywhere outside maps.
 */
const SHORT_NAME: Readonly<Record<string, string>> = {
  "North Metro": "NMHS",
  "South Metro": "SMHS",
  "East Metro": "EMHS",
  WACHS: "WACHS",
  CAHS: "CAHS",
  Private: "Private",
  Statewide: "Statewide",
};

/** "North Metro" reads "NMHS"; WACHS, CAHS, Private and Statewide keep their names. */
export function serviceShortName(service: string): string {
  return SHORT_NAME[service] ?? service;
}

/** A service's short name as a neutral tag (kit Badge `tag`: ink-2 words, line-2 hairline). */
export function ServiceNameTag({ service, className }: { service: string; className?: string }) {
  const short = serviceShortName(service);
  return (
    <Badge variant="tag" size="sm" className={className} title={short === service ? undefined : service}>
      {short}
    </Badge>
  );
}
