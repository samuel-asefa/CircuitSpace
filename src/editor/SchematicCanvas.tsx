import React, { useRef, useCallback, useEffect, useState } from 'react';
import { useSessionStore } from '../state/sessionStore';
import { CATALOG_BY_ID } from '../catalog';
import type { ComponentInstance } from '../types';

const GRID = 20; // pixels per grid unit at zoom=1

function snap(v: number): number {
  return Math.round(v / GRID) * GRID;
}

interface PinPos {
  x: number;
  y: number;
  pinId: string;
  componentId: string;
  label: string;
}

function getComponentPins(comp: ComponentInstance): PinPos[] {
  const def = CATALOG_BY_ID[comp.definitionId];
  if (!def) return [];
  return def.pins.map(pin => ({
    x: comp.x * GRID + pin.x * GRID,
    y: comp.y * GRID + pin.y * GRID,
    pinId: pin.id,
    componentId: comp.id,
    label: pin.label,
  }));
}

const PIN_RADIUS = 5;
const HIT_RADIUS = 10;

export const SchematicCanvas: React.FC = () => {
  const svgRef = useRef<SVGSVGElement>(null);
  const store = useSessionStore();
  const {
    project, activeSheetId,
    view, selection, hoveredComponentId, hoveredPinId,
    mode, wireStartPin, wireCurrentMouse,
    placingDefId,
    pan, setMode,
    setSelection, clearSelection, toggleSelectComponent, toggleSelectWire,
    setHoveredComponent, setHoveredPin,
    addComponent, setComponentPosition,
    startWire, finishWire, updateWireMouse, cancelWire,
    deleteSelection, rotateComponent,
    _pushHistory,
  } = store;

  const [isDragging, setIsDragging] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [dragStart, setDragStart] = useState<{ mx: number; my: number; compPositions: Map<string, { x: number; y: number }> } | null>(null);
  const [panStart, setPanStart] = useState<{ mx: number; my: number; vx: number; vy: number } | null>(null);

  const sheet = project?.sheets.find(s => s.id === activeSheetId);

  const svgToWorld = useCallback((mx: number, my: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const sx = (mx - rect.left - view.x) / view.zoom;
    const sy = (my - rect.top - view.y) / view.zoom;
    return { x: sx, y: sy };
  }, [view]);

  const gridPos = useCallback((mx: number, my: number) => {
    const { x, y } = svgToWorld(mx, my);
    return { x: snap(x) / GRID, y: snap(y) / GRID };
  }, [svgToWorld]);

  const findPinAt = useCallback((wx: number, wy: number): PinPos | null => {
    if (!sheet) return null;
    for (const comp of sheet.components) {
      for (const pin of getComponentPins(comp)) {
        const dx = pin.x - wx;
        const dy = pin.y - wy;
        if (Math.sqrt(dx * dx + dy * dy) <= HIT_RADIUS) return pin;
      }
    }
    return null;
  }, [sheet]);

  const findComponentAt = useCallback((wx: number, wy: number): ComponentInstance | null => {
    if (!sheet) return null;
    for (let i = sheet.components.length - 1; i >= 0; i--) {
      const comp = sheet.components[i];
      const def = CATALOG_BY_ID[comp.definitionId];
      if (!def) continue;
      const x1 = comp.x * GRID;
      const y1 = comp.y * GRID;
      const x2 = x1 + def.width * GRID;
      const y2 = y1 + def.height * GRID;
      if (wx >= x1 && wx <= x2 && wy >= y1 && wy <= y2) return comp;
    }
    return null;
  }, [sheet]);

  const handleMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    e.preventDefault();
    const { x: wx, y: wy } = svgToWorld(e.clientX, e.clientY);

    // Middle mouse or space: pan
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      setIsPanning(true);
      setPanStart({ mx: e.clientX, my: e.clientY, vx: view.x, vy: view.y });
      return;
    }

    if (e.button !== 0) return;

    // Placement mode
    if (mode === 'place' && placingDefId) {
      const { x, y } = gridPos(e.clientX, e.clientY);
      const def = CATALOG_BY_ID[placingDefId];
      if (def) addComponent(placingDefId, x, y, def.refPrefix);
      return;
    }

    // Wire mode
    if (mode === 'wire' || mode === 'select') {
      const pin = findPinAt(wx, wy);
      if (pin) {
        if (!wireStartPin) {
          startWire(pin.componentId, pin.pinId);
        } else {
          finishWire(pin.componentId, pin.pinId);
        }
        return;
      }
    }

    // Select mode
    if (mode === 'select') {
      const comp = findComponentAt(wx, wy);
      if (comp) {
        if (!e.shiftKey) {
          if (!selection.components.includes(comp.id)) setSelection([comp.id], []);
        } else {
          toggleSelectComponent(comp.id);
        }
        // Start drag
        const compPositions = new Map(
          (e.shiftKey ? selection.components : [comp.id]).map(id => {
            const c = sheet?.components.find(cc => cc.id === id);
            return [id, { x: c?.x ?? 0, y: c?.y ?? 0 }];
          })
        );
        setIsDragging(true);
        setDragStart({ mx: e.clientX, my: e.clientY, compPositions });
        return;
      }
      // Click on empty: deselect
      if (!e.shiftKey) clearSelection();
    }
  }, [mode, placingDefId, wireStartPin, view, selection, sheet, svgToWorld, gridPos, findPinAt, findComponentAt, addComponent, startWire, finishWire, setSelection, toggleSelectComponent, clearSelection]);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    // Pan
    if (isPanning && panStart) {
      pan(
        e.clientX - panStart.mx,
        e.clientY - panStart.my,
      );
      setPanStart({ mx: e.clientX, my: e.clientY, vx: view.x + (e.clientX - panStart.mx), vy: view.y + (e.clientY - panStart.my) });
      return;
    }

    // Drag components
    if (isDragging && dragStart) {
      const dxPx = (e.clientX - dragStart.mx) / view.zoom;
      const dyPx = (e.clientY - dragStart.my) / view.zoom;
      const dxGrid = Math.round(dxPx / GRID);
      const dyGrid = Math.round(dyPx / GRID);
      dragStart.compPositions.forEach((origPos, id) => {
        setComponentPosition(id, origPos.x + dxGrid, origPos.y + dyGrid);
      });
      return;
    }

    // Wire preview
    if (mode === 'wire' && wireStartPin) {
      const { x, y } = svgToWorld(e.clientX, e.clientY);
      updateWireMouse(x, y);
    }

    // Hover detection
    const { x: wx, y: wy } = svgToWorld(e.clientX, e.clientY);
    const pin = findPinAt(wx, wy);
    setHoveredPin(pin ? { componentId: pin.componentId, pinId: pin.pinId } : null);

    if (!pin) {
      const comp = findComponentAt(wx, wy);
      setHoveredComponent(comp ? comp.id : null);
    } else {
      setHoveredComponent(null);
    }
  }, [isPanning, isDragging, panStart, dragStart, view, mode, wireStartPin, svgToWorld, findPinAt, findComponentAt, pan, setComponentPosition, updateWireMouse, setHoveredPin, setHoveredComponent]);

  const handleMouseUp = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (isDragging && dragStart) {
      // Commit to history if actually moved
      const dxPx = (e.clientX - dragStart.mx) / view.zoom;
      const dyPx = (e.clientY - dragStart.my) / view.zoom;
      if (Math.abs(dxPx) > 2 || Math.abs(dyPx) > 2) _pushHistory();
    }
    setIsDragging(false);
    setIsPanning(false);
    setDragStart(null);
    setPanStart(null);
  }, [isDragging, dragStart, view.zoom, _pushHistory]);

  const handleWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    const newZoom = Math.max(0.05, Math.min(10, view.zoom * factor));
    // Zoom centered on mouse position
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const newX = mx - (mx - view.x) * (newZoom / view.zoom);
    const newY = my - (my - view.y) * (newZoom / view.zoom);
    useSessionStore.setState({ view: { x: newX, y: newY, zoom: newZoom } });
  }, [view]);

  // Keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT')) return;

      if (e.key === 'Escape') { cancelWire(); setMode('select'); clearSelection(); }
      if (e.key === 'Delete' || e.key === 'Backspace') deleteSelection();
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'z') { e.preventDefault(); store.undo(); }
      if ((e.metaKey || e.ctrlKey) && (e.shiftKey && e.key === 'z' || e.key === 'y')) { e.preventDefault(); store.redo(); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'd') { e.preventDefault(); store.duplicateSelection(); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'a') { e.preventDefault(); if (sheet) setSelection(sheet.components.map(c => c.id), sheet.wires.map(w => w.id)); }
      if (e.key === 'r' && selection.components.length === 1) rotateComponent(selection.components[0], 90);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selection, sheet, store, cancelWire, setMode, clearSelection, deleteSelection, setSelection, rotateComponent]);

  const renderGrid = () => {
    const rect = svgRef.current?.getBoundingClientRect();
    const w = rect?.width ?? 1920;
    const h = rect?.height ?? 1080;
    const gridSize = GRID * view.zoom;
    const offX = view.x % gridSize;
    const offY = view.y % gridSize;
    const lines = [];
    for (let x = offX; x < w; x += gridSize) {
      lines.push(<line key={`gx${x}`} x1={x} y1={0} x2={x} y2={h} stroke="var(--grid-color)" strokeWidth="1" />);
    }
    for (let y = offY; y < h; y += gridSize) {
      lines.push(<line key={`gy${y}`} x1={0} y1={y} x2={w} y2={y} stroke="var(--grid-color)" strokeWidth="1" />);
    }
    return lines;
  };

  const renderComponent = (comp: ComponentInstance) => {
    const def = CATALOG_BY_ID[comp.definitionId];
    if (!def) return null;
    const isSelected = selection.components.includes(comp.id);
    const isHovered = hoveredComponentId === comp.id;
    const cx = comp.x * GRID;
    const cy = comp.y * GRID;
    const w = def.width * GRID;
    const h = def.height * GRID;

    return (
      <g key={comp.id} transform={`rotate(${comp.rotation}, ${cx + w / 2}, ${cy + h / 2})`}>
        {/* Component body */}
        <rect
          x={cx} y={cy} width={w} height={h}
          fill={isSelected ? 'rgba(0,163,255,0.08)' : 'var(--bg-panel)'}
          stroke={isSelected ? 'var(--cs-accent)' : isHovered ? 'var(--text-secondary)' : 'var(--text-primary)'}
          strokeWidth={isSelected ? 2 : 1.5}
          rx={2}
        />
        {/* Component label */}
        <text x={cx + w / 2} y={cy - 6} textAnchor="middle" fill="var(--text-primary)" fontSize={11} fontFamily="var(--font-ui)" fontWeight="500">
          {comp.refDes}
        </text>
        <text x={cx + w / 2} y={cy + h + 14} textAnchor="middle" fill="var(--text-secondary)" fontSize={10} fontFamily="var(--font-ui)">
          {def.name.length > 18 ? def.name.slice(0, 17) + '…' : def.name}
        </text>
        {/* Pin stubs */}
        {def.pins.map(pin => {
          const px = cx + pin.x * GRID;
          const py = cy + pin.y * GRID;
          const isHoveredPin = hoveredPinId?.componentId === comp.id && hoveredPinId?.pinId === pin.id;
          const isWireStart = wireStartPin?.componentId === comp.id && wireStartPin?.pinId === pin.id;
          const STUB = 12;
          let x2 = px, y2 = py;
          switch (pin.direction) {
            case 'left': x2 = px - STUB; break;
            case 'right': x2 = px + STUB; break;
            case 'up': y2 = py - STUB; break;
            case 'down': y2 = py + STUB; break;
          }
          return (
            <g key={pin.id}>
              <line x1={px} y1={py} x2={x2} y2={y2} stroke="var(--text-secondary)" strokeWidth={1.5} />
              <circle
                cx={px} cy={py} r={isHoveredPin || isWireStart ? PIN_RADIUS + 2 : PIN_RADIUS}
                fill={isWireStart ? 'var(--cs-accent)' : isHoveredPin ? 'var(--cs-accent)' : 'var(--bg-app)'}
                stroke={isHoveredPin || isWireStart ? 'var(--cs-accent)' : 'var(--text-secondary)'}
                strokeWidth={1.5}
                style={{ cursor: 'crosshair' }}
              />
              <text x={x2 + (pin.direction === 'left' ? -3 : pin.direction === 'right' ? 3 : 0)}
                y={y2 + (pin.direction === 'up' ? -4 : pin.direction === 'down' ? 12 : 4)}
                textAnchor={pin.direction === 'left' ? 'end' : pin.direction === 'right' ? 'start' : 'middle'}
                fill="var(--text-tertiary)" fontSize={9} fontFamily="var(--font-ui)">
                {pin.label}
              </text>
            </g>
          );
        })}
      </g>
    );
  };

  const renderWire = (wire: typeof sheet extends undefined ? never : NonNullable<typeof sheet>['wires'][number]) => {
    if (!sheet) return null;
    const compA = wire.pinA ? sheet.components.find(c => c.id === wire.pinA!.componentId) : null;
    const compB = wire.pinB ? sheet.components.find(c => c.id === wire.pinB!.componentId) : null;
    if (!compA || !compB || !wire.pinA || !wire.pinB) return null;

    const defA = CATALOG_BY_ID[compA.definitionId];
    const defB = CATALOG_BY_ID[compB.definitionId];
    const pinDefA = defA?.pins.find(p => p.id === wire.pinA!.pinId);
    const pinDefB = defB?.pins.find(p => p.id === wire.pinB!.pinId);
    if (!pinDefA || !pinDefB) return null;

    const x1 = compA.x * GRID + pinDefA.x * GRID;
    const y1 = compA.y * GRID + pinDefA.y * GRID;
    const x2 = compB.x * GRID + pinDefB.x * GRID;
    const y2 = compB.y * GRID + pinDefB.y * GRID;

    const isSelected = selection.wires.includes(wire.id);
    // Orthogonal routing: L-shape
    const mx = x1 + (x2 - x1) / 2;
    const d = `M${x1},${y1} L${mx},${y1} L${mx},${y2} L${x2},${y2}`;

    return (
      <path
        key={wire.id}
        d={d}
        stroke={isSelected ? 'var(--cs-accent)' : 'var(--status-success)'}
        strokeWidth={isSelected ? 2.5 : 2}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ cursor: 'pointer' }}
        onClick={(e) => { e.stopPropagation(); if (e.shiftKey) toggleSelectWire(wire.id); else store.setSelection([], [wire.id]); }}
      />
    );
  };

  const renderWireGhost = () => {
    if (!wireStartPin || !wireCurrentMouse || !sheet) return null;
    const comp = sheet.components.find(c => c.id === wireStartPin.componentId);
    if (!comp) return null;
    const def = CATALOG_BY_ID[comp.definitionId];
    const pin = def?.pins.find(p => p.id === wireStartPin.pinId);
    if (!pin) return null;

    const x1 = comp.x * GRID + pin.x * GRID;
    const y1 = comp.y * GRID + pin.y * GRID;
    const x2 = wireCurrentMouse.x;
    const y2 = wireCurrentMouse.y;
    const mx = x1 + (x2 - x1) / 2;

    return (
      <path
        d={`M${x1},${y1} L${mx},${y1} L${mx},${y2} L${x2},${y2}`}
        stroke="var(--cs-accent)"
        strokeWidth={2}
        strokeDasharray="6 4"
        fill="none"
        strokeLinecap="round"
        pointerEvents="none"
      />
    );
  };

  const cursorStyle: React.CSSProperties['cursor'] =
    mode === 'place' ? 'crosshair' :
    mode === 'wire' ? 'crosshair' :
    isPanning ? 'grabbing' :
    isDragging ? 'move' :
    hoveredPinId ? 'crosshair' :
    hoveredComponentId ? 'move' : 'default';

  return (
    <svg
      ref={svgRef}
      className="schematic-svg"
      style={{ cursor: cursorStyle, flex: 1, display: 'block' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Grid */}
      <g className="grid-layer">{renderGrid()}</g>

      {/* World transform group */}
      <g transform={`translate(${view.x}, ${view.y}) scale(${view.zoom})`}>
        {/* Wires */}
        <g className="wire-layer">
          {sheet?.wires.map(w => renderWire(w))}
          {renderWireGhost()}
        </g>
        {/* Components */}
        <g className="component-layer">
          {sheet?.components.map(c => renderComponent(c))}
        </g>
      </g>
    </svg>
  );
};
