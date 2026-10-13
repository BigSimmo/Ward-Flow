import type { AnchorHTMLAttributes, ReactNode } from "react";

export interface MockNextLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  children?: ReactNode;
  href: string | { pathname?: string; query?: Record<string, string> };
  prefetch?: boolean;
  replace?: boolean;
  scroll?: boolean;
  shallow?: boolean;
  passHref?: boolean;
  locale?: string | false;
}

/**
 * Mock helper for Next.js `Link` (`next/link`).
 * Filters out Next.js-specific navigation props like `prefetch`, `replace`, `scroll`, and `shallow`
 * so rendering mock `<a>` tags in Vitest jsdom tests does not log harmless React unknown property warnings (R14).
 */
export function MockNextLink(props: MockNextLinkProps) {
  const { children, href, prefetch, replace, scroll, shallow, passHref, locale, ...rest } = props;
  void prefetch;
  void replace;
  void scroll;
  void shallow;
  void passHref;
  void locale;

  const resolvedHref = typeof href === "object" ? (href.pathname ?? "") : href;
  return (
    <a href={resolvedHref} {...rest}>
      {children}
    </a>
  );
}

/**
 * Helper to produce a `vi.mock("next/link")` factory.
 */
export function mockNextLink() {
  return {
    __esModule: true,
    default: MockNextLink,
  };
}

/**
 * Create a link mock component function suitable for inline `vi.mock("next/link")`.
 */
export function createLinkMock() {
  const MockComponent = (props: MockNextLinkProps) => {
    return <MockNextLink {...props} />;
  };
  MockComponent.displayName = "MockNextLink";
  return MockComponent;
}

export * from "@testing-library/react";
