"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { Button, Card, CardBody, CardFoot, CardHead } from "@/components/wf";
import styles from "@/components/ward-management/sovereign/sovereign-showcase.module.css";

export default function SovereignShowcaseError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Sovereign Showcase error:", error);
  }, [error]);

  return (
    <main className={styles.workspace} data-ward-design="v6" role="alert" aria-label="Sovereign Showcase Error">
      <Card>
        <CardHead icon={TriangleAlert} title="Something went wrong" />
        <CardBody>
          <p>Failed to load the Sovereign Suite showcase screen.</p>
        </CardBody>
        <CardFoot>
          <Button variant="pri" onClick={() => reset()}>
            Try again
          </Button>
        </CardFoot>
      </Card>
    </main>
  );
}
