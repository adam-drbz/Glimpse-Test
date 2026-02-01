function GalleryItem({ image, index, onClick }) {
  return (
    <div 
      className="gallery-item" 
      data-category={image.category}
      style={{ animationDelay: `${index * 0.1}s` }}
      onClick={() => onClick(index)}
    >
      <div className="image-wrapper">
        <img src={image.src} alt={image.alt} loading="lazy" />
        <div className="image-overlay">
          <span className="image-title">{image.title}</span>
          <span className="image-year">{image.year}</span>
        </div>
      </div>
    </div>
  );
}

export default GalleryItem;
