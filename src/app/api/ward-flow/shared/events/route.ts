import { handleSharedEventsGet, handleSharedEventsPost } from "@/components/ward-management/shared/server/http";
import { sharedHttpDeps } from "@/components/ward-management/shared/server/runtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Feature 3: events after a sequence number, for polling. 404 while `DATABASE_URL` is unset. */
export function GET(request: Request) {
  return handleSharedEventsGet(request, sharedHttpDeps());
}

/** Feature 3: appends one event the reducer accepts at the next sequence number, or reports a conflict. */
export function POST(request: Request) {
  return handleSharedEventsPost(request, sharedHttpDeps());
}
