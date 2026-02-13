import { useState, useEffect } from 'react'
import { executeQuery } from '../api/records'


function fmtNum(val) {
  if (val == null) return '—'
  if (Math.abs(val) >= 1e9) return `${(val / 1e9).toFixed(1)}B`
  if (Math.abs(val) >= 1e6) return `${(val / 1e6).toFixed(1)}M`
  if (Math.abs(val) >= 1e3) return `${(val / 1e3).toFixed(1)}K`
  return val.toLocaleString()
}

// Values from size_in_eur_v2 are already in millions
function fmtMM(val) {
  if (val == null) return '—'
  if (Math.abs(val) >= 1e6) return `${(val / 1e6).toFixed(1)}T`
  if (Math.abs(val) >= 1e3) return `${(val / 1e3).toFixed(1)}B`
  return `${val.toFixed(1)}M`
}

function fmtDate(dateStr) {
  if (!dateStr) return ''
  const raw = dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00'
  const d = new Date(raw)
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
}

function BuySell({ buyVal, sellVal, fmt }) {
  const format = fmt || (v => fmtNum(v))
  const b = Math.abs(buyVal || 0)
  const s = Math.abs(sellVal || 0)
  const total = b + s
  const buyPct = total > 0 ? (b / total) * 100 : 50

  return (
    <div className="flex items-center mt-2 w-full">
      <div
        className="h-5 rounded-l-full flex items-center justify-start pl-2 overflow-hidden"
        style={{
          width: `${buyPct}%`,
          minWidth: 32,
          backgroundColor: 'rgba(0, 217, 184, 0.2)',
          borderRight: '1px solid rgba(0,0,0,0.3)',
        }}
      >
        <span className="text-[9px] font-mono font-semibold whitespace-nowrap" style={{ color: 'rgba(255, 255, 255, 0.9)' }}>
          {format(buyVal)}
        </span>
      </div>
      <div
        className="h-5 rounded-r-full flex items-center justify-end pr-2 overflow-hidden"
        style={{
          width: `${100 - buyPct}%`,
          minWidth: 32,
          backgroundColor: 'rgba(239, 68, 68, 0.2)',
        }}
      >
        <span className="text-[9px] font-mono font-semibold whitespace-nowrap" style={{ color: 'rgba(255, 255, 255, 0.9)' }}>
          {format(sellVal)}
        </span>
      </div>
    </div>
  )
}

function Stat({ label, value, accent, buyVal, sellVal, fmt }) {
  return (
    <div className="flex flex-col items-center px-6 py-3 flex-1 min-w-0">
      <span
        className="text-lg font-mono font-bold leading-tight"
        style={{ color: accent ? '#00d9b8' : 'rgba(255,255,255,0.9)' }}
      >
        {value}
      </span>
      <span className="text-[10px] font-mono text-muted uppercase tracking-wider mt-0.5">
        {label}
      </span>
      {buyVal != null && sellVal != null && (
        <BuySell buyVal={buyVal} sellVal={sellVal} fmt={fmt} />
      )}
    </div>
  )
}

function Divider() {
  return <div className="w-px h-12 self-center" style={{ backgroundColor: 'rgba(0,217,184,0.1)' }} />
}

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

export default function StatsBar({ dateFrom, dateTo, context, filters }) {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)

    const extra = buildExtraFilters(filters, context)
    const baseParams = [dateFrom, dateTo]

    const bySideQuery = executeQuery({
      query: `
        SELECT
          side,
          COUNT(*) as trades,
          SUM(size_in_eur_v2) as volume,
          SUM(size_in_eur_v2 * price * 0.01) as value,
          COUNT(DISTINCT isin) as isins,
          COUNT(DISTINCT counter_party) as dealers,
          AVG(size_in_eur_v2) as avgSize
        FROM trade_records
        WHERE trade_date >= ? AND trade_date < ?
          ${extra.sql}
        GROUP BY side
      `,
      params: [...baseParams, ...extra.params],
      readonly: true,
    })

    const totalsQuery = executeQuery({
      query: `
        SELECT
          COUNT(*) as trades,
          SUM(size_in_eur_v2) as volume,
          SUM(size_in_eur_v2 * price * 0.01) as value,
          COUNT(DISTINCT isin) as isins,
          COUNT(DISTINCT COALESCE(counter_party, 'Unknown Dealer')) as dealers,
          AVG(size_in_eur_v2) as avgSize,
          MIN(trade_date) as minDate,
          MAX(trade_date) as maxDate
        FROM trade_records
        WHERE trade_date >= ? AND trade_date < ?
          ${extra.sql}
      `,
      params: [...baseParams, ...extra.params],
      readonly: true,
    })

    Promise.all([bySideQuery, totalsQuery])
      .then(([bySideResponse, totalsResponse]) => {
        const rows = bySideResponse.data || []
        const buy = rows.find(r => r.side === 'Buy') || {}
        const sell = rows.find(r => r.side === 'Sell') || {}
        const totals = (totalsResponse.data || [])[0] || {}

        setStats({
          totalTrades: totals.trades || 0,
          totalVolume: totals.volume || 0,
          totalValue: totals.value || 0,
          uniqueIsins: totals.isins || 0,
          uniqueDealers: totals.dealers || 0,
          avgTradeSize: totals.avgSize || 0,
          minDate: totals.minDate,
          maxDate: totals.maxDate,
          buy, sell,
        })
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [dateFrom, dateTo, context, filters])

  if (loading) {
    return (
      <div className="bg-navy-900 border border-default rounded-lg px-4 py-3 flex items-center justify-center">
        <div className="flex items-center gap-2 text-xs font-mono text-muted">
          <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-glow-pulse"></div>
          Loading stats...
        </div>
      </div>
    )
  }

  if (!stats) return null

  const eurMM = (v) => `€${fmtMM(v)}`

  return (
    <div className="bg-navy-900 border border-default rounded-lg px-2 py-1 flex items-center">
      <div className="flex items-center flex-1 min-w-0">
        <Stat
          label="Notional Volume"
          value={eurMM(stats.totalVolume)}
          accent
          buyVal={stats.buy.volume}
          sellVal={stats.sell.volume}
          fmt={eurMM}
        />
        <Divider />
        <Stat
          label="Total Value"
          value={eurMM(stats.totalValue)}
          buyVal={stats.buy.value}
          sellVal={stats.sell.value}
          fmt={eurMM}
        />
        <Divider />
        <Stat
          label="Trades"
          value={fmtNum(stats.totalTrades)}
          buyVal={stats.buy.trades}
          sellVal={stats.sell.trades}
        />
        <Divider />
        <Stat
          label="Unique ISINs"
          value={fmtNum(stats.uniqueIsins)}
          buyVal={stats.buy.isins}
          sellVal={stats.sell.isins}
        />
        <Divider />
        <Stat
          label="Dealers"
          value={fmtNum(stats.uniqueDealers)}
          buyVal={stats.buy.dealers}
          sellVal={stats.sell.dealers}
        />
        <Divider />
        <Stat
          label="Avg Trade Size"
          value={eurMM(stats.avgTradeSize)}
          buyVal={stats.buy.avgSize}
          sellVal={stats.sell.avgSize}
          fmt={eurMM}
        />
      </div>

      {stats.minDate && stats.maxDate && (
        <div className="flex items-center gap-2 px-4 py-1.5">
          <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-glow-pulse"></div>
          <span className="text-[10px] font-mono text-muted uppercase tracking-wider">
            {fmtDate(stats.minDate)} — {fmtDate(stats.maxDate)}
          </span>
        </div>
      )}
    </div>
  )
}
