import React, { useMemo, useState } from 'react';
import { useSessionStore } from '../state/sessionStore';
import { useAppStore } from '../state/appStore';
import { CATALOG_BY_ID } from '../catalog';
import { buildNetGraph } from '../electrical/netGraph';
import { generateBomData } from '../export';
import { formatVoltage, formatCurrentMa, formatPowerW, formatMassG, formatTimeHours, formatCostUsd } from '../utils/units';
import { AlertCircle, AlertTriangle, Info, CheckCircle, ChevronUp, ChevronDown, ArrowUpDown } from 'lucide-react';
import type { ValidationSeverity } from '../types';

const SEVERITY_ICON: Record<ValidationSeverity, React.ReactNode> = {
  error: <AlertCircle size={13} color="var(--status-error)" />,
  warning: <AlertTriangle size={13} color="var(--status-warning)" />,
  info: <Info size={13} color="var(--status-info)" />,
  passed: <CheckCircle size={13} color="var(--status-success)" />,
};

// ─── Problems Tab ─────────────────────────────────────────────────────────────
const ProblemsTab: React.FC = () => {
  const { issues, setSelection } = useSessionStore();

  const handleIssueClick = (issue: typeof issues[number]) => {
    if (issue.componentId) setSelection([issue.componentId], []);
    else if (issue.wireId) setSelection([], [issue.wireId]);
  };

  if (issues.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 8, color: 'var(--text-tertiary)' }}>
        <CheckCircle size={24} color="var(--status-success)" />
        <span style={{ fontSize: 12 }}>No issues detected</span>
      </div>
    );
  }

  return (
    <div style={{ overflowY: 'auto', height: '100%' }}>
      {issues.map(issue => (
        <div
          key={issue.id}
          onClick={() => handleIssueClick(issue)}
          style={{
            display: 'flex', alignItems: 'flex-start', gap: 10, padding: '7px 14px',
            borderBottom: '1px solid var(--border-divider)', cursor: issue.componentId || issue.wireId ? 'pointer' : 'default',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <span style={{ paddingTop: 1, flexShrink: 0 }}>{SEVERITY_ICON[issue.severity]}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 500 }}>{issue.title}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4, marginTop: 1 }}>{issue.message}</div>
            {issue.remediation && (
              <div style={{ fontSize: 10, color: 'var(--cs-accent)', marginTop: 3 }}>💡 {issue.remediation}</div>
            )}
          </div>
          <span style={{ fontSize: 10, color: 'var(--text-tertiary)', flexShrink: 0 }}>{issue.ruleId}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Power Tab ────────────────────────────────────────────────────────────────
const PowerTab: React.FC = () => {
  const { analysis } = useSessionStore();
  if (!analysis) return <EmptyState msg="Run ERC to see power analysis" />;

  return (
    <div style={{ padding: '10px 14px', overflowY: 'auto', height: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* System summary */}
      <div>
        <SectionHead>System</SectionHead>
        <MetricGrid metrics={[
          { label: 'Nominal current', value: formatCurrentMa(analysis.totalNominalCurrentMa) },
          { label: 'Peak current', value: formatCurrentMa(analysis.totalPeakCurrentMa) },
          { label: 'Total power', value: formatPowerW(analysis.totalPowerW) },
          { label: 'Est. runtime', value: analysis.estimatedRuntimeHours ? formatTimeHours(analysis.estimatedRuntimeHours) : '—' },
          { label: 'Battery reserve', value: `${analysis.batteryReservePercent.toFixed(0)}%` },
        ]} />
      </div>

      {/* Power sources */}
      {analysis.powerSources.length > 0 && (
        <div>
          <SectionHead>Power Sources</SectionHead>
          {analysis.powerSources.map(s => (
            <div key={s.componentId} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontWeight: 600, fontSize: 12 }}>{s.refDes} — {s.name}</span>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{formatVoltage(s.voltageV)}</span>
              </div>
              <MetricGrid metrics={[
                { label: 'Capacity', value: s.capacityMah ? `${s.capacityMah} mAh` : '—' },
                { label: 'Load', value: formatCurrentMa(s.nominalCurrentMa) },
                { label: 'Peak', value: formatCurrentMa(s.peakCurrentMa) },
              ]} />
            </div>
          ))}
        </div>
      )}

      {/* Regulators */}
      {analysis.regulators.length > 0 && (
        <div>
          <SectionHead>Regulators</SectionHead>
          {analysis.regulators.map(r => (
            <div key={r.componentId} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontWeight: 600, fontSize: 12 }}>{r.refDes} — {r.name}</span>
                <span style={{ fontSize: 11, color: r.isOverloaded ? 'var(--status-error)' : 'var(--text-secondary)' }}>
                  {r.isOverloaded ? '⚠ OVERLOADED' : `${r.utilizationPercent.toFixed(0)}%`}
                </span>
              </div>
              <MetricGrid metrics={[
                { label: 'Vin', value: formatVoltage(r.inputVoltageV) },
                { label: 'Vout', value: formatVoltage(r.outputVoltageV) },
                { label: 'Headroom', value: r.headroomV != null ? formatVoltage(r.headroomV) : '—' },
                { label: 'Efficiency', value: `${r.efficiencyPercent.toFixed(0)}%` },
              ]} />
            </div>
          ))}
        </div>
      )}

      {/* Loads */}
      {analysis.loads.length > 0 && (
        <div>
          <SectionHead>Loads</SectionHead>
          <table className="data-table" style={{ fontSize: 11 }}>
            <thead>
              <tr>
                <th>Ref</th><th>Name</th><th>Nominal</th><th>Peak</th><th>Supply</th>
              </tr>
            </thead>
            <tbody>
              {analysis.loads.map(l => (
                <tr key={l.componentId}>
                  <td>{l.refDes}</td>
                  <td>{l.name}</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{formatCurrentMa(l.nominalCurrentMa)}</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{formatCurrentMa(l.peakCurrentMa)}</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{formatVoltage(l.supplyVoltageV)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ─── Mass Tab ─────────────────────────────────────────────────────────────────
const MassTab: React.FC = () => {
  const { analysis } = useSessionStore();
  if (!analysis) return <EmptyState msg="No analysis available" />;

  return (
    <div style={{ padding: '10px 14px', overflowY: 'auto', height: '100%' }}>
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>Total Mass</span>
        <span style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--cs-accent)' }}>
          {formatMassG(analysis.totalMassGrams)}
        </span>
      </div>
      <table className="data-table" style={{ fontSize: 11 }}>
        <thead>
          <tr><th>Category</th><th>Count</th><th>Mass</th><th>Share</th></tr>
        </thead>
        <tbody>
          {analysis.massByCategory
            .sort((a, b) => b.massGrams - a.massGrams)
            .map(m => (
              <tr key={m.category}>
                <td>{m.category}</td>
                <td style={{ fontFamily: 'var(--font-mono)' }}>{m.componentCount}</td>
                <td style={{ fontFamily: 'var(--font-mono)' }}>{formatMassG(m.massGrams)}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{
                      width: 60, height: 6, borderRadius: 3, background: 'var(--border-divider)', overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${(m.massGrams / analysis.totalMassGrams * 100).toFixed(0)}%`,
                        height: '100%', background: 'var(--cs-accent)'
                      }} />
                    </div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>
                      {(m.massGrams / analysis.totalMassGrams * 100).toFixed(0)}%
                    </span>
                  </div>
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
};

// ─── BOM Tab ──────────────────────────────────────────────────────────────────
type BomSortKey = 'category' | 'name' | 'qty' | 'mass' | 'cost';

const BomTab: React.FC = () => {
  const { project } = useSessionStore();
  const [sortKey, setSortKey] = useState<BomSortKey>('category');
  const [sortDir, setSortDir] = useState<1 | -1>(1);

  const bom = useMemo(() => {
    if (!project) return [];
    return generateBomData(project);
  }, [project]);

  const sorted = useMemo(() => [...bom].sort((a, b) => {
    let av: string | number = 0, bv: string | number = 0;
    switch (sortKey) {
      case 'category': av = a.category; bv = b.category; break;
      case 'name': av = a.name; bv = b.name; break;
      case 'qty': av = a.quantity; bv = b.quantity; break;
      case 'mass': av = a.totalMassGrams; bv = b.totalMassGrams; break;
      case 'cost': av = a.totalCostUsd ?? -1; bv = b.totalCostUsd ?? -1; break;
    }
    if (av < bv) return -sortDir;
    if (av > bv) return sortDir;
    return 0;
  }), [bom, sortKey, sortDir]);

  const totalMass = bom.reduce((s, e) => s + e.totalMassGrams, 0);
  const totalCost = bom.reduce((s, e) => s + (e.totalCostUsd ?? 0), 0);
  const totalQty = bom.reduce((s, e) => s + e.quantity, 0);

  const toggleSort = (key: BomSortKey) => {
    if (sortKey === key) setSortDir(d => d === 1 ? -1 : 1);
    else { setSortKey(key); setSortDir(1); }
  };

  const SortTh: React.FC<{ k: BomSortKey; label: string }> = ({ k, label }) => (
    <th onClick={() => toggleSort(k)} style={{ cursor: 'pointer', userSelect: 'none' }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        {label} {sortKey === k ? (sortDir === 1 ? <ChevronUp size={10} /> : <ChevronDown size={10} />) : <ArrowUpDown size={10} opacity={0.3} />}
      </span>
    </th>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Summary row */}
      <div style={{ padding: '6px 14px', borderBottom: '1px solid var(--border-divider)', display: 'flex', gap: 24, flexShrink: 0 }}>
        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{bom.length} unique parts · {totalQty} total</span>
        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>{formatMassG(totalMass)}</span>
        {totalCost > 0 && <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>{formatCostUsd(totalCost)}</span>}
      </div>
      <div style={{ overflowY: 'auto', flex: 1 }}>
        <table className="data-table" style={{ fontSize: 11 }}>
          <thead>
            <tr>
              <th>References</th>
              <SortTh k="name" label="Component" />
              <SortTh k="category" label="Category" />
              <SortTh k="qty" label="Qty" />
              <SortTh k="mass" label="Mass" />
              <SortTh k="cost" label="Cost" />
            </tr>
          </thead>
          <tbody>
            {sorted.map(e => (
              <tr key={e.defId}>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>{e.references.join(', ')}</td>
                <td>{e.name}</td>
                <td style={{ color: 'var(--text-secondary)' }}>{e.category}</td>
                <td style={{ fontFamily: 'var(--font-mono)', textAlign: 'center' }}>{e.quantity}</td>
                <td style={{ fontFamily: 'var(--font-mono)' }}>{formatMassG(e.totalMassGrams)}</td>
                <td style={{ fontFamily: 'var(--font-mono)' }}>{e.totalCostUsd != null ? formatCostUsd(e.totalCostUsd) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── Netlist Tab ──────────────────────────────────────────────────────────────
const NetlistTab: React.FC = () => {
  const { project, activeSheetId } = useSessionStore();
  const [expandedNet, setExpandedNet] = useState<string | null>(null);

  const nets = useMemo(() => {
    const sheet = project?.sheets.find(s => s.id === activeSheetId);
    if (!sheet || !project) return [];
    const netMap = buildNetGraph(sheet);
    return Array.from(netMap.values())
      .filter(n => n.pins.length > 0)
      .sort((a, b) => {
        if (a.isGround) return -1;
        if (b.isGround) return 1;
        if (a.isPower) return -1;
        if (b.isPower) return 1;
        return a.name.localeCompare(b.name);
      });
  }, [project, activeSheetId]);

  const sheet = project?.sheets.find(s => s.id === activeSheetId);

  return (
    <div style={{ overflowY: 'auto', height: '100%' }}>
      {nets.map(net => {
        const isExpanded = expandedNet === net.id;
        const badge = net.isGround ? 'GND' : net.isPower ? 'PWR' : 'SIG';
        const badgeColor = net.isGround ? 'var(--text-tertiary)' : net.isPower ? 'var(--status-success)' : 'var(--cs-accent)';
        return (
          <div key={net.id}>
            <div
              onClick={() => setExpandedNet(isExpanded ? null : net.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px',
                borderBottom: '1px solid var(--border-divider)', cursor: 'pointer',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{
                fontSize: 9, padding: '1px 5px', borderRadius: 2, border: `1px solid ${badgeColor}`,
                color: badgeColor, fontWeight: 600, flexShrink: 0,
              }}>{badge}</span>
              <span style={{ fontSize: 12, fontWeight: 500, flex: 1, fontFamily: 'var(--font-mono)' }}>{net.name}</span>
              {net.inferredVoltageV != null && (
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                  {formatVoltage(net.inferredVoltageV)}
                </span>
              )}
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{net.pins.length} pins</span>
              {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </div>
            {isExpanded && (
              <div style={{ background: 'var(--bg-app)', borderBottom: '1px solid var(--border-divider)' }}>
                {net.pins.map((p, i) => {
                  const comp = sheet?.components.find(c => c.id === p.componentId);
                  const def = comp ? CATALOG_BY_ID[comp.definitionId] : null;
                  const pin = def?.pins.find(pd => pd.id === p.pinId);
                  return (
                    <div key={i} style={{
                      display: 'flex', gap: 12, padding: '3px 28px',
                      fontSize: 10, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-divider)',
                    }}>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{comp?.refDes ?? '?'}</span>
                      <span>{def?.name ?? '?'}</span>
                      <span style={{ color: 'var(--text-tertiary)' }}>pin: {pin?.label ?? p.pinId}</span>
                      <span style={{ color: 'var(--text-tertiary)', marginLeft: 'auto' }}>{pin?.type ?? ''}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      {nets.length === 0 && <EmptyState msg="No nets — connect components with wires" />}
    </div>
  );
};

// ─── Shared Helpers ───────────────────────────────────────────────────────────
const EmptyState: React.FC<{ msg: string }> = ({ msg }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-tertiary)', fontSize: 12 }}>
    {msg}
  </div>
);

const SectionHead: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{
    fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px',
    color: 'var(--text-tertiary)', marginBottom: 6, paddingBottom: 4, borderBottom: '1px solid var(--border-divider)',
  }}>
    {children}
  </div>
);

const MetricGrid: React.FC<{ metrics: { label: string; value: React.ReactNode }[] }> = ({ metrics }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 16px' }}>
    {metrics.map(m => (
      <div key={String(m.label)} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', borderBottom: '1px solid var(--border-divider)' }}>
        <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{m.label}</span>
        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>{m.value}</span>
      </div>
    ))}
  </div>
);

// ─── Bottom Panel ─────────────────────────────────────────────────────────────
export const BottomPanel: React.FC = () => {
  const { bottomPanelOpen, activeBottomTab, setActiveBottomTab, setBottomPanelOpen } = useAppStore();
  const { issues } = useSessionStore();

  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warnCount = issues.filter(i => i.severity === 'warning').length;

  const TABS = [
    { id: 'problems' as const, label: 'Problems', badge: errorCount > 0 ? { count: errorCount, color: 'var(--status-error)' } : warnCount > 0 ? { count: warnCount, color: 'var(--status-warning)' } : null },
    { id: 'power' as const, label: 'Power' },
    { id: 'mass' as const, label: 'Mass' },
    { id: 'bom' as const, label: 'BOM' },
    { id: 'netlist' as const, label: 'Netlist' },
  ];

  return (
    <div style={{
      borderTop: '1px solid var(--border-divider)',
      background: 'var(--bg-panel)',
      display: 'flex', flexDirection: 'column',
      height: bottomPanelOpen ? 260 : 32,
      flexShrink: 0, transition: 'height 0.15s ease',
    }}>
      {/* Tab bar */}
      <div style={{
        height: 32, display: 'flex', alignItems: 'center', borderBottom: bottomPanelOpen ? '1px solid var(--border-divider)' : 'none',
        paddingLeft: 8, gap: 2, flexShrink: 0,
      }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveBottomTab(tab.id);
              if (!bottomPanelOpen) setBottomPanelOpen(true);
            }}
            style={{
              fontSize: 11, padding: '3px 10px', border: 'none', borderRadius: 3, cursor: 'pointer',
              background: activeBottomTab === tab.id && bottomPanelOpen ? 'rgba(0,163,255,0.12)' : 'transparent',
              color: activeBottomTab === tab.id && bottomPanelOpen ? 'var(--cs-accent)' : 'var(--text-secondary)',
              fontWeight: activeBottomTab === tab.id && bottomPanelOpen ? 600 : 400,
              display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            {tab.label}
            {tab.badge && (
              <span style={{
                background: tab.badge.color, color: '#fff', fontSize: 9,
                borderRadius: 8, padding: '0 5px', fontWeight: 700,
              }}>
                {tab.badge.count}
              </span>
            )}
          </button>
        ))}
        <button
          onClick={() => setBottomPanelOpen(!bottomPanelOpen)}
          style={{ marginLeft: 'auto', marginRight: 8, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}
        >
          {bottomPanelOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
      </div>

      {/* Tab content */}
      {bottomPanelOpen && (
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {activeBottomTab === 'problems' && <ProblemsTab />}
          {activeBottomTab === 'power' && <PowerTab />}
          {activeBottomTab === 'mass' && <MassTab />}
          {activeBottomTab === 'bom' && <BomTab />}
          {activeBottomTab === 'netlist' && <NetlistTab />}
        </div>
      )}
    </div>
  );
};
