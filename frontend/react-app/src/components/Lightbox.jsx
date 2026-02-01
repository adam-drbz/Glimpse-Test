import { useEffect } from 'react';

function Lightbox({ isActive, currentImage, onClose, onPrev, onNext }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isActive) return;
      
      switch(e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          onPrev();
          break;
        case 'ArrowRight':
          onNext();
          break;
        default:
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    
    if (isActive) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isActive, onClose, onPrev, onNext]);

  const handleBackgroundClick = (e) => {
    if (e.target.classList.contains('lightbox')) {
      onClose();
    }
  };

  if (!currentImage) return null;

  return (
    <div 
      className={`lightbox ${isActive ? 'active' : ''}`}
      onClick={handleBackgroundClick}
    >
      <button className="lightbox-close" onClick={onClose}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
      <div className="lightbox-content">
        <img src={currentImage.src} alt={currentImage.alt} />
        <div className="lightbox-info">
          <h2>{currentImage.title}</h2>
          <span>{currentImage.year}</span>
        </div>
      </div>
      <button className="lightbox-nav lightbox-prev" onClick={onPrev}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      </button>
      <button className="lightbox-nav lightbox-next" onClick={onNext}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      </button>
    </div>
  );
}

export default Lightbox;
