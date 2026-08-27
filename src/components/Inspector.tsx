import React from 'react';
import { useSessionStore } from '../state/sessionStore';
import { CATALOG_BY_ID } from '../catalog';
import type { ComponentInstance } from '../types';
import { formatVoltage, formatCurrentMa, formatPowerW, formatMassG } from '../utils/units';
import { RotateCw, Trash2, Copy } from 'lucide-react';

const Field: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '3px 0', borderBottom: '1px solid var(--border-divider)' }}>
    <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{label}</span>
    <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}>{value}</span>
  </div>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div style={{ marginBottom: 16 }}>
    <div style={{
      fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px',
      color: 'var(--text-tertiary)', marginBottom: 6, paddingBottom: 4,
      borderBottom: '1px solid var(--border-divider)'
    }}>
      {title}
    </div>
    {children}
  </div>
);

const EditableField: React.FC<{
  label: string;
  value: string | number | boolean;
  type?: 'text' | 'number';
  unit?: string;
  onChange: (v: string | number) => void;
}> = ({ label, value, type = 'text', unit, onChange }) => {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0', gap: 8 }}>
      <span style={{ color: 'var(--text-secondary)', fontSize: 11, flexShrink: 0 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <input
          type={type}
          defaultValue={String(value)}
          onBlur={e => {
            const v = type === 'number' ? parseFloat(e.target.value) : e.target.value;
            onChange(isNaN(v as number) ? e.target.value : v);
          }}
          style={{ width: 90, fontSize: 12, fontFamily: 'var(--font-mono)', textAlign: 'right', height: 24 }}
        />
        {unit && <span style={{ fontSize: 11, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{unit}</span>}
      </div>
    </div>
  );
};

const ComponentInspector: React.FC<{ comp: ComponentInstance }> = ({ comp }) => {
  const { updateComponentProperty, rotateComponent, deleteSelection, duplicateSelection, analysis } = useSessionStore();
  const def = CATALOG_BY_ID[comp.definitionId];
  if (!def) return null;

  const load = analysis?.loads.find(l => l.componentId === comp.id);
  const source = analysis?.powerSources.find(s => s.componentId === comp.id);
  const reg = analysis?.regulators.find(r => r.componentId === comp.id);

  return (
    <div style={{ padding: '12px 14px', overflowY: 'auto', height: '100%' }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontSize: 18, fontWeight: 700 }}>{comp.refDes}</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="btn-icon" onClick={() => rotateComponent(comp.id, 90)} title="Rotate 90°"><RotateCw size={14} /></button>
            <button className="btn-icon" onClick={() => duplicateSelection()} title="Duplicate"><Copy size={14} /></button>
            <button className="btn-icon" onClick={() => deleteSelection()} title="Delete" style={{ color: 'var(--status-error)' }}><Trash2 size={14} /></button>
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{def.name}</div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{def.category} · {def.subcategory ?? ''}</div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4, lineHeight: 1.4 }}>{def.description}</div>
      </div>

      {/* Identity */}
      <Section title="Reference">
        <EditableField label="RefDes" value={comp.refDes} onChange={v => updateComponentProperty(comp.id, 'refDes', v)} />
      </Section>

      {/* Editable Properties */}
      {def.editableProps.length > 0 && (
        <Section title="Properties">
          {def.editableProps.map(prop => (
            <EditableField
              key={prop.key}
              label={prop.label}
              value={(comp.properties[prop.key] ?? prop.defaultValue) as string | number}
              type={prop.type === 'number' ? 'number' : 'text'}
              unit={prop.unit}
              onChange={v => updateComponentProperty(comp.id, prop.key, v)}
            />
          ))}
        </Section>
      )}

      {/* Electrical (from analysis) */}
      {(source || load || reg) && (
        <Section title="Analysis">
          {source && (
            <>
              <Field label="Voltage" value={formatVoltage(source.voltageV)} />
              <Field label="Capacity" value={source.capacityMah ? `${source.capacityMah} mAh` : '—'} />
              <Field label="Load current" value={formatCurrentMa(source.nominalCurrentMa)} />
            </>
          )}
          {reg && (
            <>
              <Field label="Input" value={formatVoltage(reg.inputVoltageV)} />
              <Field label="Output" value={formatVoltage(reg.outputVoltageV)} />
              <Field label="Load" value={formatCurrentMa(reg.nominalOutputCurrentMa)} />
              <Field label="Headroom" value={reg.headroomV != null ? formatVoltage(reg.headroomV) : '—'} />
              <Field label="Utilization" value={`${reg.utilizationPercent.toFixed(0)}%`} />
              {reg.isOverloaded && (
                <div style={{ color: 'var(--status-error)', fontSize: 11, marginTop: 4, fontWeight: 500 }}>
                  ⚠ OVERLOADED
                </div>
              )}
            </>
          )}
          {load && (
            <>
              <Field label="Nominal Idc" value={formatCurrentMa(load.nominalCurrentMa)} />
              <Field label="Peak Idc" value={formatCurrentMa(load.peakCurrentMa)} />
              <Field label="Supply" value={formatVoltage(load.supplyVoltageV)} />
            </>
          )}
        </Section>
      )}

      {/* Physical */}
      <Section title="Physical">
        <Field label="Mass" value={formatMassG(def.massGrams)} />
        {def.costUsd != null && <Field label="Est. cost" value={`$${def.costUsd.toFixed(2)}`} />}
      </Section>

      {/* Pins */}
      <Section title={`Pins (${def.pins.length})`}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 8px' }}>
          {def.pins.map(pin => (
            <div key={pin.id} style={{ fontSize: 10, display: 'flex', justifyContent: 'space-between', padding: '2px 0', borderBottom: '1px solid var(--border-divider)' }}>
              <span style={{ color: 'var(--text-tertiary)' }}>{pin.label}</span>
              <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{pin.type}</span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
};

const EmptyInspector: React.FC = () => {
  const { analysis, issues, project } = useSessionStore();
  return (
    <div style={{ padding: '12px 14px' }}>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-tertiary)', marginBottom: 12 }}>
        Project
      </div>
      {project && (
        <>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{project.name}</div>
          {project.description && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 12, lineHeight: 1.4 }}>{project.description}</div>}
        </>
      )}
      {analysis && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[
            ['Components', analysis.componentCount],
            ['Nets', analysis.netCount],
            ['Nominal Current', formatCurrentMa(analysis.totalNominalCurrentMa)],
            ['Peak Current', formatCurrentMa(analysis.totalPeakCurrentMa)],
            ['Total Power', formatPowerW(analysis.totalPowerW)],
            ['Total Mass', formatMassG(analysis.totalMassGrams)],
            ['Errors', issues.filter(i => i.severity === 'error').length],
            ['Warnings', issues.filter(i => i.severity === 'warning').length],
          ].map(([label, value]) => (
            <div key={String(label)} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid var(--border-divider)' }}>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{label}</span>
              <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}>{value}</span>
            </div>
          ))}
        </div>
      )}
      {!analysis && (
        <div style={{ color: 'var(--text-tertiary)', fontSize: 11, marginTop: 8 }}>
          Select a component to inspect it, or run ERC to see analysis.
        </div>
      )}
    </div>
  );
};

export const Inspector: React.FC = () => {
  const { selection, project, activeSheetId } = useSessionStore();
  const sheet = project?.sheets.find(s => s.id === activeSheetId);
  const selectedComp = selection.components.length === 1
    ? sheet?.components.find(c => c.id === selection.components[0]) ?? null
    : null;

  return (
    <div style={{
      width: 240, borderLeft: '1px solid var(--border-divider)',
      background: 'var(--bg-panel)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      <div className="panel-header">{selectedComp ? 'Inspector' : 'Project Summary'}</div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {selectedComp ? <ComponentInspector comp={selectedComp} /> : <EmptyInspector />}
      </div>
    </div>
  );
};
