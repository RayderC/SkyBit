'use client';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DeleteModal from './DeleteModal';

interface FileEntry {
  name: string;
  isDir: boolean;
  type: string;
  size: number | null;
  sizeFormatted: string | null;
  modified: string;
  path: string;
}

interface Props {
  file: FileEntry;
  folder: string;
  role: string;
  selectionMode: boolean;
  selected: boolean;
  onToggleSelect: (path: string) => void;
  onDeleted: (path: string) => void;
  onOpenMoveModal: (path: string) => void;
  onOpenCopyModal: (path: string) => void;
  onOpenShareModal: (path: string) => void;
  onOpenImage?: (path: string) => void;
}

// Encode each path segment so special chars like # don't become URL hashes
function encodePath(p: string): string {
  return p.split('/').map(s => encodeURIComponent(s)).join('/');
}

const S = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '1.5', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

function FileIconSvg({ type }: { type: string }) {
  switch (type) {
    case 'folder':
      return <svg {...S}><path d="M3 7c0-1.1.9-2 2-2h3.17a2 2 0 011.42.59l.82.82A2 2 0 0011.83 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/></svg>;
    case 'image':
      return <svg {...S}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>;
    case 'video':
      return <svg {...S}><rect x="2" y="6" width="14" height="12" rx="2"/><polyline points="22 8 16 12 22 16 22 8"/></svg>;
    case 'audio':
      return <svg {...S}><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>;
    case 'text':
      return <svg {...S}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>;
    case 'pdf':
      return <svg {...S}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="12" y2="17"/><line x1="15" y1="17" x2="15" y2="17"/></svg>;
    case 'archive':
      return <svg {...S}><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>;
    default:
      return <svg {...S}><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>;
  }
}

export default function FileItem({
  file, folder, role, selectionMode, selected, onToggleSelect, onDeleted,
  onOpenMoveModal, onOpenCopyModal, onOpenShareModal, onOpenImage,
}: Props) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [renameMode, setRenameMode] = useState(false);
  const [newName, setNewName] = useState(file.name);
  const [showDelete, setShowDelete] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function close(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  function handleClick() {
    if (selectionMode) { onToggleSelect(file.path); return; }
    if (file.isDir) {
      router.push(`/${encodePath(file.path)}`);
    } else if (file.type === 'image' && onOpenImage) {
      onOpenImage(file.path);
    } else {
      router.push(`/preview/${encodePath(file.path)}`);
    }
  }

  async function handleRename(e: React.FormEvent) {
    e.preventDefault();
    if (newName === file.name) { setRenameMode(false); return; }
    const res = await fetch('/api/files/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: file.path, newName }),
    });
    if (res.ok) router.refresh();
    setRenameMode(false);
  }

  async function handleDelete() {
    await fetch('/api/files/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: file.path }),
    });
    onDeleted(file.path);
  }

  const iconClass = `file-icon ${file.isDir ? 'folder' : file.type}`;
  const canWrite = ['admin', 'mod'].includes(role);

  return (
    <>
      <li
        className={`file-item ${selected ? 'selected' : ''} ${menuOpen ? 'menu-open' : ''}`}
        onClick={handleClick}
        style={{ cursor: 'pointer' }}
      >
        {selectionMode && (
          <input
            type="checkbox"
            className="file-checkbox"
            checked={selected}
            onChange={() => onToggleSelect(file.path)}
            onClick={e => e.stopPropagation()}
          />
        )}

        <span className={iconClass}><FileIconSvg type={file.isDir ? 'folder' : file.type} /></span>

        {renameMode ? (
          <form onSubmit={handleRename} onClick={e => e.stopPropagation()} style={{ flex: 1, display: 'flex', gap: 6 }}>
            <input
              className="form-input"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              autoFocus
              style={{ flex: 1, height: 32, padding: '4px 10px', fontSize: '0.875rem' }}
            />
            <button type="submit" className="btn btn-primary btn-sm">Save</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setRenameMode(false); setNewName(file.name); }}>✕</button>
          </form>
        ) : (
          <span className="file-name">
            {file.name}{file.isDir ? '/' : ''}
          </span>
        )}

        <div className="file-meta">
          {file.sizeFormatted && <span>{file.sizeFormatted}</span>}
          {file.modified && (
            <span>{new Date(file.modified).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          )}
        </div>

        {!selectionMode && (
          <div ref={menuRef} style={{ position: 'relative', flexShrink: 0 }}>
            <button
              className="file-menu-btn"
              onClick={e => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
              aria-label="More options"
            >
              ⋮
            </button>
            {menuOpen && (
              <div className="file-dropdown" onClick={e => e.stopPropagation()}>
                {canWrite && (
                  <>
                    <button onClick={() => { setMenuOpen(false); setRenameMode(true); }}>✏️ Rename</button>
                    <button onClick={() => { setMenuOpen(false); onOpenMoveModal(file.path); }}>📂 Move</button>
                    <button onClick={() => { setMenuOpen(false); onOpenCopyModal(file.path); }}>📋 Copy</button>
                  </>
                )}
                <a
                  href={`/api/files/download?path=${encodeURIComponent(file.path)}`}
                  download={file.name}
                  onClick={() => setMenuOpen(false)}
                >
                  ⬇️ Download
                </a>
                {canWrite && (
                  <button onClick={() => { setMenuOpen(false); onOpenShareModal(file.path); }}>
                    🔗 Temp Share
                  </button>
                )}
                {canWrite && (
                  <>
                    <div className="file-dropdown-sep" />
                    <button className="danger" onClick={() => { setMenuOpen(false); setShowDelete(true); }}>
                      🗑 Delete
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </li>

      {showDelete && (
        <DeleteModal
          items={[file.path]}
          onConfirm={handleDelete}
          onCancel={() => setShowDelete(false)}
        />
      )}
    </>
  );
}
