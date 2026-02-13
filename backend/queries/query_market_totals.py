#!/usr/bin/env python3
"""
Simple command-line wrapper for querying market totals.

Usage:
    python3 query_market_totals.py 2025-08-01 2025-10-31
    python3 query_market_totals.py 2025-09-01 2025-11-30
"""

import sys
import os
from dotenv import load_dotenv

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from get_market_totals import MarketTotalsAPI

# Load environment variables
load_dotenv()

def main():
    if len(sys.argv) != 3:
        print("Usage: python3 query_market_totals.py <date_from> <date_to>")
        print("Example: python3 query_market_totals.py 2025-08-01 2025-10-31")
        sys.exit(1)

    date_from = sys.argv[1]
    date_to = sys.argv[2]

    # Initialize the API client
    api = MarketTotalsAPI(
        base_url=os.getenv("GLIMPSE_API_BASE_URL"),
        app_id=os.getenv("GLIMPSE_APP_ID")
    )

    print(f"\nQuerying market totals from {date_from} to {date_to}")
    print(f"(30-day lag will be automatically applied)\n")

    try:
        result = api.get_market_totals(
            date_from=date_from,
            date_to=date_to,
            context="MARKET"
        )

        if "error" in result:
            print(f"❌ Error: {result['error']}")
            print(f"Contributors: {result['contributor_count']} (minimum required: {result['minimum_required']})")
        else:
            print("✅ Market Totals (with 30-day lag):")
            print(f"   Period: {result['period_start']} to {result['period_end']}")
            print(f"\n   Total Volume: €{result['total_volume_eur']:,.2f}M")
            print(f"   Buy Volume:   €{result['buy_volume_eur']:,.2f}M ({result['buy_pct']}%)")
            print(f"   Sell Volume:  €{result['sell_volume_eur']:,.2f}M ({result['sell_pct']}%)")
            print(f"\n   Total Trades: {result['total_trades']:,}")
            print(f"   Buy Trades:   {result['buy_trades']:,}")
            print(f"   Sell Trades:  {result['sell_trades']:,}")
            print(f"\n   Contributors: {result['contributor_count']}")

    except Exception as e:
        print(f"❌ Error calling API: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
