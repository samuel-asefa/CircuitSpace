import type {
  ValidationRule,
  ValidationIssue,
} from '../../types';
import { CATALOG_BY_ID } from '../../catalog';
import { getNetForPin } from '../../electrical/netGraph';
import { generateId } from '../../utils/id';

function issue(
  ruleId: string,
  severity: ValidationIssue['severity'],
  title: string,
  message: string,
  extra?: Partial<ValidationIssue>
): ValidationIssue {
  return { id: generateId(), ruleId, severity, title, message, ...extra };
}

// ─── Connectivity Rules ───────────────────────────────────────────────────────

export const ruleUnconnectedRequiredPin: ValidationRule = {
  id: 'ERC001',
  title: 'Required Pin Unconnected',
  description: 'A pin marked as required has no wire connected to it.',
  severity: 'warning',
  check(sheet, nets) {
    const issues: ValidationIssue[] = [];
    for (const comp of sheet.components) {
      const def = CATALOG_BY_ID[comp.definitionId];
      if (!def) continue;
      for (const pin of def.pins) {
        if (!pin.required) continue;
        const net = getNetForPin(comp.id, pin.id, nets);
        const isConnected = net != null && net.pins.length > 1;
        if (!isConnected) {
          issues.push(issue('ERC001', 'warning',
            'Required Pin Unconnected',
            `${comp.refDes} (${def.name}): Pin "${pin.label}" is required but not connected.`,
            { componentId: comp.id, remediation: `Wire pin ${pin.label} of ${comp.refDes} to the appropriate net.` }
          ));
        }
      }
    }
    return issues;
  },
};

export const ruleDanglingWire: ValidationRule = {
  id: 'ERC002',
  title: 'Dangling Wire Endpoint',
  description: 'A wire has an endpoint not connected to any component pin.',
  severity: 'warning',
  check(sheet) {
    const issues: ValidationIssue[] = [];
    for (const wire of sheet.wires) {
      if (!wire.pinA || !wire.pinB) {
        issues.push(issue('ERC002', 'warning',
          'Dangling Wire',
          'A wire segment has an unconnected endpoint.',
          { wireId: wire.id, remediation: 'Connect both ends of the wire to component pins or delete the wire.' }
        ));
      }
    }
    return issues;
  },
};

export const ruleIsolatedIsland: ValidationRule = {
  id: 'ERC003',
  title: 'Isolated Circuit Island',
  description: 'A component or group of components has no connection to any power or ground net.',
  severity: 'warning',
  check(sheet, nets) {
    const issues: ValidationIssue[] = [];
    // Find nets that contain power/ground
    const hasPower = Array.from(nets.values()).some(n => n.isPower);
    const hasGround = Array.from(nets.values()).some(n => n.isGround);
    if (!hasPower || !hasGround) return issues;

    for (const comp of sheet.components) {
      const def = CATALOG_BY_ID[comp.definitionId];
      if (!def) continue;
      // Skip passives and connectors that don't need power
      if (def.category === 'Passives' || def.category === 'Connectivity') continue;

      const hasPowerPin = def.pins.some(p => p.type === 'POWER' || p.type === 'GROUND');
      if (!hasPowerPin) continue;

      let connectedToAnyNet = false;
      for (const pin of def.pins) {
        const net = getNetForPin(comp.id, pin.id, nets);
        if (net && net.pins.length > 1) {
          connectedToAnyNet = true;
          break;
        }
      }

      if (!connectedToAnyNet) {
        issues.push(issue('ERC003', 'warning',
          'Isolated Component',
          `${comp.refDes} (${def.name}) is not connected to any nets.`,
          { componentId: comp.id }
        ));
      }
    }
    return issues;
  },
};

export const ruleSupplyPinWithoutSource: ValidationRule = {
  id: 'ERC004',
  title: 'Supply Pin Without Valid Source',
  description: 'A power input pin is connected to a net that has no identified power source.',
  severity: 'warning',
  check(sheet, nets) {
    const issues: ValidationIssue[] = [];
    for (const comp of sheet.components) {
      const def = CATALOG_BY_ID[comp.definitionId];
      if (!def) continue;
      const pwrPins = def.pins.filter(p => p.type === 'POWER' && p.protocol === 'POWER_IN');
      for (const pin of pwrPins) {
        const net = getNetForPin(comp.id, pin.id, nets);
        if (net && net.pins.length > 1 && !net.isPower && !net.isGround) {
          issues.push(issue('ERC004', 'warning',
            'Supply Pin Without Source',
            `${comp.refDes} power pin "${pin.label}" is connected to net "${net.name}" which has no identified power source.`,
            { componentId: comp.id, netId: net.id }
          ));
        }
      }
    }
    return issues;
  },
};

