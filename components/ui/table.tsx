export function Table({ headers, rows }: { headers: string[]; rows: Array<Array<string | number | null | undefined>> }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-neutral-50">
          <tr>{headers.map((h) => <th key={h} className="px-4 py-3 text-left font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-border">{row.map((cell, j) => <td key={j} className="px-4 py-3">{cell ?? '—'}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
