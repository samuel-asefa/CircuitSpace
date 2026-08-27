import React, { useState, useEffect, useRef } from 'react';
import { useSessionStore } from '../state/sessionStore';
import { useAppStore } from '../state/appStore';
import { CATALOG } from '../catalog';
import { exportProjectJson, exportBomCsv, exportNetlistCsv } from '../export';
import { Search } from 'lucide-react';

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  action: () => void;
  keywords?: string[];
}

export const CommandPalette: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const { setMode, recalculate, project, undo, redo, deleteSelection, duplicateSelection, resetView } = useSessionStore();
  const { setActiveBottomTab, setBottomPanelOpen } = useAppStore();

  useEffect(() => { inputRef.current?.focus(); }, []);

  const commands: CommandItem[] = [
    // ERC & Analysis
    { id: 'erc', label: 'Run ERC', description: 'Run Electrical Rules Check', action: () => recalculate(), keywords: ['validate', 'check', 'erc'] },
    
    // View
    { id: 'fit', label: 'Zoom to Fit', description: 'Fit all components in view', action: () => resetView(), keywords: ['zoom', 'fit'] },
    
    // Panels
    { id: 'problems', label: 'Show Problems', action: () => { setActiveBottomTab('problems'); setBottomPanelOpen(true); } },
    { id: 'power', label: 'Show Power Analysis', action: () => { setActiveBottomTab('power'); setBottomPanelOpen(true); } },
    { id: 'mass', label: 'Show Mass Breakdown', action: () => { setActiveBottomTab('mass'); setBottomPanelOpen(true); } },
    { id: 'bom', label: 'Show BOM', action: () => { setActiveBottomTab('bom'); setBottomPanelOpen(true); } },
    { id: 'netlist', label: 'Show Netlist', action: () => { setActiveBottomTab('netlist'); setBottomPanelOpen(true); } },
    
    // Tools
    { id: 'wire', label: 'Wire Tool', description: 'Switch to wire drawing mode', action: () => setMode('wire'), keywords: ['draw', 'connect', 'wire'] },
    { id: 'select', label: 'Select Tool', action: () => setMode('select'), keywords: ['select'] },
    { id: 'undo', label: 'Undo', action: () => undo(), keywords: ['undo'] },
    { id: 'redo', label: 'Redo', action: () => redo(), keywords: ['redo'] },
    { id: 'delete', label: 'Delete Selection', action: () => deleteSelection(), keywords: ['delete', 'remove'] },
    { id: 'duplicate', label: 'Duplicate Selection', action: () => duplicateSelection(), keywords: ['duplicate', 'copy'] },
    
    // Export
    ...(project ? [
      { id: 'export-json', label: 'Export Project JSON', action: () => exportProjectJson(project), keywords: ['export', 'json', 'cspace'] },
      { id: 'export-bom', label: 'Export BOM CSV', action: () => exportBomCsv(project), keywords: ['export', 'bom', 'csv'] },
      { id: 'export-netlist', label: 'Export Netlist', action: () => exportNetlistCsv(project), keywords: ['export', 'netlist'] },
    ] : []),
    
    // Component placement commands
    ...CATALOG.slice(0, 30).map(def => ({
      id: `place-${def.id}`,
      label: `Place ${def.name}`,
      description: `${def.category} — ${def.refPrefix}`,
      action: () => setMode('place', def.id),
      keywords: ['place', 'add', def.category.toLowerCase(), ...def.tags],
    })),
  ];

  const filtered = query.trim()
    ? commands.filter(c => {
        const q = query.toLowerCase();
        return c.label.toLowerCase().includes(q) ||
          c.description?.toLowerCase().includes(q) ||
          c.keywords?.some(k => k.toLowerCase().includes(q));
      })
    : commands.slice(0, 10);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, filtered.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter') { e.preventDefault(); filtered[selectedIndex]?.action(); onClose(); }
    if (e.key === 'Escape') onClose();
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 120,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: 580, background: 'var(--bg-panel)', border: '1px solid var(--border-divider)',
        borderRadius: 8, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid var(--border-divider)', gap: 10 }}>
          <Search size={16} color="var(--text-tertiary)" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
            onKeyDown={handleKey}
            placeholder="Type a command or search components…"
            style={{ flex: 1, background: 'none', border: 'none', fontSize: 14, color: 'var(--text-primary)', outline: 'none' }}
          />
          <kbd style={{ fontSize: 10, padding: '2px 6px', background: 'var(--bg-surface)', border: '1px solid var(--border-divider)', borderRadius: 3, color: 'var(--text-tertiary)' }}>
            Esc
          </kbd>
        </div>
        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          {filtered.map((cmd, i) => (
            <div
              key={cmd.id}
              onClick={() => { cmd.action(); onClose(); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '9px 16px',
                background: i === selectedIndex ? 'var(--bg-surface)' : 'transparent',
                cursor: 'pointer', borderBottom: '1px solid var(--border-divider)',
              }}
              onMouseEnter={() => setSelectedIndex(i)}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13 }}>{cmd.label}</div>
                {cmd.description && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>{cmd.description}</div>}
              </div>
              {i === selectedIndex && (
                <kbd style={{ fontSize: 10, padding: '2px 6px', background: 'var(--bg-app)', border: '1px solid var(--border-divider)', borderRadius: 3, color: 'var(--text-tertiary)' }}>
                  ↵
                </kbd>
              )}
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>No commands match "{query}"</div>
          )}
        </div>
      </div>
    </div>
  );
};
