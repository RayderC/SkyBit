'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

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

function LazyThumb({ src, alt }: { src: string; alt: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
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

export default function GalleryView({ files, imageFiles, selected, selectionMode, folder, onToggleSelect, onOpenImage }: Props) {
  const router = useRouter();

  function handleClick(file: FileEntry) {
    if (selectionMode) {
      onToggleSelect(file.path);
      return;
    }
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
    <div className="gallery-grid">
      {files.map((file) => {
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
              <LazyThumb
                src={`/api/files/thumb?path=${encodeURIComponent(file.path)}`}
                alt={file.name}
              />
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
  );
}