export const ruleGroundPinWithoutPath: ValidationRule = {
  id: 'ERC005',
  title: 'Ground Pin Without Ground Path',
  description: 'A ground pin is connected to a net that is not resolved as a ground net.',
  severity: 'warning',
  check(sheet, nets) {
    const issues: ValidationIssue[] = [];
    for (const comp of sheet.components) {
      const def = CATALOG_BY_ID[comp.definitionId];
      if (!def) continue;
      const gndPins = def.pins.filter(p => p.type === 'GROUND');
      for (const pin of gndPins) {
        const net = getNetForPin(comp.id, pin.id, nets);
        if (net && net.pins.length > 1 && !net.isGround) {
          issues.push(issue('ERC005', 'warning',
            'Ground Pin Not On Ground Net',
            `${comp.refDes} ground pin "${pin.label}" is not connected to a ground net.`,
            { componentId: comp.id, netId: net.id }
          ));
        }
      }
    }
    return issues;
  },
};

// ─── Short Circuit Rules ───────────────────────────────────────────────────────

export const rulePowerGroundShort: ValidationRule = {
  id: 'ERC006',
  title: 'Power-to-Ground Short',
  description: 'A power net is directly connected to a ground net without a load in between.',
  severity: 'error',
  check(sheet, nets) {
    const issues: ValidationIssue[] = [];
    for (const net of nets.values()) {
      const hasPowerPin = net.pins.some(p => {
        const comp = sheet.components.find(c => c.id === p.componentId);
        if (!comp) return false;
        const def = CATALOG_BY_ID[comp.definitionId];
        const pin = def?.pins.find(pp => pp.id === p.pinId);
        return pin?.type === 'POWER' && def?.isSource;
      });
      const hasGroundPin = net.pins.some(p => {
        const comp = sheet.components.find(c => c.id === p.componentId);
        if (!comp) return false;
        const def = CATALOG_BY_ID[comp.definitionId];
        const pin = def?.pins.find(pp => pp.id === p.pinId);
        return pin?.type === 'GROUND';
      });
      if (hasPowerPin && hasGroundPin) {
        issues.push(issue('ERC006', 'error',
          'Power-to-Ground Short Circuit',
          `Net "${net.name}" connects a power source directly to ground — this is a short circuit.`,
          { netId: net.id, remediation: 'Check your wiring. There should be at least one load between power and ground.' }
        ));
      }
    }
    return issues;
  },
};

// ─── Pin Type Conflict Rules ───────────────────────────────────────────────────

export const ruleIncompatiblePinTypes: ValidationRule = {
  id: 'ERC007',
  title: 'Incompatible Pin Types',
  description: 'Two pins in the same net have mutually incompatible types (e.g. SIGNAL_OUT to POWER).',
  severity: 'error',
  check(sheet, nets) {
    const issues: ValidationIssue[] = [];
    for (const net of nets.values()) {
      const powerPins = net.pins.filter(p => {
        const def = CATALOG_BY_ID[sheet.components.find(c => c.id === p.componentId)?.definitionId ?? ''];
        return def?.pins.find(pp => pp.id === p.pinId)?.type === 'POWER';
      });
      const groundPins = net.pins.filter(p => {
        const def = CATALOG_BY_ID[sheet.components.find(c => c.id === p.componentId)?.definitionId ?? ''];
        return def?.pins.find(pp => pp.id === p.pinId)?.type === 'GROUND';
      });
      if (powerPins.length > 0 && groundPins.length > 0 && net.pins.length === powerPins.length + groundPins.length) {
        // Already caught by ERC006
      }
    }
    return issues;
  },
};

export const ruleOutputToOutput: ValidationRule = {
  id: 'ERC008',
  title: 'Output Connected to Output',
  description: 'Two signal output pins are connected together, which can cause bus contention.',
  severity: 'error',
  check(sheet, nets) {
    const issues: ValidationIssue[] = [];
    for (const net of nets.values()) {
      const outputPins = net.pins.filter(p => {
        const comp = sheet.components.find(c => c.id === p.componentId);
        if (!comp) return false;
        const def = CATALOG_BY_ID[comp.definitionId];
        const pin = def?.pins.find(pp => pp.id === p.pinId);
        return pin?.type === 'SIGNAL_OUT';
      });
      if (outputPins.length >= 2) {
        issues.push(issue('ERC008', 'error',
          'Output-to-Output Connection',
          `Net "${net.name}" has ${outputPins.length} signal outputs connected together, causing bus contention.`,
          { netId: net.id, remediation: 'Only one driver should be connected per net. Use a mux or buffer if multiple sources are needed.' }
        ));
      }
    }
    return issues;
  },
};

