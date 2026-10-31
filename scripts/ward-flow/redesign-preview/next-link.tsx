// Stand-in for `next/link` in the shareable redesign preview (esbuild alias): a plain anchor.
// App addresses are caught by the preview shell; mock-up addresses become `frame.html` links.
import { forwardRef, type AnchorHTMLAttributes, type ReactNode } from "react";

import { staticHref } from "./static-href";

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string | { pathname?: string; query?: Record<string, string> };
  children?: ReactNode;
  prefetch?: boolean | null;
  replace?: boolean;
  scroll?: boolean;
  shallow?: boolean;
};

const NEXT_ONLY = ["prefetch", "replace", "scroll", "shallow"] as const;

const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link({ href, ...props }, ref) {
  const rest: Record<string, unknown> = { ...props };
  for (const key of NEXT_ONLY) delete rest[key];
  const text =
    typeof href === "string"
      ? href
      : `${href.pathname ?? ""}${href.query ? `?${new URLSearchParams(href.query)}` : ""}`;
  return <a ref={ref} href={staticHref(text)} {...rest} />;
});

export default Link;
