import { handleSharedJoin } from "@/components/ward-management/shared/server/http";
import { sharedHttpDeps } from "@/components/ward-management/shared/server/runtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Feature 3: joins today's shared world and returns it at its head. 404 while `DATABASE_URL` is unset. */
export function POST(request: Request) {
  return handleSharedJoin(request, sharedHttpDeps());
}
