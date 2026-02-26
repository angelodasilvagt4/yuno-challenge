from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List, Dict, Any
import csv
import io

app = FastAPI(title="Zephyr Reconciliation API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Reference market FX rates (local currency per 1 USD)
MARKET_RATES: Dict[str, float] = {
    "MXN": 17.50,
    "BRL": 5.00,
    "IDR": 15500.0,
    "KES": 130.0,
    "COP": 4000.0,
}

DISCREPANCY_THRESHOLD_USD = 0.50
FX_DEVIATION_ALERT_PCT = 3.0  # flag if FX rate is >3% worse than market


# ---------------------------------------------------------------------------
# Parsing helpers
# ---------------------------------------------------------------------------

def parse_orders(content: str) -> List[Dict[str, Any]]:
    reader = csv.DictReader(io.StringIO(content.strip()))
    orders = []
    for i, row in enumerate(reader, start=2):
        try:
            orders.append(
                {
                    "transaction_id": row["transaction_id"].strip(),
                    "order_date": row["order_date"].strip(),
                    "customer_currency": row["customer_currency"].strip().upper(),
                    "original_amount": float(row["original_amount"]),
                    "payment_processor": row["payment_processor"].strip(),
                }
            )
        except (KeyError, ValueError) as e:
            raise ValueError(f"Orders CSV row {i}: {e}")
    return orders


def parse_settlements(content: str) -> List[Dict[str, Any]]:
    reader = csv.DictReader(io.StringIO(content.strip()))
    settlements = []
    for i, row in enumerate(reader, start=2):
        try:
            settlements.append(
                {
                    "transaction_id": row["transaction_id"].strip(),
                    "settlement_date": row["settlement_date"].strip(),
                    "usd_amount_received": float(row["usd_amount_received"]),
                    "fx_rate_applied": float(row["fx_rate_applied"]),
                    "fees_deducted": float(row["fees_deducted"]),
                }
            )
        except (KeyError, ValueError) as e:
            raise ValueError(f"Settlements CSV row {i}: {e}")
    return settlements


# ---------------------------------------------------------------------------
# Core reconciliation engine
# ---------------------------------------------------------------------------

def reconcile(orders: List[Dict], settlements: List[Dict]) -> List[Dict]:
    settlement_map = {s["transaction_id"]: s for s in settlements}
    matched_ids: set = set()
    transactions = []

    for order in orders:
        tid = order["transaction_id"]
        settlement = settlement_map.get(tid)

        if settlement:
            matched_ids.add(tid)
            fx = settlement["fx_rate_applied"]
            fees = settlement["fees_deducted"]
            original = order["original_amount"]

            # Core formula: expected_usd = (original_amount / fx_rate) - fees
            expected_usd = (original / fx) - fees
            actual_usd = settlement["usd_amount_received"]
            difference = actual_usd - expected_usd
            diff_pct = (abs(difference) / expected_usd * 100) if expected_usd > 0 else 0

            is_discrepancy = abs(difference) > DISCREPANCY_THRESHOLD_USD

            # FX rate vs market comparison
            currency = order["customer_currency"]
            market_rate = MARKET_RATES.get(currency)
            fx_deviation_pct: Optional[float] = None
            if market_rate:
                # Positive value means FX rate is worse for merchant (more local per USD)
                fx_deviation_pct = round(((fx - market_rate) / market_rate) * 100, 2)

            reason: Optional[str] = None
            if is_discrepancy:
                if abs(difference) > 100:
                    reason = f"Large discrepancy (${abs(difference):.2f})"
                elif diff_pct > 5:
                    reason = f"High % deviation ({diff_pct:.1f}%)"
                else:
                    reason = f"Settlement mismatch (${abs(difference):.2f})"

            transactions.append(
                {
                    "transaction_id": tid,
                    "order_date": order["order_date"],
                    "settlement_date": settlement["settlement_date"],
                    "customer_currency": currency,
                    "original_amount": original,
                    "payment_processor": order["payment_processor"],
                    "fx_rate_applied": fx,
                    "fees_deducted": round(fees, 4),
                    "expected_usd": round(expected_usd, 4),
                    "actual_usd": round(actual_usd, 4),
                    "difference": round(difference, 4),
                    "difference_pct": round(diff_pct, 2),
                    "fx_deviation_pct": fx_deviation_pct,
                    "status": "matched",
                    "is_discrepancy": is_discrepancy,
                    "discrepancy_reason": reason,
                }
            )
        else:
            # Order has no settlement
            transactions.append(
                {
                    "transaction_id": tid,
                    "order_date": order["order_date"],
                    "settlement_date": None,
                    "customer_currency": order["customer_currency"],
                    "original_amount": order["original_amount"],
                    "payment_processor": order["payment_processor"],
                    "fx_rate_applied": None,
                    "fees_deducted": None,
                    "expected_usd": None,
                    "actual_usd": None,
                    "difference": None,
                    "difference_pct": None,
                    "fx_deviation_pct": None,
                    "status": "unmatched_order",
                    "is_discrepancy": False,
                    "discrepancy_reason": "No matching settlement record",
                }
            )

    # Settlements with no order
    for tid, settlement in settlement_map.items():
        if tid not in matched_ids:
            transactions.append(
                {
                    "transaction_id": tid,
                    "order_date": None,
                    "settlement_date": settlement["settlement_date"],
                    "customer_currency": None,
                    "original_amount": None,
                    "payment_processor": None,
                    "fx_rate_applied": settlement["fx_rate_applied"],
                    "fees_deducted": settlement["fees_deducted"],
                    "expected_usd": None,
                    "actual_usd": settlement["usd_amount_received"],
                    "difference": None,
                    "difference_pct": None,
                    "fx_deviation_pct": None,
                    "status": "unmatched_settlement",
                    "is_discrepancy": False,
                    "discrepancy_reason": "No matching order record",
                }
            )

    return transactions


# ---------------------------------------------------------------------------
# Pattern detection
# ---------------------------------------------------------------------------

def detect_patterns(transactions: List[Dict]) -> List[Dict]:
    alerts = []
    matched = [t for t in transactions if t["status"] == "matched"]

    # --- Processor discrepancy analysis ---
    proc: Dict[str, Dict] = {}
    for t in matched:
        p = t["payment_processor"]
        if p not in proc:
            proc[p] = {"total": 0, "flagged": 0, "total_diff": 0.0}
        proc[p]["total"] += 1
        if t["is_discrepancy"]:
            proc[p]["flagged"] += 1
            proc[p]["total_diff"] += abs(t["difference"])

    for p, s in proc.items():
        rate = s["flagged"] / s["total"] if s["total"] > 0 else 0
        if s["flagged"] >= 2 and (rate > 0.15 or s["total_diff"] > 15):
            alerts.append(
                {
                    "type": "processor",
                    "severity": "high" if rate > 0.25 or s["total_diff"] > 40 else "medium",
                    "title": f"Processor Issue: {p}",
                    "message": (
                        f"{s['flagged']} of {s['total']} transactions flagged "
                        f"({rate * 100:.0f}% rate) — ${s['total_diff']:.2f} total discrepancy"
                    ),
                    "processor": p,
                    "flagged_count": s["flagged"],
                    "total_count": s["total"],
                    "discrepancy_rate_pct": round(rate * 100, 1),
                    "total_difference_usd": round(s["total_diff"], 2),
                }
            )

    # --- Currency discrepancy analysis ---
    curr: Dict[str, Dict] = {}
    for t in matched:
        c = t["customer_currency"]
        if c not in curr:
            curr[c] = {"total": 0, "flagged": 0, "total_diff": 0.0}
        curr[c]["total"] += 1
        if t["is_discrepancy"]:
            curr[c]["flagged"] += 1
            curr[c]["total_diff"] += abs(t["difference"])

    for c, s in curr.items():
        rate = s["flagged"] / s["total"] if s["total"] > 0 else 0
        if s["flagged"] >= 2 and rate > 0.15:
            alerts.append(
                {
                    "type": "currency",
                    "severity": "high" if rate > 0.25 else "medium",
                    "title": f"Currency Anomaly: {c}",
                    "message": (
                        f"{s['flagged']} of {s['total']} {c} transactions flagged "
                        f"({rate * 100:.0f}% rate) — ${s['total_diff']:.2f} total discrepancy"
                    ),
                    "currency": c,
                    "flagged_count": s["flagged"],
                    "total_count": s["total"],
                    "discrepancy_rate_pct": round(rate * 100, 1),
                    "total_difference_usd": round(s["total_diff"], 2),
                }
            )

    # --- Large discrepancies (>$50) ---
    large = [t for t in matched if t["is_discrepancy"] and abs(t["difference"]) > 50]
    if large:
        alerts.append(
            {
                "type": "large_discrepancy",
                "severity": "critical",
                "title": "Large Discrepancies Detected",
                "message": f"{len(large)} transaction(s) with discrepancy > $50 USD",
                "count": len(large),
                "transaction_ids": [t["transaction_id"] for t in large[:5]],
                "total_difference_usd": round(sum(abs(t["difference"]) for t in large), 2),
            }
        )

    # --- Adverse FX rates ---
    bad_fx = [
        t
        for t in matched
        if t.get("fx_deviation_pct") is not None and t["fx_deviation_pct"] > FX_DEVIATION_ALERT_PCT
    ]
    if bad_fx:
        alerts.append(
            {
                "type": "fx_rate",
                "severity": "high",
                "title": "Adverse FX Rates Detected",
                "message": (
                    f"{len(bad_fx)} transaction(s) settled at FX rates more than "
                    f"{FX_DEVIATION_ALERT_PCT:.0f}% worse than market reference"
                ),
                "count": len(bad_fx),
                "transaction_ids": [t["transaction_id"] for t in bad_fx[:5]],
            }
        )

    return alerts


# ---------------------------------------------------------------------------
# API endpoints
# ---------------------------------------------------------------------------

@app.post("/api/reconcile")
async def reconcile_endpoint(
    orders_file: UploadFile = File(...),
    settlements_file: UploadFile = File(...),
):
    try:
        orders_content = (await orders_file.read()).decode("utf-8-sig")
        settlements_content = (await settlements_file.read()).decode("utf-8-sig")
    except Exception as e:
        raise HTTPException(400, f"Could not read uploaded files: {e}")

    try:
        orders = parse_orders(orders_content)
    except ValueError as e:
        raise HTTPException(400, f"Orders CSV error: {e}")

    try:
        settlements = parse_settlements(settlements_content)
    except ValueError as e:
        raise HTTPException(400, f"Settlements CSV error: {e}")

    if not orders:
        raise HTTPException(400, "Orders file is empty")
    if not settlements:
        raise HTTPException(400, "Settlements file is empty")

    transactions = reconcile(orders, settlements)
    pattern_alerts = detect_patterns(transactions)

    matched = sum(1 for t in transactions if t["status"] == "matched")
    unmatched_orders = sum(1 for t in transactions if t["status"] == "unmatched_order")
    unmatched_settlements = sum(1 for t in transactions if t["status"] == "unmatched_settlement")
    flagged = sum(1 for t in transactions if t["is_discrepancy"])
    total_discrepancy = sum(
        abs(t["difference"])
        for t in transactions
        if t["is_discrepancy"] and t["difference"] is not None
    )

    # Aggregated stats for charts
    currency_stats: Dict[str, Dict] = {}
    for t in transactions:
        if t["status"] == "matched" and t["customer_currency"]:
            c = t["customer_currency"]
            if c not in currency_stats:
                currency_stats[c] = {"volume_count": 0, "discrepancy_count": 0, "discrepancy_usd": 0.0}
            currency_stats[c]["volume_count"] += 1
            if t["is_discrepancy"]:
                currency_stats[c]["discrepancy_count"] += 1
                currency_stats[c]["discrepancy_usd"] += abs(t["difference"])

    processor_stats: Dict[str, Dict] = {}
    for t in transactions:
        if t["status"] == "matched" and t["payment_processor"]:
            p = t["payment_processor"]
            if p not in processor_stats:
                processor_stats[p] = {"volume_count": 0, "discrepancy_count": 0, "discrepancy_usd": 0.0}
            processor_stats[p]["volume_count"] += 1
            if t["is_discrepancy"]:
                processor_stats[p]["discrepancy_count"] += 1
                processor_stats[p]["discrepancy_usd"] += abs(t["difference"])

    return {
        "total_orders": len(orders),
        "total_settlements": len(settlements),
        "matched": matched,
        "unmatched_orders": unmatched_orders,
        "unmatched_settlements": unmatched_settlements,
        "flagged_count": flagged,
        "total_discrepancy_usd": round(total_discrepancy, 2),
        "transactions": transactions,
        "pattern_alerts": pattern_alerts,
        "currency_stats": {
            k: {**v, "discrepancy_usd": round(v["discrepancy_usd"], 2)}
            for k, v in currency_stats.items()
        },
        "processor_stats": {
            k: {**v, "discrepancy_usd": round(v["discrepancy_usd"], 2)}
            for k, v in processor_stats.items()
        },
    }


@app.get("/api/health")
def health():
    return {"status": "ok"}
