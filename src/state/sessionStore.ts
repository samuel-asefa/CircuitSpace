import { create } from 'zustand';
import type {
  Project,
  CircuitSheet,
  ComponentInstance,
  ValidationIssue,
  AnalysisResult,
  ProjectSettings,
} from '../types';
import { generateId, deepClone } from '../utils/id';
import { analyzeCircuit, getNets } from '../electrical/analysisEngine';
import { ALL_RULES } from '../validation/rules';

interface HistoryState {
  sheet: CircuitSheet;
  settings: ProjectSettings;
}

export interface SessionState {
  project: Project | null;
  activeSheetId: string | null;

  selection: { components: string[]; wires: string[] };
  hoveredComponentId: string | null;
  hoveredWireId: string | null;
  hoveredPinId: { componentId: string; pinId: string } | null;

  view: { x: number; y: number; zoom: number };

  mode: 'select' | 'wire' | 'place';
  wireStartPin: { componentId: string; pinId: string } | null;
  wireCurrentMouse: { x: number; y: number } | null;
  placingDefId: string | null;

  analysis: AnalysisResult | null;
  issues: ValidationIssue[];

  history: HistoryState[];
  historyIndex: number;

  loadProject: (project: Project) => void;
  closeProject: () => void;

  setZoom: (zoom: number, cx?: number, cy?: number) => void;
  pan: (dx: number, dy: number) => void;
  resetView: () => void;

  setSelection: (components: string[], wires: string[]) => void;
  clearSelection: () => void;
  toggleSelectComponent: (id: string) => void;
  toggleSelectWire: (id: string) => void;
  setHoveredComponent: (id: string | null) => void;
  setHoveredWire: (id: string | null) => void;
  setHoveredPin: (pin: { componentId: string; pinId: string } | null) => void;

  setMode: (mode: 'select' | 'wire' | 'place', defId?: string) => void;

  addComponent: (defId: string, x: number, y: number, refPrefix: string) => string;
  updateComponentProperty: (id: string, property: string, value: string | number | boolean) => void;
  moveComponents: (deltas: Array<{ id: string; dx: number; dy: number }>) => void;
  setComponentPosition: (id: string, x: number, y: number) => void;
  deleteSelection: () => void;
  rotateComponent: (id: string, delta: number) => void;
  duplicateSelection: () => void;

  startWire: (componentId: string, pinId: string) => void;
  updateWireMouse: (x: number, y: number) => void;
  finishWire: (componentId: string, pinId: string) => void;
  cancelWire: () => void;

  updateSettings: (settings: Partial<ProjectSettings>) => void;
  renameProject: (name: string) => void;

  undo: () => void;
  redo: () => void;
  _pushHistory: () => void;
  recalculate: () => void;
}

const MAX_HISTORY = 50;

