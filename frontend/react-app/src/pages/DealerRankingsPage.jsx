import { useNavigate } from 'react-router-dom'
import DealerVolumeChart from '../components/DealerVolumeChart'
import WeeklyDealerVolumeChart from '../components/WeeklyDealerVolumeChart'

export default function DealerRankingsPage({ dateFrom, dateTo, context, filters }) {
  const navigate = useNavigate()

  return (
    <>
      {/* Dealer Volume Chart */}
      <div className="mb-8 opacity-0 animate-fade-in-up delay-100">
        <DealerVolumeChart dateFrom={dateFrom} dateTo={dateTo} context={context} filters={filters} />
      </div>

      {/* Weekly Dealer Volume Chart */}
      <div className="mb-8 opacity-0 animate-fade-in-up delay-200">
        <WeeklyDealerVolumeChart dateFrom={dateFrom} dateTo={dateTo} context={context} filters={filters} />
      </div>

      {/* Quick Actions */}
      <div className="opacity-0 animate-fade-in-up delay-400">
        <div className="bg-navy-900 border border-default rounded-lg p-6">
          <h3 className="text-sm font-mono font-semibold uppercase text-muted tracking-widest mb-4">
            Quick Actions
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button onClick={() => navigate('/market-view')} className="p-4 bg-navy-850 border border-subtle rounded hover:border-cyan hover-glow-cyan transition-all duration-300 group">
              <div className="text-2xl text-muted group-hover:text-cyan group-hover:scale-110 transition-all mb-2">
                <span className="material-symbols-outlined text-[28px]">monitoring</span>
              </div>
              <div className="text-sm font-display text-secondary group-hover:text-primary transition-colors">
                Market View
              </div>
            </button>
            <button onClick={() => navigate('/bond-view')} className="p-4 bg-navy-850 border border-subtle rounded hover:border-cyan hover-glow-cyan transition-all duration-300 group">
              <div className="text-2xl text-muted group-hover:text-cyan group-hover:scale-110 transition-all mb-2">
                <span className="material-symbols-outlined text-[28px]">account_balance</span>
              </div>
              <div className="text-sm font-display text-secondary group-hover:text-primary transition-colors">
                Bond View
              </div>
            </button>
            <button onClick={() => navigate('/analytics')} className="p-4 bg-navy-850 border border-subtle rounded hover:border-cyan hover-glow-cyan transition-all duration-300 group">
              <div className="text-2xl text-muted group-hover:text-cyan group-hover:scale-110 transition-all mb-2">
                <span className="material-symbols-outlined text-[28px]">analytics</span>
              </div>
              <div className="text-sm font-display text-secondary group-hover:text-primary transition-colors">
                Analytics
              </div>
            </button>
            <button onClick={() => navigate('/reports')} className="p-4 bg-navy-850 border border-subtle rounded hover:border-cyan hover-glow-cyan transition-all duration-300 group">
              <div className="text-2xl text-muted group-hover:text-cyan group-hover:scale-110 transition-all mb-2">
                <span className="material-symbols-outlined text-[28px]">summarize</span>
              </div>
              <div className="text-sm font-display text-secondary group-hover:text-primary transition-colors">
                Reports
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="mt-8 pt-6 border-t border-subtle opacity-0 animate-fade-in delay-500">
        <div className="flex items-center justify-between text-xs font-mono text-muted">
          <div className="flex items-center gap-4">
            <span>© 2024 Glimpse Analytics</span>
            <span className="hidden md:inline">•</span>
            <span className="hidden md:inline">Data provided by secure backend</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-glow-pulse"></div>
            <span className="text-cyan">LIVE</span>
          </div>
        </div>
      </div>
    </>
  )
}
