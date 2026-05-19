'use client';
import { createContext, useContext, useState, useCallback, useRef } from 'react';

// ── Upload items ────────────────────────────────────────────────────────────
interface UploadItem {
  kind: 'upload';
  id: string;
  name: string;
  progress: number; // 0-100
  status: 'pending' | 'uploading' | 'done' | 'error';
  error?: string;
}

// ── Operation items (copy / move) ───────────────────────────────────────────
interface OperationItem {
  kind: 'operation';
  id: string;
  jobId: string;
  name: string;
  type: 'copy' | 'move';
  status: 'running' | 'done' | 'error';
  error?: string;
}

type QueueItem = UploadItem | OperationItem;

// ── Context ─────────────────────────────────────────────────────────────────
interface UploadContextValue {
  addFiles: (files: File[], folder: string) => void;
  addOperation: (jobId: string, name: string, type: 'copy' | 'move', onDone?: () => void) => void;
}

const UploadContext = createContext<UploadContextValue>({
  addFiles: () => {},
  addOperation: () => {},
});

export function useUpload() {
  return useContext(UploadContext);
}

// ── Provider ─────────────────────────────────────────────────────────────────
export function UploadProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [minimized, setMinimized] = useState(false);
  const queueRef = useRef<{ file: File; folder: string; id: string }[]>([]);
  const activeRef = useRef(0);
  const MAX_CONCURRENT = 3;

  // ── Helpers ─────────────────────────────────────────────────────────────
  function updateItem(id: string, patch: Partial<QueueItem>) {
    setItems(prev => prev.map(u => u.id === id ? { ...u, ...patch } as QueueItem : u));
  }

  // ── Upload logic ─────────────────────────────────────────────────────────
  const processQueue = useCallback(() => {
    while (activeRef.current < MAX_CONCURRENT && queueRef.current.length > 0) {
      const item = queueRef.current.shift()!;
      activeRef.current++;
      uploadFile(item.file, item.folder, item.id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function uploadFile(file: File, folder: string, id: string) {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('files', file, file.name);

    updateItem(id, { status: 'uploading', progress: 0 } as Partial<UploadItem>);

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        updateItem(id, { progress: Math.round((e.loaded / e.total) * 100) } as Partial<UploadItem>);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        updateItem(id, { status: 'done', progress: 100 } as Partial<UploadItem>);
      } else {
        updateItem(id, { status: 'error', error: `HTTP ${xhr.status}` } as Partial<UploadItem>);
      }
      activeRef.current--;
      processQueue();
    });

    xhr.addEventListener('error', () => {
      updateItem(id, { status: 'error', error: 'Network error' } as Partial<UploadItem>);
      activeRef.current--;
      processQueue();
    });

    xhr.open('POST', `/api/files/upload?folder=${encodeURIComponent(folder)}`);
    xhr.send(formData);
  }

  const addFiles = useCallback((files: File[], folder: string) => {
    const newItems: UploadItem[] = files.map(f => ({
      kind: 'upload' as const,
      id: `${Date.now()}-${Math.random()}`,
      name: f.name,
      progress: 0,
      status: 'pending',
    }));

    setItems(prev => [...prev, ...newItems]);
    setMinimized(false);

    files.forEach((f, i) => {
      queueRef.current.push({ file: f, folder, id: newItems[i].id });
    });

    processQueue();
  }, [processQueue]);

  // ── Operation (copy/move) logic ──────────────────────────────────────────
  const addOperation = useCallback((
    jobId: string,
    name: string,
    type: 'copy' | 'move',
    onDone?: () => void,
  ) => {
    const id = `op-${jobId}`;
    const opItem: OperationItem = {
      kind: 'operation',
      id,
      jobId,
      name,
      type,
      status: 'running',
    };

    setItems(prev => [...prev, opItem]);
    setMinimized(false);

    // Poll until the job finishes
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/files/job-status?id=${jobId}`);
        if (!res.ok) {
          clearInterval(interval);
          updateItem(id, { status: 'error', error: `Server error ${res.status}` } as Partial<OperationItem>);
          return;
        }
        const job = await res.json();
        if (job.status === 'done') {
          clearInterval(interval);
          updateItem(id, { status: 'done' } as Partial<OperationItem>);
          onDone?.();
        } else if (job.status === 'error') {
          clearInterval(interval);
          updateItem(id, { status: 'error', error: job.error || 'Unknown error' } as Partial<OperationItem>);
        }
      } catch {
        clearInterval(interval);
        updateItem(id, { status: 'error', error: 'Network error' } as Partial<OperationItem>);
      }
    }, 600);
  }, []);

  // ── Derived state ─────────────────────────────────────────────────────────
  const activeItems = items.filter(u =>
    u.kind === 'upload'
      ? (u.status === 'uploading' || u.status === 'pending')
      : u.status === 'running'
  );
  const doneItems = items.filter(u =>
    u.kind === 'upload' ? u.status === 'done' : u.status === 'done'
  );
  const hasError = items.some(u =>
    u.kind === 'upload' ? u.status === 'error' : u.status === 'error'
  );

  function dismiss() { setItems([]); }

  function headerLabel() {
    if (activeItems.length > 0) {
      const uploadCount = activeItems.filter(u => u.kind === 'upload').length;
      const opCount = activeItems.filter(u => u.kind === 'operation').length;
      const parts: string[] = [];
      if (uploadCount > 0) parts.push(`uploading ${uploadCount} file${uploadCount !== 1 ? 's' : ''}`);
      if (opCount > 0) parts.push(`${opCount} operation${opCount !== 1 ? 's' : ''} in progress`);
      return parts.join(', ');
    }
    if (hasError) return '⚠ Some operations failed';
    return `✓ ${doneItems.length} operation${doneItems.length !== 1 ? 's' : ''} complete`;
  }

  // ── Animated pulse bar for operations in progress ─────────────────────────
  const pulseStyle: React.CSSProperties = {
    background: 'linear-gradient(90deg, var(--primary) 0%, var(--accent-cyan) 50%, var(--primary) 100%)',
    backgroundSize: '200% 100%',
    animation: 'pulse-bar 1.6s ease-in-out infinite',
    width: '100%',
  };

  return (
    <UploadContext.Provider value={{ addFiles, addOperation }}>
      {children}
      {items.length > 0 && (
        <div className="upload-manager" style={{ bottom: activeItems.length > 0 ? 24 : 80 }}>
          <div className="upload-manager-header">
            <span style={{ textTransform: 'capitalize' }}>{headerLabel()}</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                className="btn btn-ghost btn-sm btn-icon"
                style={{ width: 24, height: 24, padding: 0, fontSize: '0.75rem' }}
                onClick={() => setMinimized(!minimized)}
              >
                {minimized ? '▲' : '▼'}
              </button>
              <button
                className="btn btn-ghost btn-sm btn-icon"
                style={{ width: 24, height: 24, padding: 0, fontSize: '0.75rem' }}
                onClick={dismiss}
              >
                ✕
              </button>
            </div>
          </div>

          {!minimized && (
            <div style={{ maxHeight: 240, overflowY: 'auto' }}>
              {items.slice(-8).map(item => {
                if (item.kind === 'upload') {
                  return (
                    <div key={item.id} className="upload-item">
                      <div className="upload-item-name">{item.name}</div>
                      <div className="upload-progress-track">
                        <div
                          className="upload-progress-bar"
                          style={{
                            width: `${item.progress}%`,
                            background: item.status === 'error'
                              ? 'var(--danger)'
                              : item.status === 'done'
                              ? 'var(--success)'
                              : 'linear-gradient(90deg, var(--primary), var(--accent-cyan))',
                          }}
                        />
                      </div>
                      <div className="upload-status">
                        {item.status === 'pending' && 'Queued'}
                        {item.status === 'uploading' && `${item.progress}%`}
                        {item.status === 'done' && '✓ Done'}
                        {item.status === 'error' && `✗ ${item.error}`}
                      </div>
                    </div>
                  );
                } else {
                  // Operation item
                  const typeLabel = item.type === 'copy' ? 'Copy' : 'Move';
                  return (
                    <div key={item.id} className="upload-item">
                      <div className="upload-item-name">
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginRight: 4 }}>
                          [{typeLabel}]
                        </span>
                        {item.name}
                      </div>
                      <div className="upload-progress-track">
                        <div
                          className="upload-progress-bar"
                          style={
                            item.status === 'running'
                              ? pulseStyle
                              : {
                                  width: '100%',
                                  background: item.status === 'error'
                                    ? 'var(--danger)'
                                    : 'var(--success)',
                                }
                          }
                        />
                      </div>
                      <div className="upload-status">
                        {item.status === 'running' && '…'}
                        {item.status === 'done' && '✓ Done'}
                        {item.status === 'error' && `✗ ${item.error}`}
                      </div>
                    </div>
                  );
                }
              })}
            </div>
          )}
        </div>
      )}
    </UploadContext.Provider>
  );
}
