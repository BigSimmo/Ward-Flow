// Stand-in for `next/navigation` in the shareable redesign preview (esbuild alias). The hooks read
// the same React contexts Next uses, so the preview shell's address and router reach every
// component exactly as they do under Next.
import { useContext } from "react";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { PathnameContext, SearchParamsContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";

import { staticHref } from "./static-href";

const staticRouter = {
  back: () => history.back(),
  forward: () => history.forward(),
  refresh: () => location.reload(),
  push: (href: string) => location.assign(staticHref(href)),
  replace: (href: string) => location.replace(staticHref(href)),
  prefetch: () => {},
};

export function useRouter() {
  return useContext(AppRouterContext) ?? staticRouter;
}

export function usePathname() {
  return useContext(PathnameContext) ?? "/";
}

export function useSearchParams() {
  return useContext(SearchParamsContext) ?? new URLSearchParams();
}

export function useParams() {
  return {};
}

export function useSelectedLayoutSegment() {
  return null;
}

export function useSelectedLayoutSegments() {
  return [];
}

export function notFound(): never {
  throw new Error("Not found in the redesign preview.");
}

export function redirect(href: string): never {
  location.assign(staticHref(href));
  throw new Error("Redirected.");
}
