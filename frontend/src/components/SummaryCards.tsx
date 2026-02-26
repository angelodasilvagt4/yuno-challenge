import type { ReconciliationResult } from '../types'

interface Props {
  result: ReconciliationResult
}

function Card({
  label,
  value,
  sub,
  color,
  icon,
}: {
  label: string
  value: string
  sub?: string
  color: string
  icon: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex items-start gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-slate-500 text-xs font-medium uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-slate-900 mt-0.5">{value}</p>
        {sub && <p className="text-slate-400 text-xs mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

export default function SummaryCards({ result }: Props) {
  const matchPct = result.total_orders
    ? ((result.matched / result.total_orders) * 100).toFixed(1)
    : '0'

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Card
        label="Total Transactions"
        value={result.total_orders.toLocaleString()}
        sub={`${result.total_settlements.toLocaleString()} settlements`}
        color="bg-indigo-50"
        icon={
          <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        }
      />
      <Card
        label="Matched"
        value={result.matched.toLocaleString()}
        sub={`${matchPct}% match rate`}
        color="bg-emerald-50"
        icon={
          <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
      />
      <Card
        label="Flagged Discrepancies"
        value={result.flagged_count.toLocaleString()}
        sub={`+ ${result.unmatched_orders} unmatched orders / ${result.unmatched_settlements} mystery settlements`}
        color={result.flagged_count > 0 ? 'bg-red-50' : 'bg-emerald-50'}
        icon={
          <svg className={`w-5 h-5 ${result.flagged_count > 0 ? 'text-red-600' : 'text-emerald-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        }
      />
      <Card
        label="Total Discrepancy"
        value={`$${result.total_discrepancy_usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        sub="USD net gap detected"
        color={result.total_discrepancy_usd > 0 ? 'bg-amber-50' : 'bg-emerald-50'}
        icon={
          <svg className={`w-5 h-5 ${result.total_discrepancy_usd > 0 ? 'text-amber-600' : 'text-emerald-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
      />
    </div>
  )
}
