import React, { useEffect, useCallback } from 'react';
import { useSessionStore } from '../state/sessionStore';
import { useAppStore } from '../state/appStore';
import { saveProject } from '../projects/db';
import {
  FileJson, Image, Camera, FileText, FileSpreadsheet,
  Play, Save, Undo, Redo, LayoutDashboard,
  PanelBottom, PanelLeft, Zap
} from 'lucide-react';
import {
  exportProjectJson, exportBomCsv, exportNetlistCsv,
  exportPdfReport, exportSvg, exportPng
} from '../export';

const AUTOSAVE_INTERVAL_MS = 30_000;

export const TopBar: React.FC = () => {
  const { project, historyIndex, history, undo, redo, recalculate, analysis } = useSessionStore();
  const {
    setScreen,
    leftSidebarOpen, setLeftSidebarOpen,
    bottomPanelOpen, setBottomPanelOpen,
  } = useAppStore();

  // Autosave
  useEffect(() => {
    if (!project) return;
    const timer = setInterval(async () => {
      await saveProject(project);
    }, AUTOSAVE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [project]);

  // Manual save hotkey
  const handleSave = useCallback(async () => {
    if (project) await saveProject(project);
  }, [project]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); handleSave(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSave]);

  const handleExport = (type: string) => {
    if (!project) return;
    const svgEl = document.querySelector('.schematic-svg') as SVGSVGElement | null;
    switch (type) {
      case 'json': exportProjectJson(project); break;
      case 'bom': exportBomCsv(project); break;
      case 'netlist': exportNetlistCsv(project); break;
      case 'pdf': exportPdfReport(project, analysis, svgEl); break;
      case 'svg': if (svgEl) exportSvg(svgEl, `${project.name}.svg`); break;
      case 'png': if (svgEl) exportPng(svgEl, `${project.name}.png`); break;
    }
  };

  return (
    <div style={{
      height: 44, borderBottom: '1px solid var(--border-divider)',
      background: 'var(--bg-panel)', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', padding: '0 8px', flexShrink: 0, gap: 4,
    }}>
      {/* Left */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button className="btn-icon" onClick={() => setScreen('dashboard')} title="Dashboard">
          <LayoutDashboard size={17} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 4 }}>
          <Zap size={16} color="var(--cs-accent)" />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>CircuitSpace</span>
        </div>
        {project && (
          <>
            <div style={{ width: 1, height: 20, background: 'var(--border-divider)', margin: '0 6px' }} />
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {project.name}
            </span>
          </>
        )}
        <div style={{ width: 1, height: 20, background: 'var(--border-divider)', margin: '0 4px' }} />
        <button className="btn-icon" onClick={handleSave} title="Save (⌘S)"><Save size={16} /></button>
        <button className="btn-icon" onClick={undo} disabled={historyIndex <= 0} style={{ opacity: historyIndex <= 0 ? 0.3 : 1 }} title="Undo (⌘Z)"><Undo size={16} /></button>
        <button className="btn-icon" onClick={redo} disabled={historyIndex >= history.length - 1} style={{ opacity: historyIndex >= history.length - 1 ? 0.3 : 1 }} title="Redo (⌘⇧Z)"><Redo size={16} /></button>
      </div>

      {/* Center */}
      <div>
        <button
          className="btn btn-primary"
          onClick={recalculate}
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
          title="Run Electrical Rules Check"
        >
          <Play size={13} /> Run ERC
        </button>
      </div>

      {/* Right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button
          className={`btn-icon ${leftSidebarOpen ? 'active' : ''}`}
          onClick={() => setLeftSidebarOpen(!leftSidebarOpen)}
          title="Toggle sidebar"
        >
          <PanelLeft size={17} />
        </button>
        <button
          className={`btn-icon ${bottomPanelOpen ? 'active' : ''}`}
          onClick={() => setBottomPanelOpen(!bottomPanelOpen)}
          title="Toggle bottom panel"
        >
          <PanelBottom size={17} />
        </button>
        <div style={{ width: 1, height: 20, background: 'var(--border-divider)', margin: '0 4px' }} />
        {/* Export buttons */}
        <div style={{ display: 'flex', background: 'var(--bg-surface)', border: '1px solid var(--border-divider)', borderRadius: 4, overflow: 'hidden' }}>
          {[
            { label: 'JSON', icon: <FileJson size={12} />, type: 'json', title: 'Export project JSON (.cspace.json)' },
            { label: 'BOM', icon: <FileSpreadsheet size={12} />, type: 'bom', title: 'Export Bill of Materials (CSV)' },
            { label: 'Net', icon: <FileText size={12} />, type: 'netlist', title: 'Export Netlist (CSV)' },
            { label: 'SVG', icon: <Image size={12} />, type: 'svg', title: 'Export SVG schematic' },
            { label: 'PNG', icon: <Camera size={12} />, type: 'png', title: 'Export PNG image' },
            { label: 'PDF', icon: <FileText size={12} />, type: 'pdf', title: 'Generate PDF report', accent: true },
          ].map((btn, i) => (
            <button
              key={btn.type}
              onClick={() => handleExport(btn.type)}
              title={btn.title}
              style={{
                display: 'flex', alignItems: 'center', gap: 4, padding: '0 8px', height: 28,
                background: 'transparent', border: 'none', borderLeft: i > 0 ? '1px solid var(--border-divider)' : 'none',
                cursor: 'pointer', fontSize: 11, color: btn.accent ? 'var(--cs-accent)' : 'var(--text-secondary)',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {btn.icon} {btn.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
