"""Build rates.json from Bank of Ghana and market rate sources.

All rates are cedis per one unit of the currency. Uses only the standard
library. A source that fails keeps its previous entries, so one outage never
removes currencies from the app.
"""

import html
import json
import re
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

OUTPUT = Path(__file__).resolve().parent.parent / "rates.json"

BOG_URL = "https://www.bog.gov.gh/treasury-and-the-markets/daily-interbank-fx-rates/"
FRANKFURTER_URL = "https://api.frankfurter.dev/v2/rates?base=GHS"
ER_API_URL = "https://open.er-api.com/v6/latest/GHS"

# WAU is the ECOWAS unit of account. MRO and SLL are replaced legacy currencies.
BOG_SKIP = {"WAU", "MRO", "SLL"}

ROW = re.compile(
    r"(\d{1,2} [A-Z][a-z]{2} \d{4}) [A-Za-z ]+? ([A-Z]{6}) ([\d.,]+) ([\d.,]+) ([\d.,]+)"
)


def fetch(url):
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read().decode("utf-8", "replace")


def number(text):
    return float(text.replace(",", ""))


def parse_bog(page):
    """Return ({code: {buying, selling}}, ISO date) for the newest date listed."""
    page = re.sub(r"<script.*?</script>|<style.*?</style>", " ", page, flags=re.S)
    text = html.unescape(re.sub(r"<[^>]+>", " ", page))
    text = re.sub(r"\s+", " ", text)

    rows = []
    for date, pair, buying, selling, _mid in ROW.findall(text):
        rows.append((datetime.strptime(date, "%d %b %Y").date(), pair, number(buying), number(selling)))
    if not rows:
        raise ValueError("no Bank of Ghana rows found")

    latest = max(row[0] for row in rows)
    rates = {}
    for date, pair, buying, selling in rows:
        if date != latest or buying <= 0 or selling <= 0:
            continue
        if pair.endswith("GHS"):
            code, low, high = pair[:3], buying, selling
        elif pair.startswith("GHS"):
            code, low, high = pair[3:], 1 / selling, 1 / buying
        else:
            continue
        if code in BOG_SKIP or code in rates:
            continue
        # The source sometimes lists buying above selling, as with JPY.
        rates[code] = {"buying": min(low, high), "selling": max(low, high)}
    return rates, latest.isoformat()


def parse_frankfurter(body):
    rows = json.loads(body)
    return {row["quote"]: row["rate"] for row in rows}, rows[0]["date"], "frankfurter"


def parse_er_api(body):
    data = json.loads(body)
    if data.get("result") != "success":
        raise ValueError("er-api returned " + str(data.get("result")))
    date = datetime.fromtimestamp(data["time_last_update_unix"], timezone.utc).date().isoformat()
    return data["rates"], date, "er-api"


def fetch_market():
    for url, parse in ((FRANKFURTER_URL, parse_frankfurter), (ER_API_URL, parse_er_api)):
        try:
            return parse(fetch(url))
        except Exception as error:
            print(f"Market source failed: {url}: {error}", file=sys.stderr)
    return None


def load_previous():
    try:
        previous = json.loads(OUTPUT.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    # Files from before this schema have no usable per-currency entries.
    return previous if isinstance(previous.get("rates"), dict) and "bog_date" in previous else {}


def entries_from(previous, source):
    return {
        code: rate
        for code, rate in previous.get("rates", {}).items()
        if rate.get("source") == source
    }


def main():
    previous = load_previous()

    try:
        bog, bog_date = parse_bog(fetch(BOG_URL))
        bog = {code: {**rate, "source": "bog"} for code, rate in bog.items()}
    except Exception as error:
        print(f"Bank of Ghana failed: {error}", file=sys.stderr)
        bog, bog_date = entries_from(previous, "bog"), previous.get("bog_date")

    market = fetch_market()
    if market:
        per_ghs, market_date, market_source = market
        market_rates = {
            code: {"buying": 1 / value, "selling": 1 / value, "source": "market"}
            for code, value in per_ghs.items()
            if value > 0 and code != "GHS"
        }
    else:
        market_rates = entries_from(previous, "market")
        market_date = previous.get("market_date")
        market_source = previous.get("market_source")

    if not bog and not market_rates:
        raise SystemExit("No rates from any source and no previous rates to keep.")

    rates = {**market_rates, **bog}  # Bank of Ghana wins where both list a currency.
    data = {
        "bog_date": bog_date,
        "market_date": market_date,
        "market_source": market_source,
        "rates": {
            code: {
                "buying": round(rate["buying"], 8),
                "selling": round(rate["selling"], 8),
                "source": rate["source"],
            }
            for code, rate in sorted(rates.items())
        },
    }

    # updated_at is left out of the comparison so an unchanged run writes nothing.
    if {k: v for k, v in previous.items() if k != "updated_at"} == data:
        print("Rates unchanged.")
        return

    data["updated_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    OUTPUT.write_text(json.dumps(data, indent=1) + "\n", encoding="utf-8", newline="\n")
    print(f"Wrote {len(rates)} rates: {len(bog)} Bank of Ghana, {len(market_rates)} market.")


if __name__ == "__main__":
    main()
