import { useState, useEffect, useMemo, useRef } from 'react'
import { Routes, Route } from 'react-router-dom'
import Header from './components/Header'
import SideNav from './components/SideNav'
import StatsBar from './components/StatsBar'
import DealerRankingsPage from './pages/DealerRankingsPage'
import MarketViewPage from './pages/MarketViewPage'
import PlaceholderPage from './pages/PlaceholderPage'

const CYAN = '#00d9b8'

const PERIODS = [
  { key: '30d', label: '30D' },
  { key: '90d', label: '90D' },
  { key: '180d', label: '180D' },
  { key: 'ytd', label: 'YTD' },
]

function fmtDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getDatesForPeriod(period, mode) {
  const today = new Date()
  // Market and compare modes: end date is lagged 30 days
  const endDate = mode !== 'client'
    ? new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30)
    : today

  let startDate
  if (period === 'ytd') {
    startDate = new Date(endDate.getFullYear(), 0, 1)
  } else {
    const days = parseInt(period)
    startDate = new Date(endDate)
    startDate.setDate(startDate.getDate() - days + 1)
  }

  // dateTo is exclusive (day after endDate) for safe datetime comparison
  const dayAfter = new Date(endDate)
  dayAfter.setDate(dayAfter.getDate() + 1)
  return { from: fmtDateKey(startDate), to: fmtDateKey(dayAfter) }
}

function generateMonthOptions(count = 18) {
  const months = []
  const today = new Date()
  for (let i = 0; i < count; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    months.push({ key, label })
  }
  return months
}

const MONTH_OPTIONS = generateMonthOptions()

const PRODUCT_OPTIONS = [
  'Credit (No Rating)', 'EM Corporate', 'EM Sovereign', 'HY Credit',
  'IG Credit', 'Municipal', 'Sovereign', 'SSA',
]
const SECTOR_OPTIONS = [
  'Autos', 'Consumer Discretionary', 'Consumer Staples', 'Energy', 'Financials',
  'Industrials', 'Municipal', 'Real Estate', 'Sovereign', 'Sovereign Agency',
  'Sub Sovereign', 'Sub Sovereign Agency', 'Supranational', 'TMT', 'Utilities',
]
const REGION_OPTIONS = ['EM ASIA', 'EM CEEMEA', 'EM LATAM', 'G10', 'Non-G10']
const SENIORITY_OPTIONS = [
  'Additional Tier 1', 'Dated Senior', 'Dated Subordinated Guaranteed Notes',
  'Junior Subordinated', 'Lien-1', 'Lien-2', 'Lien-3', 'Restricted Tier 1',
  'Senior', 'Senior Guaranteed Notes', 'Senior Non-Preferred', 'Senior Preferred',
  'Senior Subordinated', 'Senior Unsubordinated', 'Subordinated', 'Tier 1 Capital',
  'Tier 1 Subordinated', 'Tier 2 Capital', 'Tier 2 Subordinated',
  'Tier 3 Subordinated', 'Undated Subordinated', 'Unsubordinated',
]

