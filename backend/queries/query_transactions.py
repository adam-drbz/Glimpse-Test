#!/usr/bin/env python3
"""
Simple command-line wrapper for querying transaction history.

Usage:
    # Market context (capped, anonymized, 30-day lag)
    python3 query_transactions.py market 2025-08-01 2025-10-31 --limit 10

    # Client context (full detail, no lag - uses GLIMPSE_CLIENT_ID from environment)
    python3 query_transactions.py client 2025-08-01 2025-10-31 --limit 10

    # With filters
    python3 query_transactions.py market 2025-09-01 2025-09-30 --side Buy --sector "Financials" --limit 20
    python3 query_transactions.py market 2025-09-01 2025-09-30 --dealer "MORGAN STANLEY" --limit 10

    # Grouped by dealer
    python3 query_transactions.py market 2025-09-01 2025-09-30 --group-by dealer --limit 100

    # Grouped by sector
    python3 query_transactions.py market 2025-09-01 2025-09-30 --group-by sector --limit 100

Note:
    CLIENT context requires GLIMPSE_CLIENT_ID environment variable.
    Set it in .env file or export GLIMPSE_CLIENT_ID="Client 1"
"""

import sys
import argparse
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from get_transaction_history import TransactionHistoryAPI

# Load environment variables for development
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # python-dotenv not installed


def display_transaction_list(result, context_upper, offset):
    """Display transactions as a list."""
    print(f"Actual Period: {result['period_start']} to {result['period_end']}")
    if result.get('lag_applied_days'):
        print(f"Lag Applied: {result['lag_applied_days']} days")
    print(f"Total Matching Trades: {result['pagination']['total']:,}")
    print(f"Showing: {len(result['data'])} trades")
    print(f"\n{result['note']}")
    print(f"\n{'='*80}\n")

    if not result['data']:
        print("No transactions found for this query.")
        return

    # Display transactions
    for i, trade in enumerate(result['data'], start=offset + 1):
        print(f"{i}. Trade Date: {trade.get('trade_date')} {trade.get('trade_time', '')}")
        print(f"   {trade.get('side')} {trade.get('ticker')} ({trade.get('isin')})")

        if context_upper == "MARKET":
            print(f"   Size: {trade.get('size_display')} (capped)")
            print(f"   Price: {trade.get('price')}")
            if trade.get('dealer'):
                print(f"   Dealer: {trade.get('dealer')} ({trade.get('dealer_abbrev')})")
        else:
            print(f"   Size: €{trade.get('size_actual')}M (actual)")
            print(f"   Size EUR: €{trade.get('size_eur_actual')}M")
            print(f"   Price: {trade.get('price')}")
            print(f"   Mid Price: {trade.get('mid_price')}")
            print(f"   Dealer: {trade.get('dealer')} ({trade.get('dealer_abbrev')})")

        print(f"   Sector: {trade.get('sector')}, Region: {trade.get('region')}")
        print(f"   Currency: {trade.get('currency')}, Maturity: {trade.get('maturity')}")
        print()


def display_grouped_results(result, context_upper):
    """Display grouped transaction results."""
    print(f"Actual Period: {result['period_start']} to {result['period_end']}")
    print(f"Grouped by: {result['grouped_by']}")
    print(f"Total Groups: {result['total_groups']}")
    print(f"\n{'='*80}\n")

    if not result['grouped_data']:
        print("No transactions found for this query.")
        return

    # Check if this is time-based grouping
    is_time_grouping = result['grouped_by'] in ['week', 'month', 'quarter', 'year']

    # Display summary for each group
    # Handle None values in group names by converting to string for sorting
    for group_name, group_data in sorted(result['grouped_data'].items(), key=lambda x: str(x[0]) if x[0] is not None else ""):
        summary = group_data['summary']

        print(f"\n{'-'*80}")
        print(f"📊 {group_name}")
        print(f"{'-'*80}")
        print(f"Total Transactions: {summary['count']:,}")
        print(f"Total Volume: €{summary['total_volume']:,.2f}M")
        print(f"Buys: {summary['buy_count']:,} | Sells: {summary['sell_count']:,}")
        print(f"Currencies: {', '.join(summary['currencies'])}")

        # For time-based grouping, show less detail
        if is_time_grouping:
            # Don't show sample transactions for time grouping, just summary stats
            pass
        else:
            # Show first 3 transactions in this group for field-based grouping
            print(f"\nSample Transactions:")
            for i, trade in enumerate(group_data['transactions'][:3], 1):
                print(f"  {i}. {trade.get('trade_date')} - {trade.get('side')} "
                      f"{trade.get('size_display', trade.get('size_actual', 'N/A'))} "
                      f"{trade.get('ticker')} @ {trade.get('price')}")

            if len(group_data['transactions']) > 3:
                print(f"  ... and {len(group_data['transactions']) - 3} more")
        print()


