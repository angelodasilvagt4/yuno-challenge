"""
Generate realistic test data for Zephyr Reconciliation Tool.

Scale: 25,000 transactions across 5 currencies and 5 processors.

Injected discrepancies (realistic ~1% error rate):
  - 125 PayU calculation errors       (~12% of PayU txns)
  - 75  Xendit calculation errors     (~9%  of Xendit txns)
  - 100 MercadoPago bad FX on BRL     (5-10% worse than market, internally consistent)
  - 50  missing settlements            (orders with no settlement record)
  - 30  mystery settlements            (settlements with no order record)
"""

import csv
import random
from datetime import datetime, timedelta
from pathlib import Path

random.seed(99)

CURRENCIES = {
    "MXN": {"rate": 17.50, "min": 200,    "max": 5000,    "weight": 0.25},
    "BRL": {"rate": 5.00,  "min": 50,     "max": 1500,    "weight": 0.20},
    "IDR": {"rate": 15500, "min": 100000, "max": 3000000, "weight": 0.20},
    "KES": {"rate": 130,   "min": 500,    "max": 15000,   "weight": 0.15},
    "COP": {"rate": 4000,  "min": 50000,  "max": 1500000, "weight": 0.20},
}

PROCESSORS = ["StripeConnect", "MercadoPago", "Xendit", "PayU", "Flutterwave"]

FEE_SCHEDULE = {
    "StripeConnect": (0.029, 0.30),
    "MercadoPago":   (0.031, 0.25),
    "Xendit":        (0.025, 0.35),
    "PayU":          (0.028, 0.30),
    "Flutterwave":   (0.032, 0.20),
}

PROCESSOR_WEIGHTS = [0.22, 0.20, 0.20, 0.20, 0.18]

START_DATE = datetime(2024, 10, 1)
N = 25_000


def txn_id(i: int) -> str:
    return f"TXN-2024-{i:06d}"


def rand_date(days: int = 90) -> datetime:
    return START_DATE + timedelta(days=random.randint(0, days))


def add_noise(rate: float, pct: float = 0.015) -> float:
    return rate * (1 + random.uniform(-pct, pct))


def calc_fee(usd_gross: float, processor: str) -> float:
    rate, fixed = FEE_SCHEDULE[processor]
    return round(usd_gross * rate + fixed, 4)


def weighted_currency() -> str:
    currencies = list(CURRENCIES.keys())
    weights = [CURRENCIES[c]["weight"] for c in currencies]
    return random.choices(currencies, weights=weights, k=1)[0]


orders = []
settlements = []

for i in range(1, N + 1):
    tid = txn_id(i)
    currency = weighted_currency()
    info = CURRENCIES[currency]

    order_date = rand_date()
    amount = round(random.uniform(info["min"], info["max"]), 2)
    processor = random.choices(PROCESSORS, weights=PROCESSOR_WEIGHTS, k=1)[0]

    fx = round(add_noise(info["rate"]), 4)
    usd_gross = amount / fx
    fee = calc_fee(usd_gross, processor)
    usd_settled = round(usd_gross - fee, 4)
    settlement_date = order_date + timedelta(days=random.choice([1, 2]))

    orders.append({
        "transaction_id": tid,
        "order_date": order_date.strftime("%Y-%m-%d"),
        "customer_currency": currency,
        "original_amount": amount,
        "payment_processor": processor,
    })
    settlements.append({
        "transaction_id": tid,
        "settlement_date": settlement_date.strftime("%Y-%m-%d"),
        "usd_amount_received": usd_settled,
        "fx_rate_applied": fx,
        "fees_deducted": fee,
    })


# ── Type 1: PayU calculation errors (125 txns) ─────────────────────────────
payu_idx = [i for i, o in enumerate(orders) if o["payment_processor"] == "PayU"]
payu_errors = set(random.sample(payu_idx, min(125, len(payu_idx))))
for idx in payu_errors:
    delta = round(random.uniform(1.0, 18.0), 4)
    settlements[idx]["usd_amount_received"] = round(
        settlements[idx]["usd_amount_received"] + random.choice([-1, 1]) * delta, 4
    )

# ── Type 2: Xendit calculation errors (75 txns) ────────────────────────────
xendit_idx = [
    i for i, o in enumerate(orders)
    if o["payment_processor"] == "Xendit" and i not in payu_errors
]
xendit_errors = set(random.sample(xendit_idx, min(75, len(xendit_idx))))
for idx in xendit_errors:
    delta = round(random.uniform(0.8, 12.0), 4)
    settlements[idx]["usd_amount_received"] = round(
        settlements[idx]["usd_amount_received"] - delta, 4
    )

error_indices = payu_errors | xendit_errors

# ── Type 3: MercadoPago bad FX on BRL (100 txns) ──────────────────────────
brl_mp_idx = [
    i for i, o in enumerate(orders)
    if o["payment_processor"] == "MercadoPago"
    and o["customer_currency"] == "BRL"
    and i not in error_indices
]
bad_fx_idx = set(random.sample(brl_mp_idx, min(100, len(brl_mp_idx))))
for idx in bad_fx_idx:
    market = CURRENCIES["BRL"]["rate"]
    bad_rate = round(market * random.uniform(1.05, 1.10), 4)
    amount = orders[idx]["original_amount"]
    usd_gross = amount / bad_rate
    fee = calc_fee(usd_gross, "MercadoPago")
    settlements[idx]["fx_rate_applied"] = bad_rate
    settlements[idx]["fees_deducted"] = fee
    settlements[idx]["usd_amount_received"] = round(usd_gross - fee, 4)

all_injected = error_indices | bad_fx_idx

# ── Type 4: Missing settlements (50 orders) ────────────────────────────────
candidates = [i for i in range(N) if i not in all_injected]
missing_idx = set(random.sample(candidates, 50))

# ── Type 5: Mystery settlements (30 extra) ────────────────────────────────
mystery = []
for j in range(1, 31):
    mystery.append({
        "transaction_id": f"TXN-MYSTERY-{j:04d}",
        "settlement_date": rand_date().strftime("%Y-%m-%d"),
        "usd_amount_received": round(random.uniform(20, 800), 4),
        "fx_rate_applied": round(random.uniform(4.9, 18.0), 4),
        "fees_deducted": round(random.uniform(1.0, 25.0), 4),
    })

# ── Write files ─────────────────────────────────────────────────────────────
out_dir = Path(__file__).parent

with open(out_dir / "orders.csv", "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=[
        "transaction_id", "order_date", "customer_currency",
        "original_amount", "payment_processor",
    ])
    w.writeheader()
    w.writerows(orders)

filtered = [s for i, s in enumerate(settlements) if i not in missing_idx]
filtered += mystery
random.shuffle(filtered)

with open(out_dir / "settlements.csv", "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=[
        "transaction_id", "settlement_date", "usd_amount_received",
        "fx_rate_applied", "fees_deducted",
    ])
    w.writeheader()
    w.writerows(filtered)

print(f"✓ orders.csv      — {len(orders):,} transactions across 5 currencies")
print(f"✓ settlements.csv — {len(filtered):,} records")
print()
print("Injected discrepancies:")
print(f"  PayU calc errors          : {len(payu_errors)}")
print(f"  Xendit calc errors        : {len(xendit_errors)}")
print(f"  MercadoPago bad FX (BRL)  : {len(bad_fx_idx)}")
print(f"  Missing settlements       : {len(missing_idx)}")
print(f"  Mystery settlements       : {len(mystery)}")
