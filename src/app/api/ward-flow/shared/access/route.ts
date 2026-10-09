import { handleSharedAccess } from "@/lib/ward-flow-shared/http";
import { sharedHttpDeps } from "@/lib/ward-flow-shared/runtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Feature 3: exchanges the shared access code for a signed cookie. 404 while `DATABASE_URL` is unset. */
export function POST(request: Request) {
  return handleSharedAccess(request, sharedHttpDeps());
}