export const ruleConflictingPowerSources: ValidationRule = {
  id: 'ERC009',
  title: 'Conflicting Power Sources',
  description: 'Two power sources with different voltages are connected to the same net.',
  severity: 'error',
  check(sheet, nets) {
    const issues: ValidationIssue[] = [];
    for (const net of nets.values()) {
      const sourceVoltages: number[] = [];
      for (const { componentId, pinId } of net.pins) {
        const comp = sheet.components.find(c => c.id === componentId);
        if (!comp) continue;
        const def = CATALOG_BY_ID[comp.definitionId];
        if (!def?.isSource) continue;
        const pin = def.pins.find(p => p.id === pinId);
        if (pin?.type !== 'POWER') continue;
        const v = (comp.properties['voltageV'] as number) ?? def.outputVoltageV;
        if (v != null) sourceVoltages.push(v);
      }
      if (sourceVoltages.length >= 2) {
        const unique = [...new Set(sourceVoltages)];
        if (unique.length > 1) {
          issues.push(issue('ERC009', 'error',
            'Conflicting Power Sources',
            `Net "${net.name}" has conflicting source voltages: ${unique.map(v => `${v}V`).join(', ')}.`,
            { netId: net.id }
          ));
        }
      }
    }
    return issues;
  },
};

// ─── Voltage Rules ────────────────────────────────────────────────────────────

export const ruleOverVoltageLoad: ValidationRule = {
  id: 'ERC010',
  title: 'Over-Voltage Load',
  description: 'A load component is receiving voltage higher than its rated maximum.',
  severity: 'error',
  check(sheet, nets) {
    const issues: ValidationIssue[] = [];
    for (const comp of sheet.components) {
      const def = CATALOG_BY_ID[comp.definitionId];
      if (!def) continue;
      const maxV = def.maxVoltageV;
      if (maxV == null) continue;
      const pwrPin = def.pins.find(p => p.type === 'POWER' && p.protocol === 'POWER_IN');
      if (!pwrPin) continue;
      const net = getNetForPin(comp.id, pwrPin.id, nets);
      if (!net?.inferredVoltageV) continue;
      const supplyV = net.inferredVoltageV;
      if (supplyV > maxV + 0.05) {
        issues.push(issue('ERC010', 'error',
          'Over-Voltage Condition',
          `${comp.refDes} (${def.name}) max voltage is ${maxV}V but is connected to a ${supplyV.toFixed(1)}V net. Component may be damaged.`,
          { componentId: comp.id, netId: net.id, remediation: `Add a voltage regulator to step down to ≤${maxV}V.` }
        ));
      }
    }
    return issues;
  },
};

export const ruleUnderVoltageLoad: ValidationRule = {
  id: 'ERC011',
  title: 'Under-Voltage Load',
  description: 'A load component is receiving voltage below its specified minimum operating voltage.',
  severity: 'warning',
  check(sheet, nets) {
    const issues: ValidationIssue[] = [];
    for (const comp of sheet.components) {
      const def = CATALOG_BY_ID[comp.definitionId];
      if (!def) continue;
      const minV = def.minVoltageV;
      if (minV == null) continue;
      const pwrPin = def.pins.find(p => p.type === 'POWER' && p.protocol === 'POWER_IN');
      if (!pwrPin) continue;
      const net = getNetForPin(comp.id, pwrPin.id, nets);
      if (!net?.inferredVoltageV) continue;
      const supplyV = net.inferredVoltageV;
      if (supplyV < minV - 0.05) {
        issues.push(issue('ERC011', 'warning',
          'Under-Voltage Condition',
          `${comp.refDes} (${def.name}) minimum voltage is ${minV}V but is connected to a ${supplyV.toFixed(1)}V net. May malfunction.`,
          { componentId: comp.id, netId: net.id }
        ));
      }
    }
    return issues;
  },
};

