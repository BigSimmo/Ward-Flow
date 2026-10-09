import { handleSharedAccess } from "@/components/ward-management/shared/server/http";
import { sharedHttpDeps } from "@/components/ward-management/shared/server/runtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Feature 3: exchanges the shared access code for a signed cookie. 404 while `DATABASE_URL` is unset. */
export function POST(request: Request) {
  return handleSharedAccess(request, sharedHttpDeps());
}
