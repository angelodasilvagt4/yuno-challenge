import type { PatternAlert } from '../types'

interface Props {
  alerts: PatternAlert[]
}

const SEVERITY_STYLES = {
  critical: {
    wrapper: 'border-red-300 bg-red-50',
    badge: 'bg-red-600 text-white',
    icon: 'text-red-500',
    label: 'CRITICAL',
  },
  high: {
    wrapper: 'border-amber-300 bg-amber-50',
    badge: 'bg-amber-500 text-white',
    icon: 'text-amber-500',
    label: 'HIGH',
  },
  medium: {
    wrapper: 'border-yellow-200 bg-yellow-50',
    badge: 'bg-yellow-400 text-yellow-900',
    icon: 'text-yellow-500',
    label: 'MEDIUM',
  },
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  processor: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
    </svg>
  ),
  currency: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
    </svg>
  ),
  large_discrepancy: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  fx_rate: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
    </svg>
  ),
}

export default function AlertsPanel({ alerts }: Props) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h2 className="font-semibold text-slate-800">Pattern Alerts</h2>
        <span className="ml-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full">
          {alerts.length}
        </span>
      </div>

      <div className="space-y-3">
        {alerts.map((alert, i) => {
          const styles = SEVERITY_STYLES[alert.severity]
          return (
            <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${styles.wrapper}`}>
              <div className={styles.icon}>{TYPE_ICON[alert.type]}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm text-slate-800">{alert.title}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${styles.badge}`}>
                    {styles.label}
                  </span>
                </div>
                <p className="text-slate-600 text-xs mt-0.5">{alert.message}</p>
                {alert.transaction_ids && alert.transaction_ids.length > 0 && (
                  <p className="text-slate-400 text-xs mt-1">
                    e.g. {alert.transaction_ids.join(', ')}
                  </p>
                )}
              </div>
              {alert.total_difference_usd !== undefined && (
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-slate-800">
                    ${alert.total_difference_usd.toFixed(2)}
                  </p>
                  <p className="text-slate-400 text-xs">gap</p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
