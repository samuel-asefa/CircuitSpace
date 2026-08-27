import React from 'react';
import { X, MousePointer2, Move, ZoomIn, PenTool } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export const HelpModal: React.FC<Props> = ({ onClose }) => {
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }} onClick={onClose}>
      <div style={{
        background: 'var(--bg-panel)', border: '1px solid var(--border-divider)',
        borderRadius: 8, padding: 24, width: 500, maxWidth: '90vw',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        display: 'flex', flexDirection: 'column', gap: 16
      }} onClick={e => e.stopPropagation()}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-divider)', paddingBottom: 12 }}>
          <h2 style={{ fontSize: 16, margin: 0, color: 'var(--text-primary)' }}>CircuitSpace Quick Guide</h2>
          <button className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13, color: 'var(--text-secondary)' }}>
          <p style={{ margin: 0 }}>Welcome to CircuitSpace. Here are the essential controls for the schematic editor:</p>

          <div style={{ display: 'grid', gridTemplateColumns: '24px 1fr', gap: 12, alignItems: 'start' }}>
            <MousePointer2 size={16} color="var(--text-primary)" style={{ marginTop: 2 }} />
            <div>
              <strong style={{ color: 'var(--text-primary)' }}>Selection (V)</strong>
              <div style={{ marginTop: 4 }}>
                Click to select a component or wire. Shift-click to add to selection.<br/>
                Drag the background to create a selection box.<br/>
                Press <strong>Delete</strong> to remove selected items.
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '24px 1fr', gap: 12, alignItems: 'start' }}>
            <Move size={16} color="var(--text-primary)" style={{ marginTop: 2 }} />
            <div>
              <strong style={{ color: 'var(--text-primary)' }}>Moving & Panning</strong>
              <div style={{ marginTop: 4 }}>
                Drag selected components to move them.<br/>
                Hold <strong>Spacebar</strong> or use the <strong>Middle Mouse Button</strong> and drag the canvas to pan.
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '24px 1fr', gap: 12, alignItems: 'start' }}>
            <ZoomIn size={16} color="var(--text-primary)" style={{ marginTop: 2 }} />
            <div>
              <strong style={{ color: 'var(--text-primary)' }}>Zooming</strong>
              <div style={{ marginTop: 4 }}>
                Use <strong>Cmd + Scroll</strong> (Mac) or <strong>Ctrl + Scroll</strong> (Windows) to zoom in and out.
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '24px 1fr', gap: 12, alignItems: 'start' }}>
            <PenTool size={16} color="var(--text-primary)" style={{ marginTop: 2 }} />
            <div>
              <strong style={{ color: 'var(--text-primary)' }}>Wiring (W)</strong>
              <div style={{ marginTop: 4 }}>
                1. Press W or click a pin to start wiring.<br/>
                2. Click on empty space to add a corner.<br/>
                3. Click another pin or wire to finish.<br/>
                4. Press <strong>ESC</strong> to cancel at any time.
              </div>
            </div>
          </div>
          
          <div style={{ background: 'var(--bg-surface)', padding: 12, borderRadius: 4, marginTop: 8, border: '1px solid var(--border-divider)' }}>
            <strong style={{ color: 'var(--text-primary)' }}>Pro Tip: Command Palette</strong>
            <p style={{ margin: '4px 0 0 0' }}>Press <strong>Cmd + K</strong> (or Ctrl + K) to quickly search for tools, export options, or settings without using the menus.</p>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <button className="btn btn-primary" onClick={onClose}>Got it</button>
        </div>
      </div>
    </div>
  );
};
