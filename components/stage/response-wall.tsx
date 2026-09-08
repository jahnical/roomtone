export function ResponseWall({ responses }: { responses: { id: string; text: string }[] }) {
  if (responses.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-stage-foreground-muted">Waiting for answers…</div>
    );
  }

  return (
    <div className="flex h-full flex-wrap content-start gap-3 overflow-y-auto p-2">
      {responses.map((r) => (
        <div
          key={r.id}
          className="max-w-sm rounded-xl border border-stage-border bg-stage-bg-raised px-4 py-3 text-lg text-stage-foreground"
        >
          {r.text}
        </div>
      ))}
    </div>
  );
}
