'use client';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { money } from '@/lib/utils';

/**
 * Dashboard charts.
 *
 * Restrained on purpose: one accent colour, no gridline clutter, no legends
 * where the axis already says it. They exist to answer a question at a glance,
 * not to decorate.
 */

const AXIS = { fontSize: 11, fill: '#98A095' };

function TooltipCard({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color?: string }[];
  label?: string;
  formatter?: (value: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-white px-3 py-2 shadow-card">
      {label && <p className="text-xs text-ink-faint">{label}</p>}
      {payload.map((entry) => (
        <p key={entry.name} className="mt-0.5 text-sm text-ink">
          <span className="text-ink-faint">{entry.name}: </span>
          {formatter ? formatter(entry.value) : entry.value}
        </p>
      ))}
    </div>
  );
}

export function BookingTrendChart({
  data,
}: {
  data: { label: string; booked: number; completed: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
        <defs>
          <linearGradient id="bookedFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2F7A2A" stopOpacity={0.28} />
            <stop offset="100%" stopColor="#2F7A2A" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="#F0EDE5" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS} interval="preserveStartEnd" />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={AXIS} width={40} />
        <Tooltip content={<TooltipCard />} cursor={{ stroke: '#D6D2C6' }} />
        <Area
          type="monotone"
          dataKey="booked"
          name="Booked"
          stroke="#24601C"
          strokeWidth={2}
          fill="url(#bookedFill)"
        />
        <Area
          type="monotone"
          dataKey="completed"
          name="Completed"
          stroke="#7FBB72"
          strokeWidth={1.5}
          fill="none"
          strokeDasharray="4 4"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function RevenueByServiceChart({ data }: { data: { name: string; cents: number }[] }) {
  const palette = ['#24601C', '#2F7A2A', '#4E9A45', '#7FBB72', '#B6DBAC'];
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 44)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid horizontal={false} stroke="#F0EDE5" />
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          tickLine={false}
          axisLine={false}
          tick={AXIS}
          width={140}
        />
        <Tooltip
          content={<TooltipCard formatter={(v) => money(v)} />}
          cursor={{ fill: '#FAF8F3' }}
        />
        <Bar dataKey="cents" name="Revenue" radius={[0, 8, 8, 0]} barSize={18}>
          {data.map((_, i) => (
            <Cell key={i} fill={palette[i % palette.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Two-segment bar showing the online / in-person split. */
export function ModeSplit({ online, inPerson }: { online: number; inPerson: number }) {
  const total = Math.max(1, online + inPerson);
  const onlinePct = Math.round((online / total) * 100);

  return (
    <div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-line-soft">
        <div className="bg-forest-700 transition-all duration-500" style={{ width: `${onlinePct}%` }} />
        <div className="flex-1 bg-clay-300" />
      </div>
      <div className="mt-4 flex justify-between text-sm">
        <span className="flex items-center gap-2 text-ink-muted">
          <span className="h-2 w-2 rounded-full bg-forest-700" />
          Online <span className="tabular text-ink">{online}</span>
        </span>
        <span className="flex items-center gap-2 text-ink-muted">
          <span className="h-2 w-2 rounded-full bg-clay-300" />
          In person <span className="tabular text-ink">{inPerson}</span>
        </span>
      </div>
    </div>
  );
}
