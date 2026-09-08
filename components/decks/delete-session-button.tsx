"use client";

import { deleteSession } from "@/lib/sessions/actions";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";

export function DeleteSessionButton({ sessionId }: { sessionId: string }) {
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
          title: "Delete this session?",
          message: "This removes its QR code and any responses collected.",
          confirmLabel: "Delete",
          destructive: true,
        });
        if (ok) {
          deleteSession(sessionId).catch((e) => toast.show((e as Error).message, "error"));
        }
      }}
    >
      Delete session
    </Button>
  );
}
