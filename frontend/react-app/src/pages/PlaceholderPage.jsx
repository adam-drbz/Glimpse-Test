export default function PlaceholderPage({ title }) {
  return (
    <div className="flex items-center justify-center h-96 opacity-0 animate-fade-in-up">
      <div className="text-center">
        <span className="material-symbols-outlined text-4xl text-muted mb-4 block">construction</span>
        <h2 className="text-lg font-display text-primary mb-2">{title}</h2>
        <p className="text-sm font-mono text-muted">Coming soon</p>
      </div>
    </div>
  )
}
