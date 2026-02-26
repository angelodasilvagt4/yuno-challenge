import { useEffect } from 'react'
import type { Transaction } from '../types'

interface Props {
  transaction: Transaction
  onClose: () => void
}

// Market reference rates (mirrored from backend)
const MARKET_RATES: Record<string, number> = {
  MXN: 17.5,
  BRL: 5.0,
  IDR: 15500,
  KES: 130,
  COP: 4000,
}

const fmt = (v: number | null | undefined, d = 4) =>
  v == null ? '—' : v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })

const fmtUsd = (v: number | null | undefined) =>
  v == null ? '—' : `$${v.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`

function Row({ label, value, highlight }: { label: string; value: React.ReactNode; highlight?: 'red' | 'green' | 'amber' }) {
  const bg = highlight === 'red' ? 'bg-red-50 border border-red-200 rounded-lg px-3 py-2' :
             highlight === 'green' ? 'bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2' :
             highlight === 'amber' ? 'bg-amber-50 border border-amber-200 rounded-lg px-3 py-2' : ''
  return (
    <div className={`flex justify-between items-center gap-4 ${bg} ${!highlight ? 'py-1.5' : ''}`}>
      <span className="text-slate-500 text-sm">{label}</span>
      <span className={`font-mono text-sm font-semibold ${highlight === 'red' ? 'text-red-700' : highlight === 'green' ? 'text-emerald-700' : highlight === 'amber' ? 'text-amber-700' : 'text-slate-800'}`}>
        {value}
      </span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">{title}</h3>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

export default function TransactionModal({ transaction: t, onClose }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const market = t.customer_currency ? MARKET_RATES[t.customer_currency] : undefined
  const fxDeviation = t.fx_deviation_pct

  const grossUsd = (t.original_amount != null && t.fx_rate_applied != null)
    ? t.original_amount / t.fx_rate_applied
    : null

  const differenceHighlight = t.difference == null ? undefined :
    t.difference < -0.5 ? 'red' as const :
    t.difference > 0.5 ? 'amber' as const : 'green' as const

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className={`px-6 py-5 rounded-t-2xl flex items-start justify-between ${t.is_discrepancy ? 'bg-red-50 border-b border-red-200' : t.status !== 'matched' ? 'bg-amber-50 border-b border-amber-200' : 'bg-emerald-50 border-b border-emerald-200'}`}>
          <div>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Transaction Detail</p>
            <p className="font-bold text-slate-900 font-mono text-lg">{t.transaction_id}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {t.is_discrepancy && (
                <span className="px-2 py-0.5 bg-red-600 text-white text-xs font-bold rounded-full">⚠ DISCREPANCY</span>
              )}
              {t.status === 'unmatched_order' && (
                <span className="px-2 py-0.5 bg-amber-500 text-white text-xs font-bold rounded-full">NO SETTLEMENT</span>
              )}
              {t.status === 'unmatched_settlement' && (
                <span className="px-2 py-0.5 bg-indigo-600 text-white text-xs font-bold rounded-full">MYSTERY PAYMENT</span>
              )}
              {!t.is_discrepancy && t.status === 'matched' && (
                <span className="px-2 py-0.5 bg-emerald-600 text-white text-xs font-bold rounded-full">✓ CLEAN</span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 transition-colors p-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Order info */}
          {t.order_date && (
            <Section title="Order Information">
              <Row label="Order Date" value={t.order_date} />
              <Row label="Customer Currency" value={t.customer_currency ?? '—'} />
              {t.original_amount != null && (
                <Row
                  label="Original Amount"
                  value={`${fmt(t.original_amount, 2)} ${t.customer_currency ?? ''}`}
                />
              )}
              <Row label="Payment Processor" value={t.payment_processor ?? '—'} />
            </Section>
          )}

          {/* Settlement info */}
          {t.settlement_date && (
            <Section title="Settlement Information">
              <Row label="Settlement Date" value={t.settlement_date} />
              <Row label="FX Rate Applied" value={fmt(t.fx_rate_applied)} />
              {market && t.fx_rate_applied != null && (
                <Row
                  label="Market Reference Rate"
                  value={`${fmt(market, 4)} ${fxDeviation != null && fxDeviation > 3 ? `⚠ ${fxDeviation.toFixed(2)}% worse` : ''}`}
                  highlight={fxDeviation != null && fxDeviation > 3 ? 'amber' : undefined}
                />
              )}
              <Row label="Fees Deducted" value={fmtUsd(t.fees_deducted)} />
            </Section>
          )}

          {/* Calculation Breakdown */}
          {t.status === 'matched' && (
            <Section title="Calculation Breakdown">
              <div className="bg-slate-50 rounded-xl p-4 space-y-2 font-mono text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Gross USD = {fmt(t.original_amount, 2)} {t.customer_currency} ÷ {fmt(t.fx_rate_applied, 4)}</span>
                  <span className="font-semibold text-slate-700">{fmtUsd(grossUsd)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Fees Deducted</span>
                  <span className="text-red-500">− {fmtUsd(t.fees_deducted)}</span>
                </div>
                <div className="border-t border-slate-200 pt-2 flex justify-between text-slate-700 font-bold">
                  <span>Expected Settlement</span>
                  <span>{fmtUsd(t.expected_usd)}</span>
                </div>
              </div>

              <div className="mt-3 space-y-2">
                <Row
                  label="Expected USD"
                  value={fmtUsd(t.expected_usd)}
                />
                <Row
                  label="Actual USD Received"
                  value={fmtUsd(t.actual_usd)}
                  highlight={t.is_discrepancy ? (t.actual_usd! < t.expected_usd! ? 'red' : 'amber') : 'green'}
                />
                <Row
                  label="Difference"
                  value={`${t.difference != null && t.difference > 0 ? '+' : ''}${fmt(t.difference, 4)} (${fmt(t.difference_pct, 2)}%)`}
                  highlight={differenceHighlight}
                />
              </div>

              {t.discrepancy_reason && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-xs font-semibold text-red-700">Reason: {t.discrepancy_reason}</p>
                </div>
              )}
            </Section>
          )}

          {/* Unmatched explanations */}
          {t.status === 'unmatched_order' && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
              <p className="font-semibold mb-1">No settlement record found</p>
              <p className="text-xs">This order has no matching settlement. Possible causes: T+3 delay, processor error, chargeback, or the settlement is in a later file.</p>
            </div>
          )}
          {t.status === 'unmatched_settlement' && (
            <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl text-sm text-indigo-700">
              <p className="font-semibold mb-1">No matching order found</p>
              <p className="text-xs">Settlement exists without a corresponding order. Possible causes: duplicate payout, test transaction, or order from a previous period not in this file.</p>
              <div className="mt-2 pt-2 border-t border-indigo-200 space-y-1">
                <Row label="Amount Received" value={fmtUsd(t.actual_usd)} />
                <Row label="Settlement Date" value={t.settlement_date ?? '—'} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
