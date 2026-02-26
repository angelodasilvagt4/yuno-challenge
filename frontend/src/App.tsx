import { useState } from 'react'
import FileUpload from './components/FileUpload'
import SummaryCards from './components/SummaryCards'
import AlertsPanel from './components/AlertsPanel'
import Charts from './components/Charts'
import DiscrepancyTable from './components/DiscrepancyTable'
import TransactionModal from './components/TransactionModal'
import type { ReconciliationResult, Transaction } from './types'

export default function App() {
  const [result, setResult] = useState<ReconciliationResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null)

  const handleUpload = async (ordersFile: File, settlementsFile: File) => {
    setLoading(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('orders_file', ordersFile)
      form.append('settlements_file', settlementsFile)

      const res = await fetch('/api/reconcile', { method: 'POST', body: form })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }))
        throw new Error(err.detail || 'Reconciliation failed')
      }
      setResult(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = () => {
    if (!result) return
    const rows = result.transactions.filter(
      (t) => t.is_discrepancy || t.status !== 'matched',
    )
    const cols: (keyof Transaction)[] = [
      'transaction_id', 'status', 'order_date', 'settlement_date',
      'customer_currency', 'original_amount', 'payment_processor',
      'fx_rate_applied', 'fees_deducted', 'expected_usd', 'actual_usd',
      'difference', 'difference_pct', 'discrepancy_reason',
    ]
    const csv = [
      cols.join(','),
      ...rows.map((t) => cols.map((c) => t[c] ?? '').join(',')),
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob),
      download: 'zephyr_discrepancies.csv',
    })
    a.click()
    URL.revokeObjectURL(a.href)
  }

  if (!result) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 flex flex-col">
        <header className="px-8 py-6">
          <Logo />
        </header>
        <main className="flex-1 flex items-center justify-center px-6 pb-12">
          <FileUpload onUpload={handleUpload} loading={loading} error={error} />
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-slate-900 shadow-lg sticky top-0 z-30">
        <div className="max-w-screen-xl mx-auto px-6 py-4 flex items-center justify-between">
          <Logo light />
          <div className="flex items-center gap-3">
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export CSV
            </button>
            <button
              onClick={() => setResult(null)}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              New Upload
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-6 py-8 space-y-6">
        <SummaryCards result={result} />
        {result.pattern_alerts.length > 0 && (
          <AlertsPanel alerts={result.pattern_alerts} />
        )}
        <Charts result={result} />
        <DiscrepancyTable transactions={result.transactions} onSelect={setSelectedTx} />
      </main>

      {selectedTx && (
        <TransactionModal transaction={selectedTx} onClose={() => setSelectedTx(null)} />
      )}
    </div>
  )
}

function Logo({ light = false }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 bg-indigo-500 rounded-xl flex items-center justify-center shadow-lg">
        <span className="text-white font-black text-base">Z</span>
      </div>
      <div>
        <p className="text-white font-bold text-base leading-none">Zephyr Reconciliation</p>
        <p className={`text-xs leading-none mt-0.5 ${light ? 'text-slate-400' : 'text-indigo-300'}`}>
          Powered by Yuno
        </p>
      </div>
    </div>
  )
}
