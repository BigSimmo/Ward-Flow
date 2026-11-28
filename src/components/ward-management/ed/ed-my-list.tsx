"use client";

// My list (simplification batch 1, item 14, 26 Nov 2026): one card that holds what the Lists card
// and the phone Lists tab used to hold, under the Needs you rows. Each part keeps its own table or
// rows unchanged; a part that holds nobody is not shown, and an empty list is one quiet line.
import type { ReactNode } from "react";
import { Card, CardHead, EmptyState } from "@/components/wf";
import type { EdScreenContext } from "./ed-screen-context";
import { EdNeedsYouRows } from "./ed-needs-you";
import { EdExpectedTable, EdFormsTable, EdReviewTable, edListCounts } from "./ed-lists-desktop";
import { EdClearedPhoneList, EdExpectsPhoneList, EdFormsPhoneList, EdReviewPhoneList } from "./ed-screen-lists";
import { EdInboxReferrals } from "./ed-screen-inbox";
import { EdReferredPanel } from "./ed-screen-referred";
import handover from "./ed-handover.module.css";

type Part = { id: string; title: string; count: number; body: ReactNode };

export function EdMyList({ ctx }: { ctx: EdScreenContext }) {
  const { isPhone, needsYouItems, inbox, clearedPatients, outbox, answeredAll } = ctx;
  const counts = edListCounts(ctx);
  // Wider screens keep the Lists card's tables, columns unchanged; a phone keeps its list rows.
  const parts: Part[] = [
    { id: "needs", title: "Needs you", count: needsYouItems.length, body: <EdNeedsYouRows items={needsYouItems} /> },
    {
      id: "review",
      title: "Awaiting review",
      count: counts.review,
      body: isPhone ? (
        <>
          {inbox.length > 0 ? <EdInboxReferrals ctx={ctx} /> : null}
          <EdReviewPhoneList ctx={ctx} />
        </>
      ) : (
        <EdReviewTable ctx={ctx} />
      ),
    },
    {
      id: "cleared",
      title: "Medical clearance",
      count: clearedPatients.length,
      body: <EdClearedPhoneList ctx={ctx} />,
    },
    {
      id: "expected",
      title: "Expected",
      count: counts.expected,
      body: isPhone ? <EdExpectsPhoneList ctx={ctx} /> : <EdExpectedTable ctx={ctx} />,
    },
    {
      id: "forms",
      title: "Forms",
      count: counts.forms,
      body: isPhone ? <EdFormsPhoneList ctx={ctx} /> : <EdFormsTable ctx={ctx} />,
    },
    {
      id: "referred",
      title: "Referred",
      count: outbox.length + answeredAll.length,
      body: <EdReferredPanel ctx={ctx} inline />,
    },
  ];
  const shown = parts.filter((part) => part.count > 0);
  return (
    <Card aria-label="My list" className={handover.listsCard} data-pane="needs" data-testid="ward-ed-my-list">
      {shown.length === 0 ? (
        <EmptyState
          title="Nothing on your list"
          meta="Nothing needs action, and nobody here is awaiting review, expected, under a form or referred onward."
        />
      ) : (
        shown.map((part) => (
          <section
            key={part.id}
            className={handover.myListPart}
            aria-labelledby={`ward-ed-my-list-${part.id}`}
            data-testid={`ward-ed-my-list-${part.id}`}
          >
            <CardHead id={`ward-ed-my-list-${part.id}`} title={part.title} meta={part.count} />
            {part.body}
          </section>
        ))
      )}
    </Card>
  );
}
