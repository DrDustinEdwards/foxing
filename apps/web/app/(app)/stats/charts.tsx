'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
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

export interface MoodBucket {
  mood: string
  count: number
}

export function MoodBarChart({ data }: { data: MoodBucket[] }) {
  const top = data.slice(0, 6)
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer>
        <BarChart data={top} layout="vertical" margin={{ left: 8 }}>
          <XAxis
            type="number"
            tick={{ fill: TICK_COLOR, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <YAxis
            type="category"
            dataKey="mood"
            width={96}
            tick={{ fill: TICK_COLOR, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            cursor={{ fill: 'var(--bg-hover)' }}
            contentStyle={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 6,
              color: 'var(--text-primary)',
            }}
            formatter={(value) => {
              const n = typeof value === 'number' ? value : Number(value) || 0
              return [`${n} book${n === 1 ? '' : 's'}`, 'Count']
            }}
          />
          <Bar
            dataKey="count"
            fill="var(--brand-subtle)"
            stroke={BRAND_UI}
            radius={[0, 4, 4, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export interface PaceBucket {
  month: string
  wpm: number | null
}

export function ReadingPaceLine({ data }: { data: PaceBucket[] }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer>
        <LineChart data={data}>
          <CartesianGrid stroke="var(--border-subtle)" strokeDasharray="3 3" />
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
            contentStyle={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 6,
              color: 'var(--text-primary)',
            }}
            formatter={(value) => {
              if (value === null || value === undefined) {
                return ['no data', 'WPM']
              }
              const n = typeof value === 'number' ? value : Number(value)
              if (!Number.isFinite(n)) return ['no data', 'WPM']
              return [`${Math.round(n)}`, 'WPM']
            }}
          />
          <Line
            type="monotone"
            dataKey="wpm"
            stroke={BRAND_UI}
            strokeWidth={2}
            dot={{ fill: BRAND_UI, r: 3 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
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
