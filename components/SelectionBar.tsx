'use client';

interface Props {
  count: number;
  onDelete: () => void;
  onMove: () => void;
  onCopy: () => void;
  onCancel: () => void;
}

export default function SelectionBar({ count, onDelete, onMove, onCopy, onCancel }: Props) {
  if (count === 0) return null;
  return (
    <div className="selection-bar">
      <span className="selection-count">{count} item{count !== 1 ? 's' : ''} selected</span>
      <button className="btn btn-secondary btn-sm" onClick={onMove}>Move</button>
      <button className="btn btn-secondary btn-sm" onClick={onCopy}>Copy</button>
      <button className="btn btn-danger btn-sm" onClick={onDelete}>Delete</button>
      <button className="btn btn-ghost btn-sm" onClick={onCancel}>✕ Cancel</button>
    </div>
  );
}
