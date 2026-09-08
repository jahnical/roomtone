"use client";

import { useTransition } from "react";
import { createSessionForDeck } from "@/lib/sessions/actions";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

export function CreateSessionButton({ deckId }: { deckId: string }) {
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  return (
    <Button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          try {
            await createSessionForDeck(deckId);
          } catch (e) {
            // redirect() resolves by throwing a framework-internal error that
            // must NOT be swallowed here, only genuine failures should surface.
            if ((e as Error)?.message?.includes("NEXT_REDIRECT")) throw e;
            toast.show((e as Error).message, "error");
          }
        })
      }
    >
      {pending ? "Creating session…" : "Present this deck"}
    </Button>
  );
}
