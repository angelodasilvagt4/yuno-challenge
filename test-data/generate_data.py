"""
Generate realistic test data for Zephyr Reconciliation Tool.

Intentionally injected discrepancies:
  - 5 transactions where actual_usd is wrong (PayU — calculation errors)
  - 3 transactions where actual_usd is wrong (Xendit — calculation errors)
  - 4 transactions with bad FX rates 5-10% worse than market (MercadoPago, BRL)
  - 3 orders with no matching settlement (missing settlements)
  - 3 settlements with no matching order (mystery payments)
"""

import csv
import random
from datetime import datetime, timedelta
from pathlib import Path

random.seed(42)

CURRENCIES = {
    "MXN": {"rate": 17.50, "min": 200,    "max": 5000},
    "BRL": {"rate": 5.00,  "min": 50,     "max": 1500},
    "IDR": {"rate": 15500, "min": 100000, "max": 3000000},
    "KES": {"rate": 130,   "min": 500,    "max": 15000},
    "COP": {"rate": 4000,  "min": 50000,  "max": 1500000},
}

PROCESSORS = ["StripeConnect", "MercadoPago", "Xendit", "PayU", "Flutterwave"]

FEE_SCHEDULE = {
    "StripeConnect":  (0.029, 0.30),
    "MercadoPago":   (0.031, 0.25),
    "Xendit":        (0.025, 0.35),
    "PayU":          (0.028, 0.30),
    "Flutterwave":   (0.032, 0.20),
}

START_DATE = datetime(2024, 10, 1)
N = 220


def txn_id(i: int) -> str:
    return f"TXN-2024-{i:05d}"


def rand_date(days: int = 90) -> datetime:
    return START_DATE + timedelta(days=random.randint(0, days))


def add_noise(rate: float, pct: float = 0.015) -> float:
    return rate * (1 + random.uniform(-pct, pct))


def calc_fee(usd_gross: float, processor: str) -> float:
    rate, fixed = FEE_SCHEDULE[processor]
    return round(usd_gross * rate + fixed, 4)


orders = []
settlements = []

for i in range(1, N + 1):
    tid = txn_id(i)
    currency = random.choice(list(CURRENCIES.keys()))
    info = CURRENCIES[currency]

    order_date = rand_date()
    amount = round(random.uniform(info["min"], info["max"]), 2)
    processor = random.choice(PROCESSORS)

    fx = round(add_noise(info["rate"]), 4)
    usd_gross = amount / fx
    fee = calc_fee(usd_gross, processor)
    usd_settled = round(usd_gross - fee, 4)
    settlement_date = order_date + timedelta(days=random.choice([1, 2]))

    orders.append(
        {
            "transaction_id": tid,
            "order_date": order_date.strftime("%Y-%m-%d"),
            "customer_currency": currency,
            "original_amount": amount,
            "payment_processor": processor,
        }
    )
    settlements.append(
        {
            "transaction_id": tid,
            "settlement_date": settlement_date.strftime("%Y-%m-%d"),
            "usd_amount_received": usd_settled,
            "fx_rate_applied": fx,
            "fees_deducted": fee,
        }
    )

# ── Inject discrepancy type 1: PayU calculation errors (5 txns) ────────────
# Pick PayU transactions
payu_indices = [i for i, o in enumerate(orders) if o["payment_processor"] == "PayU"]
payu_errors = random.sample(payu_indices, min(5, len(payu_indices)))
for idx in payu_errors:
    delta = round(random.uniform(1.5, 12.0), 4)
    direction = random.choice([-1, 1])
    settlements[idx]["usd_amount_received"] = round(
        settlements[idx]["usd_amount_received"] + direction * delta, 4
    )

# ── Inject discrepancy type 2: Xendit calculation errors (3 txns) ──────────
xendit_indices = [
    i for i, o in enumerate(orders)
    if o["payment_processor"] == "Xendit" and i not in payu_errors
]
xendit_errors = random.sample(xendit_indices, min(3, len(xendit_indices)))
for idx in xendit_errors:
    delta = round(random.uniform(2.0, 8.0), 4)
    settlements[idx]["usd_amount_received"] = round(
        settlements[idx]["usd_amount_received"] - delta, 4
    )

error_indices = set(payu_errors + xendit_errors)

# ── Inject discrepancy type 3: Bad FX rates on MercadoPago BRL (4 txns) ────
brl_mp_indices = [
    i for i, o in enumerate(orders)
    if o["payment_processor"] == "MercadoPago"
    and o["customer_currency"] == "BRL"
    and i not in error_indices
]
bad_fx_indices = random.sample(brl_mp_indices, min(4, len(brl_mp_indices)))
for idx in bad_fx_indices:
    market_rate = CURRENCIES["BRL"]["rate"]
    bad_rate = round(market_rate * random.uniform(1.05, 1.10), 4)
    amount = orders[idx]["original_amount"]
    usd_gross = amount / bad_rate
    fee = calc_fee(usd_gross, "MercadoPago")
    settlements[idx]["fx_rate_applied"] = bad_rate
    settlements[idx]["fees_deducted"] = fee
    settlements[idx]["usd_amount_received"] = round(usd_gross - fee, 4)

all_injected = error_indices | set(bad_fx_indices)

# ── Inject type 4: Missing settlements (3 orders) ──────────────────────────
candidates = [i for i in range(N) if i not in all_injected]
missing_settlement_indices = set(random.sample(candidates, 3))

# ── Inject type 5: Mystery settlements (3 extra in settlement file) ─────────
mystery = []
for j in range(1, 4):
    mystery.append(
        {
            "transaction_id": f"TXN-MYSTERY-{j:03d}",
            "settlement_date": rand_date().strftime("%Y-%m-%d"),
            "usd_amount_received": round(random.uniform(50, 600), 4),
            "fx_rate_applied": round(random.uniform(4.9, 18.0), 4),
            "fees_deducted": round(random.uniform(1.5, 18.0), 4),
        }
    )

# ── Write CSV files ─────────────────────────────────────────────────────────
out_dir = Path(__file__).parent

with open(out_dir / "orders.csv", "w", newline="") as f:
    w = csv.DictWriter(
        f,
        fieldnames=["transaction_id", "order_date", "customer_currency", "original_amount", "payment_processor"],
    )
    w.writeheader()
    w.writerows(orders)

filtered_settlements = [s for i, s in enumerate(settlements) if i not in missing_settlement_indices]
filtered_settlements += mystery
random.shuffle(filtered_settlements)

with open(out_dir / "settlements.csv", "w", newline="") as f:
    w = csv.DictWriter(
        f,
        fieldnames=["transaction_id", "settlement_date", "usd_amount_received", "fx_rate_applied", "fees_deducted"],
    )
    w.writeheader()
    w.writerows(filtered_settlements)

print(f"✓ orders.csv        — {len(orders)} transactions across 5 currencies")
print(f"✓ settlements.csv   — {len(filtered_settlements)} records")
print()
print("Injected discrepancies:")
print(f"  PayU calculation errors   : {len(payu_errors)}")
print(f"  Xendit calculation errors : {len(xendit_errors)}")
print(f"  MercadoPago bad FX (BRL)  : {len(bad_fx_indices)}")
print(f"  Missing settlements       : {len(missing_settlement_indices)}")
print(f"  Mystery settlements       : {len(mystery)}")
