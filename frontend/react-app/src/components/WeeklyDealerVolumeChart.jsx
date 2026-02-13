import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  LabelList,
} from 'recharts'
import { executeQuery } from '../api/records'

// Curated palette — distinct hues that read well on dark backgrounds
const DEALER_PALETTE = [
  '#00d9b8', // cyan (primary brand)
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ef4444', // red
  '#3b82f6', // blue
  '#ec4899', // pink
  '#10b981', // emerald
  '#f97316', // orange
  '#06b6d4', // sky
  '#a78bfa', // lavender
]
const OTHER_COLOR = 'rgba(255,255,255,0.3)'

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
  if (val == null) return '—'
  const abs = Math.abs(val)
  if (abs >= 1000) return `${(val / 1000).toFixed(1)}B`
  return `${val.toFixed(0)}M`
}

function getISOWeekLabel(dateStr) {
  const raw = dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00'
  const d = new Date(raw)
  // Get ISO week number
  const tmp = new Date(d.getTime())
  tmp.setDate(tmp.getDate() + 3 - ((tmp.getDay() + 6) % 7))
  const week1 = new Date(tmp.getFullYear(), 0, 4)
  const weekNum = 1 + Math.round(((tmp - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)

  // Get the Monday of this ISO week for the label
  const monday = new Date(d.getTime())
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  const mon = monday.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
  return { weekKey: `${tmp.getFullYear()}-W${String(weekNum).padStart(2, '0')}`, label: mon }
}

// Keys use prefixes to separate Buy/Sell stacks for the same dealer
const BUY_PREFIX = 'buy:'
const SELL_PREFIX = 'sell:'

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null

  const buyItems = []
  const sellItems = []
  for (const p of payload) {
    if (!p.value || p.value === 0) continue
    const isSell = p.dataKey.startsWith(SELL_PREFIX)
    const name = p.dataKey.slice(p.dataKey.indexOf(':') + 1)
    const entry = { name, value: Math.abs(p.value), color: p.color }
    if (isSell) sellItems.push(entry)
    else buyItems.push(entry)
  }
  buyItems.sort((a, b) => b.value - a.value)
  sellItems.sort((a, b) => b.value - a.value)

  const buyTotal = buyItems.reduce((s, p) => s + p.value, 0)
  const sellTotal = sellItems.reduce((s, p) => s + p.value, 0)

  const renderSection = (title, items, total, color) => {
    if (!items.length) return null
    return (
      <>
        <div className="flex items-center gap-1.5 mt-1.5 mb-1" style={{ color }}>
          <span className="text-[10px] font-semibold uppercase tracking-wider">{title}</span>
          <span className="text-[10px]">{fmtMM(total)} EUR</span>
        </div>
        {items.map(entry => (
          <div key={entry.name} className="flex items-center gap-2 py-0.5">
            <span
              className="w-2.5 h-2.5 rounded-sm shrink-0"
              style={{ backgroundColor: entry.color }}
            />
            <span className="flex-1 text-secondary truncate" style={{ maxWidth: 160 }}>
              {entry.name}
            </span>
            <span className="text-primary font-medium ml-2">{fmtMM(entry.value)}</span>
          </div>
        ))}
      </>
    )
  }

  return (
    <div
      className="bg-navy-800 border border-cyan rounded px-3 py-2 text-xs font-mono shadow-lg"
      style={{ maxHeight: 400, overflowY: 'auto' }}
    >
      <div className="text-primary font-semibold mb-1">
        Week of {label}
      </div>
      {renderSection('Buy', buyItems, buyTotal, '#00d9b8')}
      {renderSection('Sell', sellItems, sellTotal, '#ef4444')}
    </div>
  )
}

function LegendPanel({ dealers, colors }) {
  return (
    <div className="flex flex-col gap-1 py-1">
      {dealers.map((name, i) => (
        <div key={name} className="flex items-center gap-2 px-3 py-0.5">
          <span
            className="w-3 h-3 rounded-sm shrink-0"
            style={{ backgroundColor: colors[i] }}
          />
          <span className="text-xs font-mono text-secondary truncate">{name}</span>
        </div>
      ))}
    </div>
  )
}

export default function WeeklyDealerVolumeChart({ dateFrom, dateTo, context, filters }) {
  const [rawData, setRawData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    const extra = buildExtraFilters(filters, context)
    const baseParams = [dateFrom, dateTo]

    // Fetch weekly volume by dealer and side (Buy + Sell)
    executeQuery({
      query: `
        SELECT
          trade_date,
          side,
          counter_party as dealer,
          SUM(size_in_eur_v2) as volume,
          SUM(size_in_MM_capped_num * currency_to_usd_conversion_rate * usd_to_eur_conversion_rate) as displayVolume
        FROM trade_records
        WHERE trade_date >= ? AND trade_date < ?
          AND side IN ('Buy', 'Sell')
          AND counter_party IS NOT NULL
          ${extra.sql}
        GROUP BY trade_date, side, counter_party
        ORDER BY trade_date
      `,
      params: [...baseParams, ...extra.params],
      readonly: true,
    })
      .then(response => {
        if (cancelled) return
        setRawData(response.data || [])
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

  const { chartData, buyStackOrder, sellStackOrder, legendDealers, dealerColors } = useMemo(() => {
    if (!rawData?.length) return { chartData: [], buyStackOrder: [], sellStackOrder: [], legendDealers: [], dealerColors: {} }

    // 1. Bucket rows into ISO weeks, separated by side
    // Track both volume (size_in_eur_v2, for ranking) and displayVolume (size_in_MM_capped_num, for chart)
    const weekMap = {}
    const globalRankTotals = {} // dealer -> total volume for ranking
    for (const row of rawData) {
      const { weekKey, label } = getISOWeekLabel(row.trade_date)
      if (!weekMap[weekKey]) weekMap[weekKey] = { label, buy: {}, sell: {}, buyDisplay: {}, sellDisplay: {} }
      const bucket = weekMap[weekKey]
      // Flip: trade side is buy-side perspective; dealer side is opposite
      const side = row.side === 'Buy' ? 'sell' : 'buy'
      const displaySide = side + 'Display'
      bucket[side][row.dealer] = (bucket[side][row.dealer] || 0) + (row.volume || 0)
      bucket[displaySide][row.dealer] = (bucket[displaySide][row.dealer] || 0) + (row.displayVolume || 0)
      globalRankTotals[row.dealer] = (globalRankTotals[row.dealer] || 0) + (row.volume || 0)
    }

    // 2. Determine top 10 dealers globally by total volume (for ranking only)
    const sortedDealers = Object.entries(globalRankTotals)
      .sort((a, b) => b[1] - a[1])
    const top = sortedDealers.slice(0, 10).map(d => d[0])
    const topSet = new Set(top)

    // 3. Build chart data using displayVolume for values
    // Buy values are positive, Sell values are negative
    const sortedWeeks = Object.entries(weekMap).sort((a, b) => a[0].localeCompare(b[0]))
    const OTHER_LABEL = 'All Other Dealers'
    const data = sortedWeeks.map(([weekKey, { label, buyDisplay, sellDisplay }]) => {
      const entry = { weekKey, label }
      let otherBuy = 0
      let otherSell = 0

      for (const [dealer, vol] of Object.entries(buyDisplay)) {
        if (topSet.has(dealer)) {
          entry[BUY_PREFIX + dealer] = vol
        } else {
          otherBuy += vol
        }
      }
      for (const [dealer, vol] of Object.entries(sellDisplay)) {
        if (topSet.has(dealer)) {
          entry[SELL_PREFIX + dealer] = -vol // negative for downward stack
        } else {
          otherSell += vol
        }
      }
      entry[BUY_PREFIX + OTHER_LABEL] = otherBuy
      entry[SELL_PREFIX + OTHER_LABEL] = -otherSell

      // Precompute totals for column labels
      let buyTotal = otherBuy
      let sellTotal = otherSell
      for (const dealer of top) {
        buyTotal += entry[BUY_PREFIX + dealer] || 0
        sellTotal += Math.abs(entry[SELL_PREFIX + dealer] || 0)
      }
      entry._buyTotal = buyTotal
      entry._sellTotal = sellTotal

      return entry
    })

    // 4. Build color map (same color for a dealer on both Buy and Sell sides)
    const colors = {}
    top.forEach((name, i) => { colors[name] = DEALER_PALETTE[i] })
    colors[OTHER_LABEL] = OTHER_COLOR

    // 5. Stack orders
    // Buy: "All Other" at bottom (rendered first), smallest dealer next, largest at top
    const buyOrder = [BUY_PREFIX + OTHER_LABEL, ...([...top].reverse().map(d => BUY_PREFIX + d))]
    // Sell: mirror — "All Other" at bottom (most negative), largest dealer closest to zero line
    const sellOrder = [SELL_PREFIX + OTHER_LABEL, ...([...top].reverse().map(d => SELL_PREFIX + d))]

    return {
      chartData: data,
      buyStackOrder: buyOrder,
      sellStackOrder: sellOrder,
      legendDealers: [...top, OTHER_LABEL],
      dealerColors: colors,
    }
  }, [rawData])

  const renderBuyTotal = useCallback((props) => {
    const { x, y, width, index } = props
    const total = chartData[index]?._buyTotal
    if (!total) return null
    return (
      <text
        x={x + width / 2}
        y={y - 4}
        textAnchor="middle"
        fill="rgba(0,217,184,0.9)"
        fontSize={11}
        fontWeight={600}
        fontFamily="ui-monospace, monospace"
      >
        {fmtMM(total)}
      </text>
    )
  }, [chartData])

  const renderSellTotal = useCallback((props) => {
    const { x, y, width, height, index } = props
    const total = chartData[index]?._sellTotal
    if (!total) return null
    return (
      <text
        x={x + width / 2}
        y={Math.max(y, y + height) + 10}
        textAnchor="middle"
        fill="rgba(239,68,68,0.9)"
        fontSize={11}
        fontWeight={600}
        fontFamily="ui-monospace, monospace"
      >
        {fmtMM(total)}
      </text>
    )
  }, [chartData])

  const formatYAxis = useCallback((val) => {
    const abs = Math.abs(val)
    if (abs >= 1000) return `${(val / 1000).toFixed(0)}B`
    if (abs > 0) return `${val.toFixed(0)}M`
    return '0'
  }, [])

  return (
    <div className="bg-navy-900 border border-default rounded-lg p-6">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-sm font-mono font-semibold uppercase text-primary tracking-widest mb-1">
          {context === 'client' ? 'My Weekly Volume by Dealer' : 'Market Weekly Volume by Dealer'}
        </h3>
        <p className="text-xs font-mono text-muted">
          Weekly EUR volume (MM) — top 10 dealers + others &middot;
          <span className="text-cyan ml-1">Dealer Buys ▲</span>
          <span className="text-red-400 ml-2">Dealer Sells ▼</span>
        </p>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center h-96">
          <div className="flex items-center gap-2 text-sm font-mono text-muted">
            <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-glow-pulse"></div>
            Loading data...
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

      {/* Chart */}
      {!loading && !error && chartData.length > 0 && (
        <div className="flex gap-4" style={{ height: 480 }}>
          {/* Stacked bar chart */}
          <div className="flex-1 min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 20, right: 16, bottom: 20, left: 8 }}
                barCategoryGap="12%"
                stackOffset="sign"
              >
                <XAxis
                  dataKey="label"
                  tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10, fontFamily: 'ui-monospace, monospace' }}
                  axisLine={{ stroke: 'rgba(0,217,184,0.08)' }}
                  tickLine={false}
                  interval={chartData.length > 20 ? Math.floor(chartData.length / 12) : 0}
                  angle={chartData.length > 14 ? -45 : 0}
                  textAnchor={chartData.length > 14 ? 'end' : 'middle'}
                  height={chartData.length > 14 ? 50 : 30}
                />
                <YAxis
                  tickFormatter={formatYAxis}
                  tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11, fontFamily: 'ui-monospace, monospace' }}
                  axisLine={false}
                  tickLine={false}
                  width={52}
                />
                <ReferenceLine y={0} stroke="rgba(0,217,184,0.2)" strokeWidth={1} />
                <Tooltip
                  content={<CustomTooltip />}
                  cursor={{ fill: 'rgba(0, 217, 184, 0.04)' }}
                />
                {/* Buy bars (positive, stacking upward) */}
                {buyStackOrder.map((key, i) => {
                  const dealer = key.slice(BUY_PREFIX.length)
                  const isTop = i === buyStackOrder.length - 1
                  return (
                    <Bar
                      key={key}
                      dataKey={key}
                      name={dealer}
                      stackId="buy"
                      fill={dealerColors[dealer]}
                      radius={0}
                    >
                      {isTop && <LabelList content={renderBuyTotal} />}
                    </Bar>
                  )
                })}
                {/* Sell bars (negative, stacking downward) */}
                {sellStackOrder.map((key, i) => {
                  const dealer = key.slice(SELL_PREFIX.length)
                  const isBottom = i === sellStackOrder.length - 1
                  return (
                    <Bar
                      key={key}
                      dataKey={key}
                      name={dealer}
                      stackId="sell"
                      fill={dealerColors[dealer]}
                      radius={0}
                    >
                      {isBottom && <LabelList content={renderSellTotal} />}
                    </Bar>
                  )
                })}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Legend sidebar */}
          <div className="w-52 shrink-0 bg-navy-950 border border-subtle rounded-lg overflow-y-auto">
            <div className="px-3 py-2 border-b border-subtle">
              <span className="text-[10px] font-mono text-muted uppercase tracking-wider">Legend</span>
            </div>
            <LegendPanel
              dealers={legendDealers}
              colors={legendDealers.map(d => dealerColors[d])}
            />
            <div className="px-3 py-2 border-t border-subtle">
              <div className="flex items-center gap-2 text-[10px] font-mono text-muted">
                <span className="text-cyan">▲</span>
                <span>Above zero = Buy</span>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-mono text-muted mt-0.5">
                <span className="text-red-400">▼</span>
                <span>Below zero = Sell</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && chartData.length === 0 && (
        <div className="flex items-center justify-center h-96">
          <div className="text-sm font-mono text-muted">
            No trade data available for this period
          </div>
        </div>
      )}
    </div>
  )
}
