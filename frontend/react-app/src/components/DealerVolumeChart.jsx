import { useState, useEffect, useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { executeQuery } from '../api/records'

const CYAN = '#00d9b8'
const CYAN_DIM = 'rgba(0, 217, 184, 0.6)'

const TIER_COLORS = {
  gold:    { text: '#fbbf24', bg: 'rgba(251, 191, 36, 0.08)', border: 'rgba(251, 191, 36, 0.25)' },
  silver:  { text: '#94a3b8', bg: 'rgba(148, 163, 184, 0.06)', border: 'rgba(148, 163, 184, 0.20)' },
  bronze:  { text: '#cd7f32', bg: 'rgba(205, 127, 50, 0.06)', border: 'rgba(205, 127, 50, 0.18)' },
  unknown: { text: '#ef4444', bg: 'rgba(239, 68, 68, 0.08)', border: 'rgba(239, 68, 68, 0.25)' },
}

const UNKNOWN_DEALER = 'Unknown Dealer'
function buildExtraFilters(filters, context) {
  let sql = ''
  const params = []
  if (context === 'client' && filters?._clientId) {
    sql += ` AND glimpse_buy_side = ?`
    params.push(filters._clientId)
  }
  for (const [key, col] of [['products', 'secmst_bond_category'], ['sectors', 'secmst_glimpse_sector'], ['regions', 'secmst_region'], ['seniorities', 'secmst_seniority']]) {
    if (filters?.[key]?.length > 0) {
      sql += ` AND ${col} IN (${filters[key].map(() => '?').join(', ')})`
      params.push(...filters[key])
    }
  }
  return { sql, params }
}

function getTier(rank, name) {
  if (name === UNKNOWN_DEALER) return 'unknown'
  if (rank <= 5) return 'gold'
  if (rank <= 10) return 'silver'
  return 'bronze'
}

function fmtMM(val) {
  if (val == null) return '—'
  if (Math.abs(val) >= 1000) return `${(val / 1000).toFixed(1)}B`
  return `${val.toFixed(1)}M`
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-navy-800 border border-cyan rounded px-3 py-2 text-xs font-mono shadow-lg">
      <div className="text-primary font-semibold mb-1">{d.name}</div>
      <div className="text-cyan">{d.volumePct.toFixed(1)}% of volume &middot; {fmtMM(d.totalVolume)} EUR</div>
      <div className="text-secondary mt-0.5">{d.valuePct.toFixed(1)}% of value &middot; {fmtMM(d.totalValue)} EUR</div>
      <div className="text-muted mt-0.5">{d.totalTransactions} trades</div>
    </div>
  )
}

