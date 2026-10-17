import type { ReactNode } from "react";

export interface Column<T> {
  label: string;
  cell: (row: T) => ReactNode;
  align?: "right";
}

export function Table<T>({ rows, columns, rowKey, empty }: { rows: T[]; columns: Column<T>[]; rowKey: (row: T) => string; empty: string }) {
  if (rows.length === 0) return <p className="text-sm text-foreground/60">{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-foreground/60">
            {columns.map((c) => (
              <th key={c.label} className={`px-2 py-2 font-normal ${c.align === "right" ? "text-right" : ""}`}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={rowKey(r)} className="border-t border-foreground/10">
              {columns.map((c) => (
                <td key={c.label} className={`px-2 py-2 ${c.align === "right" ? "text-right tabular-nums" : ""}`}>
                  {c.cell(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const Money = ({ v }: { v: number }) => (
  <span className={v < 0 ? "text-red-600" : ""}>{v.toLocaleString("en-US", { style: "currency", currency: "USD" })}</span>
);