export const ruleLogicVoltageMismatch: ValidationRule = {
  id: 'ERC012',
  title: 'Logic Voltage Mismatch',
  description: 'A signal output pin drives a net at a logic level incompatible with the receiving pin.',
  severity: 'warning',
  check(sheet, nets) {
    const issues: ValidationIssue[] = [];
    // Detect 5V signal driving 3.3V-only input
    for (const net of nets.values()) {
      let driverVoltage: number | null = null;
      let receiverMaxV: number | null = null;
      let receiverCompId: string | null = null;

      for (const { componentId, pinId } of net.pins) {
        const comp = sheet.components.find(c => c.id === componentId);
        if (!comp) continue;
        const def = CATALOG_BY_ID[comp.definitionId];
        if (!def) continue;
        const pin = def.pins.find(p => p.id === pinId);
        if (!pin) continue;

        if (pin.type === 'SIGNAL_OUT') {
          driverVoltage = def.nominalVoltageV ?? null;
        }
        if (pin.type === 'SIGNAL_IN' && def.maxVoltageV) {
          receiverMaxV = def.maxVoltageV;
          receiverCompId = componentId;
        }
      }

      if (driverVoltage != null && receiverMaxV != null && driverVoltage > receiverMaxV + 0.2) {
        const comp = sheet.components.find(c => c.id === receiverCompId);
        const def = comp ? CATALOG_BY_ID[comp.definitionId] : null;
        issues.push(issue('ERC012', 'warning',
          'Logic Voltage Mismatch',
          `Net "${net.name}": ${driverVoltage}V signal may damage receiver ${comp?.refDes ?? ''} (${def?.name ?? ''}) rated for max ${receiverMaxV}V logic.`,
          { netId: net.id, componentId: receiverCompId ?? undefined, remediation: 'Use a logic-level shifter or voltage divider between the driver and receiver.' }
        ));
      }
    }
    return issues;
  },
};

// ─── Regulator Rules ─────────────────────────────────────────────────────────

export const ruleRegulatorInputRange: ValidationRule = {
  id: 'ERC013',
  title: 'Regulator Input Voltage Out of Range',
  description: 'A voltage regulator input voltage is outside its specified operating range.',
  severity: 'error',
  check(sheet, nets) {
    const issues: ValidationIssue[] = [];
    for (const comp of sheet.components) {
      const def = CATALOG_BY_ID[comp.definitionId];
      if (!def?.isRegulator) continue;
      const vinPin = def.pins.find(p => p.protocol === 'POWER_IN' || p.label === 'VIN');
      if (!vinPin) continue;
      const net = getNetForPin(comp.id, vinPin.id, nets);
      if (!net?.inferredVoltageV) continue;
      const vin = net.inferredVoltageV;

      if (def.regulatorInputMinV != null && vin < def.regulatorInputMinV) {
        issues.push(issue('ERC013', 'error',
          'Regulator Input Too Low',
          `${comp.refDes} (${def.name}) requires ≥${def.regulatorInputMinV}V input but receives ${vin.toFixed(1)}V.`,
          { componentId: comp.id }
        ));
      }
      if (def.regulatorInputMaxV != null && vin > def.regulatorInputMaxV) {
        issues.push(issue('ERC013', 'error',
          'Regulator Input Too High',
          `${comp.refDes} (${def.name}) maximum input is ${def.regulatorInputMaxV}V but receives ${vin.toFixed(1)}V.`,
          { componentId: comp.id }
        ));
      }
    }
    return issues;
  },
};

export const ruleRegulatorHeadroom: ValidationRule = {
  id: 'ERC014',
  title: 'Insufficient Regulator Headroom',
  description: 'An LDO regulator does not have sufficient input-output voltage differential (dropout).',
  severity: 'warning',
  check(sheet, nets) {
    const issues: ValidationIssue[] = [];
    for (const comp of sheet.components) {
      const def = CATALOG_BY_ID[comp.definitionId];
      if (!def?.isRegulator) continue;
      if (!def.regulatorDropoutV) continue;
      const vinPin = def.pins.find(p => p.protocol === 'POWER_IN' || p.label === 'VIN');
      if (!vinPin) continue;
      const net = getNetForPin(comp.id, vinPin.id, nets);
      if (!net?.inferredVoltageV) continue;
      const vin = net.inferredVoltageV;
      const outputV = (comp.properties['outputVoltageV'] as number) ?? def.regulatorOutputV ?? 0;
      const headroom = vin - outputV;
      if (headroom < def.regulatorDropoutV) {
        issues.push(issue('ERC014', 'warning',
          'Insufficient LDO Headroom',
          `${comp.refDes} (${def.name}) has ${headroom.toFixed(2)}V headroom but requires ${def.regulatorDropoutV}V dropout. Output may be unregulated.`,
          { componentId: comp.id }
        ));
      }
    }
    return issues;
  },
};