function DealerRankingTable({ data }) {
  if (!data?.length) return null

  return (
    <div className="flex flex-col h-full">
      {/* Column headers */}
      <div className="flex items-center px-3 py-2 border-b border-subtle text-[10px] font-mono text-muted uppercase tracking-wider">
        <span className="w-7 text-center">#</span>
        <span className="flex-1 ml-2">Dealer</span>
        <span className="w-12 text-right">Vol %</span>
        <span className="w-16 text-right">Vol</span>
        <span className="w-12 text-right">Trades</span>
        <span className="w-12 text-right">Val %</span>
        <span className="w-16 text-right">Val</span>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto">
        {data.map((d, i) => {
          const rank = i + 1
          const tier = getTier(rank, d.name)
          const colors = TIER_COLORS[tier]
          const isUnknown = d.name === UNKNOWN_DEALER
          return (
            <div
              key={d.name}
              className="flex items-center px-3 py-1.5 border-b transition-colors hover:bg-navy-850"
              style={{ borderBottomColor: 'rgba(0,217,184,0.04)' }}
            >
              <span
                className="w-7 text-center text-[11px] font-mono font-semibold rounded-sm py-0.5"
                style={{
                  color: colors.text,
                  backgroundColor: colors.bg,
                  border: `1px solid ${colors.border}`,
                }}
              >
                {rank}
              </span>
              <span
                className="flex-1 ml-2 text-xs font-mono truncate"
                style={{ color: isUnknown ? colors.text : rank <= 5 ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.65)' }}
              >
                {d.name}
              </span>
              <span
                className="w-12 text-right text-xs font-mono font-medium"
                style={{ color: colors.text }}
              >
                {d.volumePct.toFixed(1)}%
              </span>
              <span
                className="w-16 text-right text-[11px] font-mono"
                style={{ color: rank <= 5 ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.5)' }}
              >
                {fmtMM(d.totalVolume)}
              </span>
              <span
                className="w-12 text-right text-[11px] font-mono"
                style={{ color: rank <= 5 ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.5)' }}
              >
                {d.totalTransactions}
              </span>
              <span
                className="w-12 text-right text-xs font-mono font-medium"
                style={{ color: colors.text }}
              >
                {d.valuePct.toFixed(1)}%
              </span>
              <span
                className="w-16 text-right text-[11px] font-mono"
                style={{ color: rank <= 5 ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.5)' }}
              >
                {fmtMM(d.totalValue)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function DealerVolumeChart({ dateFrom, dateTo, context, filters }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [hoveredIndex, setHoveredIndex] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    const extra = buildExtraFilters(filters, context)
    const baseParams = [dateFrom, dateTo]

    executeQuery({
      query: `
        SELECT COALESCE(counter_party, 'Unknown Dealer') as name,
               COUNT(*) as totalTransactions,
               SUM(size_in_eur_v2) as totalVolume,
               SUM(size_in_eur_v2 * price * 0.01) as totalValue,
               MIN(trade_date) as minDate,
               MAX(trade_date) as maxDate
        FROM trade_records
        WHERE trade_date >= ? AND trade_date < ?
          ${extra.sql}
        GROUP BY counter_party
        ORDER BY totalVolume DESC
      `,
      params: [...baseParams, ...extra.params],
      readonly: true,
    })
      .then(response => {
        if (cancelled) return

        const groups = response.data || []
        const totalVolume = groups.reduce((sum, g) => sum + (g.totalVolume || 0), 0)
        const totalValue = groups.reduce((sum, g) => sum + (g.totalValue || 0), 0)

        // Extract date range from all rows
        let minDate = null
        let maxDate = null
        for (const g of groups) {
          if (g.minDate && (!minDate || g.minDate < minDate)) minDate = g.minDate
          if (g.maxDate && (!maxDate || g.maxDate > maxDate)) maxDate = g.maxDate
        }

        setData({
          groups: groups.map(g => ({
            ...g,
            volumePct: totalVolume > 0
              ? parseFloat(((g.totalVolume / totalVolume) * 100).toFixed(2))
              : 0,
            valuePct: totalValue > 0
              ? parseFloat(((g.totalValue / totalValue) * 100).toFixed(2))
              : 0,
          })),
          totalVolume,
          totalValue,
          totalGroups: groups.length,
          minDate,
          maxDate,
        })
        setLoading(false)
      })
      .catch(err => {
        if (!cancelled) {
          setError(err.message)
          setLoading(false)
        }
      })

    return () => { cancelled = true }
  }, [dateFrom, dateTo, context, filters])

  const chartData = useMemo(() => {
    if (!data?.groups) return []
    return [...data.groups].sort((a, b) => b.volumePct - a.volumePct)
  }, [data])

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    const raw = dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00'
    const d = new Date(raw)
    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
  }


  return (
    <div className="bg-navy-900 border border-default rounded-lg p-6">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-sm font-mono font-semibold uppercase text-primary tracking-widest mb-1">
          {context === 'client' ? 'My Dealer Volume' : 'Market Dealer Volume'}
        </h3>
        <p className="text-xs font-mono text-muted">
          % of total volume
          {data && !loading && (
            <>
              <span className="text-secondary ml-2">
                ({data.totalGroups} dealers &middot; {fmtMM(data.totalVolume)} vol &middot; {fmtMM(data.totalValue)} val)
              </span>
              {data.minDate && data.maxDate && (
                <span className="text-muted ml-2">
                  &middot; {formatDate(data.minDate)} &ndash; {formatDate(data.maxDate)}
                </span>
              )}
            </>
          )}
        </p>
      </div>

      {/* Content area */}
      {loading && (
        <div className="flex items-center justify-center h-96">
          <div className="flex items-center gap-2 text-sm font-mono text-muted">
            <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-glow-pulse"></div>
            Loading data...
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-center h-96">
          <div className="text-sm font-mono text-red-400">
            Failed to load data: {error}
          </div>
        </div>
      )}

      {!loading && !error && chartData.length > 0 && (
        <div className="flex gap-6" style={{ height: 480 }}>
          {/* Ranking table - left */}
          <div className="w-130 shrink-0 bg-navy-950 border border-subtle rounded-lg overflow-hidden">
            <DealerRankingTable data={chartData} />
          </div>

          {/* Bar chart - right */}
          <div className="flex-1 min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData.slice(0, 15)}
                layout="vertical"
                margin={{ top: 0, right: 40, bottom: 0, left: 0 }}
                barCategoryGap="20%"
              >
                <XAxis
                  type="number"
                  domain={[0, 'auto']}
                  tickFormatter={v => `${v}%`}
                  tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
                  axisLine={{ stroke: 'rgba(0,217,184,0.08)' }}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={140}
                  tick={{ fill: 'rgba(255,255,255,0.75)', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={<CustomTooltip />}
                  cursor={{ fill: 'rgba(0, 217, 184, 0.04)' }}
                />
                <Bar
                  dataKey="volumePct"
                  radius={[0, 4, 4, 0]}
                  onMouseEnter={(_, idx) => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  {chartData.slice(0, 15).map((entry, index) => {
                    const isUnk = entry.name === UNKNOWN_DEALER
                    const unkColor = TIER_COLORS.unknown.text
                    return (
                      <Cell
                        key={index}
                        fill={isUnk
                          ? (hoveredIndex === index ? unkColor : 'rgba(239, 68, 68, 0.5)')
                          : (hoveredIndex === index ? CYAN : CYAN_DIM)
                        }
                        style={{
                          filter: hoveredIndex === index
                            ? `drop-shadow(0 0 8px ${isUnk ? unkColor : CYAN})`
                            : 'none',
                          transition: 'all 0.2s ease',
                        }}
                      />
                    )
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {!loading && !error && chartData.length === 0 && (
        <div className="flex items-center justify-center h-96">
          <div className="text-sm font-mono text-muted">
            No data available for this period
          </div>
        </div>
      )}
    </div>
  )
}
