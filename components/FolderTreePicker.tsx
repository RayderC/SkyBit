'use client';
import { useEffect, useState } from 'react';

interface FolderNode {
  name: string;
  path: string;
  children: FolderNode[];
}

interface Props {
  action: 'Move' | 'Copy';
  onConfirm: (destFolder: string) => void;
  onCancel: () => void;
}

function TreeNode({
  node, selected, onSelect, depth,
}: {
  node: FolderNode; selected: string; onSelect: (path: string) => void; depth: number;
}) {
  const [open, setOpen] = useState(depth < 1);
  return (
    <li className="folder-tree-node">
      <div
        className={`folder-tree-label ${selected === node.path ? 'selected' : ''}`}
        style={{ paddingLeft: 8 + depth * 4 }}
        onClick={() => onSelect(node.path)}
      >
        {node.children.length > 0 && (
          <span
            style={{ cursor: 'pointer', marginRight: 4, fontSize: '0.7rem', color: 'var(--text-subtle)' }}
            onClick={e => { e.stopPropagation(); setOpen(!open); }}
          >
            {open ? '▼' : '▶'}
          </span>
        )}
        <span style={{ color: 'var(--accent-cyan)', marginRight: 6 }}>📁</span>
        {node.name}
      </div>
      {open && node.children.length > 0 && (
        <ul className="folder-tree folder-tree-children" style={{ marginLeft: 12, borderLeft: '1px solid var(--border)', paddingLeft: 4 }}>
          {node.children.map(child => (
            <TreeNode key={child.path} node={child} selected={selected} onSelect={onSelect} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function FolderTreePicker({ action, onConfirm, onCancel }: Props) {
  const [tree, setTree] = useState<FolderNode | null>(null);
  const [selected, setSelected] = useState('');

  useEffect(() => {
    fetch('/api/files/folder-tree').then(r => r.json()).then(setTree);
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onCancel(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 480, maxHeight: '70vh', display: 'flex', flexDirection: 'column' }}>
        <h2 className="modal-title">{action} To...</h2>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 16, fontFamily: 'var(--font-mono)' }}>
          {selected ? `→ ${selected || 'Home'}` : 'Select a destination folder'}
        </p>

        <div style={{ flex: 1, overflowY: 'auto', background: 'var(--surface-2)', border: '1px solid var(--border-bright)', borderRadius: 'var(--radius-sm)', padding: 8, minHeight: 200 }}>
          {!tree ? (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>Loading...</div>
          ) : (
            <ul className="folder-tree">
              <li className="folder-tree-node">
                <div
                  className={`folder-tree-label ${selected === '' ? 'selected' : ''}`}
                  onClick={() => setSelected('')}
                >
                  <span style={{ color: 'var(--accent-cyan)', marginRight: 6 }}>🏠</span>
                  Home
                </div>
                {tree.children.length > 0 && (
                  <ul className="folder-tree folder-tree-children" style={{ marginLeft: 12, borderLeft: '1px solid var(--border)', paddingLeft: 4 }}>
                    {tree.children.map(child => (
                      <TreeNode key={child.path} node={child} selected={selected} onSelect={setSelected} depth={0} />
                    ))}
                  </ul>
                )}
              </li>
            </ul>
          )}
        </div>

        <div className="modal-actions" style={{ marginTop: 16 }}>
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={() => onConfirm(selected)}
          >
            {action} Here
          </button>
        </div>
      </div>
    </div>
  );
}