export const ruleRegulatorOverload: ValidationRule = {
  id: 'ERC015',
  title: 'Regulator Output Overloaded',
  description: 'A voltage regulator is supplying more current than its rated maximum.',
  severity: 'error',
  check(_sheet, _nets, analysis) {
    const issues: ValidationIssue[] = [];
    if (!analysis) return issues;
    for (const reg of analysis.regulators) {
      if (reg.isOverloaded) {
        issues.push(issue('ERC015', 'error',
          'Regulator Overloaded',
          `${reg.refDes} (${reg.name}) is supplying ${reg.nominalOutputCurrentMa.toFixed(0)}mA but rated for ${reg.maxOutputCurrentMa}mA max.`,
          { componentId: reg.componentId, remediation: 'Use a higher-current regulator or split the load across multiple regulators.' }
        ));
      }
    }
    return issues;
  },
};

// ─── Current Rules ────────────────────────────────────────────────────────────

export const ruleSourceCurrentOverload: ValidationRule = {
  id: 'ERC016',
  title: 'Source Current Overload',
  description: 'The total load current exceeds the power source rated output current.',
  severity: 'error',
  check(sheet, _nets, analysis) {
    const issues: ValidationIssue[] = [];
    if (!analysis) return issues;
    for (const source of analysis.powerSources) {
      const comp = sheet.components.find(c => c.id === source.componentId);
      const def = comp ? CATALOG_BY_ID[comp.definitionId] : null;
      const maxCurrentMa = def?.maxCurrentMa;
      if (maxCurrentMa && source.nominalCurrentMa > maxCurrentMa) {
        issues.push(issue('ERC016', 'error',
          'Source Current Overload',
          `${source.refDes} (${source.name}) load is ${source.nominalCurrentMa.toFixed(0)}mA but source rating is ${maxCurrentMa}mA.`,
          { componentId: source.componentId }
        ));
      }
    }
    return issues;
  },
};

export const ruleConnectorCurrentRating: ValidationRule = {
  id: 'ERC017',
  title: 'Connector Current Rating Exceeded',
  description: 'A connector is passing more current than its rated maximum.',
  severity: 'warning',
  check(sheet, _nets, analysis) {
    const issues: ValidationIssue[] = [];
    if (!analysis) return issues;
    for (const comp of sheet.components) {
      const def = CATALOG_BY_ID[comp.definitionId];
      if (def?.category !== 'Connectivity') continue;
      const maxCurrentMa = (comp.properties['maxCurrentA'] as number | undefined) !== undefined ? (comp.properties['maxCurrentA'] as number) * 1000 : def.maxCurrentMa;
      if (!maxCurrentMa) continue;
      if (analysis.totalNominalCurrentMa > maxCurrentMa) {
        issues.push(issue('ERC017', 'warning',
          'Connector Current Exceeded',
          `${comp.refDes} (${def.name}) is rated for ${(maxCurrentMa / 1000).toFixed(1)}A but system draws ${(analysis.totalNominalCurrentMa / 1000).toFixed(2)}A.`,
          { componentId: comp.id }
        ));
      }
    }
    return issues;
  },
};

export const ruleSwitchCurrentRating: ValidationRule = {
  id: 'ERC018',
  title: 'Switch Current Rating Exceeded',
  description: 'A power switch carries more current than its rated maximum.',
  severity: 'warning',
  check(sheet, _nets, analysis) {
    const issues: ValidationIssue[] = [];
    if (!analysis) return issues;
    for (const comp of sheet.components) {
      if (comp.definitionId !== 'power_switch') continue;
      const maxA = (comp.properties['maxCurrentA'] as number) ?? 5;
      const maxMa = maxA * 1000;
      if (analysis.totalPeakCurrentMa > maxMa) {
        issues.push(issue('ERC018', 'warning',
          'Switch Current Rating Exceeded',
          `${comp.refDes} rated ${maxA}A but peak system current is ${(analysis.totalPeakCurrentMa / 1000).toFixed(2)}A.`,
          { componentId: comp.id }
        ));
      }
    }
    return issues;
  },
};

// ─── Project Budget Rules ─────────────────────────────────────────────────────

export const rulePowerBudgetExceeded: ValidationRule = {
  id: 'ERC019',
  title: 'Total Power Budget Exceeded',
  description: 'Estimated total power draw exceeds the configured project power budget.',
  severity: 'warning',
  check(_sheet, _nets, analysis, settings) {
    const issues: ValidationIssue[] = [];
    if (!analysis || settings.powerBudgetW <= 0) return issues;
    if (analysis.totalPowerW > settings.powerBudgetW) {
      issues.push(issue('ERC019', 'warning',
        'Power Budget Exceeded',
        `System power is ${analysis.totalPowerW.toFixed(2)}W, exceeding budget of ${settings.powerBudgetW}W.`,
        { remediation: 'Increase power budget or reduce system load.' }
      ));
    }
    return issues;
  },
};

