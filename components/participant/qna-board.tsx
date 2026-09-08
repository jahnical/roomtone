"use client";

import { useState } from "react";
import { ArrowUp } from "lucide-react";
import type { QnaItemPayload } from "@/lib/realtime/events";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils/cn";

interface QnaBoardProps {
  code: string;
  token: string | null;
  items: QnaItemPayload[];
}

export function QnaBoard({ code, token, items }: QnaBoardProps) {
  const toast = useToast();
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [upvoted, setUpvoted] = useState<Set<string>>(new Set());

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !text.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/qna", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, token, text: text.trim() }),
      });
      if (res.ok) {
        setText("");
      } else {
        const body = await res.json().catch(() => ({}));
        toast.show(body.error ?? "Couldn't submit your question.", "error");
      }
    } catch {
      toast.show("Couldn't reach Roomtone. Check your connection and try again.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function upvote(id: string) {
    if (!token) return;
    // Optimistic toggle so a tap feels instant — the next qna-update SSE
    // event (which carries the server's real count) reconciles this.
    setUpvoted((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    try {
      await fetch(`/api/qna/${id}/upvote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, token }),
      });
    } catch {
      // SSE will still reflect the true server state even if this particular
      // request failed to round-trip; no need to hard-fail the tap.
    }
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-4">
      <form onSubmit={submit} className="flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ask a question…"
          maxLength={300}
          className="border-brand-100 bg-white text-brand-950 placeholder:text-brand-950/30"
        />
        <Button type="submit" disabled={submitting || !text.trim()}>
          Ask
        </Button>
      </form>

      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li
            key={item.id}
            className={cn(
              "flex items-center gap-3 rounded-xl border border-brand-100 bg-white px-3 py-2.5",
              item.answered && "opacity-50",
            )}
          >
            <button
              type="button"
              onClick={() => upvote(item.id)}
              aria-label="Upvote"
              className={cn(
                "flex flex-col items-center rounded-lg border px-2 py-1 text-xs font-semibold transition-colors",
                upvoted.has(item.id)
                  ? "border-brand-500 bg-brand-50 text-brand-700"
                  : "border-brand-100 text-brand-950/60 hover:border-brand-300",
              )}
            >
              <ArrowUp size={14} />
              {item.upvotes}
            </button>
            <span className="flex-1 text-sm text-brand-950">{item.text}</span>
            {item.answered && <span className="text-xs text-brand-950/40">Answered</span>}
          </li>
        ))}
        {items.length === 0 && <li className="text-center text-sm text-brand-950/40">No questions yet, be the first.</li>}
      </ul>
    </div>
  );
}
