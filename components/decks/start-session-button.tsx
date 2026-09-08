"use client";

import { useTransition } from "react";
import { startSession } from "@/lib/sessions/actions";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

export function StartSessionButton({ sessionId, label }: { sessionId: string; label: string }) {
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  return (
    <Button
      type="button"
      size="lg"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          try {
            await startSession(sessionId);
          } catch (e) {
            if ((e as Error)?.message?.includes("NEXT_REDIRECT")) throw e;
            toast.show((e as Error).message, "error");
          }
        })
      }
    >
      {pending ? "Starting…" : label}
    </Button>
  );
}
