"use client";

import {
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatINR, formatINRCompact, monthLabel } from "@/lib/format";

const axisTick = { fill: "var(--muted)", fontSize: 12 };

type TipPayload = { name?: string; value?: number; color?: string; dataKey?: string | number };

function ChartTooltip({
  active,
  payload,
  label,
  labelFormatter,
}: {
  active?: boolean;
  payload?: TipPayload[];
  label?: string;
  labelFormatter?: (l: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium text-ink">{labelFormatter ? labelFormatter(String(label)) : label}</p>
      {payload.map((p) => (
        <p key={String(p.dataKey)} className="flex items-center gap-2 text-ink-2">
          <span className="inline-block h-2 w-2 rounded-sm" style={{ background: p.color }} />
          <span>{p.name}</span>
          <span className="tabular ml-auto pl-3 font-medium text-ink">{formatINR(p.value ?? 0)}</span>
        </p>
      ))}
    </div>
  );
}

export function CashflowChart({ data }: { data: { month: string; income: number; expenses: number }[] }) {
  const empty = data.every((d) => d.income === 0 && d.expenses === 0);
  return (
    <div>
      <div className="mb-3 flex items-center gap-4 text-xs text-ink-2" aria-hidden>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-series-1" /> Income
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-series-2" /> Expenses
        </span>
      </div>
      <div className="relative h-60">
        {empty && (
          <p className="absolute inset-0 z-10 flex items-center justify-center text-sm text-muted">
            No income or expenses logged in the last 6 months yet
          </p>
        )}
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={2} barCategoryGap="28%" margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--grid)" />
            <XAxis
              dataKey="month"
              tickFormatter={(m) => monthLabel(m)}
              tick={axisTick}
              axisLine={{ stroke: "var(--axis)" }}
              tickLine={false}
            />
            <YAxis
              tickFormatter={formatINRCompact}
              tick={axisTick}
              axisLine={false}
              tickLine={false}
              width={52}
            />
            <Tooltip
              cursor={{ fill: "var(--surface-2)" }}
              content={<ChartTooltip labelFormatter={(m) => monthLabel(m, "long")} />}
            />
            <Bar isAnimationActive={false} dataKey="income" name="Income" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={28} />
            <Bar isAnimationActive={false} dataKey="expenses" name="Expenses" fill="var(--series-2)" radius={[4, 4, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>Income and expenses by month</caption>
        <thead><tr><th>Month</th><th>Income</th><th>Expenses</th></tr></thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.month}><td>{monthLabel(d.month, "long")}</td><td>{formatINR(d.income)}</td><td>{formatINR(d.expenses)}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CategoryChart({ data }: { data: { name: string; amount: number }[] }) {
  const top = data.length > 7
    ? [...data.slice(0, 6), { name: "Other", amount: data.slice(6).reduce((s, d) => s + d.amount, 0) }]
    : data;
  return (
    <div style={{ height: Math.max(top.length * 36 + 8, 80) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={top} layout="vertical" barCategoryGap={8} margin={{ top: 0, right: 64, left: 0, bottom: 0 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            width={140}
            tick={{ fill: "var(--ink-2)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip cursor={{ fill: "var(--surface-2)" }} content={<ChartTooltip />} />
          <Bar isAnimationActive={false} dataKey="amount" name="Spent" fill="var(--series-1)" radius={[0, 4, 4, 0]} maxBarSize={20}>
            <LabelList
              dataKey="amount"
              position="right"
              formatter={(v) => formatINRCompact(Number(v))}
              style={{ fill: "var(--ink-2)", fontSize: 12 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Single-series monthly spend for one category or subcategory. */
export function TrendChart({ data, highlight }: { data: { month: string; amount: number }[]; highlight: string[] }) {
  const peak = Math.max(...data.map((d) => d.amount));
  return (
    <div>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barCategoryGap="30%" margin={{ top: 18, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--grid)" />
            <XAxis dataKey="month" tickFormatter={(m) => monthLabel(m)} tick={axisTick} axisLine={{ stroke: "var(--axis)" }} tickLine={false} />
            <YAxis tickFormatter={formatINRCompact} tick={axisTick} axisLine={false} tickLine={false} width={52} />
            <Tooltip cursor={{ fill: "var(--surface-2)" }} content={<ChartTooltip labelFormatter={(m) => monthLabel(m, "long")} />} />
            <Bar isAnimationActive={false} dataKey="amount" name="Spent" radius={[4, 4, 0, 0]} maxBarSize={36}>
              {data.map((d) => (
                <Cell key={d.month} fill={highlight.includes(d.month) ? "var(--series-1)" : "var(--trend-muted)"} />
              ))}
              <LabelList
                dataKey="amount"
                position="top"
                formatter={(v) => (Number(v) === peak && peak > 0 ? formatINRCompact(Number(v)) : "")}
                style={{ fill: "var(--ink-2)", fontSize: 11 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>Spending by month</caption>
        <tbody>{data.map((d) => <tr key={d.month}><td>{monthLabel(d.month, "long")}</td><td>{formatINR(d.amount)}</td></tr>)}</tbody>
      </table>
    </div>
  );
}
