import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from 'recharts'
import type { ReconciliationResult } from '../types'

interface Props {
  result: ReconciliationResult
}

const PALETTE = ['#6366f1', '#f59e0b', '#ef4444', '#10b981', '#3b82f6', '#8b5cf6']

const usd = (v: number) =>
  `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function Charts({ result }: Props) {
  const currencyData = Object.entries(result.currency_stats)
    .map(([currency, stats]) => ({
      currency,
      discrepancy: stats.discrepancy_usd,
      volume: stats.volume_count,
      flagged: stats.discrepancy_count,
    }))
    .sort((a, b) => b.discrepancy - a.discrepancy)

  const processorData = Object.entries(result.processor_stats)
    .map(([processor, stats]) => ({
      processor,
      discrepancy: stats.discrepancy_usd,
      volume: stats.volume_count,
      flagged: stats.discrepancy_count,
    }))
    .sort((a, b) => b.discrepancy - a.discrepancy)

  const statusData = [
    { name: 'Matched Clean', value: result.matched - result.flagged_count, fill: '#10b981' },
    { name: 'Flagged', value: result.flagged_count, fill: '#ef4444' },
    { name: 'Unmatched Orders', value: result.unmatched_orders, fill: '#f59e0b' },
    { name: 'Mystery Settlements', value: result.unmatched_settlements, fill: '#6366f1' },
  ].filter((d) => d.value > 0)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Discrepancy by Currency */}
      <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <h3 className="font-semibold text-slate-700 text-sm mb-4">Discrepancy by Currency (USD)</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={currencyData} layout="vertical" margin={{ left: 0, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tickFormatter={(v) => `$${v.toFixed(0)}`} tick={{ fontSize: 11 }} />
            <YAxis dataKey="currency" type="category" tick={{ fontSize: 12, fontWeight: 600 }} width={40} />
            <Tooltip
              formatter={(v: number, _n, { payload }) =>
                [`${usd(v)} (${payload.flagged} txns)`, 'Discrepancy']
              }
            />
            <Bar dataKey="discrepancy" radius={[0, 4, 4, 0]}>
              {currencyData.map((_, i) => (
                <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Discrepancy by Processor */}
      <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <h3 className="font-semibold text-slate-700 text-sm mb-4">Discrepancy by Processor (USD)</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={processorData} layout="vertical" margin={{ left: 0, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tickFormatter={(v) => `$${v.toFixed(0)}`} tick={{ fontSize: 11 }} />
            <YAxis dataKey="processor" type="category" tick={{ fontSize: 10 }} width={80} />
            <Tooltip
              formatter={(v: number, _n, { payload }) =>
                [`${usd(v)} (${payload.flagged} txns)`, 'Discrepancy']
              }
            />
            <Bar dataKey="discrepancy" radius={[0, 4, 4, 0]}>
              {processorData.map((_, i) => (
                <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Transaction Status Breakdown */}
      <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <h3 className="font-semibold text-slate-700 text-sm mb-4">Transaction Status Breakdown</h3>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={statusData}
              cx="50%"
              cy="45%"
              innerRadius={50}
              outerRadius={75}
              paddingAngle={2}
              dataKey="value"
            >
              {statusData.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Pie>
            <Legend
              iconType="circle"
              iconSize={8}
              formatter={(v) => <span style={{ fontSize: 11 }}>{v}</span>}
            />
            <Tooltip formatter={(v: number) => [v, 'Transactions']} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
