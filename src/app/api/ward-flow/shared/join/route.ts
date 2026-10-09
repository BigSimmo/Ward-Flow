import { handleSharedJoin } from "@/lib/ward-flow-shared/http";
import { sharedHttpDeps } from "@/lib/ward-flow-shared/runtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Feature 3: joins today's shared world and returns it at its head. 404 while `DATABASE_URL` is unset. */
export function POST(request: Request) {
  return handleSharedJoin(request, sharedHttpDeps());
}
