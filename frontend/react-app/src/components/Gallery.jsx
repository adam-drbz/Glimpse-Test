import { useEffect, useState } from 'react';
import GalleryItem from './GalleryItem';

function Gallery({ category, onImageClick }) {
  const [images] = useState([
    {
      src: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80',
      alt: 'Mountain landscape',
      title: 'Mountain Solitude',
      year: '2024',
      category: 'landscapes'
    },
    {
      src: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&q=80',
      alt: 'Forest path',
      title: 'Forest Dreams',
      year: '2024',
      category: 'landscapes'
    },
    {
      src: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80',
      alt: 'Coastal view',
      title: 'Coastal Harmony',
      year: '2023',
      category: 'landscapes'
    },
    {
      src: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800&q=80',
      alt: 'Portrait',
      title: 'Natural Light',
      year: '2024',
      category: 'portraits'
    },
    {
      src: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80',
      alt: 'Portrait',
      title: 'Urban Portrait',
      year: '2023',
      category: 'portraits'
    },
    {
      src: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800&q=80',
      alt: 'City architecture',
      title: 'Glass & Steel',
      year: '2024',
      category: 'urban'
    },
    {
      src: 'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=800&q=80',
      alt: 'City street',
      title: 'Night Streets',
      year: '2023',
      category: 'urban'
    },
    {
      src: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?w=800&q=80',
      alt: 'Urban scene',
      title: 'Concrete Jungle',
      year: '2024',
      category: 'urban'
    },
    {
      src: 'https://images.unsplash.com/photo-1557672172-298e090bd0f1?w=800&q=80',
      alt: 'Abstract',
      title: 'Color Study',
      year: '2024',
      category: 'abstract'
    },
    {
      src: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=800&q=80',
      alt: 'Abstract pattern',
      title: 'Architectural Forms',
      year: '2023',
      category: 'abstract'
    },
    {
      src: 'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=800&q=80',
      alt: 'Desert landscape',
      title: 'Desert Silence',
      year: '2024',
      category: 'landscapes'
    },
    {
      src: 'https://images.unsplash.com/photo-1550859492-d5da9d8e45f3?w=800&q=80',
      alt: 'Abstract texture',
      title: 'Textural Depths',
      year: '2023',
      category: 'abstract'
    }
  ]);

  const filteredImages = category === 'all' 
    ? images 
    : images.filter(img => img.category === category);

  const handleImageClick = (index) => {
    const visibleIndex = filteredImages.findIndex((_, i) => i === index);
    onImageClick(visibleIndex, filteredImages);
  };

  return (
    <main className="main">
      <div className="gallery">
        {filteredImages.map((image, index) => (
          <GalleryItem
            key={`${image.category}-${index}`}
            image={image}
            index={index}
            onClick={() => handleImageClick(index)}
          />
        ))}
      </div>
    </main>
  );
}

export default Gallery;
