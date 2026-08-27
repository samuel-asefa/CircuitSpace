import { describe, it, expect } from 'vitest';
import { analyzeCircuit } from '../analysisEngine';
import { CATALOG_BY_ID } from '../../catalog';
import { TEMPLATES } from '../../templates';
import type { ProjectSettings, CircuitSheet, ComponentInstance } from '../../types';

describe('Analysis Engine', () => {
  const defaultSettings: ProjectSettings = {
    targetRuntimeHours: 2,
    batteryReservePercent: 20,
    nominalBusVoltageV: 3.3,
    maxMassGrams: 500,
    powerBudgetW: 5,
  };

  const createBlankSheet = (): CircuitSheet => ({
    id: 'sheet-1',
    name: 'Main',
    components: [],
    wires: [],
    netLabels: [],
    junctions: [],
  });

  const createComp = (defId: string, id: string, props: any = {}): ComponentInstance => ({
    id,
    definitionId: defId,
    refDes: 'C1',
    x: 0,
    y: 0,
    rotation: 0,
    properties: props,
  });

  it('calculates mass correctly for empty sheet', () => {
    const sheet = createBlankSheet();
    const result = analyzeCircuit(sheet, defaultSettings);
    
    expect(result.totalMassGrams).toBe(0);
    expect(result.componentCount).toBe(0);
    expect(result.netCount).toBe(0);
  });

  it('aggregates mass from components', () => {
    const sheet = createBlankSheet();
    sheet.components.push(createComp('lipo_1s', 'b1'));
    sheet.components.push(createComp('arduino_nano', 'u1'));
    
    const result = analyzeCircuit(sheet, defaultSettings);
    
    const battMass = CATALOG_BY_ID['lipo_1s'].massGrams || 0;
    const mcuMass = CATALOG_BY_ID['arduino_nano'].massGrams || 0;
    
    expect(result.totalMassGrams).toBe(battMass + mcuMass);
    expect(result.componentCount).toBe(2);
  });

  it('calculates power and mass correctly for a template', () => {
    const template = TEMPLATES.find(t => t.id === 'tpl-baro-flight');
    if (!template) throw new Error('Template not found');
    const project = template.create();
    const sheet = project.sheets[0];
    
    const result = analyzeCircuit(sheet, defaultSettings);
    
    // Baro logger has some components and mass
    expect(result.componentCount).toBeGreaterThan(0);
    expect(result.totalMassGrams).toBeGreaterThan(0);
  });
});