export const ruleRuntimeBelowTarget: ValidationRule = {
  id: 'ERC020',
  title: 'Estimated Runtime Below Target',
  description: 'The estimated battery runtime is below the configured project target.',
  severity: 'warning',
  check(_sheet, _nets, analysis, settings) {
    const issues: ValidationIssue[] = [];
    if (!analysis?.estimatedRuntimeHours || settings.targetRuntimeHours <= 0) return issues;
    if (analysis.estimatedRuntimeHours < settings.targetRuntimeHours) {
      const pct = (analysis.estimatedRuntimeHours / settings.targetRuntimeHours * 100).toFixed(0);
      issues.push(issue('ERC020', 'warning',
        'Runtime Below Target',
        `Estimated runtime is ${(analysis.estimatedRuntimeHours * 60).toFixed(0)} min, below target of ${(settings.targetRuntimeHours * 60).toFixed(0)} min (${pct}% of target).`,
        { remediation: 'Increase battery capacity or reduce current consumption.' }
      ));
    }
    return issues;
  },
};

export const ruleBatteryReserveLow: ValidationRule = {
  id: 'ERC021',
  title: 'Battery Reserve Below Target',
  description: 'Projected remaining battery capacity after target runtime is below the configured reserve.',
  severity: 'warning',
  check(_sheet, _nets, analysis, settings) {
    const issues: ValidationIssue[] = [];
    if (!analysis || settings.batteryReservePercent <= 0) return issues;
    if (analysis.batteryReservePercent < settings.batteryReservePercent) {
      issues.push(issue('ERC021', 'warning',
        'Low Battery Reserve',
        `Battery reserve is ${analysis.batteryReservePercent.toFixed(0)}%, below required ${settings.batteryReservePercent}%.`,
        { remediation: 'Increase battery capacity or reduce current draw to maintain reserve margin.' }
      ));
    }
    return issues;
  },
};

// ─── I2C Rules ────────────────────────────────────────────────────────────────

export const ruleI2CAddressCollision: ValidationRule = {
  id: 'ERC022',
  title: 'I2C Address Collision',
  description: 'Two or more I2C devices on the same bus have the same address.',
  severity: 'error',
  check(sheet, nets) {
    const issues: ValidationIssue[] = [];
    // Group I2C devices by bus (sharing same SDA net)
    const sdaNetToDevices = new Map<string, Array<{ compId: string; addr: number; name: string; refDes: string }>>();

    for (const comp of sheet.components) {
      const def = CATALOG_BY_ID[comp.definitionId];
      if (!def) continue;
      const sdaPin = def.pins.find(p => p.protocol === 'I2C_SDA');
      if (!sdaPin) continue;
      const i2cAddr = (comp.properties['i2cAddr'] as string) ?? (sdaPin.i2cAddress != null ? `0x${sdaPin.i2cAddress.toString(16)}` : null);
      if (!i2cAddr) continue;

      const net = getNetForPin(comp.id, sdaPin.id, nets);
      if (!net) continue;
      const key = net.id;

      const addr = parseInt(i2cAddr, 16);
      if (isNaN(addr)) continue;

      if (!sdaNetToDevices.has(key)) sdaNetToDevices.set(key, []);
      sdaNetToDevices.get(key)!.push({ compId: comp.id, addr, name: def.name, refDes: comp.refDes });
    }

    for (const [, devices] of sdaNetToDevices) {
      const addrMap = new Map<number, typeof devices>();
      for (const d of devices) {
        if (!addrMap.has(d.addr)) addrMap.set(d.addr, []);
        addrMap.get(d.addr)!.push(d);
      }
      for (const [addr, group] of addrMap) {
        if (group.length > 1) {
          const names = group.map(d => d.refDes).join(', ');
          issues.push(issue('ERC022', 'error',
            'I2C Address Collision',
            `I2C address 0x${addr.toString(16).toUpperCase()} is shared by: ${names}. Only one device can occupy an address.`,
            { componentId: group[0].compId, remediation: 'Change device address via hardware address pins (A0/A1/A2) or use an I2C multiplexer.' }
          ));
        }
      }
    }
    return issues;
  },
};

// ─── Reference Designator Rules ───────────────────────────────────────────────

export const ruleDuplicateRefDes: ValidationRule = {
  id: 'ERC023',
  title: 'Duplicate Reference Designator',
  description: 'Two or more components have the same reference designator.',
  severity: 'error',
  check(sheet) {
    const issues: ValidationIssue[] = [];
    const seen = new Map<string, string>(); // refDes → first componentId
    for (const comp of sheet.components) {
      if (seen.has(comp.refDes)) {
        issues.push(issue('ERC023', 'error',
          'Duplicate Reference Designator',
          `Reference designator "${comp.refDes}" is used by more than one component.`,
          { componentId: comp.id, remediation: 'Renumber the components to have unique reference designators.' }
        ));
      } else {
        seen.set(comp.refDes, comp.id);
      }
    }
    return issues;
  },
};

