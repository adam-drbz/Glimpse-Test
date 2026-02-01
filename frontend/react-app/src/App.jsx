import { useState } from 'react';
import Header from './components/Header';
import Gallery from './components/Gallery';
import Lightbox from './components/Lightbox';
import Footer from './components/Footer';
import './App.css';

function App() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [lightboxActive, setLightboxActive] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [visibleImages, setVisibleImages] = useState([]);

  const handleCategoryChange = (category) => {
    setActiveCategory(category);
  };

  const handleImageClick = (index, images) => {
    setCurrentImageIndex(index);
    setVisibleImages(images);
    setLightboxActive(true);
  };

  const closeLightbox = () => {
    setLightboxActive(false);
  };

  const showPrevImage = () => {
    setCurrentImageIndex((prevIndex) => 
      (prevIndex - 1 + visibleImages.length) % visibleImages.length
    );
  };

  const showNextImage = () => {
    setCurrentImageIndex((prevIndex) => 
      (prevIndex + 1) % visibleImages.length
    );
  };

  return (
    <>
      <div className="grain-overlay"></div>
      <Header 
        activeCategory={activeCategory} 
        onCategoryChange={handleCategoryChange} 
      />
      <Gallery 
        category={activeCategory} 
        onImageClick={handleImageClick}
      />
      <Lightbox
        isActive={lightboxActive}
        currentImage={visibleImages[currentImageIndex]}
        onClose={closeLightbox}
        onPrev={showPrevImage}
        onNext={showNextImage}
      />
      <Footer />
    </>
  );
}

export default App;
