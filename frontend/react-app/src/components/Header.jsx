import glimpseLogo from '../assets/glimpse-logo_white.svg'

function Header({ onMenuClick }) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-navy-900 border-b border-default scanline-container">
      <div className="flex items-center justify-between h-full px-6">
        {/* Menu Button */}
        <button
          className="p-2 rounded border border-transparent hover:border-cyan hover-glow-cyan transition-all duration-300 text-primary group"
          onClick={onMenuClick}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="group-hover:text-cyan transition-colors"
          >
            <line x1="2" y1="10" x2="18" y2="10" />
            <line x1="2" y1="5" x2="18" y2="5" />
            <line x1="2" y1="15" x2="18" y2="15" />
          </svg>
        </button>

        {/* Logo */}
        <div className="flex items-center ml-6 flex-1">
          <img src={glimpseLogo} alt="Glimpse" className="h-8" />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          {/* Status Indicator */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-navy-850 border border-subtle rounded text-xs font-mono">
            <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-glow-pulse"></div>
            <span className="text-muted">LIVE</span>
          </div>

          {/* Export Button */}
          <button className="px-4 py-2 rounded border border-default text-sm font-medium text-secondary hover:text-primary hover:border-cyan hover-glow-cyan transition-all duration-300 font-display">
            Export
          </button>

          {/* Primary CTA */}
          <button className="px-4 py-2 rounded bg-cyan-500 text-navy-950 border border-cyan-500 text-sm font-semibold hover:bg-cyan-400 hover:border-cyan-400 glow-cyan hover-glow-cyan-strong transition-all duration-300 font-display">
            New Analysis
          </button>
        </div>
      </div>
    </header>
  )
}

export default Header