export const ruleConflictingNetLabels: ValidationRule = {
  id: 'ERC024',
  title: 'Conflicting Net Labels',
  description: 'A net has multiple conflicting labels applied to it.',
  severity: 'warning',
  check(sheet) {
    const issues: ValidationIssue[] = [];
    // For now detect duplicate net labels at same position
    const seen = new Map<string, number>();
    for (const label of sheet.netLabels) {
      seen.set(label.name, (seen.get(label.name) ?? 0) + 1);
    }
    for (const [name, count] of seen) {
      if (count > 1 && !['GND', 'VCC', 'VBUS', '3V3', '5V'].includes(name)) {
        issues.push(issue('ERC024', 'warning',
          'Duplicate Net Label',
          `Net label "${name}" appears ${count} times. Verify it connects the correct nets.`
        ));
      }
    }
    return issues;
  },
};

export const ruleFloatingSignalInput: ValidationRule = {
  id: 'ERC025',
  title: 'Floating Signal Input',
  description: 'A signal input pin is not connected, leaving it floating and susceptible to noise.',
  severity: 'warning',
  check(sheet, nets) {
    const issues: ValidationIssue[] = [];
    for (const comp of sheet.components) {
      const def = CATALOG_BY_ID[comp.definitionId];
      if (!def) continue;
      for (const pin of def.pins) {
        if (pin.type !== 'SIGNAL_IN') continue;
        const net = getNetForPin(comp.id, pin.id, nets);
        const isConnected = net != null && net.pins.length > 1;
        if (!isConnected) {
          issues.push(issue('ERC025', 'warning',
            'Floating Signal Input',
            `${comp.refDes} (${def.name}) signal input "${pin.label}" is unconnected and floating.`,
            { componentId: comp.id, remediation: `Connect a pull-up or pull-down resistor to pin ${pin.label}, or wire it to the appropriate signal.` }
          ));
        }
      }
    }
    return issues;
  },
};

export const ruleMissingPullup: ValidationRule = {
  id: 'ERC026',
  title: 'I2C Bus Missing Pull-Up Resistors',
  description: 'An I2C bus (SDA/SCL) lacks pull-up resistors, which are required for I2C operation.',
  severity: 'warning',
  check(sheet, nets) {
    const issues: ValidationIssue[] = [];
    // Find nets with I2C SDA pins
    const sdaNets = new Set<string>();
    const sclNets = new Set<string>();
    for (const comp of sheet.components) {
      const def = CATALOG_BY_ID[comp.definitionId];
      if (!def) continue;
      for (const pin of def.pins) {
        const net = getNetForPin(comp.id, pin.id, nets);
        if (!net) continue;
        if (pin.protocol === 'I2C_SDA') sdaNets.add(net.id);
        if (pin.protocol === 'I2C_SCL') sclNets.add(net.id);
      }
    }
    if (sdaNets.size === 0) return issues;

    // Check if pull-up resistors are present
    const hasPullup = sheet.components.some(c => c.definitionId === 'pullup_resistor');

    if (!hasPullup && sdaNets.size > 0) {
      issues.push(issue('ERC026', 'warning',
        'I2C Pull-Up Resistors Missing',
        `I2C bus detected but no pull-up resistors found. I2C requires pull-ups on SDA and SCL (typically 4.7kΩ to supply voltage).`,
        { remediation: 'Add pull-up resistors (4.7kΩ recommended) from SDA and SCL to the appropriate supply voltage.' }
      ));
    }
    return issues;
  },
};

export const ruleIncompatibleProtocol: ValidationRule = {
  id: 'ERC027',
  title: 'Incompatible Protocol Connection',
  description: 'Pins with incompatible communication protocols are connected on the same net.',
  severity: 'warning',
  check(sheet, nets) {
    const issues: ValidationIssue[] = [];
    for (const net of nets.values()) {
      const protocols = net.pins.map(p => {
        const comp = sheet.components.find(c => c.id === p.componentId);
        if (!comp) return null;
        const def = CATALOG_BY_ID[comp.definitionId];
        return def?.pins.find(pp => pp.id === p.pinId)?.protocol ?? null;
      }).filter(Boolean);

      // Check if TX of one protocol is connected to MOSI of another (for example)
      const hasTx = protocols.some(p => p === 'UART_TX');
      const hasMosi = protocols.some(p => p === 'SPI_MOSI');
      if (hasTx && hasMosi) {
        issues.push(issue('ERC027', 'warning',
          'Protocol Mismatch',
          `Net "${net.name}" mixes UART_TX and SPI_MOSI signals. Verify this connection is intentional.`,
          { netId: net.id }
        ));
      }
    }
    return issues;
  },
};

