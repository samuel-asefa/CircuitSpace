import type {
  CircuitSheet,
  Net,
  AnalysisResult,
  PowerSourceAnalysis,
  RegulatorAnalysis,
  LoadAnalysis,
  MassBreakdown,
  ProjectSettings,
  ComponentCategory,
} from '../types';
import { CATALOG_BY_ID } from '../catalog';
import { buildNetGraph, getNetForPin } from './netGraph';

/**
 * Performs full DC power and mass analysis of a circuit sheet.
 */
export function analyzeCircuit(
  sheet: CircuitSheet,
  settings: ProjectSettings
): AnalysisResult {
  const nets = buildNetGraph(sheet);
  const netList = Array.from(nets.values());

  const powerSources: PowerSourceAnalysis[] = [];
  const regulators: RegulatorAnalysis[] = [];
  const loads: LoadAnalysis[] = [];
  const massByCategory = new Map<ComponentCategory, MassBreakdown>();
  const notes: string[] = [];

  let totalMassGrams = 0;
  let connectedPinCount = 0;
  let unconnectedRequiredPinCount = 0;

  for (const instance of sheet.components) {
    const def = CATALOG_BY_ID[instance.definitionId];
    if (!def) continue;

    // Mass accounting
    const mass = def.massGrams;
    totalMassGrams += mass;
    const cat = def.category;
    if (!massByCategory.has(cat)) {
      massByCategory.set(cat, { category: cat, massGrams: 0, componentCount: 0 });
    }
    const massEntry = massByCategory.get(cat)!;
    massEntry.massGrams += mass;
    massEntry.componentCount++;

    // Count connected / unconnected pins
    for (const pin of def.pins) {
      const net = getNetForPin(instance.id, pin.id, nets);
      const isConnected = net != null && net.pins.length > 1;
      if (isConnected) connectedPinCount++;
      if (!isConnected && pin.required) unconnectedRequiredPinCount++;
    }

    // Source analysis
    if (def.isSource) {
      const voltageV = (instance.properties['voltageV'] as number) ?? def.outputVoltageV ?? 0;
      const capacityMah = (instance.properties['capacityMah'] as number) ?? def.capacityMah ?? null;

      powerSources.push({
        componentId: instance.id,
        refDes: instance.refDes,
        name: (instance.properties['label'] as string) ?? def.name,
        voltageV,
        capacityMah,
        nominalCurrentMa: 0,
        peakCurrentMa: 0,
        utilizationPercent: 0,
      });
    }

    // Regulator analysis
    if (def.isRegulator) {
      const outputVoltageV = (instance.properties['outputVoltageV'] as number) ?? def.regulatorOutputV ?? 0;
      const maxOutputCurrentMa = (instance.properties['outputCurrentMa'] as number) ?? def.outputCurrentMa ?? 1000;
      const efficiency = def.regulatorEfficiency ?? 0.85;

      const vinPin = def.pins.find(p => p.protocol === 'POWER_IN' || p.label === 'VIN');
      let inputVoltageV: number | null = null;
      if (vinPin) {
        const vinNet = getNetForPin(instance.id, vinPin.id, nets);
        if (vinNet) inputVoltageV = vinNet.inferredVoltageV;
      }

      const headroomV = inputVoltageV != null
        ? inputVoltageV - outputVoltageV - (def.regulatorDropoutV ?? 0)
        : null;

      regulators.push({
        componentId: instance.id,
        refDes: instance.refDes,
        name: (instance.properties['label'] as string) ?? def.name,
        inputVoltageV,
        outputVoltageV,
        nominalOutputCurrentMa: 0,
        maxOutputCurrentMa,
        utilizationPercent: 0,
        efficiencyPercent: efficiency * 100,
        headroomV,
        isOverloaded: false,
      });
    }

    // Load analysis
    if (!def.isSource && !def.isRegulator) {
      const nominalCurrentMa = (instance.properties['nominalCurrentMa'] as number) ?? def.nominalCurrentMa ?? 0;
      const peakCurrentMa = (instance.properties['maxCurrentMa'] as number) ?? def.maxCurrentMa ?? nominalCurrentMa * 1.5;

      let supplyVoltageV: number | null = null;
      const pwrPin = def.pins.find(p => p.type === 'POWER' && p.protocol === 'POWER_IN');
      if (pwrPin) {
        const net = getNetForPin(instance.id, pwrPin.id, nets);
        if (net) supplyVoltageV = net.inferredVoltageV;
      }

      if (nominalCurrentMa > 0 || peakCurrentMa > 0) {
        loads.push({
          componentId: instance.id,
          refDes: instance.refDes,
          name: (instance.properties['label'] as string) ?? def.name,
          category: def.category,
          nominalCurrentMa,
          peakCurrentMa,
          supplyVoltageV,
        });
      }
    }
  }

  // Aggregate totals
  const totalNominalCurrentMa = loads.reduce((sum, l) => sum + l.nominalCurrentMa, 0);
  const totalPeakCurrentMa = loads.reduce((sum, l) => sum + l.peakCurrentMa, 0);

  // Assign load to power sources
  for (const source of powerSources) {
    source.nominalCurrentMa = totalNominalCurrentMa;
    source.peakCurrentMa = totalPeakCurrentMa;
    if (source.capacityMah != null && source.capacityMah > 0 && totalNominalCurrentMa > 0) {
      source.utilizationPercent = (source.nominalCurrentMa / source.capacityMah) * 100;
    }
  }

  for (const reg of regulators) {
    reg.nominalOutputCurrentMa = totalNominalCurrentMa;
    reg.isOverloaded = reg.nominalOutputCurrentMa > reg.maxOutputCurrentMa;
    reg.utilizationPercent = reg.maxOutputCurrentMa > 0
      ? (reg.nominalOutputCurrentMa / reg.maxOutputCurrentMa) * 100
      : 0;
  }

  const primarySourceVoltage = powerSources[0]?.voltageV ?? settings.nominalBusVoltageV;
  const totalPowerW = (primarySourceVoltage * totalNominalCurrentMa) / 1000;

  let estimatedRuntimeHours: number | null = null;
  const primarySource = powerSources[0];
  if (primarySource?.capacityMah && primarySource.capacityMah > 0 && totalNominalCurrentMa > 0) {
    const usableCapacity = primarySource.capacityMah * (1 - settings.batteryReservePercent / 100);
    estimatedRuntimeHours = usableCapacity / totalNominalCurrentMa;
  }

  let batteryReservePercent = settings.batteryReservePercent;
  if (estimatedRuntimeHours != null && settings.targetRuntimeHours > 0) {
    const totalCapacity = primarySource?.capacityMah ?? 0;
    const usedMah = totalNominalCurrentMa * settings.targetRuntimeHours;
    batteryReservePercent = totalCapacity > 0
      ? Math.max(0, ((totalCapacity - usedMah) / totalCapacity) * 100)
      : 0;
  }

  if (settings.maxMassGrams > 0 && totalMassGrams > settings.maxMassGrams) {
    notes.push(`Mass budget exceeded: ${totalMassGrams.toFixed(0)}g vs ${settings.maxMassGrams}g limit.`);
  }

  if (loads.length === 0 && powerSources.length === 0) {
    notes.push('No powered components found. Add a power source and loads to see analysis.');
  }

  return {
    timestamp: Date.now(),
    powerSources,
    regulators,
    loads,
    totalNominalCurrentMa,
    totalPeakCurrentMa,
    totalPowerW,
    estimatedRuntimeHours,
    batteryCapacityMah: primarySource?.capacityMah ?? 0,
    batteryReservePercent,
    totalMassGrams,
    massByCategory: Array.from(massByCategory.values()),
    componentCount: sheet.components.length,
    netCount: netList.filter(n => n.pins.length > 1).length,
    connectedPinCount,
    unconnectedRequiredPinCount,
    warningCount: 0,
    errorCount: 0,
    isValid: powerSources.length > 0,
    notes,
  };
}

/**
 * Get nets — exported for ERC engine
 */
export function getNets(sheet: CircuitSheet): Map<string, Net> {
  return buildNetGraph(sheet);
}
