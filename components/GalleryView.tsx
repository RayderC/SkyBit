'use client';
import { useEffect, useRef, useState } from 'react';

interface FileEntry {
  name: string;
  path: string;
}

interface Props {
  images: FileEntry[];
  selected: Set<string>;
  selectionMode: boolean;
  onToggleSelect: (path: string) => void;
  onOpen: (index: number) => void;
}

function LazyThumb({ src, alt }: { src: string; alt: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    // Only request the image when it enters the viewport (+300px margin)
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { rootMargin: '300px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={wrapRef} className="gallery-thumb-wrap">
      {visible && <img src={src} alt={alt} />}
    </div>
  );
}

export default function GalleryView({ images, selected, selectionMode, onToggleSelect, onOpen }: Props) {
  return (
    <div className="gallery-grid">
      {images.map((img, i) => {
        const thumbUrl = `/api/files/thumb?path=${encodeURIComponent(img.path)}`;
        const isSelected = selected.has(img.path);
        return (
          <div
            key={img.path}
            className={`gallery-item ${isSelected ? 'selected' : ''}`}
            onClick={() => {
              if (selectionMode) onToggleSelect(img.path);
              else onOpen(i);
            }}
          >
            {selectionMode && (
              <input
                type="checkbox"
                className="gallery-item-checkbox"
                checked={isSelected}
                onChange={() => onToggleSelect(img.path)}
                onClick={e => e.stopPropagation()}
              />
            )}
            <LazyThumb src={thumbUrl} alt={img.name} />
            <div className="gallery-item-name">{img.name}</div>
          </div>
        );
      })}
    </div>
  );
}
