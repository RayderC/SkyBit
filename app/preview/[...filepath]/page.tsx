'use client';
import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import DeleteModal from '@/components/DeleteModal';

interface Props {
  params: Promise<{ filepath: string[] }>;
}

export default function PreviewPage({ params }: Props) {
  const { filepath } = use(params);
  const filePath = filepath ? filepath.join('/') : '';
  const router = useRouter();

  const [fileData, setFileData] = useState<{
    fileType: string; content?: string; size?: number; name?: string;
  } | null>(null);
  const [role, setRole] = useState('user');
  const [content, setContent] = useState('');
  const [saved, setSaved] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [loading, setLoading] = useState(true);

  const folder = filePath.split('/').slice(0, -1).join('/');
  const filename = filePath.split('/').pop() || '';

  useEffect(() => {
    Promise.all([
      fetch(`/api/files/preview?path=${encodeURIComponent(filePath)}`).then(r => r.json()),
      fetch('/api/auth/user').then(r => r.json()),
    ]).then(([preview, user]) => {
      setFileData(preview);
      setRole(user.role || 'user');
      if (preview.content) setContent(preview.content);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [filePath]);

  async function handleSave() {
    await fetch('/api/files/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: filePath, content }),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleDelete() {
    await fetch('/api/files/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: filePath }),
    });
    router.push(folder ? `/${folder}` : '/');
  }

  const downloadUrl = `/api/files/download?path=${encodeURIComponent(filePath)}`;

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>Loading...</div>
      </div>
    );
  }

  return (
    <div className="page-root" style={{ maxWidth: 900 }}>
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-subtle)', marginBottom: 4 }}>
            Preview
          </div>
          <h1 style={{ fontSize: '1.1rem', fontFamily: 'var(--font-mono)', color: 'var(--text)', wordBreak: 'break-all' }}>
            {filename}
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <a href={folder ? `/${folder}` : '/'} className="btn btn-ghost btn-sm">← Back</a>
          <a href={downloadUrl} download className="btn btn-secondary btn-sm">Download</a>
          {['admin', 'mod'].includes(role) && fileData?.fileType === 'text' && (
            <button className="btn btn-primary btn-sm" onClick={handleSave}>
              {saved ? '✓ Saved' : 'Save'}
            </button>
          )}
          {['admin', 'mod'].includes(role) && (
            <button className="btn btn-danger btn-sm" onClick={() => setShowDelete(true)}>Delete</button>
          )}
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {fileData?.fileType === 'image' && (
          <img
            src={downloadUrl}
            alt={filename}
            style={{ display: 'block', maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain', margin: '0 auto', padding: 24 }}
          />
        )}

        {fileData?.fileType === 'video' && (
          <video controls style={{ width: '100%', maxHeight: '70vh', background: '#000' }}>
            <source src={downloadUrl} />
          </video>
        )}

        {fileData?.fileType === 'audio' && (
          <div style={{ padding: 32, display: 'flex', justifyContent: 'center' }}>
            <audio controls src={downloadUrl} style={{ width: '100%', maxWidth: 500 }} />
          </div>
        )}

        {fileData?.fileType === 'text' && (
          ['admin', 'mod'].includes(role) ? (
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              style={{
                width: '100%', minHeight: 500, background: 'var(--surface-2)',
                color: 'var(--text)', border: 'none', padding: 24,
                fontFamily: 'var(--font-mono)', fontSize: '0.85rem', lineHeight: 1.7,
                resize: 'vertical', outline: 'none',
              }}
            />
          ) : (
            <pre style={{
              padding: 24, overflow: 'auto', maxHeight: 600,
              fontFamily: 'var(--font-mono)', fontSize: '0.85rem',
              lineHeight: 1.7, color: 'var(--text)',
            }}>{content}</pre>
          )
        )}

        {fileData?.fileType === 'pdf' && (
          <iframe
            src={downloadUrl}
            title={filename}
            style={{ width: '100%', height: '80vh', border: 'none', display: 'block' }}
          />
        )}

        {fileData?.fileType === 'archive' && (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 3 + 'rem', marginBottom: 16 }}>📦</div>
            <p>Archive file — download to extract</p>
          </div>
        )}

        {fileData?.fileType === 'other' && (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 3 + 'rem', marginBottom: 16 }}>📄</div>
            <p>No preview available for this file type</p>
          </div>
        )}
      </div>

      {showDelete && (
        <DeleteModal
          items={[filePath]}
          onConfirm={handleDelete}
          onCancel={() => setShowDelete(false)}
        />
      )}
    </div>
  );
}
