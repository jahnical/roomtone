"use client";

import { deleteDeck } from "@/lib/decks/actions";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";

export function DeleteDeckButton({ deckId }: { deckId: string }) {
  const confirm = useConfirm();
  const toast = useToast();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="text-red-600 hover:bg-red-50"
      onClick={async () => {
        const ok = await confirm({
          title: "Delete this deck?",
          message: "This also deletes all its sessions and responses.",
          confirmLabel: "Delete",
          destructive: true,
        });
        if (ok) {
          deleteDeck(deckId).catch((e) => toast.show((e as Error).message, "error"));
        }
      }}
    >
      Delete deck
    </Button>
  );
}
