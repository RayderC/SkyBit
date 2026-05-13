'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import DeleteModal from './DeleteModal';

interface Props {
  images: { name: string; path: string }[];
  initialIndex: number;
  folder: string;
  onClose: () => void;
  onDeleted: (path: string) => void;
}

export default function Lightbox({ images, initialIndex, folder, onClose, onDeleted }: Props) {
  const [index, setIndex] = useState(initialIndex);
  const [showDelete, setShowDelete] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const current = images[index];
  const imgUrl = `/api/files/download?path=${encodeURIComponent(current.path)}`;

  const prev = useCallback(() => setIndex(i => (i > 0 ? i - 1 : images.length - 1)), [images.length]);
  const next = useCallback(() => setIndex(i => (i < images.length - 1 ? i + 1 : 0)), [images.length]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    }
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose, prev, next]);

  async function handleDelete() {
    const path = current.path;
    await fetch('/api/files/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });
    onDeleted(path);
    if (images.length <= 1) { onClose(); return; }
    setIndex(i => Math.min(i, images.length - 2));
    setShowDelete(false);
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }
  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (delta < -50) next();
    if (delta > 50) prev();
    touchStartX.current = null;
  }

  return (
    <>
      <div
        className="lightbox-overlay"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Header */}
        <div className="lightbox-header">
          <span className="lightbox-filename">{current.name}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <a
              href={imgUrl}
              download={current.name}
              className="btn btn-secondary btn-sm"
              onClick={e => e.stopPropagation()}
            >
              Download
            </a>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
          </div>
        </div>

        {/* Image area */}
        <div className="lightbox-body">
          {images.length > 1 && (
            <button className="lightbox-arrow left" onClick={prev} aria-label="Previous">‹</button>
          )}

          <img
            key={current.path}
            src={imgUrl}
            alt={current.name}
            className="lightbox-img"
            draggable={false}
          />

          {images.length > 1 && (
            <button className="lightbox-arrow right" onClick={next} aria-label="Next">›</button>
          )}

          {images.length > 1 && (
            <div className="lightbox-counter">
              {index + 1} / {images.length}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="lightbox-footer">
          <button className="btn btn-danger btn-sm" onClick={() => setShowDelete(true)}>
            Delete
          </button>
        </div>
      </div>

      {showDelete && (
        <DeleteModal
          items={[current.path]}
          onConfirm={handleDelete}
          onCancel={() => setShowDelete(false)}
        />
      )}
    </>
  );
}
