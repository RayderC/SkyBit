'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import FileItem from './FileItem';
import GalleryView from './GalleryView';
import Lightbox from './Lightbox';
import SelectionBar from './SelectionBar';
import DeleteModal from './DeleteModal';
import FolderTreePicker from './FolderTreePicker';
import { useUpload } from './UploadManager';

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
  folder: string;
}

export default function FileBrowser({ folder }: Props) {
  const router = useRouter();
  const { addFiles } = useUpload();

  const [files, setFiles] = useState<FileEntry[]>([]);
  const [role, setRole] = useState('user');
  const [isImageFolder, setIsImageFolder] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  // View mode
  const [viewMode, setViewMode] = useState<'list' | 'gallery'>('list');

  // Selection
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Modals
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [moveTarget, setMoveTarget] = useState<string | null>(null);    // single file move
  const [copyTarget, setCopyTarget] = useState<string | null>(null);    // single file copy
  const [bulkMove, setBulkMove] = useState(false);
  const [bulkCopy, setBulkCopy] = useState(false);
  const [shareTarget, setShareTarget] = useState<string | null>(null);
  const [shareExpiry, setShareExpiry] = useState(60);
  const [shareLink, setShareLink] = useState('');

  // Drag-drop
  const dropRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const canWrite = ['admin', 'mod'].includes(role);

  // Build breadcrumb
  const breadcrumbs = folder
    ? folder.split('/').reduce<{ label: string; path: string }[]>((acc, part, i, arr) => {
        acc.push({ label: part, path: arr.slice(0, i + 1).join('/') });
        return acc;
      }, [])
    : [];

  function loadFiles() {
    setLoading(true);
    Promise.all([
      fetch(`/api/files/list?folder=${encodeURIComponent(folder)}`).then(r => {
        if (r.status === 401) throw new Error('Not authenticated');
        if (!r.ok) throw new Error(`Failed to load folder (${r.status})`);
        return r.json();
      }),
    ]).then(([data]) => {
      const entries: FileEntry[] = data.files.map((f: Omit<FileEntry, 'path'>) => ({
        ...f,
        path: folder ? `${folder}/${f.name}` : f.name,
      }));
      setFiles(entries);
      setRole(data.role);
      setIsImageFolder(data.isImageFolder);
      setViewMode(data.isImageFolder ? 'gallery' : 'list');
      setLoading(false);
    }).catch((e: Error) => {
      if (e.message === 'Not authenticated') {
        router.push('/login');
      } else {
        setError(e.message);
        setLoading(false);
      }
    });
  }

  useEffect(() => {
    setSearch('');
    setSelectionMode(false);
    setSelected(new Set());
    loadFiles();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folder]);

  // Filtered files
  const filtered = search
    ? files.filter(f => f.name.toLowerCase().includes(search.toLowerCase()))
    : files;

  const imageFiles = filtered.filter(f => f.type === 'image');

  // Toggle select
  const toggleSelect = useCallback((path: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  function exitSelection() {
    setSelectionMode(false);
    setSelected(new Set());
  }

  // Bulk delete
  async function handleBulkDelete() {
    await fetch('/api/files/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths: [...selected] }),
    });
    setShowBulkDelete(false);
    exitSelection();
    loadFiles();
  }

  // Single move/copy
  async function handleMove(dest: string) {
    const paths = moveTarget ? [moveTarget] : [...selected];
    await fetch('/api/files/bulk-move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths, dest }),
    });
    setMoveTarget(null);
    setBulkMove(false);
    exitSelection();
    loadFiles();
  }

  async function handleCopy(dest: string) {
    const paths = copyTarget ? [copyTarget] : [...selected];
    await fetch('/api/files/bulk-copy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths, dest }),
    });
    setCopyTarget(null);
    setBulkCopy(false);
    exitSelection();
    loadFiles();
  }

  // Share
  async function handleShare() {
    const res = await fetch('/api/temp-shares/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: shareTarget, expiresIn: shareExpiry }),
    });
    const data = await res.json();
    if (data.token) {
      const url = `${window.location.origin}/share?token=${data.token}`;
      setShareLink(url);
    }
  }

  // New folder
  const [newFolderMode, setNewFolderMode] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  async function handleNewFolder(e: React.FormEvent) {
    e.preventDefault();
    await fetch('/api/files/new-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder, name: newFolderName }),
    });
    setNewFolderMode(false);
    setNewFolderName('');
    loadFiles();
  }

  // New file
  const [newFileMode, setNewFileMode] = useState(false);
  const [newFileName, setNewFileName] = useState('');

  async function handleNewFile(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/files/new-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder, name: newFileName }),
    });
    if (res.ok) {
      const data = await res.json();
      setNewFileMode(false);
      setNewFileName('');
      loadFiles();
      const previewPath = (folder ? `${folder}/${data.name}` : data.name).split('/').map((s: string) => encodeURIComponent(s)).join('/');
      router.push(`/preview/${previewPath}`);
    }
  }

  // Drag and drop upload
  function handleDragOver(e: React.DragEvent) { e.preventDefault(); setDragging(true); }
  function handleDragLeave() { setDragging(false); }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (!canWrite) return;
    const fileList = Array.from(e.dataTransfer.files);
    if (fileList.length > 0) {
      addFiles(fileList, folder);
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', animation: 'pulse 1.2s ease-in-out infinite' }}>
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div
      className={`browser-root ${dragging ? 'drag-over' : ''}`}
      ref={dropRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Toolbar */}
      <div className="browser-toolbar">
        <div className="search-bar">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search files..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* View toggle */}
        <div className="view-toggle">
          <button
            className={`view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => setViewMode('list')}
            title="List view"
          >☰</button>
          <button
            className={`view-toggle-btn ${viewMode === 'gallery' ? 'active' : ''}`}
            onClick={() => setViewMode('gallery')}
            title="Gallery view"
          >⊞</button>
        </div>

        {/* Select toggle */}
        {canWrite && (
          <button
            className={`btn btn-sm ${selectionMode ? 'btn-secondary' : 'btn-ghost'}`}
            onClick={() => { if (selectionMode) exitSelection(); else setSelectionMode(true); }}
            style={selectionMode ? { borderColor: 'var(--primary-light)', color: 'var(--primary-light)' } : {}}
          >
            {selectionMode ? '✕ Cancel' : '☑ Select'}
          </button>
        )}

        {canWrite && (
          <>
            <button className="btn btn-ghost btn-sm" onClick={() => { setNewFolderMode(!newFolderMode); setNewFileMode(false); }}>
              📁+ Folder
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => { setNewFileMode(!newFileMode); setNewFolderMode(false); }}>
              📄+ File
            </button>
            <label className="btn btn-primary btn-sm" style={{ cursor: 'pointer' }}>
              ⬆ Upload
              <input
                type="file"
                multiple
                style={{ display: 'none' }}
                onChange={e => {
                  if (e.target.files?.length) {
                    addFiles(Array.from(e.target.files), folder);
                    e.target.value = '';
                  }
                }}
              />
            </label>
          </>
        )}
      </div>

      {/* New folder inline form */}
      {newFolderMode && (
        <form onSubmit={handleNewFolder} style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
          <input
            className="form-input"
            value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            placeholder="New folder name"
            autoFocus
            style={{ maxWidth: 260, height: 36 }}
            required
          />
          <button type="submit" className="btn btn-primary btn-sm">Create</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setNewFolderMode(false)}>Cancel</button>
        </form>
      )}

      {/* New file inline form */}
      {newFileMode && (
        <form onSubmit={handleNewFile} style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
          <input
            className="form-input"
            value={newFileName}
            onChange={e => setNewFileName(e.target.value)}
            placeholder="filename.txt"
            autoFocus
            style={{ maxWidth: 260, height: 36 }}
            required
          />
          <button type="submit" className="btn btn-primary btn-sm">Create</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setNewFileMode(false)}>Cancel</button>
        </form>
      )}

      {/* Breadcrumb */}
      <div className="breadcrumb">
        <Link href="/">Home</Link>
        {breadcrumbs.map((bc, i) => (
          <span key={bc.path} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span className="breadcrumb-sep">/</span>
            {i === breadcrumbs.length - 1
              ? <span style={{ color: 'var(--text)' }}>{bc.label}</span>
              : <Link href={`/${bc.path.split('/').map(s => encodeURIComponent(s)).join('/')}`}>{bc.label}</Link>
            }
          </span>
        ))}
      </div>

      {error && <div className="flash flash-error">{error}</div>}

      {/* Empty state */}
      {filtered.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '3rem', marginBottom: 16 }}>📂</div>
          <p style={{ fontFamily: 'var(--font-mono)' }}>
            {search ? 'No files match your search' : 'This folder is empty'}
          </p>
        </div>
      )}

      {/* File list */}
      {viewMode === 'list' && filtered.length > 0 && (
        <ul className="file-list">
          {filtered.map(file => (
            <FileItem
              key={file.path}
              file={file}
              folder={folder}
              role={role}
              selectionMode={selectionMode}
              selected={selected.has(file.path)}
              onToggleSelect={toggleSelect}
              onDeleted={(path) => { setFiles(prev => prev.filter(f => f.path !== path)); }}
              onOpenMoveModal={(path) => setMoveTarget(path)}
              onOpenCopyModal={(path) => setCopyTarget(path)}
              onOpenShareModal={(path) => { setShareTarget(path); setShareLink(''); }}
              onOpenImage={(path) => {
                const idx = imageFiles.findIndex(f => f.path === path);
                if (idx >= 0) setLightboxIndex(idx);
                else router.push(`/preview/${path.split('/').map(s => encodeURIComponent(s)).join('/')}`);
              }}
            />
          ))}
        </ul>
      )}

      {/* Gallery */}
      {viewMode === 'gallery' && imageFiles.length > 0 && (
        <GalleryView
          images={imageFiles.map(f => ({ name: f.name, path: f.path }))}
          selected={selected}
          selectionMode={selectionMode}
          onToggleSelect={toggleSelect}
          onOpen={(i) => setLightboxIndex(i)}
        />
      )}
      {viewMode === 'gallery' && imageFiles.length === 0 && filtered.length > 0 && (
        <p style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textAlign: 'center', padding: 32 }}>
          No images in this folder. Switch to list view to see all files.
        </p>
      )}

      {/* Selection bar */}
      {selectionMode && (
        <SelectionBar
          count={selected.size}
          onDelete={() => setShowBulkDelete(true)}
          onMove={() => setBulkMove(true)}
          onCopy={() => setBulkCopy(true)}
          onCancel={exitSelection}
        />
      )}

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <Lightbox
          images={imageFiles.map(f => ({ name: f.name, path: f.path }))}
          initialIndex={lightboxIndex}
          folder={folder}
          onClose={() => setLightboxIndex(null)}
          onDeleted={(path) => {
            setFiles(prev => prev.filter(f => f.path !== path));
            const remaining = imageFiles.filter(f => f.path !== path);
            if (remaining.length === 0) setLightboxIndex(null);
          }}
        />
      )}

      {/* Bulk delete modal */}
      {showBulkDelete && (
        <DeleteModal
          items={[...selected]}
          onConfirm={handleBulkDelete}
          onCancel={() => setShowBulkDelete(false)}
        />
      )}

      {/* Move modal (single or bulk) */}
      {(moveTarget || bulkMove) && (
        <FolderTreePicker
          action="Move"
          onConfirm={(dest) => handleMove(dest)}
          onCancel={() => { setMoveTarget(null); setBulkMove(false); }}
        />
      )}

      {/* Copy modal (single or bulk) */}
      {(copyTarget || bulkCopy) && (
        <FolderTreePicker
          action="Copy"
          onConfirm={(dest) => handleCopy(dest)}
          onCancel={() => { setCopyTarget(null); setBulkCopy(false); }}
        />
      )}

      {/* Temp share modal */}
      {shareTarget && (
        <div className="modal-overlay" onClick={() => { setShareTarget(null); setShareLink(''); }}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">🔗 Temp Share</h2>
            <p className="modal-body">
              Share <strong>{shareTarget.split('/').pop()}</strong> with a time-limited link.
            </p>
            {!shareLink ? (
              <>
                <div className="form-group" style={{ marginBottom: 20 }}>
                  <label className="form-label">Expires in (minutes)</label>
                  <input
                    type="number"
                    min={1}
                    value={shareExpiry}
                    onChange={e => setShareExpiry(Number(e.target.value))}
                    className="form-input"
                  />
                </div>
                <div className="modal-actions">
                  <button className="btn btn-ghost" onClick={() => setShareTarget(null)}>Cancel</button>
                  <button className="btn btn-primary" onClick={handleShare}>Generate Link</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border-bright)', borderRadius: 'var(--radius-sm)', padding: 12, marginBottom: 16 }}>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-muted)', wordBreak: 'break-all' }}>{shareLink}</p>
                </div>
                <div className="modal-actions">
                  <button className="btn btn-secondary" onClick={() => navigator.clipboard?.writeText(shareLink)}>Copy Link</button>
                  <button className="btn btn-ghost" onClick={() => { setShareTarget(null); setShareLink(''); }}>Done</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