def main():
    parser = argparse.ArgumentParser(
        description='Query transaction history',
        epilog='Note: CLIENT context requires GLIMPSE_CLIENT_ID environment variable'
    )
    parser.add_argument('context', choices=['market', 'client'], help='Query context')
    parser.add_argument('date_from', help='Start date (YYYY-MM-DD)')
    parser.add_argument('date_to', help='End date (YYYY-MM-DD)')
    parser.add_argument('--limit', type=int, default=10, help='Max records to return')
    parser.add_argument('--offset', type=int, default=0, help='Records to skip')
    parser.add_argument('--group-by', dest='group_by',
                        choices=['dealer', 'ticker', 'sector', 'currency', 'region', 'country', 'seniority', 'credit_grade', 'week', 'month', 'quarter', 'year'],
                        help='Group results by field or time period (dealer, sector, ticker, week, month, quarter, year, etc.)')

    # Filter options
    parser.add_argument('--isin', help='Filter by ISIN')
    parser.add_argument('--ticker', help='Filter by ticker')
    parser.add_argument('--side', choices=['Buy', 'Sell'], help='Filter by side')
    parser.add_argument('--dealer', help='Filter by dealer/counterparty')
    parser.add_argument('--sector', help='Filter by sector')
    parser.add_argument('--region', help='Filter by region')
    parser.add_argument('--currency', help='Filter by currency')
    parser.add_argument('--seniority', help='Filter by seniority')
    parser.add_argument('--credit-grade', dest='credit_grade', help='Filter by credit grade')
    parser.add_argument('--bond-category', dest='bond_category', help='Filter by bond category')

    args = parser.parse_args()

    # For client context, verify environment variable is set
    if args.context == 'client':
        client_id = os.environ.get('GLIMPSE_CLIENT_ID')
        if not client_id:
            print("❌ Error: CLIENT context requires GLIMPSE_CLIENT_ID environment variable")
            print("\nSet it in one of these ways:")
            print("  1. Create/update .env file with: GLIMPSE_CLIENT_ID=Client 1")
            print("  2. Export in shell: export GLIMPSE_CLIENT_ID=\"Client 1\"")
            sys.exit(1)
        print(f"✓ Authenticated as: {client_id}\n")

    # Build filters dictionary
    filters = {}
    for key in ['isin', 'ticker', 'side', 'dealer', 'sector', 'region', 'currency', 'seniority', 'credit_grade', 'bond_category']:
        value = getattr(args, key, None)
        if value:
            filters[key] = value

    # Initialize API
    api = TransactionHistoryAPI(
        base_url=os.getenv("GLIMPSE_API_BASE_URL"),
        app_id=os.getenv("GLIMPSE_APP_ID")
    )

    context_upper = args.context.upper()
    print(f"\n{'='*80}")
    print(f"TRANSACTION HISTORY - {context_upper} CONTEXT")
    print(f"{'='*80}")
    print(f"Date Range: {args.date_from} to {args.date_to}")
    if filters:
        print(f"Filters: {filters}")
    if args.group_by:
        print(f"Grouped by: {args.group_by}")
    print()

    try:
        result = api.get_transaction_history(
            date_from=args.date_from,
            date_to=args.date_to,
            context=context_upper,
            filters=filters,
            limit=args.limit,
            offset=args.offset,
            group_by=args.group_by
        )

        # Check if results are grouped
        if args.group_by:
            display_grouped_results(result, context_upper)
        else:
            display_transaction_list(result, context_upper, args.offset)


    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
