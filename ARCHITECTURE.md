# Architecture — Zephyr Multi-Currency Reconciliation Tool

## Overview

A full-stack tool that ingests two CSV files (orders + settlements), reconciles them, and surfaces discrepancies through an interactive dashboard.

---

## System Design

```
┌──────────────────────────────────────────────────────────┐
│  Browser (React + Vite)                                  │
│  ┌────────────┐  ┌───────────────────────────────────┐  │
│  │ FileUpload │  │ Dashboard                         │  │
│  │ (drag-drop)│  │  SummaryCards  AlertsPanel        │  │
│  └─────┬──────┘  │  Charts        DiscrepancyTable   │  │
│        │ FormData│  TransactionModal                  │  │
│        ▼         └───────────────────────────────────┘  │
└────────┼─────────────────────────────────────────────────┘
         │ POST /api/reconcile
         ▼
┌──────────────────────────────┐
│  FastAPI (Python)            │
│  ┌────────────────────────┐  │
│  │ parse_orders()         │  │
│  │ parse_settlements()    │  │
│  │ reconcile()            │  │
│  │ detect_patterns()      │  │
│  └────────────────────────┘  │
└──────────────────────────────┘
```

---

## Matching Logic

1. **ID-based join**: Each order is matched to a settlement using `transaction_id` as the primary key — an exact string match.

2. **Expected settlement calculation**:
   ```
   gross_usd    = original_amount / fx_rate_applied
   expected_usd = gross_usd - fees_deducted
   difference   = actual_usd_received - expected_usd
   ```

3. **Discrepancy flag**: A transaction is flagged when `|difference| > $0.50 USD`. This threshold is intentionally conservative to avoid noise from rounding while still catching meaningful errors.

4. **Unmatched orders**: Orders with no settlement record — potential missing payouts.

5. **Unmatched settlements**: Settlements with no order record — potential duplicates or ghost transactions.

---

## FX Rate Deviation Detection

A second-layer check compares each settlement's `fx_rate_applied` against hardcoded market reference rates (sourced at time of writing):

| Currency | Reference Rate (local / USD) |
|----------|------------------------------|
| MXN      | 17.50                        |
| BRL      | 5.00                         |
| IDR      | 15,500                       |
| KES      | 130                          |
| COP      | 4,000                        |

`fx_deviation_pct = ((fx_rate_applied - market_rate) / market_rate) × 100`

Positive deviation means the merchant received fewer USD than the market rate would imply. Transactions with deviation > 3% are surfaced in the Alerts panel.

---

## Pattern Detection

After per-transaction reconciliation, the backend aggregates results and fires alerts for:

| Pattern | Trigger |
|---------|---------|
| Processor anomaly | ≥ 2 flagged transactions AND (>15% discrepancy rate OR >$15 total gap) |
| Currency anomaly | ≥ 2 flagged transactions AND >15% discrepancy rate |
| Large discrepancies | Any transaction with discrepancy > $50 |
| Adverse FX rates | Any matched transaction with fx_deviation_pct > 3% |

Alerts carry severity levels (`critical` / `high` / `medium`) to help triage urgency.

---

## Frontend Data Flow

```
App (state: result, selectedTx)
 ├── FileUpload  →  POST /api/reconcile  →  setResult()
 ├── SummaryCards (read-only, result)
 ├── AlertsPanel (read-only, pattern_alerts)
 ├── Charts (derived from currency_stats / processor_stats)
 ├── DiscrepancyTable (filter + sort client-side, onSelect → setSelectedTx)
 └── TransactionModal (selectedTx, re-derives calculation breakdown from raw fields)
```

All filtering and sorting happens client-side after a single API call — no re-fetches needed.

---

## Key Design Decisions

- **Single POST response**: The full reconciliation result (all transactions + aggregates) is returned in one API response. With 200–500 transactions this is ~200 KB — well within browser limits and avoids pagination complexity.
- **No persistence**: The tool is stateless by design. Files are processed in memory and results live in React state. This matches the "upload & review" workflow and avoids database setup overhead.
- **CSV export in frontend**: The discrepancy export is generated client-side from the in-memory result, avoiding a second round-trip.
- **Market rate hardcoding**: Reference FX rates are hardcoded constants. In production these would be fetched from an FX data provider (e.g. Open Exchange Rates) using the settlement date to get the historical rate.
