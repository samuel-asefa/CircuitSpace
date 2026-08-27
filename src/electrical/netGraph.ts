import type {
  CircuitSheet,
  ComponentInstance,
  Net,
  NetId,
  ComponentDefinition,
  PinType,
} from '../types';
import { CATALOG_BY_ID } from '../catalog';
import { generateId } from '../utils/id';

/**
 * Resolved pin position in sheet coordinates.
 */
export interface ResolvedPin {
  componentId: string;
  pinId: string;
  x: number;
  y: number;
  type: PinType;
  def: ComponentDefinition;
}

/**
 * Resolve all pin world-space coordinates for a component instance.
 */
export function resolveComponentPins(instance: ComponentInstance): ResolvedPin[] {
  const def = CATALOG_BY_ID[instance.definitionId];
  if (!def) return [];
  return def.pins.map(pin => ({
    componentId: instance.id,
    pinId: pin.id,
    x: instance.x + pin.x,
    y: instance.y + pin.y,
    type: pin.type,
    pinDef: pin,
    def,
  }));
}

/**
 * Build a net graph from a circuit sheet.
 * Uses union-find to merge wire-connected pins into nets.
 *
 * Returns Map<netId, Net>
 */
export function buildNetGraph(sheet: CircuitSheet): Map<NetId, Net> {
  // Union-Find structure: maps "componentId:pinId" → root key
  const parent = new Map<string, string>();

  function key(componentId: string, pinId: string) {
    return `${componentId}::${pinId}`;
  }

  function find(k: string): string {
    if (!parent.has(k)) parent.set(k, k);
    const root = parent.get(k)!;
    if (root !== k) {
      const resolved = find(root);
      parent.set(k, resolved);
      return resolved;
    }
    return k;
  }

  function union(a: string, b: string) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  }

  // Initialize all pins
  for (const comp of sheet.components) {
    const def = CATALOG_BY_ID[comp.definitionId];
    if (!def) continue;
    for (const pin of def.pins) {
      const k = key(comp.id, pin.id);
      parent.set(k, k);
    }
  }

  // Union connected pins via wires
  for (const wire of sheet.wires) {
    if (wire.pinA && wire.pinB) {
      union(key(wire.pinA.componentId, wire.pinA.pinId), key(wire.pinB.componentId, wire.pinB.pinId));
    }
  }

  // Also union pins that share the same wire endpoint coordinates
  // (for dangling wires / net labels we still track wire segments)
  // Group by root
  const rootToKey = new Map<string, string[]>();
  for (const [k] of parent) {
    const root = find(k);
    if (!rootToKey.has(root)) rootToKey.set(root, []);
    rootToKey.get(root)!.push(k);
  }

  // Build nets
  const netMap = new Map<NetId, Net>();
  const rootToNetId = new Map<string, NetId>();

  for (const [root, keys] of rootToKey) {
    const netId = generateId();
    rootToNetId.set(root, netId);

    const pins: Net['pins'] = keys.map(k => {
      const [componentId, pinId] = k.split('::');
      return { componentId, pinId };
    });

    netMap.set(netId, {
      id: netId,
      name: '', // will be named below
      pins,
      inferredVoltageV: null,
      isPower: false,
      isGround: false,
    });
  }

  // Apply net labels
  for (const label of sheet.netLabels) {
    // Find which net this label connects to (by proximity to wire endpoints)
    // For now: label names are applied if they appear in a net
    // Simplified: iterate nets and find if label matches a pin region
    // Full spatial lookup left for render-time
    void label;
  }

  // Infer net voltage & type from power sources
  for (const [, net] of netMap) {
    for (const { componentId, pinId } of net.pins) {
      const comp = sheet.components.find(c => c.id === componentId);
      if (!comp) continue;
      const def = CATALOG_BY_ID[comp.definitionId];
      if (!def) continue;
      const pin = def.pins.find(p => p.id === pinId);
      if (!pin) continue;

      if (pin.type === 'GROUND') {
        net.isGround = true;
        net.inferredVoltageV = 0;
      }
      if (pin.type === 'POWER' && pin.protocol === 'POWER_OUT' && def.isSource) {
        const voltage = (comp.properties['voltageV'] as number) ?? def.outputVoltageV ?? null;
        if (voltage != null) {
          net.inferredVoltageV = voltage;
          net.isPower = true;
        }
      }
      if (pin.type === 'POWER' && pin.protocol === 'POWER_OUT' && def.isRegulator) {
        const voltage = (comp.properties['outputVoltageV'] as number) ?? def.regulatorOutputV ?? null;
        if (voltage != null) {
          net.inferredVoltageV = voltage;
          net.isPower = true;
        }
      }
    }
  }

  // Auto-name nets
  let powerCount = 0;
  let gndCount = 0;
  let netCount = 0;
  for (const [, net] of netMap) {
    if (net.isGround) {
      net.name = gndCount === 0 ? 'GND' : `GND${gndCount}`;
      gndCount++;
    } else if (net.isPower && net.inferredVoltageV != null) {
      const v = net.inferredVoltageV;
      net.name = `VCC_${v.toFixed(1).replace('.', 'V')}`;
      powerCount++;
      void powerCount;
    } else {
      net.name = `NET${String(netCount++).padStart(2, '0')}`;
    }
  }

  return netMap;
}

/**
 * Get all nets that a component pin belongs to.
 */
export function getNetForPin(
  componentId: string,
  pinId: string,
  nets: Map<NetId, Net>
): Net | undefined {
  for (const net of nets.values()) {
    if (net.pins.some(p => p.componentId === componentId && p.pinId === pinId)) {
      return net;
    }
  }
  return undefined;
}

/**
 * Check if two pins are connected in the same net.
 */
export function arePinsConnected(
  compA: string, pinA: string,
  compB: string, pinB: string,
  nets: Map<NetId, Net>
): boolean {
  const netA = getNetForPin(compA, pinA, nets);
  const netB = getNetForPin(compB, pinB, nets);
  return netA != null && netB != null && netA.id === netB.id;
}
