import { useState, useEffect, useMemo } from 'react'
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { executeQuery } from '../api/records'

const CYAN = '#00d9b8'

const TIER_COLORS = {
  gold:   { text: '#fbbf24', bg: 'rgba(251, 191, 36, 0.08)', border: 'rgba(251, 191, 36, 0.25)' },
  silver: { text: '#94a3b8', bg: 'rgba(148, 163, 184, 0.06)', border: 'rgba(148, 163, 184, 0.20)' },
  bronze: { text: '#cd7f32', bg: 'rgba(205, 127, 50, 0.06)', border: 'rgba(205, 127, 50, 0.18)' },
}

function getTier(rank) {
  if (rank <= 5) return 'gold'
  if (rank <= 10) return 'silver'
  return 'bronze'
}

function buildExtraFilters(filters, context) {
  let sql = ''
  const params = []
  if (context === 'client' && filters?._clientId) {
    sql += ` AND glimpse_buy_side = ?`
    params.push(filters._clientId)
  }
  if (!filters?.includeUnknown) {
    sql += ` AND counter_party IS NOT NULL AND counter_party NOT IN ('Unknown', 'Unknown Dealer')`
  }
  for (const [key, col] of [
    ['products', 'secmst_bond_category'],
    ['sectors', 'secmst_glimpse_sector'],
    ['regions', 'secmst_region'],
    ['seniorities', 'secmst_seniority'],
  ]) {
    if (filters?.[key]?.length > 0) {
      sql += ` AND ${col} IN (${filters[key].map(() => '?').join(', ')})`
      params.push(...filters[key])
    }
  }
  return { sql, params }
}

function fmtMM(val) {
  if (val == null) return '\u2014'
  if (Math.abs(val) >= 1000) return `${(val / 1000).toFixed(1)}B`
  return `${val.toFixed(1)}M`
}

function fmtEurMM(val) {
  if (val == null || val === 0) return '\u2014'
  const rounded = Math.round(val)
  return `${rounded.toLocaleString('en-US')}MM`
}

function RankChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const data = payload[0]?.payload
  if (!data) return null
  const delta = data.delta
  const deltaColor = delta != null
    ? (delta > 0 ? '#4ade80' : delta < 0 ? '#f87171' : 'rgba(255,255,255,0.5)')
    : 'rgba(255,255,255,0.3)'
  return (
    <div className="bg-navy-800 border border-cyan rounded px-3 py-2 text-xs font-mono shadow-lg">
      <div className="text-primary font-semibold mb-1.5">{label}</div>
      <div className="flex items-center gap-3 mb-1">
        <span style={{ color: CYAN }}>My Rank: <strong>#{data.clientRank || '\u2014'}</strong></span>
        <span style={{ color: 'rgba(148,163,184,0.8)' }}>Mkt Rank: <strong>#{data.marketRank || '\u2014'}</strong></span>
      </div>
      {delta != null && (
        <div className="mb-1" style={{ color: deltaColor }}>
          Delta: <strong>{delta > 0 ? '+' : ''}{delta}</strong>
        </div>
      )}
      <div style={{ color: CYAN }}>
        Activity: <strong>{data.clientVolume > 0 ? fmtEurMM(data.clientVolume) : '\u2014'}</strong>
      </div>
    </div>
  )
}

