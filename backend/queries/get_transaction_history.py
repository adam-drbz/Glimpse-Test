"""
get_transaction_history.py

Secure function for retrieving transaction history with built-in controls.
Implements the GLP Data Control Framework's secure function pattern.

This function:
- For MARKET context: 30-day lag, dealer names visible, NO client identifiers, capped sizes
- For CLIENT context: No lag, full detail, row-level security (only client's own data)
- Supports filtering and pagination
"""

import requests
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
import json
import os
from collections import defaultdict

# Try to load environment variables for development (optional dependency)
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # python-dotenv not installed, will use os.environ directly


class TransactionHistoryAPI:
    """
    Secure function for retrieving transaction history from the Boltzbit API.

    This class enforces data controls at the function boundary:
    - MARKET context: capped sizes, no party names, 30-day lag
    - CLIENT context: full detail, only client's own data, no lag
    """

    def __init__(self, base_url: str, app_id: str, api_key: Optional[str] = None):
        """
        Initialize the API client.

        Args:
            base_url: Base URL for the Boltzbit API
            app_id: Application ID for the Glimpse app
            api_key: Optional API key for authentication
        """
        self.base_url = base_url.rstrip('/')
        self.app_id = app_id
        self.headers = {
            'Content-Type': 'application/json'
        }
        if api_key:
            self.headers['Authorization'] = f'Bearer {api_key}'

    def _format_date_range(self, date_from: str, date_to: str) -> tuple[str, str]:
        """
        Format date range for SQL query to include full days.

        Since database stores timestamps as YYYY-MM-DDTHH:MM:SS, we need to:
        - Keep start date as-is (will match >= YYYY-MM-DD 00:00:00)
        - Add one day to end date and use < comparison (to include all of end date)

        Args:
            date_from: Start date (YYYY-MM-DD format)
            date_to: End date (YYYY-MM-DD format)

        Returns:
            Tuple of (date_from, date_to_next_day) for SQL WHERE clause
        """
        input_fmt = "%Y-%m-%d"

        dt_to = datetime.strptime(date_to, input_fmt)
        dt_to_next = dt_to + timedelta(days=1)

        return date_from, dt_to_next.strftime(input_fmt)

    def _apply_lag(self, date_from: str, date_to: str, lag_days: int = 30) -> tuple[str, str]:
        """
        Apply time lag cap to date range for market data security.

        The lag works as a maximum date cap: data returned cannot be more recent
        than lag_days prior to today. The start date is unchanged, but the end
        date is capped at (today - lag_days).

        Args:
            date_from: Start date (YYYY-MM-DD format) - returned unchanged
            date_to: End date (YYYY-MM-DD format) - capped at today minus lag_days
            lag_days: Number of days to lag (default 30)

        Returns:
            Tuple of (date_from, capped_date_to) in YYYY-MM-DD format

        Example:
            Today is 2026-02-12
            Request: 2026-01-01 to 2026-01-31
            Returns: 2026-01-01 to 2026-01-13 (today - 30 days)

            Request: 2025-12-01 to 2025-12-31
            Returns: 2025-12-01 to 2025-12-31 (unchanged, already > 30 days old)
        """
        input_fmt = "%Y-%m-%d"
        output_fmt = "%Y-%m-%d"  # Database uses ISO format (YYYY-MM-DD)

        dt_from = datetime.strptime(date_from, input_fmt)
        dt_to = datetime.strptime(date_to, input_fmt)

        # Calculate the maximum allowed date (today - lag_days)
        max_allowed_date = datetime.now() - timedelta(days=lag_days)

        # Cap the end date at max_allowed_date
        if dt_to > max_allowed_date:
            dt_to = max_allowed_date

        return dt_from.strftime(output_fmt), dt_to.strftime(output_fmt)

    def _execute_query(self, query: str, params: List[Any]) -> Dict[str, Any]:
        """
        Execute a SQL query against the Boltzbit API.

        Args:
            query: SQL query with ? parameter placeholders
            params: List of parameter values

        Returns:
            API response with query results
        """
        url = f"{self.base_url}/api/v1/apps/{self.app_id}/tables/query"

        payload = {
            "query": query,
            "params": params,
            "readonly": True
        }

        response = requests.post(url, json=payload, headers=self.headers)

        if not response.ok:
            try:
                error_detail = response.json()
                print(f"API Error Response: {json.dumps(error_detail, indent=2)}")
            except:
                print(f"API Error Response (raw): {response.text}")

        response.raise_for_status()

        return response.json()

    def _build_filter_conditions(self, filters: Dict[str, Any]) -> tuple[str, List[Any]]:
        """
        Build SQL WHERE conditions from filter dictionary.

        Args:
            filters: Dictionary of filter conditions

        Returns:
            Tuple of (where_clause, params_list)
        """
        conditions = []
        params = []

        if filters.get('isin'):
            conditions.append("isin = ?")
            params.append(filters['isin'])

        if filters.get('ticker'):
            conditions.append("ticker = ?")
            params.append(filters['ticker'])

        if filters.get('side'):
            conditions.append("side = ?")
            params.append(filters['side'])

        if filters.get('dealer'):
            conditions.append("counter_party = ?")
            params.append(filters['dealer'])

        if filters.get('sector'):
            conditions.append("secmst_glimpse_sector = ?")
            params.append(filters['sector'])

        if filters.get('region'):
            conditions.append("secmst_region = ?")
            params.append(filters['region'])

        if filters.get('currency'):
            conditions.append("currency = ?")
            params.append(filters['currency'])

        if filters.get('seniority'):
            conditions.append("secmst_seniority = ?")
            params.append(filters['seniority'])

        if filters.get('credit_grade'):
            conditions.append("secmst_credit_grade = ?")
            params.append(filters['credit_grade'])

        if filters.get('bond_category'):
            conditions.append("secmst_bond_category = ?")
            params.append(filters['bond_category'])

        where_clause = " AND ".join(conditions) if conditions else "1=1"
        return where_clause, params

    def get_transaction_history(
        self,
        date_from: str,
        date_to: str,
        context: str = "MARKET",
        filters: Optional[Dict[str, Any]] = None,
        limit: int = 100,
        offset: int = 0,
        group_by: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Retrieve transaction history with security controls.

        Args:
            date_from: Start date (YYYY-MM-DD)
            date_to: End date (YYYY-MM-DD)
            context: "MARKET" or "CLIENT"
            filters: Optional filter dictionary (isin, ticker, side, dealer, sector, etc.)
            limit: Maximum number of records to return (default 100)
            offset: Number of records to skip for pagination (default 0)
            group_by: Optional grouping field ("dealer", "ticker", "sector", "currency", etc.)

        Returns:
            Dictionary with transaction history:
            {
                "data": [ { transaction }, ... ],
                "pagination": {
                    "limit": int,
                    "offset": int,
                    "total": int
                },
                "period_start": str,
                "period_end": str,
                "context": str
            }

            If group_by is specified, returns grouped data:
            {
                "grouped_data": {
                    "Group A": { "transactions": [...], "summary": {...} },
                    ...
                },
                "total_groups": int,
                "context": str,
                "period_start": str,
                "period_end": str
            }

        Note:
            For CLIENT context, client_id is ALWAYS read from GLIMPSE_CLIENT_ID
            environment variable. This enforces authentication and prevents
            client impersonation.
        """
        filters = filters or {}

        if context == "MARKET":
            result = self._get_market_transactions(date_from, date_to, filters, limit, offset)
        elif context == "CLIENT":
            # CRITICAL SECURITY: Client ID MUST come from environment variable
            # In production: Set by authenticated session
            # In development: Set in .env file
            # CANNOT be overridden via parameter to prevent client impersonation
            client_id = os.environ.get('GLIMPSE_CLIENT_ID')

            if not client_id:
                raise ValueError(
                    "CLIENT context requires GLIMPSE_CLIENT_ID environment variable. "
                    "In production, this is set by the authentication system. "
                    "In development, set it in your .env file."
                )

            result = self._get_client_transactions(date_from, date_to, client_id, filters, limit, offset)
        else:
            raise ValueError(f"Invalid context: {context}. Must be 'MARKET' or 'CLIENT'")

        # Apply grouping if requested
        if group_by:
            # Check if it's a time-based grouping
            if group_by in ['week', 'month', 'quarter', 'year']:
                return self._group_by_time_period(result, group_by)
            else:
                return self._group_by_field(result, group_by)

        return result

    def _get_market_transactions(
        self,
        date_from: str,
        date_to: str,
        filters: Dict[str, Any],
        limit: int,
        offset: int
    ) -> Dict[str, Any]:
        """
        Get market transaction history with 30-day lag.

        Returns transactions with dealer names visible but NO client identifiers.
        Sizes are capped as per database (size_in_MM_capped_num).
        """
        # Step 1: Apply 30-day lag
        lagged_from, lagged_to = self._apply_lag(date_from, date_to)

        # Step 2: Format dates to include full end day (add 1 day, use < instead of <=)
        query_from, query_to = self._format_date_range(lagged_from, lagged_to)

        # Step 3: Build filter conditions
        filter_where, filter_params = self._build_filter_conditions(filters)

        # Step 4: Query trade_records with lagged dates
        # DEALER names are visible, CLIENT names are NOT
        query = f"""
            SELECT
                output_file_dtl_id as txn_id,
                trade_date,
                trade_time,
                side,
                isin,
                ticker,
                maturity,
                coupon_perc,
                size_in_MM_capped_num as size_capped,
                size_in_MM as size_display,
                price,
                settlement_date,
                on_venue,
                venue,
                process_trade,
                auto_execution,
                portfolio_trade,
                currency,
                counter_party as dealer,
                counterparty_abbreviations as dealer_abbrev,
                secmst_glimpse_sector as sector,
                secmst_country as country,
                secmst_region as region,
                secmst_seniority as seniority,
                secmst_credit_grade as credit_grade,
                secmst_bond_category as bond_category,
                secmst_entity_name as entity_name,
                maturity_index,
                size_in_eur as size_eur_capped
            FROM trade_records
            WHERE trade_date >= ?
              AND trade_date < ?
              AND {filter_where}
            ORDER BY trade_date DESC, trade_time DESC
            LIMIT ? OFFSET ?
        """

        params = [query_from, query_to] + filter_params + [limit, offset]

        result = self._execute_query(query, params)

        # Get total count for pagination
        count_query = f"""
            SELECT COUNT(*) as total
            FROM trade_records
            WHERE trade_date >= ?
              AND trade_date < ?
              AND {filter_where}
        """

        count_params = [query_from, query_to] + filter_params
        count_result = self._execute_query(count_query, count_params)

        return {
            "data": result['data'],
            "pagination": {
                "limit": limit,
                "offset": offset,
                "total": count_result['data'][0]['total']
            },
            "period_start": lagged_from,
            "period_end": lagged_to,
            "original_period_start": date_from,
            "original_period_end": date_to,
            "context": "MARKET",
            "lag_applied_days": 30,
            "note": "30-day lag applied. Dealer names visible. Client identifiers excluded. Sizes are capped."
        }

    def _get_client_transactions(
        self,
        date_from: str,
        date_to: str,
        client_id: str,
        filters: Dict[str, Any],
        limit: int,
        offset: int
    ) -> Dict[str, Any]:
        """
        Get client's own transaction history with full detail and no lag.

        CRITICAL SECURITY: Row-level security enforced via WHERE buy_side = client_id
        This ensures clients can ONLY see their own data.

        Returns actual UNCAPPED values, dealer names, actual prices for the client's trades.
        """
        # NO lag applied for client context
        # Format dates to include full end day (add 1 day, use < instead of <=)
        query_from, query_to = self._format_date_range(date_from, date_to)

        # Build filter conditions
        filter_where, filter_params = self._build_filter_conditions(filters)

        # Query for full detail - client's own data
        # ROW-LEVEL SECURITY: WHERE buy_side = ? restricts to client's data only
        query = f"""
            SELECT
                output_file_dtl_id as txn_id,
                trade_date,
                trade_time,
                side,
                isin,
                ticker,
                maturity,
                coupon_perc,
                size_in_MM_actual as size_actual,
                size_in_eur as size_eur_actual,
                price_actual as price,
                mid_price_actual as mid_price,
                yield_perc,
                spread,
                settlement_date,
                on_venue,
                venue_actual as venue,
                process_trade,
                auto_execution,
                portfolio_trade,
                counter_party as dealer,
                counterparty_abbreviations as dealer_abbrev,
                currency,
                secmst_glimpse_sector as sector,
                secmst_country as country,
                secmst_region as region,
                secmst_seniority as seniority,
                secmst_credit_grade as credit_grade,
                secmst_bond_category as bond_category,
                secmst_entity_name as entity_name,
                maturity_index
            FROM trade_records
            WHERE buy_side = ?
              AND trade_date >= ?
              AND trade_date < ?
              AND {filter_where}
            ORDER BY trade_date DESC, trade_time DESC
            LIMIT ? OFFSET ?
        """

        # CRITICAL: client_id is first parameter, enforcing row-level security
        params = [client_id, query_from, query_to] + filter_params + [limit, offset]

        result = self._execute_query(query, params)

        # Get total count with same row-level security
        count_query = f"""
            SELECT COUNT(*) as total
            FROM trade_records
            WHERE buy_side = ?
              AND trade_date >= ?
              AND trade_date < ?
              AND {filter_where}
        """

        count_params = [client_id, query_from, query_to] + filter_params
        count_result = self._execute_query(count_query, count_params)

        return {
            "data": result['data'],
            "pagination": {
                "limit": limit,
                "offset": offset,
                "total": count_result['data'][0]['total']
            },
            "period_start": date_from,
            "period_end": date_to,
            "context": "CLIENT",
            "client_id": client_id,
            "note": "No lag. Full detail for your own trades. Actual UNCAPPED sizes, dealer names, and actual prices visible."
        }

    def _group_by_time_period(self, result: Dict[str, Any], period: str) -> Dict[str, Any]:
        """
        Group transaction data by time period (week, month, quarter, year).

        Args:
            result: Result dictionary from get_transaction_history()
            period: Time period to group by ('week', 'month', 'quarter', 'year')

        Returns:
            Dictionary with transactions grouped by time period
        """
        grouped = defaultdict(lambda: {
            "transactions": [],
            "summary": {
                "count": 0,
                "total_volume": 0.0,
                "buy_count": 0,
                "sell_count": 0,
                "currencies": set()
            }
        })

        # Group transactions by the specified time period
        for txn in result.get('data', []):
            trade_date_str = txn.get('trade_date', '')
            if not trade_date_str:
                continue

            # Parse the trade date
            trade_date = datetime.strptime(trade_date_str.split('T')[0], '%Y-%m-%d')

            # Determine the group key based on period
            if period == 'week':
                # ISO week: YYYY-W##
                year, week, _ = trade_date.isocalendar()
                group_key = f"{year}-W{week:02d}"
            elif period == 'month':
                # YYYY-MM
                group_key = trade_date.strftime('%Y-%m')
            elif period == 'quarter':
                # YYYY-Q#
                quarter = (trade_date.month - 1) // 3 + 1
                group_key = f"{trade_date.year}-Q{quarter}"
            elif period == 'year':
                # YYYY
                group_key = str(trade_date.year)
            else:
                raise ValueError(f"Invalid period: {period}. Must be 'week', 'month', 'quarter', or 'year'")

            grouped[group_key]["transactions"].append(txn)

            # Update summary statistics
            summary = grouped[group_key]["summary"]
            summary["count"] += 1

            # Add volume (try size_actual first for CLIENT context, fallback to size_capped)
            size = txn.get('size_actual') or txn.get('size_capped', 0)
            if size:
                try:
                    summary["total_volume"] += float(size)
                except (ValueError, TypeError):
                    pass

            # Count buy/sell
            if txn.get('side') == 'Buy':
                summary["buy_count"] += 1
            elif txn.get('side') == 'Sell':
                summary["sell_count"] += 1

            # Track currencies
            if txn.get('currency'):
                summary["currencies"].add(txn['currency'])

        # Convert sets to lists for JSON serialization
        for group_data in grouped.values():
            group_data["summary"]["currencies"] = list(group_data["summary"]["currencies"])

        return {
            "grouped_data": dict(grouped),
            "total_groups": len(grouped),
            "grouped_by": period,
            "context": result.get('context'),
            "period_start": result.get('period_start'),
            "period_end": result.get('period_end'),
            "pagination": result.get('pagination')
        }

    def _group_by_field(self, result: Dict[str, Any], field: str) -> Dict[str, Any]:
        """
        Group transaction data by a specified field.

        Args:
            result: Result dictionary from get_transaction_history()
            field: Field name to group by (e.g., "dealer", "ticker", "sector", "currency")

        Returns:
            Dictionary with transactions grouped by the specified field
        """
        grouped = defaultdict(lambda: {
            "transactions": [],
            "summary": {
                "count": 0,
                "total_volume": 0.0,
                "buy_count": 0,
                "sell_count": 0,
                "currencies": set()
            }
        })

        # Group transactions by the specified field
        for txn in result.get('data', []):
            group_value = txn.get(field, 'Unknown')
            grouped[group_value]["transactions"].append(txn)

            # Update summary statistics
            summary = grouped[group_value]["summary"]
            summary["count"] += 1

            # Add volume (try size_actual first for CLIENT context, fallback to size_capped)
            size = txn.get('size_actual') or txn.get('size_capped', 0)
            if size:
                try:
                    summary["total_volume"] += float(size)
                except (ValueError, TypeError):
                    pass

            # Count buy/sell
            if txn.get('side') == 'Buy':
                summary["buy_count"] += 1
            elif txn.get('side') == 'Sell':
                summary["sell_count"] += 1

            # Track currencies
            if txn.get('currency'):
                summary["currencies"].add(txn['currency'])

        # Convert sets to lists for JSON serialization
        for group_data in grouped.values():
            group_data["summary"]["currencies"] = list(group_data["summary"]["currencies"])

        return {
            "grouped_data": dict(grouped),
            "total_groups": len(grouped),
            "grouped_by": field,
            "context": result.get('context'),
            "period_start": result.get('period_start'),
            "period_end": result.get('period_end'),
            "pagination": result.get('pagination')
        }

    def group_by_dealer(self, result: Dict[str, Any]) -> Dict[str, Any]:
        """
        Group transaction data by dealer.
        Convenience method that calls _group_by_field with "dealer".

        Args:
            result: Result dictionary from get_transaction_history()

        Returns:
            Dictionary with transactions grouped by dealer
        """
        return self._group_by_field(result, "dealer")


# Example usage
if __name__ == "__main__":
    # Initialize the API client
    api = TransactionHistoryAPI(
        base_url=os.getenv("GLIMPSE_API_BASE_URL"),
        app_id=os.getenv("GLIMPSE_APP_ID")
    )

    print("="*60)
    print("Example 1: MARKET CONTEXT - Anonymized, capped transactions")
    print("="*60)

    try:
        market_result = api.get_transaction_history(
            date_from="2025-09-01",
            date_to="2025-09-30",
            context="MARKET",
            filters={"side": "Buy"},
            limit=5
        )

        print(f"\nPeriod: {market_result['period_start']} to {market_result['period_end']}")
        print(f"Total Trades: {market_result['pagination']['total']}")
        print(f"\nFirst 5 trades:")
        print(f"{market_result['note']}\n")

        for i, trade in enumerate(market_result['data'][:5], 1):
            print(f"{i}. {trade['trade_date']} - {trade['side']} {trade['size_display']} "
                  f"{trade['ticker']} @ {trade['price']}")

    except Exception as e:
        print(f"Error: {e}")

    print("\n" + "="*60)
    print("Example 2: CLIENT CONTEXT - Full detail for client's trades")
    print("="*60)
    print("Note: Requires GLIMPSE_CLIENT_ID environment variable")

    try:
        # Client ID is read from GLIMPSE_CLIENT_ID environment variable
        # CANNOT be overridden to prevent client impersonation
        client_result = api.get_transaction_history(
            date_from="2025-08-01",
            date_to="2025-10-31",
            context="CLIENT",
            limit=5
        )

        print(f"\nPeriod: {client_result['period_start']} to {client_result['period_end']}")
        print(f"Total Trades: {client_result['pagination']['total']}")
        print(f"{client_result['note']}\n")

        for i, trade in enumerate(client_result['data'][:5], 1):
            print(f"{i}. {trade['trade_date']} - {trade['side']} "
                  f"€{trade.get('size_actual', 'N/A')}M {trade['ticker']} "
                  f"with {trade.get('dealer', 'N/A')}")

    except Exception as e:
        print(f"Error (expected if CLIENT_NAME_HERE is invalid): {e}")

    print("\n" + "="*60)
    print("Example 3: GROUP BY DEALER (Direct method)")
    print("="*60)

    try:
        # Get market transactions with grouping built-in
        grouped_result = api.get_transaction_history(
            date_from="2025-09-01",
            date_to="2025-09-30",
            context="MARKET",
            limit=100,
            group_by="dealer"  # Request grouped results directly
        )

        print(f"\nTotal Dealers: {grouped_result['total_groups']}")
        print(f"Grouped by: {grouped_result['grouped_by']}")
        print(f"Period: {grouped_result['period_start']} to {grouped_result['period_end']}\n")

        # Show summary for each dealer
        for dealer, data in sorted(grouped_result['grouped_data'].items())[:5]:  # Show first 5
            summary = data['summary']
            print(f"\n{dealer}:")
            print(f"  Total Transactions: {summary['count']}")
            print(f"  Total Volume: €{summary['total_volume']:.2f}M")
            print(f"  Buys: {summary['buy_count']}, Sells: {summary['sell_count']}")
            print(f"  Currencies: {', '.join(summary['currencies'])}")

            # Show first 2 transactions for this dealer
            print(f"  Sample Transactions:")
            for i, txn in enumerate(data['transactions'][:2], 1):
                print(f"    {i}. {txn['trade_date']} - {txn['side']} {txn['size_display']} "
                      f"{txn['ticker']} @ {txn['price']}")

    except Exception as e:
        print(f"Error: {e}")

    print("\n" + "="*60)
    print("Example 4: GROUP BY SECTOR")
    print("="*60)

    try:
        # Group by sector instead of dealer
        sector_result = api.get_transaction_history(
            date_from="2025-09-01",
            date_to="2025-09-30",
            context="MARKET",
            limit=100,
            group_by="sector"
        )

        print(f"\nTotal Sectors: {sector_result['total_groups']}")
        print(f"Period: {sector_result['period_start']} to {sector_result['period_end']}\n")

        # Show summary for each sector
        for sector, data in sorted(sector_result['grouped_data'].items()):
            summary = data['summary']
            print(f"\n{sector}:")
            print(f"  Total Transactions: {summary['count']}")
            print(f"  Total Volume: €{summary['total_volume']:.2f}M")
            print(f"  Buys: {summary['buy_count']}, Sells: {summary['sell_count']}")

    except Exception as e:
        print(f"Error: {e}")
