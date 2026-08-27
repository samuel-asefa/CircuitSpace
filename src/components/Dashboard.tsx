import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../state/appStore';
import { useSessionStore } from '../state/sessionStore';
import { listProjects, saveProject, deleteProject } from '../projects/db';
import { TEMPLATES } from '../templates';
import type { Project } from '../types';
import { generateId } from '../utils/id';
import { formatMassG, formatTimeHours } from '../utils/units';
import {
  Plus, FolderOpen, Trash2, Copy, LayoutTemplate,
  Clock, Upload, Zap
} from 'lucide-react';

function createBlankProject(name: string): Project {
  return {
    id: generateId(),
    name,
    description: '',
    author: '',
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
    schemaVersion: 1,
    sheets: [{
      id: generateId(),
      name: 'Sheet 1',
      components: [],
      wires: [],
      netLabels: [],
      junctions: [],
    }],
    settings: {
      targetRuntimeHours: 2,
      batteryReservePercent: 20,
      nominalBusVoltageV: 3.3,
      maxMassGrams: 500,
      powerBudgetW: 5,
    },
  };
}

export const Dashboard: React.FC = () => {
  const { setScreen } = useAppStore();
  const { loadProject } = useSessionStore();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'recent' | 'templates'>('recent');
  const [newProjectName, setNewProjectName] = useState('');
  const [showNewForm, setShowNewForm] = useState(false);
  const newNameRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listProjects().then(p => { setProjects(p); setIsLoading(false); });
  }, []);

  useEffect(() => {
    if (showNewForm) newNameRef.current?.focus();
  }, [showNewForm]);

  const openProject = (p: Project) => {
    loadProject(p);
    setScreen('editor');
  };

  const handleNew = async () => {
    const name = newProjectName.trim() || 'Untitled Project';
    const p = createBlankProject(name);
    await saveProject(p);
    openProject(p);
  };

  const handleTemplate = async (tplId: string) => {
    const tpl = TEMPLATES.find(t => t.id === tplId);
    if (!tpl) return;
    const p = tpl.create();
    p.id = generateId();
    p.createdAt = new Date().toISOString();
    p.modifiedAt = new Date().toISOString();
    await saveProject(p);
    openProject(p);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Delete this project?')) return;
    await deleteProject(id);
    setProjects(prev => prev.filter(p => p.id !== id));
  };

  const handleDuplicate = async (project: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    const dup: Project = {
      ...JSON.parse(JSON.stringify(project)),
      id: generateId(),
      name: `${project.name} (copy)`,
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
    };
    await saveProject(dup);
    setProjects(prev => [dup, ...prev]);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string) as Project;
        if (!data.id || !data.sheets) throw new Error('Invalid project file');
        data.id = generateId(); // new ID to avoid collision
        data.modifiedAt = new Date().toISOString();
        await saveProject(data);
        openProject(data);
      } catch {
        alert('Failed to import project: invalid or corrupt file.');
      }
    };
    reader.readAsText(file);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div style={{
      width: '100vw', height: '100vh',
      background: 'var(--bg-app)',
      display: 'flex', flexDirection: 'column',
      fontFamily: 'var(--font-ui)',
    }}>
      {/* Top bar */}
      <div style={{
        height: 56, borderBottom: '1px solid var(--border-divider)',
        background: 'var(--bg-panel)', display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Zap size={20} color="var(--cs-accent)" />
          <span style={{ fontSize: 18, fontWeight: 700 }}>CircuitSpace</span>
          <span style={{
            fontSize: 10, padding: '2px 6px', borderRadius: 3,
            background: 'rgba(0,163,255,0.15)', color: 'var(--cs-accent)', fontWeight: 600,
          }}>AVIONICS CAD</span>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <label htmlFor="import-input">
            <button
              className="btn"
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
              onClick={() => importRef.current?.click()}
            >
              <Upload size={14} /> Import .cspace.json
            </button>
          </label>
          <input ref={importRef} type="file" accept=".json,.cspace.json" onChange={handleImport} style={{ display: 'none' }} />
          <button
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
            onClick={() => setShowNewForm(true)}
          >
            <Plus size={14} /> New Project
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left column: tagline + new project */}
        <div style={{
          width: 300, borderRight: '1px solid var(--border-divider)',
          padding: 24, display: 'flex', flexDirection: 'column', gap: 20, flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 20 }}>
              Rocket avionics CAD with 60+ components, 25+ electrical checks, live power/mass analysis & 8 design templates.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {['60+ aerospace components', '30 ERC validation rules', 'Live power & mass analysis', '8 starter templates', '6 export formats', 'IndexedDB project persistence'].map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                  <span style={{ color: 'var(--status-success)', fontSize: 14 }}>✓</span>
                  {f}
                </div>
              ))}
            </div>
          </div>

          {showNewForm && (
            <div style={{
              padding: 16, background: 'var(--bg-surface)', borderRadius: 6,
              border: '1px solid var(--border-divider)', display: 'flex', flexDirection: 'column', gap: 10,
            }}>
              <div style={{ fontSize: 12, fontWeight: 600 }}>New Project</div>
              <input
                ref={newNameRef}
                value={newProjectName}
                onChange={e => setNewProjectName(e.target.value)}
                placeholder="Project name…"
                onKeyDown={e => { if (e.key === 'Enter') handleNew(); if (e.key === 'Escape') setShowNewForm(false); }}
                style={{ width: '100%', height: 32, padding: '0 10px' }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" onClick={handleNew} style={{ flex: 1, fontSize: 12 }}>Create</button>
                <button className="btn" onClick={() => setShowNewForm(false)} style={{ fontSize: 12 }}>Cancel</button>
              </div>
            </div>
          )}

          <div style={{ marginTop: 'auto', fontSize: 10, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
            Keyboard shortcuts: <kbd style={{ background: 'var(--bg-surface)', padding: '1px 4px', borderRadius: 2 }}>⌘K</kbd> command palette
          </div>
        </div>

        {/* Main content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Tabs */}
          <div style={{ borderBottom: '1px solid var(--border-divider)', padding: '0 24px', display: 'flex', gap: 2, background: 'var(--bg-panel)', flexShrink: 0 }}>
            {[
              { id: 'recent' as const, label: 'Recent Projects', icon: <Clock size={14} /> },
              { id: 'templates' as const, label: 'Templates', icon: <LayoutTemplate size={14} /> },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '10px 16px', background: 'none', border: 'none',
                  borderBottom: activeTab === tab.id ? '2px solid var(--cs-accent)' : '2px solid transparent',
                  color: activeTab === tab.id ? 'var(--cs-accent)' : 'var(--text-secondary)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500,
                }}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
            {activeTab === 'recent' && (
              <>
                {isLoading && <p style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>Loading projects…</p>}
                {!isLoading && projects.length === 0 && (
                  <div style={{ textAlign: 'center', paddingTop: 60, color: 'var(--text-tertiary)' }}>
                    <FolderOpen size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
                    <p style={{ fontSize: 14, marginBottom: 8 }}>No projects yet</p>
                    <p style={{ fontSize: 12 }}>Create a new project or start from a template.</p>
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                  {projects.map(p => (
                    <div
                      key={p.id}
                      onClick={() => openProject(p)}
                      style={{
                        background: 'var(--bg-panel)', border: '1px solid var(--border-divider)',
                        borderRadius: 8, padding: 16, cursor: 'pointer',
                        transition: 'border-color 0.15s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--cs-accent)')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-divider)')}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, flex: 1, marginRight: 8 }}>{p.name}</div>
                        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                          <button className="btn-icon" onClick={(e) => handleDuplicate(p, e)} title="Duplicate"><Copy size={13} /></button>
                          <button className="btn-icon" onClick={(e) => handleDelete(p.id, e)} title="Delete" style={{ color: 'var(--status-error)' }}><Trash2 size={13} /></button>
                        </div>
                      </div>
                      {p.description && (
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 10, lineHeight: 1.4 }}>{p.description}</div>
                      )}
                      {p.stats && (
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                          {[
                            { v: `${p.stats.componentCount} components` },
                            { v: `${p.stats.netCount} nets` },
                            p.stats.errorCount > 0 ? { v: `${p.stats.errorCount} errors`, c: 'var(--status-error)' } : null,
                            p.stats.warningCount > 0 ? { v: `${p.stats.warningCount} warnings`, c: 'var(--status-warning)' } : null,
                            { v: formatMassG(p.stats.totalMassGrams) },
                            p.stats.estimatedRuntimeHours ? { v: formatTimeHours(p.stats.estimatedRuntimeHours) } : null,
                          ].filter(Boolean).map((stat, i) => (
                            <span key={i} style={{ fontSize: 10, color: stat!.c ?? 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                              {stat!.v}
                            </span>
                          ))}
                        </div>
                      )}
                      <div style={{ marginTop: 10, fontSize: 10, color: 'var(--text-tertiary)' }}>
                        Modified {formatDate(p.modifiedAt)}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {activeTab === 'templates' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                {TEMPLATES.map(tpl => (
                  <div
                    key={tpl.id}
                    onClick={() => handleTemplate(tpl.id)}
                    style={{
                      background: 'var(--bg-panel)', border: '1px solid var(--border-divider)',
                      borderRadius: 8, padding: 16, cursor: 'pointer',
                      transition: 'border-color 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--cs-accent)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-divider)')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <LayoutTemplate size={16} color="var(--cs-accent)" />
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{tpl.name}</div>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      {tpl.description}
                    </div>
                    <div style={{ marginTop: 12 }}>
                      <button className="btn btn-primary" style={{ fontSize: 11, padding: '4px 12px' }}>
                        Use Template →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
