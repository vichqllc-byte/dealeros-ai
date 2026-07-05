export function Toast({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-xl border border-border bg-white p-4 shadow-md">
      <div className="text-sm font-semibold">{title}</div>
      {description ? <div className="mt-1 text-sm text-neutral-600">{description}</div> : null}
    </div>
  );
}
