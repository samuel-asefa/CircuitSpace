import React from 'react';
import { useSessionStore } from '../state/sessionStore';
import { MousePointer2, Pencil, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

export const Toolbar: React.FC = () => {
  const { mode, setMode, view, setZoom, resetView } = useSessionStore();

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: 2, padding: '8px 4px',
      background: 'var(--bg-panel)', borderRight: '1px solid var(--border-divider)',
      width: 40, flexShrink: 0,
    }}>
      <button
        className={`btn-icon ${mode === 'select' ? 'active' : ''}`}
        onClick={() => setMode('select')}
        title="Select (V)"
      >
        <MousePointer2 size={16} />
      </button>
      <button
        className={`btn-icon ${mode === 'wire' ? 'active' : ''}`}
        onClick={() => setMode('wire')}
        title="Wire (W)"
      >
        <Pencil size={16} />
      </button>
      
      <div style={{ width: 28, height: 1, background: 'var(--border-divider)', margin: '4px 0' }} />
      
      <button className="btn-icon" onClick={() => setZoom(view.zoom * 1.25)} title="Zoom In (+)">
        <ZoomIn size={16} />
      </button>
      <button className="btn-icon" onClick={() => setZoom(view.zoom / 1.25)} title="Zoom Out (-)">
        <ZoomOut size={16} />
      </button>
      <button className="btn-icon" onClick={resetView} title="Reset View (0)">
        <Maximize2 size={15} />
      </button>
    </div>
  );
};
