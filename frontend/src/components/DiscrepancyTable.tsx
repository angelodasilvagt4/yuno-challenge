import { useState, useMemo } from 'react'
import type { Transaction } from '../types'

interface Props {
  transactions: Transaction[]
  onSelect: (t: Transaction) => void
}

type FilterTab = 'all' | 'discrepancies' | 'unmatched_orders' | 'unmatched_settlements'
type SortKey = keyof Transaction
type SortDir = 'asc' | 'desc'

const PAGE_SIZE_OPTIONS = [25, 50, 100]

const STATUS_BADGE: Record<string, string> = {
  matched: 'bg-emerald-100 text-emerald-700',
  unmatched_order: 'bg-amber-100 text-amber-700',
  unmatched_settlement: 'bg-indigo-100 text-indigo-700',
}

const STATUS_LABEL: Record<string, string> = {
  matched: 'Matched',
  unmatched_order: 'No Settlement',
  unmatched_settlement: 'Mystery',
}

const fmt = (v: number | null, decimals = 2) =>
  v == null ? '—' : v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })

const fmtUsd = (v: number | null) =>
  v == null ? '—' : `$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function DiscrepancyTable({ transactions, onSelect }: Props) {
  const [tab, setTab] = useState<FilterTab>('all')
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'order_date', dir: 'desc' })
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  const counts = useMemo(() => ({
    all: transactions.length,
    discrepancies: transactions.filter((t) => t.is_discrepancy).length,
    unmatched_orders: transactions.filter((t) => t.status === 'unmatched_order').length,
    unmatched_settlements: transactions.filter((t) => t.status === 'unmatched_settlement').length,
  }), [transactions])

  const filtered = useMemo(() => {
    let rows = transactions

    if (tab === 'discrepancies') rows = rows.filter((t) => t.is_discrepancy)
    else if (tab === 'unmatched_orders') rows = rows.filter((t) => t.status === 'unmatched_order')
    else if (tab === 'unmatched_settlements') rows = rows.filter((t) => t.status === 'unmatched_settlement')

    if (search.trim()) {
      const q = search.toLowerCase()
      rows = rows.filter(
        (t) =>
          t.transaction_id.toLowerCase().includes(q) ||
          (t.customer_currency ?? '').toLowerCase().includes(q) ||
          (t.payment_processor ?? '').toLowerCase().includes(q),
      )
    }

    return [...rows].sort((a, b) => {
      const av = a[sort.key] ?? ''
      const bv = b[sort.key] ?? ''
      const cmp = av < bv ? -1 : av > bv ? 1 : 0
      return sort.dir === 'asc' ? cmp : -cmp
    })
  }, [transactions, tab, search, sort])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize)

  const resetPage = () => setPage(1)

  const toggleSort = (key: SortKey) => {
    setSort((s) => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' })
    resetPage()
  }

  const SortIcon = ({ col }: { col: SortKey }) => (
    <span className="ml-1 text-slate-400">
      {sort.key === col ? (sort.dir === 'asc' ? '↑' : '↓') : '↕'}
    </span>
  )

  const TABS: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'discrepancies', label: 'Discrepancies' },
    { key: 'unmatched_orders', label: 'Unmatched Orders' },
    { key: 'unmatched_settlements', label: 'Mystery Settlements' },
  ]

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-slate-100">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <h2 className="font-semibold text-slate-800">
            Transaction Ledger
            <span className="ml-2 text-slate-400 font-normal text-sm">
              {filtered.length.toLocaleString()} results
            </span>
          </h2>
          <input
            type="text"
            placeholder="Search by ID, currency, processor…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); resetPage() }}
            className="w-full sm:w-72 px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>
        <div className="flex gap-2 mt-3 flex-wrap">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => { setTab(key); resetPage() }}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                tab === key
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {label}
              <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                tab === key ? 'bg-indigo-500 text-white' : 'bg-slate-200 text-slate-500'
              }`}>
                {counts[key].toLocaleString()}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {[
                { key: 'transaction_id' as SortKey, label: 'Transaction ID' },
                { key: 'order_date' as SortKey, label: 'Date' },
                { key: 'customer_currency' as SortKey, label: 'Currency' },
                { key: 'original_amount' as SortKey, label: 'Original Amt' },
                { key: 'payment_processor' as SortKey, label: 'Processor' },
                { key: 'expected_usd' as SortKey, label: 'Expected USD' },
                { key: 'actual_usd' as SortKey, label: 'Actual USD' },
                { key: 'difference' as SortKey, label: 'Difference' },
                { key: 'status' as SortKey, label: 'Status' },
              ].map(({ key, label }) => (
                <th
                  key={key}
                  onClick={() => toggleSort(key)}
                  className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer hover:text-slate-700 select-none whitespace-nowrap"
                >
                  {label}<SortIcon col={key} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginated.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-slate-400 text-sm">
                  No transactions match your filter.
                </td>
              </tr>
            )}
            {paginated.map((t) => (
              <tr
                key={t.transaction_id}
                onClick={() => onSelect(t)}
                className={`cursor-pointer transition-colors hover:bg-slate-50 ${
                  t.is_discrepancy ? 'bg-red-50/40' : ''
                }`}
              >
                <td className="px-4 py-3 font-mono text-xs text-slate-700">{t.transaction_id}</td>
                <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{t.order_date ?? '—'}</td>
                <td className="px-4 py-3">
                  {t.customer_currency ? (
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-xs font-semibold rounded">
                      {t.customer_currency}
                    </span>
                  ) : '—'}
                </td>
                <td className="px-4 py-3 text-right text-slate-700 font-mono text-xs">
                  {t.original_amount != null
                    ? `${fmt(t.original_amount, 2)} ${t.customer_currency ?? ''}`
                    : '—'}
                </td>
                <td className="px-4 py-3 text-slate-600 text-xs whitespace-nowrap">
                  {t.payment_processor ?? '—'}
                </td>
                <td className="px-4 py-3 text-right font-mono text-xs text-slate-600">
                  {fmtUsd(t.expected_usd)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-xs text-slate-600">
                  {fmtUsd(t.actual_usd)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-xs font-semibold">
                  {t.difference == null ? (
                    <span className="text-slate-400">—</span>
                  ) : (
                    <span className={t.difference < -0.5 ? 'text-red-600' : t.difference > 0.5 ? 'text-amber-600' : 'text-emerald-600'}>
                      {t.difference > 0 ? '+' : ''}{fmt(t.difference)}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_BADGE[t.status]}`}>
                      {STATUS_LABEL[t.status]}
                    </span>
                    {t.is_discrepancy && (
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-[10px] font-semibold">
                        ⚠ Flagged
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination footer */}
      <div className="px-5 py-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span>
            Showing {filtered.length === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} of{' '}
            <span className="font-semibold text-slate-700">{filtered.length.toLocaleString()}</span> transactions
          </span>
          <span className="text-slate-300">|</span>
          <label className="flex items-center gap-1.5">
            Rows:
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); resetPage() }}
              className="border border-slate-200 rounded px-1.5 py-0.5 text-xs text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-300"
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage(1)}
            disabled={page === 1}
            className="px-2 py-1 text-xs rounded border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed"
          >«</button>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-2 py-1 text-xs rounded border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed"
          >‹</button>

          {/* Page number pills */}
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let p: number
            if (totalPages <= 5) p = i + 1
            else if (page <= 3) p = i + 1
            else if (page >= totalPages - 2) p = totalPages - 4 + i
            else p = page - 2 + i
            return (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                  p === page
                    ? 'bg-indigo-600 border-indigo-600 text-white'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {p}
              </button>
            )
          })}

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-2 py-1 text-xs rounded border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed"
          >›</button>
          <button
            onClick={() => setPage(totalPages)}
            disabled={page === totalPages}
            className="px-2 py-1 text-xs rounded border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed"
          >»</button>
        </div>
      </div>
    </div>
  )
}
