"use client";

import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const money = (n: number) => `$${n.toFixed(n !== 0 && Math.abs(n) < 10 ? 2 : 0)}`;

export function CostChart({ data }: { data: { day: string; costUsd: number; revenueUsd: number }[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="currentColor" strokeOpacity={0.08} />
          <XAxis dataKey="day" tickFormatter={(d: string) => d.slice(5)} tick={{ fontSize: 11 }} stroke="currentColor" strokeOpacity={0.4} minTickGap={16} />
          <YAxis tickFormatter={money} tick={{ fontSize: 11 }} stroke="currentColor" strokeOpacity={0.4} width={48} />
          <Tooltip formatter={(v) => money(Number(v))} contentStyle={{ fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="revenueUsd" name="Net revenue" fill="#16a34a" fillOpacity={0.55} />
          <Line dataKey="costUsd" name="AI cost" stroke="#dc2626" strokeWidth={2} dot={false} type="monotone" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
