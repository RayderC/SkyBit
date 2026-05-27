'use client';
import { useEffect, useRef, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useWindowVirtualizer } from '@tanstack/react-virtual';

interface FileEntry {
  name: string;
  path: string;
  isDir: boolean;
  type: string;
}

interface Props {
  files: FileEntry[];
  imageFiles: FileEntry[];
  selected: Set<string>;
  selectionMode: boolean;
  folder: string;
  onToggleSelect: (path: string) => void;
  onOpenImage: (index: number) => void;
}

const TYPE_ICONS: Record<string, string> = {
  folder: '📁',
  video: '🎬',
  audio: '🎵',
  text: '📄',
  pdf: '📋',
  archive: '🗜',
  other: '📎',
};

// Fixed item dimensions — must match CSS
const ITEM_WIDTH = 172;  // 160px tile + 12px gap
const ITEM_HEIGHT = 204; // 160px square + 32px name label + 12px gap

export default function GalleryView({
  files, imageFiles, selected, selectionMode, folder, onToggleSelect, onOpenImage,
}: Props) {
  const router = useRouter();
  const gridRef = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(4);

  // Track container width to calculate column count
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const calc = () => {
      const w = el.getBoundingClientRect().width;
      setCols(Math.max(1, Math.floor((w + 12) / ITEM_WIDTH)));
    };
    calc();
    const ro = new ResizeObserver(calc);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Group flat file list into rows for the virtualizer
  const rows = useMemo(() => {
    const result: FileEntry[][] = [];
    for (let i = 0; i < files.length; i += cols) {
      result.push(files.slice(i, i + cols));
    }
    return result;
  }, [files, cols]);

  const virtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: () => ITEM_HEIGHT,
    overscan: 3,
    // offset from top of page to the grid container
    scrollMargin: gridRef.current?.offsetTop ?? 0,
  });

  function handleClick(file: FileEntry) {
    if (selectionMode) { onToggleSelect(file.path); return; }
    if (file.isDir) {
      const encoded = file.path.split('/').map(s => encodeURIComponent(s)).join('/');
      router.push(`/${encoded}`);
    } else if (file.type === 'image') {
      const idx = imageFiles.findIndex(f => f.path === file.path);
      if (idx >= 0) onOpenImage(idx);
    } else {
      const encoded = file.path.split('/').map(s => encodeURIComponent(s)).join('/');
      router.push(`/preview/${encoded}`);
    }
  }

  return (
    <div ref={gridRef}>
      {/* Outer div sized to the full virtual height so the scrollbar is accurate */}
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map(vRow => (
          <div
            key={vRow.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              transform: `translateY(${vRow.start - virtualizer.options.scrollMargin}px)`,
              display: 'grid',
              gridTemplateColumns: `repeat(${cols}, 1fr)`,
              gap: '12px',
              paddingBottom: '12px',
            }}
          >
            {rows[vRow.index].map(file => {
              const isSelected = selected.has(file.path);
              const icon = TYPE_ICONS[file.isDir ? 'folder' : file.type] ?? '📎';

              return (
                <div
                  key={file.path}
                  className={`gallery-item${isSelected ? ' selected' : ''}${file.isDir ? ' gallery-item-folder' : ''}`}
                  onClick={() => handleClick(file)}
                >
                  {selectionMode && (
                    <input
                      type="checkbox"
                      className="gallery-item-checkbox"
                      checked={isSelected}
                      onChange={() => onToggleSelect(file.path)}
                      onClick={e => e.stopPropagation()}
                    />
                  )}

                  {file.type === 'image' && !file.isDir ? (
                    <div className="gallery-thumb-wrap">
                      {/* loading="lazy" lets the browser natively throttle image fetches */}
                      <img
                        src={`/api/files/thumb?path=${encodeURIComponent(file.path)}`}
                        alt={file.name}
                        loading="lazy"
                        decoding="async"
                      />
                    </div>
                  ) : (
                    <div className="gallery-thumb-wrap gallery-icon-wrap">
                      <span className="gallery-file-icon">{icon}</span>
                    </div>
                  )}

                  <div className="gallery-item-name">{file.name}</div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