function MultiSelectDropdown({ label, options, selected, onToggle, onClear, renderLabel }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const fmt = renderLabel || (v => v)
  const count = selected.length
  const display = count === 0 ? label : count === 1
    ? fmt(selected[0])
    : `${count} ${label.toLowerCase()}`

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`px-3 py-1.5 text-xs font-mono transition-colors flex items-center gap-1.5 ${
          count > 0
            ? 'bg-cyan-500 text-navy-950 font-semibold'
            : 'text-muted hover:text-secondary'
        }`}
      >
        <span className="max-w-24 truncate">{display}</span>
        <svg width="8" height="5" viewBox="0 0 8 5" fill="currentColor" className={`transition-transform shrink-0 ${open ? 'rotate-180' : ''}`}>
          <path d="M0.5 0.5L4 4L7.5 0.5" stroke="currentColor" strokeWidth="1" fill="none" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-52 bg-navy-850 border border-subtle rounded-lg shadow-xl z-50 overflow-hidden">
          {count > 0 && (
            <button
              onClick={() => { onClear(); setOpen(false) }}
              className="w-full px-3 py-1.5 text-[10px] font-mono text-muted hover:text-cyan text-left border-b border-subtle uppercase tracking-wider"
            >
              Clear selection
            </button>
          )}
          <div className="max-h-52 overflow-y-auto">
            {options.map(opt => {
              const isSelected = selected.includes(opt)
              return (
                <button
                  key={opt}
                  onClick={() => onToggle(opt)}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs font-mono transition-colors ${
                    isSelected ? 'text-cyan bg-navy-800' : 'text-secondary hover:bg-navy-800 hover:text-primary'
                  }`}
                >
                  <span
                    className="w-3.5 h-3.5 rounded-sm border flex items-center justify-center shrink-0"
                    style={{
                      borderColor: isSelected ? CYAN : 'rgba(255,255,255,0.2)',
                      backgroundColor: isSelected ? 'rgba(0, 217, 184, 0.15)' : 'transparent',
                    }}
                  >
                    {isSelected && (
                      <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                        <path d="M1 3L3 5L7 1" stroke={CYAN} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  <span className="truncate">{fmt(opt)}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}


function App() {
  const [sideNavOpen, setSideNavOpen] = useState(true)

  // Page-level filter state
  const [context, setContext] = useState('market')
  const [period, setPeriod] = useState('90d')
  const [selectedMonths, setSelectedMonths] = useState([])
  const [selectedProducts, setSelectedProducts] = useState([])
  const [selectedSectors, setSelectedSectors] = useState([])
  const [selectedRegions, setSelectedRegions] = useState([])
  const [selectedSeniorities, setSelectedSeniorities] = useState([])
  const [includeUnknown, setIncludeUnknown] = useState(false)

  function handlePeriodClick(key) {
    setPeriod(key)
    setSelectedMonths([])
  }

  function handleToggleMonth(monthKey) {
    setSelectedMonths(prev => {
      const next = prev.includes(monthKey)
        ? prev.filter(m => m !== monthKey)
        : [...prev, monthKey]
      return next
    })
    setPeriod(null)
  }

  function handleClearMonths() {
    setSelectedMonths([])
    setPeriod('90d')
  }

  function toggleInList(setter) {
    return (val) => setter(prev =>
      prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]
    )
  }

  const CLIENT_ID = import.meta.env.VITE_GLIMPSE_CLIENT_ID || 'Client 1'

  const filters = useMemo(() => ({
    products: selectedProducts,
    sectors: selectedSectors,
    regions: selectedRegions,
    seniorities: selectedSeniorities,
    includeUnknown,
    _clientId: CLIENT_ID,
  }), [selectedProducts, selectedSectors, selectedRegions, selectedSeniorities, includeUnknown])

  // Compute dates synchronously from period or selected months
  const { dateFrom, dateTo } = useMemo(() => {
    if (selectedMonths.length > 0) {
      const sorted = [...selectedMonths].sort()
      const earliest = sorted[0]
      const latest = sorted[sorted.length - 1]
      const [ey, em] = earliest.split('-').map(Number)
      const [ly, lm] = latest.split('-').map(Number)
      const from = `${ey}-${String(em).padStart(2, '0')}-01`
      let toDate = new Date(ly, lm, 1)
      // In market/compare mode, cap the end date at today - 30 days
      if (context !== 'client') {
        const today = new Date()
        const marketCutoff = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30)
        const dayAfterCutoff = new Date(marketCutoff)
        dayAfterCutoff.setDate(dayAfterCutoff.getDate() + 1)
        if (toDate > dayAfterCutoff) {
          toDate = dayAfterCutoff
        }
      }
      const to = fmtDateKey(toDate)
      return { dateFrom: from, dateTo: to }
    }
    if (period) {
      const dates = getDatesForPeriod(period, context)
      return { dateFrom: dates.from, dateTo: dates.to }
    }
    // Fallback to 90d market
    const dates = getDatesForPeriod('90d', context)
    return { dateFrom: dates.from, dateTo: dates.to }
  }, [context, period, selectedMonths])

  return (
    <div className="w-full min-h-screen bg-navy-950">
      <Header onMenuClick={() => setSideNavOpen(!sideNavOpen)} context={context} />

      <div className="flex pt-16 min-h-screen">
        <SideNav isOpen={sideNavOpen} />

        <main
          className={`
            p-8 transition-all duration-300 min-w-0
            ${sideNavOpen ? 'ml-64 w-[calc(100%-16rem)]' : 'ml-16 w-[calc(100%-4rem)]'}
          `}
        >
          <div>
            {/* Stats Bar + Page-level Filters */}
            <div className="sticky top-16 z-20 -mx-8 px-8 pt-4 pb-4 mb-6 bg-navy-950 opacity-0 animate-fade-in-up">
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <StatsBar dateFrom={dateFrom} dateTo={dateTo} context={context} filters={filters} />
                </div>

                <div className="relative z-10 flex flex-col gap-2 shrink-0 pt-1">
                  {/* Row 1: Context + Date selectors */}
                  <div className="flex items-center gap-3 justify-end">
                    <div className="flex bg-navy-850 border border-subtle rounded overflow-hidden">
                      {[
                        { key: 'market', label: 'Market' },
                        { key: 'client', label: 'Client' },
                        { key: 'compare', label: 'Compare' },
                      ].map(c => (
                        <button
                          key={c.key}
                          onClick={() => setContext(c.key)}
                          className={`px-3 py-1.5 text-xs font-mono transition-colors ${
                            context === c.key
                              ? 'bg-cyan-500 text-navy-950 font-semibold'
                              : 'text-muted hover:text-secondary'
                          }`}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>

                    <div className="flex bg-navy-850 border border-subtle rounded overflow-hidden">
                      {PERIODS.map(p => (
                        <button
                          key={p.key}
                          onClick={() => handlePeriodClick(p.key)}
                          className={`px-3 py-1.5 text-xs font-mono transition-colors ${
                            period === p.key
                              ? 'bg-cyan-500 text-navy-950 font-semibold'
                              : 'text-muted hover:text-secondary'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>

                    <div className="bg-navy-850 border border-subtle rounded">
                      <MultiSelectDropdown
                        label="Months"
                        options={MONTH_OPTIONS.map(m => m.key)}
                        selected={selectedMonths}
                        onToggle={handleToggleMonth}
                        onClear={handleClearMonths}
                        renderLabel={(key) => MONTH_OPTIONS.find(m => m.key === key)?.label || key}
                      />
                    </div>
                  </div>

                  {/* Row 2: Data filters */}
                  <div className="flex items-center gap-3 justify-end">
                    <div className="bg-navy-850 border border-subtle rounded">
                      <MultiSelectDropdown
                        label="Products"
                        options={PRODUCT_OPTIONS}
                        selected={selectedProducts}
                        onToggle={toggleInList(setSelectedProducts)}
                        onClear={() => setSelectedProducts([])}
                      />
                    </div>
                    <div className="bg-navy-850 border border-subtle rounded">
                      <MultiSelectDropdown
                        label="Sectors"
                        options={SECTOR_OPTIONS}
                        selected={selectedSectors}
                        onToggle={toggleInList(setSelectedSectors)}
                        onClear={() => setSelectedSectors([])}
                      />
                    </div>
                    <div className="bg-navy-850 border border-subtle rounded">
                      <MultiSelectDropdown
                        label="Regions"
                        options={REGION_OPTIONS}
                        selected={selectedRegions}
                        onToggle={toggleInList(setSelectedRegions)}
                        onClear={() => setSelectedRegions([])}
                      />
                    </div>
                    <div className="bg-navy-850 border border-subtle rounded">
                      <MultiSelectDropdown
                        label="Seniorities"
                        options={SENIORITY_OPTIONS}
                        selected={selectedSeniorities}
                        onToggle={toggleInList(setSelectedSeniorities)}
                        onClear={() => setSelectedSeniorities([])}
                      />
                    </div>
                  </div>

                  {/* Row 3: Unknown dealers toggle */}
                  <div className="flex items-center gap-3 justify-end">
                    {!includeUnknown && (
                      <span className="text-[10px] font-mono text-muted italic">
                        Unknown dealers excluded from tables &amp; charts, included in total volumes
                      </span>
                    )}
                    <button
                      onClick={() => setIncludeUnknown(prev => !prev)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono transition-colors rounded ${
                        includeUnknown
                          ? 'bg-cyan-500 text-navy-950 font-semibold'
                          : 'bg-navy-850 border border-subtle text-muted hover:text-secondary'
                      }`}
                    >
                      <span
                        className="w-3.5 h-3.5 rounded-sm border flex items-center justify-center shrink-0"
                        style={{
                          borderColor: includeUnknown ? 'rgba(0,30,40,0.4)' : 'rgba(255,255,255,0.2)',
                          backgroundColor: includeUnknown ? 'rgba(0,30,40,0.2)' : 'transparent',
                        }}
                      >
                        {includeUnknown && (
                          <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                            <path d="M1 3L3 5L7 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </span>
                      Unknowns
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Page content via routing */}
            <Routes>
              <Route path="/" element={
                <DealerRankingsPage dateFrom={dateFrom} dateTo={dateTo} context={context} filters={filters} />
              } />
              <Route path="/market-view" element={
                <MarketViewPage dateFrom={dateFrom} dateTo={dateTo} context={context} filters={filters} />
              } />
              <Route path="/bond-view" element={<PlaceholderPage title="Bond View" />} />
              <Route path="/analytics" element={<PlaceholderPage title="Analytics" />} />
              <Route path="/reports" element={<PlaceholderPage title="Reports" />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  )
}

export default App
