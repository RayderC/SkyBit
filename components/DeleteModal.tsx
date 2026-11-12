'use client';
import { useEffect } from 'react';

interface Props {
  items: string[];
  message?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DeleteModal({ items, message, onConfirm, onCancel }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') onConfirm();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel, onConfirm]);

  const defaultMsg = items.length === 1
    ? <>Are you sure you want to delete <strong>{items[0].split('/').pop() || items[0]}</strong>? It goes to the trash for 30 days, so you can restore it.</>
    : <>Are you sure you want to delete <strong>{items.length} items</strong>? They go to the trash for 30 days, so you can restore them.</>;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <h2 className="modal-title">⚠ Confirm Delete</h2>
        <p className="modal-body">{message || defaultMsg}</p>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn btn-danger" onClick={onConfirm} autoFocus>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
