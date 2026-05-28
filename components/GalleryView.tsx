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

// Min tile width + gap — drives column count calculation
const TILE_MIN = 172; // 160px + 12px gap

export default function GalleryView({
  files, imageFiles, selected, selectionMode, folder, onToggleSelect, onOpenImage,
}: Props) {
  const router = useRouter();
  const gridRef = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(4);

  // Track container width → column count
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const calc = () => setCols(Math.max(1, Math.floor((el.getBoundingClientRect().width + 12) / TILE_MIN)));
    calc();
    const ro = new ResizeObserver(calc);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Group flat list into rows
  const rows = useMemo(() => {
    const result: FileEntry[][] = [];
    for (let i = 0; i < files.length; i += cols) {
      result.push(files.slice(i, i + cols));
    }
    return result;
  }, [files, cols]);

  const virtualizer = useWindowVirtualizer({
    count: rows.length,
    // Conservative over-estimate — measureElement corrects it after first render
    estimateSize: () => 240,
    overscan: 3,
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
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map(vRow => (
          <div
            key={vRow.key}
            // measureElement reads the actual rendered height of each row so
            // the virtualizer self-corrects after the first paint — no more overlap
            ref={virtualizer.measureElement}
            data-index={vRow.index}
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