function getActiveSheet(project: Project | null, sheetId: string | null): CircuitSheet | null {
  if (!project || !sheetId) return null;
  return project.sheets.find(s => s.id === sheetId) ?? null;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  project: null,
  activeSheetId: null,
  selection: { components: [], wires: [] },
  hoveredComponentId: null,
  hoveredWireId: null,
  hoveredPinId: null,
  view: { x: 0, y: 0, zoom: 1 },
  mode: 'select',
  wireStartPin: null,
  wireCurrentMouse: null,
  placingDefId: null,
  analysis: null,
  issues: [],
  history: [],
  historyIndex: -1,

  loadProject: (project: Project) => {
    set({
      project,
      activeSheetId: project.sheets[0]?.id ?? null,
      selection: { components: [], wires: [] },
      history: [],
      historyIndex: -1,
      mode: 'select',
      wireStartPin: null,
      wireCurrentMouse: null,
      placingDefId: null,
      view: { x: 0, y: 0, zoom: 1 },
    });
    get()._pushHistory();
    get().recalculate();
  },

  closeProject: () => set({
    project: null,
    activeSheetId: null,
    analysis: null,
    issues: [],
    history: [],
    historyIndex: -1,
  }),

  setZoom: (zoom, _cx, _cy) => set(s => ({
    view: { ...s.view, zoom: Math.max(0.05, Math.min(10, zoom)) },
  })),
  pan: (dx, dy) => set(s => ({ view: { ...s.view, x: s.view.x + dx, y: s.view.y + dy } })),
  resetView: () => set({ view: { x: 0, y: 0, zoom: 1 } }),

  setSelection: (components, wires) => set({ selection: { components, wires } }),
  clearSelection: () => set({ selection: { components: [], wires: [] } }),
  toggleSelectComponent: (id) => set(s => {
    const has = s.selection.components.includes(id);
    return { selection: { ...s.selection, components: has ? s.selection.components.filter(c => c !== id) : [...s.selection.components, id] } };
  }),
  toggleSelectWire: (id) => set(s => {
    const has = s.selection.wires.includes(id);
    return { selection: { ...s.selection, wires: has ? s.selection.wires.filter(w => w !== id) : [...s.selection.wires, id] } };
  }),
  setHoveredComponent: (id) => set({ hoveredComponentId: id }),
  setHoveredWire: (id) => set({ hoveredWireId: id }),
  setHoveredPin: (pin) => set({ hoveredPinId: pin }),

  setMode: (mode, defId) => set({ mode, wireStartPin: null, wireCurrentMouse: null, placingDefId: defId ?? null }),

  addComponent: (defId, x, y, refPrefix) => {
    get()._pushHistory();
    let newId = '';
    set(s => {
      if (!s.project || !s.activeSheetId) return s;
      const project = deepClone(s.project);
      const sheet = getActiveSheet(project, s.activeSheetId);
      if (!sheet) return s;

      const existingRefDes = sheet.components.map(c => c.refDes);
      const nums = existingRefDes
        .filter(r => r.startsWith(refPrefix))
        .map(r => parseInt(r.slice(refPrefix.length), 10))
        .filter(n => !isNaN(n));
      const next = nums.length === 0 ? 1 : Math.max(...nums) + 1;
      const refDes = `${refPrefix}${next}`;

      newId = generateId();
      const newComp: ComponentInstance = { id: newId, definitionId: defId, refDes, x, y, rotation: 0, properties: {} };
      sheet.components.push(newComp);
      return { project, selection: { components: [newId], wires: [] }, mode: 'select', placingDefId: null };
    });
    get().recalculate();
    return newId;
  },

  updateComponentProperty: (id, property, value) => {
    get()._pushHistory();
    set(s => {
      if (!s.project || !s.activeSheetId) return s;
      const project = deepClone(s.project);
      const sheet = getActiveSheet(project, s.activeSheetId);
      if (!sheet) return s;
      const comp = sheet.components.find(c => c.id === id);
      if (comp) {
        if (property === 'refDes') comp.refDes = String(value);
        else comp.properties[property] = value;
      }
      return { project };
    });
    get().recalculate();
  },

  moveComponents: (deltas) => {
    set(s => {
      if (!s.project || !s.activeSheetId) return s;
      const project = deepClone(s.project);
      const sheet = getActiveSheet(project, s.activeSheetId);
      if (!sheet) return s;
      deltas.forEach(d => {
        const comp = sheet.components.find(c => c.id === d.id);
        if (comp) { comp.x += d.dx; comp.y += d.dy; }
      });
      return { project };
    });
  },

  setComponentPosition: (id, x, y) => {
    set(s => {
      if (!s.project || !s.activeSheetId) return s;
      const project = deepClone(s.project);
      const sheet = getActiveSheet(project, s.activeSheetId);
      if (!sheet) return s;
      const comp = sheet.components.find(c => c.id === id);
      if (comp) { comp.x = x; comp.y = y; }
      return { project };
    });
  },

  rotateComponent: (id, delta) => {
    get()._pushHistory();
    set(s => {
      if (!s.project || !s.activeSheetId) return s;
      const project = deepClone(s.project);
      const sheet = getActiveSheet(project, s.activeSheetId);
      if (!sheet) return s;
      const comp = sheet.components.find(c => c.id === id);
      if (comp) comp.rotation = (comp.rotation + delta + 360) % 360;
      return { project };
    });
  },

  deleteSelection: () => {
    get()._pushHistory();
    set(s => {
      if (!s.project || !s.activeSheetId) return s;
      const project = deepClone(s.project);
      const sheet = getActiveSheet(project, s.activeSheetId);
      if (!sheet) return s;
      const { components, wires } = s.selection;
      sheet.components = sheet.components.filter(c => !components.includes(c.id));
      sheet.wires = sheet.wires.filter(w => {
        if (wires.includes(w.id)) return false;
        if (w.pinA && components.includes(w.pinA.componentId)) return false;
        if (w.pinB && components.includes(w.pinB.componentId)) return false;
        return true;
      });
      return { project, selection: { components: [], wires: [] } };
    });
    get().recalculate();
  },

  duplicateSelection: () => {
    get()._pushHistory();
    set(s => {
      if (!s.project || !s.activeSheetId) return s;
      const project = deepClone(s.project);
      const sheet = getActiveSheet(project, s.activeSheetId);
      if (!sheet) return s;
      const { components } = s.selection;
      const newIds: string[] = [];
      components.forEach(cid => {
        const original = sheet.components.find(c => c.id === cid);
        if (!original) return;
        const newId = generateId();
        newIds.push(newId);
        const clone: ComponentInstance = {
          ...deepClone(original),
          id: newId,
          x: original.x + 40,
          y: original.y + 40,
        };
        // Fix refDes
        const existingNums = sheet.components
          .filter(c => c.refDes.startsWith(original.refDes.replace(/\d+$/, '')))
          .map(c => parseInt(c.refDes.replace(/^\D+/, ''), 10))
          .filter(n => !isNaN(n));
        const nextNum = existingNums.length === 0 ? 1 : Math.max(...existingNums) + 1;
        clone.refDes = `${original.refDes.replace(/\d+$/, '')}${nextNum}`;
        sheet.components.push(clone);
      });
      return { project, selection: { components: newIds, wires: [] } };
    });
    get().recalculate();
  },

  startWire: (componentId, pinId) => set({ mode: 'wire', wireStartPin: { componentId, pinId } }),
  updateWireMouse: (x, y) => set({ wireCurrentMouse: { x, y } }),

  finishWire: (componentId, pinId) => {
    const start = get().wireStartPin;
    if (!start) return;
    if (start.componentId === componentId && start.pinId === pinId) {
      set({ mode: 'select', wireStartPin: null, wireCurrentMouse: null });
      return;
    }
    get()._pushHistory();
    set(s => {
      if (!s.project || !s.activeSheetId) return s;
      const project = deepClone(s.project);
      const sheet = getActiveSheet(project, s.activeSheetId);
      if (!sheet) return s;
      const startPin = s.wireStartPin;
      if (!startPin) return s;
      const exists = sheet.wires.some(w => {
        const a = w.pinA; const b = w.pinB;
        if (!a || !b) return false;
        return (a.componentId === startPin.componentId && a.pinId === startPin.pinId && b.componentId === componentId && b.pinId === pinId) ||
               (b.componentId === startPin.componentId && b.pinId === startPin.pinId && a.componentId === componentId && a.pinId === pinId);
      });
      if (!exists) {
        sheet.wires.push({
          id: generateId(), netId: generateId(), segments: [],
          pinA: { ...startPin },
          pinB: { componentId, pinId },
        });
      }
      return { project, mode: 'select', wireStartPin: null, wireCurrentMouse: null };
    });
    get().recalculate();
  },

  cancelWire: () => set({ mode: 'select', wireStartPin: null, wireCurrentMouse: null }),

  updateSettings: (settings) => {
    get()._pushHistory();
    set(s => {
      if (!s.project) return s;
      const project = deepClone(s.project);
      project.settings = { ...project.settings, ...settings };
      return { project };
    });
    get().recalculate();
  },

  renameProject: (name) => set(s => {
    if (!s.project) return s;
    return { project: { ...s.project, name } };
  }),

  _pushHistory: () => set(s => {
    if (!s.project || !s.activeSheetId) return s;
    const sheet = getActiveSheet(s.project, s.activeSheetId);
    if (!sheet) return s;
    const newHistory = s.history.slice(0, s.historyIndex + 1);
    newHistory.push(deepClone({ sheet, settings: s.project.settings }));
    if (newHistory.length > MAX_HISTORY) newHistory.shift();
    return { history: newHistory, historyIndex: newHistory.length - 1 };
  }),

  undo: () => {
    set(s => {
      if (s.historyIndex <= 0 || !s.project || !s.activeSheetId) return s;
      const newIndex = s.historyIndex - 1;
      const target = s.history[newIndex];
      const project = deepClone(s.project);
      const si = project.sheets.findIndex(sh => sh.id === s.activeSheetId);
      if (si !== -1) project.sheets[si] = deepClone(target.sheet);
      project.settings = deepClone(target.settings);
      return { project, historyIndex: newIndex, selection: { components: [], wires: [] } };
    });
    get().recalculate();
  },

  redo: () => {
    set(s => {
      if (s.historyIndex >= s.history.length - 1 || !s.project || !s.activeSheetId) return s;
      const newIndex = s.historyIndex + 1;
      const target = s.history[newIndex];
      const project = deepClone(s.project);
      const si = project.sheets.findIndex(sh => sh.id === s.activeSheetId);
      if (si !== -1) project.sheets[si] = deepClone(target.sheet);
      project.settings = deepClone(target.settings);
      return { project, historyIndex: newIndex, selection: { components: [], wires: [] } };
    });
    get().recalculate();
  },

  recalculate: () => {
    set(s => {
      if (!s.project || !s.activeSheetId) return s;
      const sheet = getActiveSheet(s.project, s.activeSheetId);
      if (!sheet) return s;

      const analysis = analyzeCircuit(sheet, s.project.settings);
      const nets = getNets(sheet);

      const issues: ValidationIssue[] = [];
      for (const rule of ALL_RULES) {
        try {
          issues.push(...rule.check(sheet, nets, analysis, s.project.settings));
        } catch (_e) {
          // rule threw — skip
        }
      }
      issues.sort((a, b) => {
        const p: Record<string, number> = { error: 0, warning: 1, info: 2, passed: 3 };
        return (p[a.severity] ?? 3) - (p[b.severity] ?? 3);
      });

      analysis.errorCount = issues.filter(i => i.severity === 'error').length;
      analysis.warningCount = issues.filter(i => i.severity === 'warning').length;

      const project: Project = {
        ...s.project,
        modifiedAt: new Date().toISOString(),
        stats: {
          componentCount: analysis.componentCount,
          netCount: analysis.netCount,
          errorCount: analysis.errorCount,
          warningCount: analysis.warningCount,
          totalMassGrams: analysis.totalMassGrams,
          estimatedRuntimeHours: analysis.estimatedRuntimeHours,
        },
      };

      return { analysis, issues, project };
    });
  },
}));