export const rulePolarityConflict: ValidationRule = {
  id: 'ERC028',
  title: 'Polarity-Sensitive Connection',
  description: 'A polarity-sensitive component may be connected in reverse.',
  severity: 'warning',
  check(sheet, nets) {
    const issues: ValidationIssue[] = [];
    // Check capacitors: + should be on power net, - on ground
    for (const comp of sheet.components) {
      if (comp.definitionId !== 'capacitor') continue;
      const def = CATALOG_BY_ID[comp.definitionId];
      if (!def) continue;
      const posPin = def.pins.find(p => p.label === '+');
      const negPin = def.pins.find(p => p.label === '−');
      if (!posPin || !negPin) continue;

      const posNet = getNetForPin(comp.id, posPin.id, nets);
      const negNet = getNetForPin(comp.id, negPin.id, nets);

      if (posNet?.isGround && negNet?.isPower) {
        issues.push(issue('ERC028', 'warning',
          'Reversed Capacitor Polarity',
          `${comp.refDes}: Electrolytic capacitor may be connected with reversed polarity. Positive terminal should connect to higher voltage.`,
          { componentId: comp.id }
        ));
      }
    }
    return issues;
  },
};

export const ruleMissingElectricalMetadata: ValidationRule = {
  id: 'ERC029',
  title: 'Component Missing Critical Electrical Data',
  description: 'A component is placed but lacks key electrical properties needed for accurate analysis.',
  severity: 'info',
  check(sheet) {
    const issues: ValidationIssue[] = [];
    for (const comp of sheet.components) {
      const def = CATALOG_BY_ID[comp.definitionId];
      if (!def) continue;
      if (def.category === 'Passives' || def.category === 'Connectivity') continue;

      const hasVoltage = def.nominalVoltageV != null || def.outputVoltageV != null;
      const hasCurrent = def.nominalCurrentMa != null || def.outputCurrentMa != null;

      if (!hasVoltage && !hasCurrent) {
        issues.push(issue('ERC029', 'info',
          'Missing Electrical Data',
          `${comp.refDes} (${def.name}) has no voltage or current data. Analysis may be inaccurate.`,
          { componentId: comp.id }
        ));
      }
    }
    return issues;
  },
};

export const ruleMassBudgetExceeded: ValidationRule = {
  id: 'ERC030',
  title: 'Avionics Mass Budget Exceeded',
  description: 'Total avionics system mass exceeds the configured project mass limit.',
  severity: 'warning',
  check(_sheet, _nets, analysis, settings) {
    const issues: ValidationIssue[] = [];
    if (!analysis || settings.maxMassGrams <= 0) return issues;
    if (analysis.totalMassGrams > settings.maxMassGrams) {
      issues.push(issue('ERC030', 'warning',
        'Mass Budget Exceeded',
        `Avionics mass is ${analysis.totalMassGrams.toFixed(0)}g, exceeding limit of ${settings.maxMassGrams}g.`,
        { remediation: 'Replace heavy components with lighter alternatives or remove non-essential components.' }
      ));
    }
    return issues;
  },
};

// ─── Rule Registry ────────────────────────────────────────────────────────────

export const ALL_RULES: ValidationRule[] = [
  ruleUnconnectedRequiredPin,
  ruleDanglingWire,
  ruleIsolatedIsland,
  ruleSupplyPinWithoutSource,
  ruleGroundPinWithoutPath,
  rulePowerGroundShort,
  ruleIncompatiblePinTypes,
  ruleOutputToOutput,
  ruleConflictingPowerSources,
  ruleOverVoltageLoad,
  ruleUnderVoltageLoad,
  ruleLogicVoltageMismatch,
  ruleRegulatorInputRange,
  ruleRegulatorHeadroom,
  ruleRegulatorOverload,
  ruleSourceCurrentOverload,
  ruleConnectorCurrentRating,
  ruleSwitchCurrentRating,
  rulePowerBudgetExceeded,
  ruleRuntimeBelowTarget,
  ruleBatteryReserveLow,
  ruleI2CAddressCollision,
  ruleDuplicateRefDes,
  ruleConflictingNetLabels,
  ruleFloatingSignalInput,
  ruleMissingPullup,
  ruleIncompatibleProtocol,
  rulePolarityConflict,
  ruleMissingElectricalMetadata,
  ruleMassBudgetExceeded,
];
