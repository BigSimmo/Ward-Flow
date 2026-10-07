import { assertStatisticsPresentation } from "./helpers/statistics-presentation";

import type { ReactNode } from "react";
import { describe, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

/**
 * The community-team statistics page shows no typed figures.
 *
 * Until 25 Sept 2026 it drew case-duration bands with "142" open cases and a "184d" median, a fixed
 * "92.4%" follow-up gauge against a 90% benchmark, and a "28 received" referral-source chart, all
 * from constants. Josh's ruling that day: a figure comes from the record or says "Not recorded".
 */

describe("community-team statistics: no typed figures", () => {
  it("uses visible operational panels instead of the retired explanation: says the case durations, follow-up share and referral sources are not recorded", () => {
    assertStatisticsPresentation("community");
  });
});
