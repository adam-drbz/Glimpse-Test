import { useState, useEffect, useRef, useCallback } from 'react'
import { listRecords } from '../api/records'

const CYAN = '#00d9b8'

function fmtDate(val) {
  if (!val) return '—'
  const raw = val.includes('T') ? val : val + 'T00:00:00'
  const d = new Date(raw)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtDateDMY(val) {
  if (!val) return '—'
  const raw = val.includes('T') ? val : val + 'T00:00:00'
  const d = new Date(raw)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}-${mm}-${yyyy}`
}

function fmtTime(val) {
  if (!val) return '—'
  const d = new Date(val)
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function fmtCoupon(v) {
  return v != null ? `${Number(v).toFixed(3)}%` : '—'
}

function fmtPrice(v) {
  return v != null ? Number(v).toFixed(3) : '—'
}

const COLUMNS = [
  { key: 'trade_date',            label: 'Date',      format: fmtDate },
  { key: 'trade_time',            label: 'Time',      format: fmtTime },
  { key: 'side',                  label: 'Side' },
  { key: 'size_in_MM',            label: 'Size',      sortKey: 'size_in_MM_capped_num' },
  { key: 'currency',              label: 'Currency' },
  { key: 'ticker',                label: 'Ticker' },
  { key: 'secmst_entity_name',    label: 'Name' },
  { key: 'isin',                  label: 'ISIN' },
  { key: 'coupon_perc',           label: 'Cpn',       format: fmtCoupon },
  { key: 'maturity',              label: 'Maturity',  format: fmtDateDMY },
  { key: 'price',                 label: 'Price',     format: fmtPrice },
  { key: 'venue',                 label: 'Venue' },
  { key: 'secmst_glimpse_sector', label: 'Sector' },
  { key: 'secmst_region',         label: 'Region' },
  { key: 'secmst_seniority',      label: 'Seniority' },
]

// All data field keys needed for the API request
const ALL_FIELDS = [...new Set(COLUMNS.flatMap(c => c.sortKey ? [c.key, c.sortKey] : [c.key]))].join(',')

function ColumnToggle({ columns, visible, onToggle }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-muted hover:text-secondary bg-navy-850 border border-subtle rounded transition-colors"
      >
        <span className="material-symbols-outlined text-[16px]">view_column</span>
        Columns
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-52 bg-navy-850 border border-subtle rounded-lg shadow-xl z-50 overflow-hidden">
          <div className="max-h-64 overflow-y-auto">
            {columns.map(col => {
              const isVisible = visible.includes(col.key)
              return (
                <button
                  key={col.key}
                  onClick={() => onToggle(col.key)}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs font-mono transition-colors ${
                    isVisible ? 'text-cyan bg-navy-800' : 'text-secondary hover:bg-navy-800 hover:text-primary'
                  }`}
                >
                  <span
                    className="w-3.5 h-3.5 rounded-sm border flex items-center justify-center shrink-0"
                    style={{
                      borderColor: isVisible ? CYAN : 'rgba(255,255,255,0.2)',
                      backgroundColor: isVisible ? 'rgba(0, 217, 184, 0.15)' : 'transparent',
                    }}
                  >
                    {isVisible && (
                      <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                        <path d="M1 3L3 5L7 1" stroke={CYAN} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  <span>{col.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}


export default function MarketViewPage({ dateFrom, dateTo, context, filters }) {
  const [data, setData] = useState([])
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 0, limit: 50 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [sortField, setSortField] = useState('trade_date')
  const [sortDir, setSortDir] = useState('desc')

  const [columnFilters, setColumnFilters] = useState({})
  const [columnFilterInputs, setColumnFilterInputs] = useState({})
  const filterTimerRef = useRef({})

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  const [visibleColumns, setVisibleColumns] = useState(() => COLUMNS.map(c => c.key))

  // Reset to page 1 when filters or sorting change
  const resetPageRef = useRef(false)
  useEffect(() => {
    if (resetPageRef.current) {
      setPage(1)
    }
    resetPageRef.current = true
  }, [dateFrom, dateTo, context, filters, sortField, sortDir, columnFilters, pageSize])

  // Fetch data
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    const conditions = []

    // Date range
    conditions.push({ field: 'trade_date', op: 'ge', value: dateFrom })
    conditions.push({ field: 'trade_date', op: 'lt', value: dateTo })

    // Page-level filters
    if (filters.products?.length > 0) {
      conditions.push({ field: 'secmst_bond_category', op: 'in', value: filters.products })
    }
    if (filters.sectors?.length > 0) {
      conditions.push({ field: 'secmst_glimpse_sector', op: 'in', value: filters.sectors })
    }
    if (filters.regions?.length > 0) {
      conditions.push({ field: 'secmst_region', op: 'in', value: filters.regions })
    }
    if (filters.seniorities?.length > 0) {
      conditions.push({ field: 'secmst_seniority', op: 'in', value: filters.seniorities })
    }

    // Client context
    if (context === 'client' && filters._clientId) {
      conditions.push({ field: 'glimpse_buy_side', op: 'eq', value: filters._clientId })
    }

    // Per-column filters
    for (const [field, value] of Object.entries(columnFilters)) {
      if (value && value.trim()) {
        conditions.push({ field, op: 'like', value: `%${value.trim()}%` })
      }
    }

    const filter = conditions.length > 0 ? { and: conditions } : undefined

    // Use sortKey if the column defines one (e.g. size_in_MM uses size_in_MM_capped_num for sorting)
    const colDef = COLUMNS.find(c => c.key === sortField)
    const actualSortField = colDef?.sortKey || sortField

    listRecords('trade_records', {
      filter,
      sort: `${actualSortField}:${sortDir}`,
      fields: ALL_FIELDS,
      limit: pageSize,
      page,
    })
      .then(response => {
        if (cancelled) return
        setData(response.data || [])
        setPagination(response.pagination || { total: 0, page: 1, totalPages: 0, limit: pageSize })
        setLoading(false)
      })
      .catch(err => {
        if (!cancelled) {
          setError(err.message)
          setLoading(false)
        }
      })

    return () => { cancelled = true }
  }, [dateFrom, dateTo, context, filters, sortField, sortDir, columnFilters, page, pageSize])

  function handleSort(field) {
    if (sortField === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const handleColumnFilterChange = useCallback((field, value) => {
    setColumnFilterInputs(prev => ({ ...prev, [field]: value }))

    clearTimeout(filterTimerRef.current[field])
    filterTimerRef.current[field] = setTimeout(() => {
      setColumnFilters(prev => {
        const next = { ...prev }
        if (value.trim()) {
          next[field] = value.trim()
        } else {
          delete next[field]
        }
        return next
      })
    }, 300)
  }, [])

  function handleToggleColumn(key) {
    setVisibleColumns(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  const displayColumns = COLUMNS.filter(c => visibleColumns.includes(c.key))

  const pageStart = data.length > 0 ? ((page - 1) * pageSize) + 1 : 0
  const pageEnd = Math.min(page * pageSize, pagination.total)

  const paginationBtnClass = (disabled) =>
    `px-2.5 py-1.5 text-xs font-mono rounded transition-colors ${
      disabled
        ? 'text-muted/30 cursor-not-allowed'
        : 'text-muted hover:text-cyan hover:bg-navy-800'
    }`

  return (
    <div className="opacity-0 animate-fade-in-up">
      {/* Page header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-mono font-semibold uppercase text-primary tracking-widest">
            Market View
          </h2>
          <p className="text-xs font-mono text-muted mt-0.5">
            {pagination.total?.toLocaleString() || 0} records
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ColumnToggle columns={COLUMNS} visible={visibleColumns} onToggle={handleToggleColumn} />
          <select
            value={pageSize}
            onChange={e => setPageSize(Number(e.target.value))}
            className="bg-navy-850 border border-subtle rounded px-2 py-1.5 text-xs font-mono text-secondary focus:outline-none focus:border-cyan transition-colors"
          >
            <option value={25}>25 rows</option>
            <option value={50}>50 rows</option>
            <option value={100}>100 rows</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-navy-900 border border-default rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              {/* Header row */}
              <tr className="border-b border-subtle">
                {displayColumns.map(col => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className="px-3 py-2.5 text-left text-[10px] uppercase tracking-wider text-muted font-semibold cursor-pointer hover:text-cyan transition-colors whitespace-nowrap select-none"
                  >
                    <div className="flex items-center gap-1">
                      {col.label}
                      {sortField === col.key && (
                        <span className="text-cyan text-[8px]">{sortDir === 'asc' ? '▲' : '▼'}</span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
              {/* Filter row */}
              <tr className="border-b border-subtle bg-navy-950/50">
                {displayColumns.map(col => (
                  <th key={col.key} className="px-3 py-1.5">
                    <input
                      type="text"
                      placeholder="Filter..."
                      value={columnFilterInputs[col.key] || ''}
                      onChange={e => handleColumnFilterChange(col.key, e.target.value)}
                      className="w-full bg-navy-800 border border-subtle rounded px-2 py-1 text-xs font-mono text-secondary placeholder:text-muted/40 focus:border-cyan focus:outline-none transition-colors min-w-[60px]"
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={displayColumns.length} className="px-3 py-16 text-center">
                    <div className="flex items-center justify-center gap-2 text-sm font-mono text-muted">
                      <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-glow-pulse"></div>
                      Loading data...
                    </div>
                  </td>
                </tr>
              )}
              {error && (
                <tr>
                  <td colSpan={displayColumns.length} className="px-3 py-16 text-center text-sm font-mono text-red-400">
                    Failed to load data: {error}
                  </td>
                </tr>
              )}
              {!loading && !error && data.map((row, i) => (
                <tr
                  key={row.id || i}
                  className="border-b border-subtle/30 transition-colors hover:bg-navy-850/50"
                >
                  {displayColumns.map(col => {
                    const val = row[col.key]
                    let display = col.format ? col.format(val) : (val ?? '—')

                    // Color-code the Side column
                    let cellClass = 'px-3 py-2 text-secondary whitespace-nowrap'
                    if (col.key === 'side') {
                      cellClass = `px-3 py-2 whitespace-nowrap font-semibold ${
                        val === 'Buy' ? 'text-cyan' : val === 'Sell' ? 'text-red-400' : 'text-secondary'
                      }`
                    }

                    return (
                      <td key={col.key} className={cellClass}>
                        {display}
                      </td>
                    )
                  })}
                </tr>
              ))}
              {!loading && !error && data.length === 0 && (
                <tr>
                  <td colSpan={displayColumns.length} className="px-3 py-16 text-center text-sm font-mono text-muted">
                    No records found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-subtle">
          <span className="text-xs font-mono text-muted">
            {data.length > 0
              ? `Showing ${pageStart.toLocaleString()}–${pageEnd.toLocaleString()} of ${pagination.total?.toLocaleString()}`
              : 'No results'
            }
          </span>
          <div className="flex items-center gap-1">
            <button
              disabled={page <= 1}
              onClick={() => setPage(1)}
              className={paginationBtnClass(page <= 1)}
            >
              First
            </button>
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className={paginationBtnClass(page <= 1)}
            >
              Prev
            </button>
            <span className="px-3 py-1.5 text-xs font-mono text-secondary">
              {pagination.totalPages > 0 ? `${page} / ${pagination.totalPages}` : '—'}
            </span>
            <button
              disabled={page >= pagination.totalPages}
              onClick={() => setPage(p => p + 1)}
              className={paginationBtnClass(page >= pagination.totalPages)}
            >
              Next
            </button>
            <button
              disabled={page >= pagination.totalPages}
              onClick={() => setPage(pagination.totalPages)}
              className={paginationBtnClass(page >= pagination.totalPages)}
            >
              Last
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
