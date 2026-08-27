import React, { useEffect, useState } from 'react';
import { useSessionStore } from '../state/sessionStore';
import { formatCurrentMa, formatPowerW, formatMassG } from '../utils/units';

export const StatusBar: React.FC = () => {
  const { project, analysis, issues, view } = useSessionStore();
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');

  useEffect(() => {
    if (!project) return;
    setSaveStatus('unsaved');
    const timer = setTimeout(() => setSaveStatus('saved'), 1200);
    return () => clearTimeout(timer);
  }, [project?.modifiedAt]);

  if (!project || !analysis) return (
    <div style={{ height: 24, borderTop: '1px solid var(--border-divider)', background: 'var(--bg-surface)', display: 'flex', alignItems: 'center', padding: '0 12px' }}>
      <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>CircuitSpace — Rocket Avionics CAD</span>
    </div>
  );

  const errCount = issues.filter(i => i.severity === 'error').length;
  const warnCount = issues.filter(i => i.severity === 'warning').length;

  const items: { label: string; value: string; color?: string }[] = [
    { label: 'components', value: String(analysis.componentCount) },
    { label: 'nets', value: String(analysis.netCount) },
    { label: 'errors', value: String(errCount), color: errCount > 0 ? 'var(--status-error)' : undefined },
    { label: 'warnings', value: String(warnCount), color: warnCount > 0 ? 'var(--status-warning)' : undefined },
    { label: '', value: formatCurrentMa(analysis.totalNominalCurrentMa) },
    { label: '', value: formatPowerW(analysis.totalPowerW) },
    { label: '', value: formatMassG(analysis.totalMassGrams) },
  ];

  return (
    <div style={{
      height: 24, borderTop: '1px solid var(--border-divider)',
      background: 'var(--bg-surface)', display: 'flex', alignItems: 'center',
      padding: '0 12px', gap: 1, flexShrink: 0,
    }}>
      {items.map((item, i) => (
        <React.Fragment key={i}>
          <span style={{
            fontSize: 10, fontFamily: 'var(--font-mono)',
            color: item.color ?? 'var(--text-secondary)',
            padding: '0 6px',
          }}>
            {item.value}{item.label ? ` ${item.label}` : ''}
          </span>
          {i < items.length - 1 && (
            <span style={{ color: 'var(--text-tertiary)', fontSize: 10 }}>·</span>
          )}
        </React.Fragment>
      ))}
      <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-tertiary)' }}>
        {Math.round(view.zoom * 100)}%
      </span>
      <span style={{ marginLeft: 12, fontSize: 10, color: saveStatus === 'unsaved' ? 'var(--status-warning)' : 'var(--text-tertiary)' }}>
        {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'unsaved' ? 'Unsaved' : '● Saved'}
      </span>
    </div>
  );
};
