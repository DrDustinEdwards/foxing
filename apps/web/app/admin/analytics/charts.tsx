'use client'

import {
  Bar,
  BarChart,
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

const BRAND_UI = 'var(--brand-ui)'
const TICK = 'var(--text-tertiary)'
const PALETTE = [
  'var(--brand-ui)',
  'var(--brand-secondary)',
  'var(--success)',
  'var(--info)',
  'var(--error)',
  'var(--brand-text)',
  'var(--warning)',
  'var(--text-tertiary)',
]

const TOOLTIP_STYLE = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 6,
  color: 'var(--text-primary)',
}

export function SignupsLine({
  data,
}: {
  data: Array<{ day: string; count: number }>
}) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer>
        <LineChart data={data}>
          <XAxis
            dataKey="day"
            tick={{ fill: TICK, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: TICK, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Line
            type="monotone"
            dataKey="count"
            stroke={BRAND_UI}
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function CountBarChart({
  data,
}: {
  data: Array<{ name: string; value: number }>
}) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer>
        <BarChart data={data}>
          <XAxis
            dataKey="name"
            tick={{ fill: TICK, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fill: TICK, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip cursor={{ fill: 'var(--bg-hover)' }} contentStyle={TOOLTIP_STYLE} />
          <Bar dataKey="value" fill={BRAND_UI} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function DonutChart({
  data,
}: {
  data: Array<{ name: string; value: number }>
}) {
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
            {data.map((_e, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={TOOLTIP_STYLE} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
