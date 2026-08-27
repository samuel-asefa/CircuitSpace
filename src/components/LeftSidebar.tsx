import React from 'react';
import { useAppStore } from '../state/appStore';
import { useSessionStore } from '../state/sessionStore';
import { ComponentLibrary } from './ComponentLibrary';
import { TEMPLATES } from '../templates';
import { saveProject } from '../projects/db';
import { generateId } from '../utils/id';
import { Layers, Package, LayoutTemplate, Info } from 'lucide-react';

const ProjectTab: React.FC = () => {
  const { project, updateSettings } = useSessionStore();

  if (!project) return null;

  return (
    <div style={{ overflowY: 'auto', height: '100%', padding: '12px 14px' }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{project.name}</div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
          Created {new Date(project.createdAt).toLocaleDateString()}
        </div>
      </div>

      {/* Sheets */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-tertiary)', marginBottom: 6 }}>
          Sheets
        </div>
        {project.sheets.map(s => (
          <div key={s.id} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px',
            background: 'var(--bg-surface)', borderRadius: 4, marginBottom: 4,
          }}>
            <Layers size={12} color="var(--cs-accent)" />
            <span style={{ fontSize: 12 }}>{s.name}</span>
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>{s.components.length} comps</span>
          </div>
        ))}
      </div>

      {/* Project Settings */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-tertiary)', marginBottom: 8 }}>
          Project Settings
        </div>
        {([
          { key: 'nominalBusVoltageV', label: 'Bus Voltage', unit: 'V' },
          { key: 'targetRuntimeHours', label: 'Target Runtime', unit: 'h' },
          { key: 'batteryReservePercent', label: 'Battery Reserve', unit: '%' },
          { key: 'maxMassGrams', label: 'Mass Budget', unit: 'g' },
          { key: 'powerBudgetW', label: 'Power Budget', unit: 'W' },
        ] as const).map(field => (
          <div key={field.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{field.label}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input
                type="number"
                defaultValue={project.settings[field.key]}
                onBlur={e => {
                  const v = parseFloat(e.target.value);
                  if (!isNaN(v)) updateSettings({ [field.key]: v });
                }}
                style={{ width: 70, fontSize: 11, fontFamily: 'var(--font-mono)', textAlign: 'right', height: 24 }}
              />
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)', width: 16 }}>{field.unit}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const TemplatesTab: React.FC = () => {
  const { loadProject } = useSessionStore();
  const { saveProject: _save } = { saveProject };

  const handleTemplate = async (tplId: string) => {
    const tpl = TEMPLATES.find(t => t.id === tplId);
    if (!tpl) return;
    const p = tpl.create();
    p.id = generateId();
    p.createdAt = new Date().toISOString();
    p.modifiedAt = new Date().toISOString();
    await saveProject(p);
    loadProject(p);
  };

  return (
    <div style={{ overflowY: 'auto', height: '100%', padding: '8px 0' }}>
      {TEMPLATES.filter(t => t.id !== 'tpl-blank').map(tpl => (
        <div
          key={tpl.id}
          onClick={() => handleTemplate(tpl.id)}
          style={{
            padding: '8px 14px', cursor: 'pointer',
            borderBottom: '1px solid var(--border-divider)',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 2 }}>{tpl.name}</div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', lineHeight: 1.4 }}>{tpl.description}</div>
        </div>
      ))}
    </div>
  );
};

export const LeftSidebar: React.FC = () => {
  const { activeLeftTab, setActiveLeftTab } = useAppStore();

  const TABS = [
    { id: 'project' as const, icon: <Info size={14} />, label: 'Project' },
    { id: 'components' as const, icon: <Package size={14} />, label: 'Components' },
    { id: 'templates' as const, icon: <LayoutTemplate size={14} />, label: 'Templates' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: 260, borderRight: '1px solid var(--border-divider)', background: 'var(--bg-panel)', flexShrink: 0 }}>
      {/* Tab strip */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-divider)', flexShrink: 0 }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveLeftTab(tab.id as any)}
            style={{
              flex: 1, padding: '8px 4px', border: 'none', borderBottom: `2px solid ${activeLeftTab === tab.id ? 'var(--cs-accent)' : 'transparent'}`,
              background: 'transparent', cursor: 'pointer',
              color: activeLeftTab === tab.id ? 'var(--cs-accent)' : 'var(--text-secondary)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              fontSize: 9, fontWeight: activeLeftTab === tab.id ? 600 : 400,
              textTransform: 'uppercase', letterSpacing: '0.3px',
            }}
            title={tab.label}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {activeLeftTab === 'project' && <ProjectTab />}
        {activeLeftTab === 'components' && <ComponentLibrary />}
        {activeLeftTab === 'templates' && <TemplatesTab />}
      </div>
    </div>
  );
};
