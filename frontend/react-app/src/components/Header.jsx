function Header({ activeCategory, onCategoryChange }) {
  const categories = [
    { id: 'all', label: 'All Works' },
    { id: 'landscapes', label: 'Landscapes' },
    { id: 'portraits', label: 'Portraits' },
    { id: 'urban', label: 'Urban' },
    { id: 'abstract', label: 'Abstract' }
  ];

  return (
    <header className="header">
      <div className="header-content">
        <h1 className="site-title">Photography Collections</h1>
        <nav className="nav">
          {categories.map(category => (
            <button
              key={category.id}
              className={`nav-btn ${activeCategory === category.id ? 'active' : ''}`}
              onClick={() => onCategoryChange(category.id)}
            >
              {category.label}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}

export default Header;
