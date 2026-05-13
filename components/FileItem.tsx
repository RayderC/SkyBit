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
}

const ICONS: Record<string, string> = {
  folder: '📁', image: '🖼', video: '🎬', audio: '🎵', text: '📄', archive: '📦', other: '📄',
};

export default function FileItem({
  file, folder, role, selectionMode, selected, onToggleSelect, onDeleted, onOpenMoveModal, onOpenCopyModal, onOpenShareModal,
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

  function handleClick(e: React.MouseEvent) {
    if (selectionMode) { onToggleSelect(file.path); return; }
    if (file.isDir) {
      router.push(`/${file.path}`);
    } else {
      router.push(`/preview/${file.path}`);
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

  const iconClass = `file-icon ${file.type}`;
  const canWrite = ['admin', 'mod'].includes(role);

  return (
    <>
      <li
        className={`file-item ${selected ? 'selected' : ''}`}
        onClick={handleClick}
        style={{ cursor: selectionMode ? 'pointer' : 'pointer' }}
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

        <span className={iconClass}>{ICONS[file.type] || '📄'}</span>

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
                    <button onClick={() => { setMenuOpen(false); setRenameMode(true); }}>
                      ✏️ Rename
                    </button>
                    <button onClick={() => { setMenuOpen(false); onOpenMoveModal(file.path); }}>
                      📂 Move
                    </button>
                    <button onClick={() => { setMenuOpen(false); onOpenCopyModal(file.path); }}>
                      📋 Copy
                    </button>
                  </>
                )}
                <a href={`/api/files/download?path=${encodeURIComponent(file.path)}`} download={file.name}
                   onClick={() => setMenuOpen(false)}>
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
