import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

function SideNav({ isOpen }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [time, setTime] = useState(() => new Date().toLocaleTimeString('en-GB'))

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date().toLocaleTimeString('en-GB'))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const navItems = [
    { id: 'dashboard', label: 'Dealer Rankings', icon: 'leaderboard', path: '/', badge: null },
    { id: 'market-view', label: 'Market View', icon: 'monitoring', path: '/market-view', badge: null },
    { id: 'bond-view', label: 'Bond View', icon: 'account_balance', path: '/bond-view', badge: null },
    { id: 'analytics', label: 'Analytics', icon: 'analytics', path: '/analytics', badge: null },
    { id: 'reports', label: 'Reports', icon: 'summarize', path: '/reports', badge: '3' }
  ]

  const activeItem = navItems.find(item => {
    if (item.path === '/') return location.pathname === '/'
    return location.pathname.startsWith(item.path)
  })?.id || 'dashboard'

  return (
    <aside
      className={`
        fixed top-16 left-0 bottom-0
        bg-navy-900 border-r border-default
        transition-all duration-300 ease-out
        overflow-hidden
        ${isOpen ? 'w-64' : 'w-16'}
      `}
    >
      {/* Scanline effect */}
      <div className="scanline-container absolute inset-0 pointer-events-none"></div>

      <nav className="relative z-10 py-6 h-full overflow-y-auto">
        {/* Session Info - only show when expanded */}
        {isOpen && (
          <div className="px-5 mb-6 pb-6 border-b border-subtle">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono text-muted uppercase tracking-wider whitespace-nowrap">Session</span>
              <span className="text-xs font-mono text-cyan whitespace-nowrap">{time}</span>
            </div>
          </div>
        )}

        {/* Main Menu */}
        <div className="mb-8">
          {isOpen && (
            <h3 className="px-5 mb-3 text-xs font-mono font-semibold uppercase text-muted tracking-widest whitespace-nowrap">
              Navigation
            </h3>
          )}
          <ul className="space-y-1">
            {navItems.map((item, index) => {
              const isActive = activeItem === item.id
              return (
                <li key={item.id} className="opacity-0 animate-fade-in-up" style={{ animationDelay: `${index * 50}ms` }}>
                  <button
                    onClick={() => navigate(item.path)}
                    title={!isOpen ? item.label : undefined}
                    className={`
                      group w-full flex items-center py-3 relative
                      text-sm font-display
                      border-l-2 transition-all duration-300
                      ${isOpen ? 'gap-3 px-5' : 'justify-center px-0'}
                      ${isActive
                        ? 'border-cyan bg-navy-850 text-primary glow-cyan'
                        : 'border-transparent text-secondary hover:border-cyan hover:bg-navy-850/50 hover:text-primary hover-glow-cyan'
                      }
                    `}
                  >
                    <span className={`
                      material-symbols-outlined text-[20px] transition-all duration-300
                      ${isActive ? 'text-cyan scale-110' : 'text-muted group-hover:text-cyan group-hover:scale-110'}
                    `}>
                      {item.icon}
                    </span>
                    {isOpen && (
                      <>
                        <span className="flex-1 text-left whitespace-nowrap">{item.label}</span>
                        {item.badge && (
                          <span className={`
                            px-1.5 py-0.5 text-[10px] font-mono font-bold rounded
                            ${item.badge === 'NEW'
                              ? 'bg-cyan-500 text-navy-950 glow-cyan'
                              : 'bg-navy-800 text-muted border border-subtle'
                            }
                          `}>
                            {item.badge}
                          </span>
                        )}
                      </>
                    )}
                    {!isOpen && item.badge && (
                      <span className="absolute top-2 right-2 w-2 h-2 bg-cyan-500 rounded-full"></span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>

        {/* Quick Stats - only show when expanded */}
        {isOpen && (
          <div className="px-5 mb-6">
            <h3 className="mb-3 text-xs font-mono font-semibold uppercase text-muted tracking-widest">
              System Status
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 bg-navy-850 border border-subtle rounded">
                <span className="text-xs font-mono text-muted">API</span>
                <div className="flex items-center gap-1.5">
                  <div className="w-1 h-1 bg-cyan-500 rounded-full animate-glow-pulse"></div>
                  <span className="text-xs font-mono text-cyan">OK</span>
                </div>
              </div>
              <div className="flex items-center justify-between p-2 bg-navy-850 border border-subtle rounded">
                <span className="text-xs font-mono text-muted">Updates</span>
                <span className="text-xs font-mono text-secondary">T-1</span>
              </div>
            </div>
          </div>
        )}
      </nav>
    </aside>
  )
}

export default SideNav