function generateLast6Months(dateTo) {
  // dateTo is exclusive (day after end), so the actual end is dateTo - 1 day
  const end = new Date(dateTo)
  end.setDate(end.getDate() - 1)
  const months = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(end.getFullYear(), end.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
    // Month start and end (exclusive)
    const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
    const next = new Date(d.getFullYear(), d.getMonth() + 1, 1)
    const to = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`
    months.push({ key, label, from, to })
  }
  return months
}

export default function DealerComparisonChart({ dateFrom, dateTo, filters }) {
  const [clientData, setClientData] = useState(null)
  const [marketData, setMarketData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [topN, setTopN] = useState(15)
  const [selectedDealer, setSelectedDealer] = useState(null)
  const [monthlyData, setMonthlyData] = useState(null)
  const [monthlyLoading, setMonthlyLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    // Build client query
    const clientExtra = buildExtraFilters(filters, 'client')
    const clientQuery = {
      query: `
        SELECT COALESCE(counter_party, 'Unknown Dealer') as name,
               COUNT(*) as totalTransactions,
               SUM(size_in_eur_v2) as totalVolume
        FROM trade_records
        WHERE trade_date >= ? AND trade_date < ?
          ${clientExtra.sql}
        GROUP BY counter_party
        ORDER BY totalVolume DESC
      `,
      params: [dateFrom, dateTo, ...clientExtra.params],
      readonly: true,
    }

    // Build market query (same filters minus client)
    let marketSql = ''
    const marketParams = [dateFrom, dateTo]
    if (!filters?.includeUnknown) {
      marketSql += ` AND counter_party IS NOT NULL AND counter_party NOT IN ('Unknown', 'Unknown Dealer')`
    }
    for (const [key, col] of [
      ['products', 'secmst_bond_category'],
      ['sectors', 'secmst_glimpse_sector'],
      ['regions', 'secmst_region'],
      ['seniorities', 'secmst_seniority'],
    ]) {
      if (filters?.[key]?.length > 0) {
        marketSql += ` AND ${col} IN (${filters[key].map(() => '?').join(', ')})`
        marketParams.push(...filters[key])
      }
    }
    const marketQuery = {
      query: `
        SELECT COALESCE(counter_party, 'Unknown Dealer') as name,
               COUNT(*) as totalTransactions,
               SUM(size_in_eur_v2) as totalVolume
        FROM trade_records
        WHERE trade_date >= ? AND trade_date < ?
          ${marketSql}
        GROUP BY counter_party
        ORDER BY totalVolume DESC
      `,
      params: marketParams,
      readonly: true,
    }

    Promise.all([
      executeQuery(clientQuery),
      executeQuery(marketQuery),
    ])
      .then(([clientRes, marketRes]) => {
        if (cancelled) return
        setClientData(clientRes.data || [])
        setMarketData(marketRes.data || [])
        setLoading(false)
      })
      .catch(err => {
        if (!cancelled) {
          setError(err.message)
          setLoading(false)
        }
      })

    return () => { cancelled = true }
  }, [dateFrom, dateTo, filters])

  // Auto-select first dealer when table data loads
  useEffect(() => {
    if (clientData?.length && !selectedDealer) {
      setSelectedDealer(clientData[0].name)
    }
  }, [clientData, selectedDealer])

  // Fetch month-by-month rankings for the selected dealer
  const months6 = useMemo(() => generateLast6Months(dateTo), [dateTo])

  useEffect(() => {
    if (!selectedDealer || !months6.length) return
    let cancelled = false
    setMonthlyLoading(true)

    // For each month, we need:
    // 1. Client-side rank of this dealer (rank by volume among all dealers in client view)
    // 2. Market-side rank of this dealer
    // 3. Client activity volume for this dealer
    // We'll run one query per scope (client + market) that returns per-month, per-dealer totals,
    // then compute ranks in JS.

    const globalFrom = months6[0].from
    const globalTo = months6[months6.length - 1].to

    const clientExtra = buildExtraFilters(filters, 'client')
    let marketSql = ''
    const marketParams = []
    if (!filters?.includeUnknown) {
      marketSql += ` AND counter_party IS NOT NULL AND counter_party NOT IN ('Unknown', 'Unknown Dealer')`
    }
    for (const [key, col] of [
      ['products', 'secmst_bond_category'],
      ['sectors', 'secmst_glimpse_sector'],
      ['regions', 'secmst_region'],
      ['seniorities', 'secmst_seniority'],
    ]) {
      if (filters?.[key]?.length > 0) {
        marketSql += ` AND ${col} IN (${filters[key].map(() => '?').join(', ')})`
        marketParams.push(...filters[key])
      }
    }

    const monthExpr = `SUBSTR(trade_date, 1, 7)`

    const clientQuery = {
      query: `
        SELECT ${monthExpr} as month,
               COALESCE(counter_party, 'Unknown Dealer') as dealer,
               SUM(size_in_eur_v2) as volume
        FROM trade_records
        WHERE trade_date >= ? AND trade_date < ?
          ${clientExtra.sql}
        GROUP BY month, counter_party
        ORDER BY month, volume DESC
      `,
      params: [globalFrom, globalTo, ...clientExtra.params],
      readonly: true,
    }

    const marketQuery = {
      query: `
        SELECT ${monthExpr} as month,
               COALESCE(counter_party, 'Unknown Dealer') as dealer,
               SUM(size_in_eur_v2) as volume
        FROM trade_records
        WHERE trade_date >= ? AND trade_date < ?
          ${marketSql}
        GROUP BY month, counter_party
        ORDER BY month, volume DESC
      `,
      params: [globalFrom, globalTo, ...marketParams],
      readonly: true,
    }

    Promise.all([
      executeQuery(clientQuery),
      executeQuery(marketQuery),
    ])
      .then(([clientRes, marketRes]) => {
        if (cancelled) return

        // Group by month, compute ranks
        const buildMonthRanks = (rows) => {
          const byMonth = {}
          for (const row of (rows.data || [])) {
            if (!byMonth[row.month]) byMonth[row.month] = []
            byMonth[row.month].push({ dealer: row.dealer, volume: row.volume || 0 })
          }
          // Sort each month by volume desc and assign ranks
          const result = {}
          for (const [month, dealers] of Object.entries(byMonth)) {
            dealers.sort((a, b) => b.volume - a.volume)
            result[month] = {}
            dealers.forEach((d, i) => {
              result[month][d.dealer] = { rank: i + 1, volume: d.volume }
            })
          }
          return result
        }

        const clientRanks = buildMonthRanks(clientRes)
        const marketRanks = buildMonthRanks(marketRes)

        // Build monthly data for the selected dealer
        const monthly = months6.map(m => {
          const cInfo = clientRanks[m.key]?.[selectedDealer]
          const mInfo = marketRanks[m.key]?.[selectedDealer]
          const clientRank = cInfo?.rank || null
          const marketRank = mInfo?.rank || null
          const delta = (clientRank != null && marketRank != null) ? marketRank - clientRank : null
          return {
            month: m.key,
            label: m.label,
            clientRank,
            marketRank,
            delta,
            clientVolume: cInfo?.volume || 0,
          }
        })

        setMonthlyData(monthly)
        setMonthlyLoading(false)
      })
      .catch(() => {
        if (!cancelled) {
          setMonthlyData(null)
          setMonthlyLoading(false)
        }
      })

    return () => { cancelled = true }
  }, [selectedDealer, dateTo, filters, months6])

  const { tableData, clientTotal, marketTotal } = useMemo(() => {
    if (!clientData?.length || !marketData?.length) {
      return { tableData: [], clientTotal: 0, marketTotal: 0 }
    }

    const cTotal = clientData.reduce((s, g) => s + (g.totalVolume || 0), 0)
    const mTotal = marketData.reduce((s, g) => s + (g.totalVolume || 0), 0)

    // Build lookup maps with ranks
    const clientMap = {}
    clientData.forEach((g, i) => {
      clientMap[g.name] = {
        rank: i + 1,
        vol: g.totalVolume || 0,
        pct: cTotal > 0 ? ((g.totalVolume || 0) / cTotal) * 100 : 0,
        trades: g.totalTransactions || 0,
      }
    })

    const marketMap = {}
    marketData.forEach((g, i) => {
      marketMap[g.name] = {
        rank: i + 1,
        vol: g.totalVolume || 0,
        pct: mTotal > 0 ? ((g.totalVolume || 0) / mTotal) * 100 : 0,
        trades: g.totalTransactions || 0,
      }
    })

    // Merge: use client ranking order (my top dealers first)
    const seen = new Set()
    const merged = []

    for (const dealer of clientData) {
      seen.add(dealer.name)
      const c = clientMap[dealer.name]
      const m = marketMap[dealer.name]
      merged.push({
        name: dealer.name,
        clientRank: c.rank,
        clientPct: c.pct,
        clientVol: c.vol,
        clientTrades: c.trades,
        marketRank: m?.rank || null,
        marketPct: m?.pct || 0,
        marketVol: m?.vol || 0,
        marketTrades: m?.trades || 0,
        rankDelta: m ? m.rank - c.rank : null,
        gap: c.pct - (m?.pct || 0),
      })
    }

    // Add market-only dealers (not in client data)
    for (const dealer of marketData) {
      if (seen.has(dealer.name)) continue
      const m = marketMap[dealer.name]
      merged.push({
        name: dealer.name,
        clientRank: null,
        clientPct: 0,
        clientVol: 0,
        clientTrades: 0,
        marketRank: m.rank,
        marketPct: m.pct,
        marketVol: m.vol,
        marketTrades: m.trades,
        rankDelta: null,
        gap: -m.pct,
      })
    }

    return {
      tableData: merged.slice(0, topN),
      clientTotal: cTotal,
      marketTotal: mTotal,
    }
  }, [clientData, marketData, topN])

  return (
    <div className="bg-navy-900 border border-default rounded-lg p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-mono font-semibold uppercase text-primary tracking-widest mb-1">
              Dealer Comparison — Client vs Market
            </h3>
            <p className="text-xs font-mono text-muted">
              Rank and volume share comparison
              {!loading && clientData && (
                <span className="text-secondary ml-2">
                  ({clientData.length} client dealers &middot; {marketData?.length || 0} market dealers
                  &middot; {fmtMM(clientTotal)} client vol &middot; {fmtMM(marketTotal)} market vol)
                </span>
              )}
            </p>
          </div>
          {/* Top N selector */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-muted uppercase tracking-wider">Show</span>
            <div className="flex bg-navy-850 border border-subtle rounded overflow-hidden">
              {[10, 15, 20].map(n => (
                <button
                  key={n}
                  onClick={() => setTopN(n)}
                  className={`px-2.5 py-1 text-[11px] font-mono transition-colors ${
                    topN === n
                      ? 'bg-cyan-500 text-navy-950 font-semibold'
                      : 'text-muted hover:text-secondary'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center h-96">
          <div className="flex items-center gap-2 text-sm font-mono text-muted">
            <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-glow-pulse"></div>
            Loading comparison data...
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center justify-center h-96">
          <div className="text-sm font-mono text-red-400">
            Failed to load data: {error}
          </div>
        </div>
      )}

      {/* Content: table + placeholder */}
      {!loading && !error && tableData.length > 0 && (
        <div className="flex gap-6" style={{ height: 680 }}>
          {/* Left: Comparison table (1/3) */}
          <div className="w-1/3 shrink-0 min-w-0 bg-navy-950 border border-subtle rounded-lg overflow-hidden flex flex-col">
            {/* Column headers */}
            <div className="flex items-center px-3 py-2 border-b border-subtle text-[10px] font-mono text-muted uppercase tracking-wider">
              <span className="flex-1">Dealer</span>
              <span className="w-10 text-center">My #</span>
              <span className="w-10 text-center">Mkt #</span>
              <span className="w-12 text-center">Delta</span>
              <span className="w-24 text-center">Status</span>
              <span className="w-14 text-right">My Vol%</span>
              <span className="w-14 text-right">Mkt Vol%</span>
              <span className="w-16 text-right">Gap</span>
            </div>
            {/* Rows */}
            <div className="flex-1 overflow-y-auto">
              {tableData.map((d) => {
                const delta = d.rankDelta
                const deltaColor = delta > 0 ? '#4ade80' : delta < 0 ? '#f87171' : 'rgba(255,255,255,0.7)'
                const statusLabel = delta == null ? null : delta > 0 ? 'Outperforming' : delta < 0 ? 'Underperforming' : 'As Expected'
                const statusColor = delta > 0 ? '#4ade80' : delta < 0 ? '#f87171' : '#fbbf24'
                const statusBg = delta > 0 ? 'rgba(74,222,128,0.1)' : delta < 0 ? 'rgba(248,113,113,0.1)' : 'rgba(251,191,36,0.1)'
                const statusBorder = delta > 0 ? 'rgba(74,222,128,0.25)' : delta < 0 ? 'rgba(248,113,113,0.25)' : 'rgba(251,191,36,0.25)'
                const gapColor = d.gap > 0.05 ? '#4ade80' : d.gap < -0.05 ? '#f87171' : 'rgba(255,255,255,0.7)'
                const isSelected = selectedDealer === d.name
                return (
                  <div
                    key={d.name}
                    className={`flex items-center px-3 py-1.5 border-b transition-colors cursor-pointer ${isSelected ? 'bg-navy-850' : 'hover:bg-navy-850'}`}
                    style={{
                      borderBottomColor: 'rgba(0,217,184,0.04)',
                      ...(isSelected ? { borderLeftWidth: 2, borderLeftStyle: 'solid', borderLeftColor: CYAN } : {}),
                    }}
                    onClick={() => setSelectedDealer(d.name)}
                  >
                    {/* Dealer name */}
                    <span
                      className="flex-1 text-xs font-mono truncate"
                      style={{ color: d.clientRank && d.clientRank <= 5 ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.65)' }}
                      title={d.name}
                    >
                      {d.name}
                    </span>
                    {/* My rank */}
                    <span className="w-10 flex justify-center">
                      {d.clientRank ? (
                        <span
                          className="w-7 text-center text-[11px] font-mono font-semibold rounded-sm py-0.5"
                          style={{
                            color: TIER_COLORS[getTier(d.clientRank)].text,
                            backgroundColor: TIER_COLORS[getTier(d.clientRank)].bg,
                            border: `1px solid ${TIER_COLORS[getTier(d.clientRank)].border}`,
                          }}
                        >
                          {d.clientRank}
                        </span>
                      ) : <span className="text-[11px] font-mono text-muted">&mdash;</span>}
                    </span>
                    {/* Market rank */}
                    <span className="w-10 flex justify-center">
                      {d.marketRank ? (
                        <span
                          className="w-7 text-center text-[11px] font-mono font-semibold rounded-sm py-0.5"
                          style={{
                            color: TIER_COLORS[getTier(d.marketRank)].text,
                            backgroundColor: TIER_COLORS[getTier(d.marketRank)].bg,
                            border: `1px solid ${TIER_COLORS[getTier(d.marketRank)].border}`,
                          }}
                        >
                          {d.marketRank}
                        </span>
                      ) : <span className="text-[11px] font-mono text-muted">&mdash;</span>}
                    </span>
                    {/* Delta */}
                    <span className="w-12 text-center text-xs font-mono font-semibold" style={{ color: deltaColor }}>
                      {delta != null ? `${delta > 0 ? '+' : ''}${delta}` : '\u2014'}
                    </span>
                    {/* Status badge */}
                    <span className="w-24 flex justify-center">
                      {statusLabel ? (
                        <span
                          className="text-[10px] font-mono font-semibold uppercase tracking-wider px-2 py-0.5 rounded-sm"
                          style={{
                            color: statusColor,
                            backgroundColor: statusBg,
                            border: `1px solid ${statusBorder}`,
                          }}
                        >
                          {statusLabel}
                        </span>
                      ) : (
                        <span className="text-[11px] font-mono text-muted">&mdash;</span>
                      )}
                    </span>
                    {/* My Vol % */}
                    <span
                      className="w-14 text-right text-xs font-mono font-medium"
                      style={{ color: CYAN }}
                    >
                      {d.clientPct > 0 ? d.clientPct.toFixed(1) + '%' : '\u2014'}
                    </span>
                    {/* Mkt Vol % */}
                    <span
                      className="w-14 text-right text-xs font-mono font-medium"
                      style={{ color: 'rgba(255,255,255,0.75)' }}
                    >
                      {d.marketPct > 0 ? d.marketPct.toFixed(1) + '%' : '\u2014'}
                    </span>
                    {/* Gap (pp) */}
                    <span
                      className="w-16 text-right text-xs font-mono font-semibold"
                      style={{ color: gapColor }}
                    >
                      {d.gap > 0 ? '+' : ''}{d.gap.toFixed(1)}pp
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Right: Rank Over Time (2/3) */}
          <div className="flex-1 min-w-0 bg-navy-950 border border-subtle rounded-lg overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-4 py-3 border-b border-subtle flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono text-muted uppercase tracking-wider">
                  Rank Over Time
                </span>
                {selectedDealer && (
                  <span className="text-xs font-mono text-primary ml-3 font-semibold">
                    {selectedDealer}
                  </span>
                )}
              </div>
              {selectedDealer && !monthlyLoading && monthlyData && (
                <span className="text-[10px] font-mono text-muted">
                  Last 6 months
                </span>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 flex flex-col">
              {!selectedDealer && (
                <div className="flex-1 flex items-center justify-center">
                  <span className="text-xs font-mono text-muted">Select a dealer to view rank history</span>
                </div>
              )}

              {selectedDealer && monthlyLoading && (
                <div className="flex-1 flex items-center justify-center">
                  <div className="flex items-center gap-2 text-sm font-mono text-muted">
                    <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-glow-pulse"></div>
                    Loading...
                  </div>
                </div>
              )}

              {selectedDealer && !monthlyLoading && monthlyData && (
                <div className="flex-1 flex flex-col min-h-0">
                  {/* Tabular grid: row labels on left, month values across */}
                  <table className="w-full border-collapse shrink-0">
                    {/* Month header row */}
                    <thead>
                      <tr>
                        <th className="w-24"></th>
                        {monthlyData.map(m => (
                          <th key={m.month} className="text-center px-2 py-3 text-[10px] font-mono text-muted uppercase tracking-wider font-normal">
                            {m.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {/* My Rank row */}
                      <tr style={{ borderBottom: '1px solid rgba(0,217,184,0.06)' }}>
                        <td className="px-4 py-2.5 text-[10px] font-mono text-muted uppercase tracking-wider whitespace-nowrap">My Rank</td>
                        {monthlyData.map(m => (
                          <td key={m.month} className="text-center px-2 py-2.5">
                            {m.clientRank ? (
                              <span
                                className="inline-block w-8 text-center text-xs font-mono font-semibold rounded-sm py-0.5"
                                style={{
                                  color: TIER_COLORS[getTier(m.clientRank)].text,
                                  backgroundColor: TIER_COLORS[getTier(m.clientRank)].bg,
                                  border: `1px solid ${TIER_COLORS[getTier(m.clientRank)].border}`,
                                }}
                              >
                                {m.clientRank}
                              </span>
                            ) : (
                              <span className="text-xs font-mono text-muted">&mdash;</span>
                            )}
                          </td>
                        ))}
                      </tr>
                      {/* Mkt Rank row */}
                      <tr style={{ borderBottom: '1px solid rgba(0,217,184,0.06)' }}>
                        <td className="px-4 py-2.5 text-[10px] font-mono text-muted uppercase tracking-wider whitespace-nowrap">Mkt Rank</td>
                        {monthlyData.map(m => (
                          <td key={m.month} className="text-center px-2 py-2.5">
                            {m.marketRank ? (
                              <span
                                className="inline-block w-8 text-center text-xs font-mono font-semibold rounded-sm py-0.5"
                                style={{
                                  color: TIER_COLORS[getTier(m.marketRank)].text,
                                  backgroundColor: TIER_COLORS[getTier(m.marketRank)].bg,
                                  border: `1px solid ${TIER_COLORS[getTier(m.marketRank)].border}`,
                                }}
                              >
                                {m.marketRank}
                              </span>
                            ) : (
                              <span className="text-xs font-mono text-muted">&mdash;</span>
                            )}
                          </td>
                        ))}
                      </tr>
                      {/* Delta row */}
                      <tr style={{ borderBottom: '1px solid rgba(0,217,184,0.06)' }}>
                        <td className="px-4 py-2.5 text-[10px] font-mono text-muted uppercase tracking-wider">Delta</td>
                        {monthlyData.map(m => {
                          const delta = m.delta
                          const deltaColor = delta != null
                            ? (delta > 0 ? '#4ade80' : delta < 0 ? '#f87171' : 'rgba(255,255,255,0.5)')
                            : 'rgba(255,255,255,0.3)'
                          return (
                            <td key={m.month} className="text-center px-2 py-2.5">
                              <span className="text-xs font-mono font-semibold" style={{ color: deltaColor }}>
                                {delta != null ? `${delta > 0 ? '+' : ''}${delta}` : '\u2014'}
                              </span>
                            </td>
                          )
                        })}
                      </tr>
                      {/* My Activity row */}
                      <tr>
                        <td className="px-4 py-2.5 text-[10px] font-mono text-muted uppercase tracking-wider whitespace-nowrap">My Activity</td>
                        {monthlyData.map(m => (
                          <td key={m.month} className="text-center px-2 py-2.5">
                            <span
                              className="text-xs font-mono font-semibold"
                              style={{ color: m.clientVolume > 0 ? CYAN : 'rgba(255,255,255,0.3)' }}
                            >
                              {m.clientVolume > 0 ? fmtEurMM(m.clientVolume) : '\u2014'}
                            </span>
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>

                  {/* Chart: dual-axis rank lines + activity bars */}
                  <div className="flex-1 min-h-0 px-2 pb-2 pt-1" style={{ borderTop: '1px solid rgba(0,217,184,0.06)' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={monthlyData}
                        margin={{ top: 12, right: 16, bottom: 4, left: 8 }}
                      >
                        <defs>
                          <linearGradient id="activityGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={CYAN} stopOpacity={0.35} />
                            <stop offset="100%" stopColor={CYAN} stopOpacity={0.05} />
                          </linearGradient>
                          <linearGradient id="cyanLineGlow" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={CYAN} stopOpacity={0.6} />
                            <stop offset="100%" stopColor={CYAN} stopOpacity={0} />
                          </linearGradient>
                          <filter id="glowFilter">
                            <feGaussianBlur stdDeviation="3" result="blur" />
                            <feMerge>
                              <feMergeNode in="blur" />
                              <feMergeNode in="SourceGraphic" />
                            </feMerge>
                          </filter>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="2 6"
                          stroke="rgba(0,217,184,0.06)"
                          vertical={false}
                        />
                        {/* Left Y-axis: Rank (inverted — #1 at top) */}
                        <YAxis
                          yAxisId="rank"
                          orientation="left"
                          reversed
                          domain={[1, (dataMax) => Math.max(dataMax + 2, 15)]}
                          allowDecimals={false}
                          tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10, fontFamily: 'ui-monospace, monospace' }}
                          axisLine={false}
                          tickLine={false}
                          width={28}
                          label={{
                            value: 'RANK',
                            angle: -90,
                            position: 'insideLeft',
                            offset: 10,
                            style: { fill: 'rgba(255,255,255,0.25)', fontSize: 9, fontFamily: 'ui-monospace, monospace', letterSpacing: '0.1em' },
                          }}
                        />
                        {/* Right Y-axis: Volume (MM) */}
                        <YAxis
                          yAxisId="vol"
                          orientation="right"
                          tick={{ fill: 'rgba(0,217,184,0.4)', fontSize: 10, fontFamily: 'ui-monospace, monospace' }}
                          axisLine={false}
                          tickLine={false}
                          width={48}
                          tickFormatter={(v) => {
                            if (v === 0) return '0'
                            return `${Math.round(v).toLocaleString('en-US')}`
                          }}
                          label={{
                            value: 'EUR MM',
                            angle: 90,
                            position: 'insideRight',
                            offset: 4,
                            style: { fill: 'rgba(0,217,184,0.25)', fontSize: 9, fontFamily: 'ui-monospace, monospace', letterSpacing: '0.1em' },
                          }}
                        />
                        <XAxis
                          dataKey="label"
                          tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10, fontFamily: 'ui-monospace, monospace' }}
                          axisLine={{ stroke: 'rgba(0,217,184,0.08)' }}
                          tickLine={false}
                        />
                        <Tooltip content={<RankChartTooltip />} cursor={{ stroke: 'rgba(0,217,184,0.15)', strokeWidth: 1 }} />
                        {/* Activity bars */}
                        <Bar
                          yAxisId="vol"
                          dataKey="clientVolume"
                          fill="url(#activityGrad)"
                          radius={[3, 3, 0, 0]}
                          barSize={32}
                          isAnimationActive={false}
                        />
                        {/* Mkt Rank line */}
                        <Line
                          yAxisId="rank"
                          type="monotone"
                          dataKey="marketRank"
                          stroke="rgba(148,163,184,0.6)"
                          strokeWidth={2}
                          strokeDasharray="6 3"
                          dot={{ r: 4, fill: '#0a1628', stroke: 'rgba(148,163,184,0.7)', strokeWidth: 2 }}
                          activeDot={{ r: 6, fill: 'rgba(148,163,184,0.3)', stroke: 'rgba(148,163,184,0.9)', strokeWidth: 2 }}
                          connectNulls
                          isAnimationActive={false}
                        />
                        {/* My Rank line — on top, with glow */}
                        <Line
                          yAxisId="rank"
                          type="monotone"
                          dataKey="clientRank"
                          stroke={CYAN}
                          strokeWidth={2.5}
                          dot={{ r: 5, fill: '#0a1628', stroke: CYAN, strokeWidth: 2.5 }}
                          activeDot={{ r: 7, fill: 'rgba(0,217,184,0.2)', stroke: CYAN, strokeWidth: 2.5, filter: 'url(#glowFilter)' }}
                          connectNulls
                          isAnimationActive={false}
                          filter="url(#glowFilter)"
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                    {/* Chart legend */}
                    <div className="flex items-center justify-center gap-5 pb-2 pt-0.5">
                      <div className="flex items-center gap-1.5">
                        <div className="w-4 h-0.5 rounded" style={{ backgroundColor: CYAN, boxShadow: `0 0 6px ${CYAN}` }}></div>
                        <span className="text-[10px] font-mono" style={{ color: CYAN }}>My Rank</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-4 h-0.5 rounded" style={{ backgroundColor: 'rgba(148,163,184,0.6)', borderTop: '1px dashed rgba(148,163,184,0.6)' }}></div>
                        <span className="text-[10px] font-mono text-muted">Mkt Rank</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-sm" style={{ background: `linear-gradient(to bottom, rgba(0,217,184,0.35), rgba(0,217,184,0.05))` }}></div>
                        <span className="text-[10px] font-mono text-muted">My Activity (EUR MM)</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && tableData.length === 0 && (
        <div className="flex items-center justify-center h-96">
          <div className="text-sm font-mono text-muted">
            No comparison data available for this period
          </div>
        </div>
      )}
    </div>
  )
}
