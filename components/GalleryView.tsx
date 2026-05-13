'use client';

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

export default function GalleryView({ images, selected, selectionMode, onToggleSelect, onOpen }: Props) {
  return (
    <div className="gallery-grid">
      {images.map((img, i) => {
        const imgUrl = `/api/files/download?path=${encodeURIComponent(img.path)}`;
        const isSelected = selected.has(img.path);
        return (
          <div
            key={img.path}
            className={`gallery-item ${isSelected ? 'selected' : ''}`}
            onClick={() => {
              if (selectionMode) {
                onToggleSelect(img.path);
              } else {
                onOpen(i);
              }
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
            <img
              src={imgUrl}
              alt={img.name}
              loading="lazy"
            />
            <div className="gallery-item-name">{img.name}</div>
          </div>
        );
      })}
    </div>
  );
}
