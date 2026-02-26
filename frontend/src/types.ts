export interface Transaction {
  transaction_id: string
  order_date: string | null
  settlement_date: string | null
  customer_currency: string | null
  original_amount: number | null
  payment_processor: string | null
  fx_rate_applied: number | null
  fees_deducted: number | null
  expected_usd: number | null
  actual_usd: number | null
  difference: number | null
  difference_pct: number | null
  fx_deviation_pct: number | null
  status: 'matched' | 'unmatched_order' | 'unmatched_settlement'
  is_discrepancy: boolean
  discrepancy_reason: string | null
}

export interface PatternAlert {
  type: 'processor' | 'currency' | 'large_discrepancy' | 'fx_rate'
  severity: 'critical' | 'high' | 'medium'
  title: string
  message: string
  processor?: string
  currency?: string
  count?: number
  transaction_ids?: string[]
  flagged_count?: number
  total_count?: number
  discrepancy_rate_pct?: number
  total_difference_usd?: number
}

export interface CurrencyStat {
  volume_count: number
  discrepancy_count: number
  discrepancy_usd: number
}

export interface ProcessorStat {
  volume_count: number
  discrepancy_count: number
  discrepancy_usd: number
}

export interface ReconciliationResult {
  total_orders: number
  total_settlements: number
  matched: number
  unmatched_orders: number
  unmatched_settlements: number
  flagged_count: number
  total_discrepancy_usd: number
  transactions: Transaction[]
  pattern_alerts: PatternAlert[]
  currency_stats: Record<string, CurrencyStat>
  processor_stats: Record<string, ProcessorStat>
}
