"""
get_market_totals.py

Secure aggregation function for computing market totals with built-in controls.
Implements the GLP Data Control Framework's secure function pattern.

This function:
- Applies 30-day lag to all date ranges
- Enforces minimum 5-contributor threshold
- Returns only safe aggregated outputs (no individual client data)
- Queries source table with actual values, returns aggregated metrics only
"""

import requests
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
import json
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


class MarketTotalsAPI:
    """
    Secure function for retrieving market totals from the Boltzbit API.

    This class enforces data controls at the function boundary, ensuring
    the LLM can only access safe aggregated outputs even though the function
    internally accesses actual uncapped values.
    """

    def __init__(self, base_url: str, app_id: str, api_key: Optional[str] = None):
        """
        Initialize the API client.

        Args:
            base_url: Base URL for the Boltzbit API (e.g., "https://api.boltzbit.com")
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

    def _apply_lag(self, date_from: str, date_to: str, lag_days: int = 30) -> tuple[str, str]:
        """
        Apply time lag to date range for market data security.

        Args:
            date_from: Start date (YYYY-MM-DD format)
            date_to: End date (YYYY-MM-DD format)
            lag_days: Number of days to lag (default 30)

        Returns:
            Tuple of (lagged_date_from, lagged_date_to) in DD-MMM-YY format
        """
        input_fmt = "%Y-%m-%d"
        output_fmt = "%d-%b-%y"  # Database uses DD-MMM-YY format (e.g., "01-Aug-25")

        # Parse dates
        dt_from = datetime.strptime(date_from, input_fmt)
        dt_to = datetime.strptime(date_to, input_fmt)

        # Apply lag
        lagged_from = dt_from - timedelta(days=lag_days)
        lagged_to = dt_to - timedelta(days=lag_days)

        return lagged_from.strftime(output_fmt), lagged_to.strftime(output_fmt)

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
            "readonly": True  # Enforce read-only for security
        }

        response = requests.post(url, json=payload, headers=self.headers)

        # Better error handling to see actual error message
        if not response.ok:
            try:
                error_detail = response.json()
                print(f"API Error Response: {json.dumps(error_detail, indent=2)}")
            except:
                print(f"API Error Response (raw): {response.text}")

        response.raise_for_status()

        return response.json()

    def get_market_totals(
        self,
        date_from: str,
        date_to: str,
        context: str = "MARKET"
    ) -> Dict[str, Any]:
        """
        Compute market totals with security controls.

        This is the main secure function that the LLM calls. It:
        1. Applies 30-day lag to the date range
        2. Queries source table with actual uncapped values
        3. Checks minimum contributor threshold
        4. Returns only safe aggregated outputs

        Args:
            date_from: Start date (YYYY-MM-DD)
            date_to: End date (YYYY-MM-DD)
            context: Always "MARKET" for this function

        Returns:
            Dictionary with safe aggregated outputs:
            {
                "total_volume_eur": float,
                "buy_volume_eur": float,
                "sell_volume_eur": float,
                "buy_pct": float,
                "sell_pct": float,
                "total_trades": int,
                "buy_trades": int,
                "sell_trades": int,
                "period_start": str,
                "period_end": str
            }

            Or error response if insufficient contributors:
            {
                "error": "Insufficient data for this filter",
                "contributor_count": int
            }
        """
        if context != "MARKET":
            raise ValueError("get_market_totals only supports MARKET context")

        # Step 1: Apply 30-day lag
        lagged_from, lagged_to = self._apply_lag(date_from, date_to)

        # Step 2: Check contributor threshold
        contributor_query = """
            SELECT COUNT(DISTINCT buy_side) as contributor_count
            FROM trade_records
            WHERE trade_date >= ? AND trade_date <= ?
        """

        contributor_result = self._execute_query(
            contributor_query,
            [lagged_from, lagged_to]
        )

        contributor_count = contributor_result['data'][0]['contributor_count']

        # Step 3: Enforce minimum 5 contributors
        if contributor_count < 5:
            return {
                "error": "Insufficient data for this filter",
                "contributor_count": contributor_count,
                "minimum_required": 5
            }

        # Step 4: Query source table with actual UNCAPPED values
        # This is the key security boundary - we access actual values internally
        # but only return aggregated metrics
        totals_query = """
            SELECT
                SUM(CASE WHEN side = 'Buy' THEN size_in_eur ELSE 0 END) as buy_volume_eur,
                SUM(CASE WHEN side = 'Sell' THEN size_in_eur ELSE 0 END) as sell_volume_eur,
                SUM(size_in_eur) as total_volume_eur,
                COUNT(CASE WHEN side = 'Buy' THEN 1 END) as buy_trades,
                COUNT(CASE WHEN side = 'Sell' THEN 1 END) as sell_trades,
                COUNT(*) as total_trades
            FROM trade_records
            WHERE trade_date >= ? AND trade_date <= ?
        """

        totals_result = self._execute_query(
            totals_query,
            [lagged_from, lagged_to]
        )

        data = totals_result['data'][0]

        # Step 5: Compute percentages
        total_volume = data['total_volume_eur'] or 0
        buy_volume = data['buy_volume_eur'] or 0
        sell_volume = data['sell_volume_eur'] or 0

        buy_pct = (buy_volume / total_volume * 100) if total_volume > 0 else 0
        sell_pct = (sell_volume / total_volume * 100) if total_volume > 0 else 0

        # Step 6: Return safe aggregated outputs only
        # Individual trade values never leave this function
        # Client names/IDs never leave this function
        return {
            "total_volume_eur": total_volume,
            "buy_volume_eur": buy_volume,
            "sell_volume_eur": sell_volume,
            "buy_pct": round(buy_pct, 2),
            "sell_pct": round(sell_pct, 2),
            "total_trades": data['total_trades'],
            "buy_trades": data['buy_trades'],
            "sell_trades": data['sell_trades'],
            "period_start": lagged_from,
            "period_end": lagged_to,
            "original_period_start": date_from,
            "original_period_end": date_to,
            "lag_applied_days": 30,
            "contributor_count": contributor_count
        }


# Example usage
if __name__ == "__main__":
    # Initialize the API client
    api = MarketTotalsAPI(
        base_url=os.getenv("GLIMPSE_API_BASE_URL"),
        app_id=os.getenv("GLIMPSE_APP_ID")
    )

    # Example 1: Get market totals for the available data range
    # Note: The function will automatically lag this by 30 days
    # Data available: Aug 1 - Oct 31, 2025
    # So we query Sep 1 - Nov 30, 2025 which lags to Aug 1 - Oct 31
    try:
        result = api.get_market_totals(
            date_from="2025-09-01",  # Will be lagged to 2025-08-02
            date_to="2025-11-30",    # Will be lagged to 2025-10-31
            context="MARKET"
        )

        if "error" in result:
            print(f"Error: {result['error']}")
            print(f"Contributors: {result['contributor_count']} (minimum required: {result['minimum_required']})")
        else:
            print("Market Totals (with 30-day lag):")
            print(f"Period: {result['period_start']} to {result['period_end']}")
            print(f"Total Volume: €{result['total_volume_eur']:,.2f}")
            print(f"Buy Volume: €{result['buy_volume_eur']:,.2f} ({result['buy_pct']}%)")
            print(f"Sell Volume: €{result['sell_volume_eur']:,.2f} ({result['sell_pct']}%)")
            print(f"Total Trades: {result['total_trades']:,}")
            print(f"Buy Trades: {result['buy_trades']:,}")
            print(f"Sell Trades: {result['sell_trades']:,}")
            print(f"Contributors: {result['contributor_count']}")

    except Exception as e:
        print(f"Error calling API: {e}")

    # Example 2: Demonstrate the lag application
    print("\n" + "="*50)
    print("Lag Application Example:")
    print("="*50)

    original_from = "2026-01-01"
    original_to = "2026-01-31"

    lagged_from, lagged_to = api._apply_lag(original_from, original_to, lag_days=30)

    print(f"Original period: {original_from} to {original_to}")
    print(f"Lagged period:   {lagged_from} to {lagged_to}")
    print(f"This ensures all market data is at least 30 days old")
