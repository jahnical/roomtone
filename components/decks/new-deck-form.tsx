"use client";

import { useActionState, useState } from "react";
import { createDeck, type FormActionState } from "@/lib/decks/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const initialState: FormActionState = {};

export function NewDeckForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createDeck, initialState);

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} size="lg">
        New deck
      </Button>
    );
  }

  return (
    <form
      action={formAction}
      className="flex w-full max-w-md flex-col gap-4 rounded-xl border border-border bg-surface p-5"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" placeholder="Week 3 check-in" autoFocus required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea id="description" name="description" placeholder="What this deck is for" />
      </div>
      {state?.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create deck"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
