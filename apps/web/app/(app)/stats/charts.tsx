'use client'

import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

/**
 * Recharts wrappers run client-side. Server pages pass plain JSON-friendly
 * data; styling pulls from CSS custom properties via inline style so the
 * tokens stay the source of truth.
 */

const BRAND_UI = 'var(--brand-ui)'
const TICK_COLOR = 'var(--text-tertiary)'
const DONUT_COLORS = [
  'var(--brand-ui)',
  'var(--brand-secondary)',
  'var(--success)',
  'var(--info)',
  'var(--error)',
  'var(--brand-text)',
  'var(--warning)',
  'var(--text-tertiary)',
]

export interface MonthlyBucket {
  month: string
  count: number
}

export function MonthlyBooksChart({ data }: { data: MonthlyBucket[] }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer>
        <BarChart data={data}>
          <XAxis
            dataKey="month"
            tick={{ fill: TICK_COLOR, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fill: TICK_COLOR, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ fill: 'var(--bg-hover)' }}
            contentStyle={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 6,
              color: 'var(--text-primary)',
            }}
          />
          <Bar dataKey="count" fill={BRAND_UI} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export interface ThemeBucket {
  name: string
  value: number
}

export function GenreDonut({ data }: { data: ThemeBucket[] }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="55%"
            outerRadius="90%"
            paddingAngle={2}
          >
            {data.map((_entry, idx) => (
              <Cell key={idx} fill={DONUT_COLORS[idx % DONUT_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 6,
              color: 'var(--text-primary)',
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
