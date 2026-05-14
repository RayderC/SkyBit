'use client';
import { createContext, useContext, useState, useCallback, useRef } from 'react';

interface UploadItem {
  id: string;
  name: string;
  progress: number; // 0-100
  status: 'pending' | 'uploading' | 'done' | 'error';
  error?: string;
}

interface UploadContextValue {
  addFiles: (files: File[], folder: string) => void;
}

const UploadContext = createContext<UploadContextValue>({ addFiles: () => {} });

export function useUpload() {
  return useContext(UploadContext);
}

export function UploadProvider({ children }: { children: React.ReactNode }) {
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [minimized, setMinimized] = useState(false);
  const queueRef = useRef<{ file: File; folder: string; id: string }[]>([]);
  const activeRef = useRef(0);
  const MAX_CONCURRENT = 3;

  function updateUpload(id: string, patch: Partial<UploadItem>) {
    setUploads(prev => prev.map(u => u.id === id ? { ...u, ...patch } : u));
  }

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

    updateUpload(id, { status: 'uploading', progress: 0 });

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        updateUpload(id, { progress: Math.round((e.loaded / e.total) * 100) });
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        updateUpload(id, { status: 'done', progress: 100 });
      } else {
        updateUpload(id, { status: 'error', error: `HTTP ${xhr.status}` });
      }
      activeRef.current--;
      processQueue();
    });

    xhr.addEventListener('error', () => {
      updateUpload(id, { status: 'error', error: 'Network error' });
      activeRef.current--;
      processQueue();
    });

    xhr.open('POST', `/api/files/upload?folder=${encodeURIComponent(folder)}`);
    xhr.send(formData);
  }

  const addFiles = useCallback((files: File[], folder: string) => {
    const newItems: UploadItem[] = files.map(f => ({
      id: `${Date.now()}-${Math.random()}`,
      name: f.name,
      progress: 0,
      status: 'pending',
    }));

    setUploads(prev => [...prev, ...newItems]);
    setMinimized(false);

    files.forEach((f, i) => {
      queueRef.current.push({ file: f, folder, id: newItems[i].id });
    });

    processQueue();
  }, [processQueue]);

  const active = uploads.filter(u => u.status === 'uploading' || u.status === 'pending');
  const done = uploads.filter(u => u.status === 'done');
  const hasError = uploads.some(u => u.status === 'error');

  function dismiss() {
    setUploads([]);
  }

  return (
    <UploadContext.Provider value={{ addFiles }}>
      {children}
      {uploads.length > 0 && (
        <div className="upload-manager" style={{ bottom: active.length > 0 ? 24 : 80 }}>
          <div className="upload-manager-header">
            <span>
              {active.length > 0
                ? `Uploading ${active.length} file${active.length !== 1 ? 's' : ''}...`
                : hasError
                ? '⚠ Upload errors'
                : `✓ ${done.length} upload${done.length !== 1 ? 's' : ''} complete`}
            </span>
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
              {uploads.slice(-8).map(item => (
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
              ))}
            </div>
          )}
        </div>
      )}
    </UploadContext.Provider>
  );
}
