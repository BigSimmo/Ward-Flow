"use client";

import { EdDepartmentProposal } from "./ed-department-proposal";
import { EdHubProposal } from "./ed-hub-proposal";
import { PreviewBar } from "./ed-proposal-parts";

/** Preview-only frame: the hub without `?ed=`, one department with it. */
export function EdProposalPreview({ edId }: { edId?: string }) {
  return (
    <>
      <PreviewBar
        current={{
          label: "Current screen",
          href: edId ? `/mockups/ward-flow/ed/${encodeURIComponent(edId)}` : "/mockups/ward-flow/ed",
        }}
      />
      {edId ? <EdDepartmentProposal edId={edId} /> : <EdHubProposal />}
    </>
  );
}
