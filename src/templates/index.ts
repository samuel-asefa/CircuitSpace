import type { Project } from '../types';
import { generateId } from '../utils/id';

// We define factory functions for each template to always return a fresh project.

function createBaseProject(name: string, description: string): Project {
  return {
    id: generateId(),
    name,
    description,
    author: 'CircuitSpace Templates',
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
    schemaVersion: 1,
    sheets: [{
      id: generateId(),
      name: 'Sheet 1',
      components: [],
      wires: [],
      netLabels: [],
      junctions: []
    }],
    settings: {
      targetRuntimeHours: 2,
      batteryReservePercent: 20,
      nominalBusVoltageV: 3.3,
      maxMassGrams: 500,
      powerBudgetW: 5
    }
  };
}

export const TEMPLATES = [
  {
    id: 'tpl-blank',
    name: 'Blank Project',
    description: 'Start from scratch with an empty schematic.',
    create: () => createBaseProject('Blank Project', '')
  },
  {
    id: 'tpl-basic-logger',
    name: 'Basic Sensor Logger',
    description: 'A simple flight data logger using an RP2040, IMU, and SD card.',
    create: () => {
      const p = createBaseProject('Basic Sensor Logger', 'A simple flight data logger using an RP2040, IMU, and SD card.');
      const s = p.sheets[0];
      
      const rp2040 = { id: generateId(), definitionId: 'rp2040_generic', refDes: 'U1', x: 20, y: 20, rotation: 0, properties: {} };
      const batt = { id: generateId(), definitionId: 'lipo_1s_500mah', refDes: 'BT1', x: -10, y: 15, rotation: 0, properties: {} };
      const ldo = { id: generateId(), definitionId: 'ldo_3v3', refDes: 'U2', x: 5, y: 15, rotation: 0, properties: {} };
      const imu = { id: generateId(), definitionId: 'mpu6050', refDes: 'U3', x: 40, y: 15, rotation: 0, properties: {} };
      const sd = { id: generateId(), definitionId: 'microsd_module', refDes: 'U4', x: 40, y: 30, rotation: 0, properties: {} };

      s.components.push(rp2040, batt, ldo, imu, sd);
      
      // We will skip wiring for templates right now as laying out coordinates is tedious, 
      // but placing the components gives them a valid starting point for Analysis & ERC
      // Let\'s wire power at least so ERC passes partially
      s.wires.push({
        id: generateId(), netId: generateId(), segments: [],
        pinA: { componentId: batt.id, pinId: 'pwr' },
        pinB: { componentId: ldo.id, pinId: 'vin' }
      });
      s.wires.push({
        id: generateId(), netId: generateId(), segments: [],
        pinA: { componentId: ldo.id, pinId: 'vout' },
        pinB: { componentId: rp2040.id, pinId: '3v3' }
      });
      s.wires.push({
        id: generateId(), netId: generateId(), segments: [],
        pinA: { componentId: ldo.id, pinId: 'vout' },
        pinB: { componentId: imu.id, pinId: 'vcc' }
      });

      return p;
    }
  },
  {
    id: 'tpl-baro-flight',
    name: 'Barometric Flight Logger',
    description: 'An ESP32-based flight computer recording barometric altitude with BMP388.',
    create: () => {
      const p = createBaseProject('Barometric Flight Logger', 'Records altitude during flight.');
      const s = p.sheets[0];
      s.components.push(
        { id: generateId(), definitionId: 'esp32_wroom', refDes: 'U1', x: 20, y: 20, rotation: 0, properties: {} },
        { id: generateId(), definitionId: 'lipo_1s_1000mah', refDes: 'BT1', x: -10, y: 15, rotation: 0, properties: {} },
        { id: generateId(), definitionId: 'bmp388', refDes: 'U2', x: 40, y: 15, rotation: 0, properties: {} },
        { id: generateId(), definitionId: 'ldo_3v3', refDes: 'U3', x: 5, y: 15, rotation: 0, properties: {} },
        { id: generateId(), definitionId: 'rgb_led', refDes: 'D1', x: 40, y: 30, rotation: 0, properties: {} },
        { id: generateId(), definitionId: 'resistor', refDes: 'R1', x: 35, y: 30, rotation: 0, properties: {} }
      );
      return p;
    }
  },
  {
    id: 'tpl-gps-logger',
    name: 'GPS + Data Logger',
    description: 'Tracks vehicle position and speed using a U-blox GPS and RP2040.',
    create: () => {
      const p = createBaseProject('GPS + Data Logger', 'Tracks vehicle position and speed.');
      const s = p.sheets[0];
      s.components.push(
        { id: generateId(), definitionId: 'rp2040_generic', refDes: 'U1', x: 20, y: 20, rotation: 0, properties: {} },
        { id: generateId(), definitionId: 'lipo_2s_800mah', refDes: 'BT1', x: -10, y: 15, rotation: 0, properties: {} },
        { id: generateId(), definitionId: 'buck_5v', refDes: 'U2', x: 5, y: 15, rotation: 0, properties: {} },
        { id: generateId(), definitionId: 'ldo_3v3', refDes: 'U3', x: 5, y: 25, rotation: 0, properties: {} },
        { id: generateId(), definitionId: 'ublox_neo_m8n', refDes: 'U4', x: 40, y: 15, rotation: 0, properties: {} },
        { id: generateId(), definitionId: 'microsd_module', refDes: 'U5', x: 40, y: 35, rotation: 0, properties: {} }
      );
      return p;
    }
  },
  {
    id: 'tpl-imu-telemetry',
    name: 'IMU Telemetry System',
    description: 'High-speed 9-DOF IMU streaming telemetry over LoRa radio.',
    create: () => {
      const p = createBaseProject('IMU Telemetry System', 'High-speed 9-DOF IMU streaming over LoRa.');
      const s = p.sheets[0];
      s.components.push(
        { id: generateId(), definitionId: 'teensy41', refDes: 'U1', x: 20, y: 20, rotation: 0, properties: {} },
        { id: generateId(), definitionId: 'bno085', refDes: 'U2', x: 40, y: 10, rotation: 0, properties: {} },
        { id: generateId(), definitionId: 'lora_rfm95', refDes: 'U3', x: 40, y: 30, rotation: 0, properties: {} },
        { id: generateId(), definitionId: 'lipo_1s_500mah', refDes: 'BT1', x: -10, y: 15, rotation: 0, properties: {} },
        { id: generateId(), definitionId: 'ldo_3v3', refDes: 'U4', x: 5, y: 15, rotation: 0, properties: {} }
      );
      return p;
    }
  },
  {
    id: 'tpl-dual-sensor',
    name: 'Dual-Sensor Data Acquisition',
    description: 'Redundant sensing with two different barometric sensors for reliability.',
    create: () => {
      const p = createBaseProject('Dual-Sensor Data Acquisition', 'Redundant sensing with two different barometers.');
      const s = p.sheets[0];
      s.components.push(
        { id: generateId(), definitionId: 'rp2040_generic', refDes: 'U1', x: 20, y: 20, rotation: 0, properties: {} },
        { id: generateId(), definitionId: 'bmp388', refDes: 'U2', x: 40, y: 10, rotation: 0, properties: {} },
        { id: generateId(), definitionId: 'ms5607', refDes: 'U3', x: 40, y: 25, rotation: 0, properties: {} },
        { id: generateId(), definitionId: 'microsd_module', refDes: 'U4', x: 40, y: 40, rotation: 0, properties: {} },
        { id: generateId(), definitionId: 'lipo_1s_500mah', refDes: 'BT1', x: -10, y: 15, rotation: 0, properties: {} },
        { id: generateId(), definitionId: 'ldo_3v3', refDes: 'U5', x: 5, y: 15, rotation: 0, properties: {} }
      );
      return p;
    }
  },
  {
    id: 'tpl-reg-5v',
    name: 'Regulated 5V Avionics Bus',
    description: 'High power 5V buck regulator driving multiple peripherals from a 3S battery.',
    create: () => {
      const p = createBaseProject('Regulated 5V Avionics Bus', 'High power 5V buck regulator from 3S battery.');
      p.settings.nominalBusVoltageV = 5.0;
      const s = p.sheets[0];
      s.components.push(
        { id: generateId(), definitionId: 'lipo_3s_1500mah', refDes: 'BT1', x: -10, y: 20, rotation: 0, properties: {} },
        { id: generateId(), definitionId: 'buck_5v_high', refDes: 'U1', x: 5, y: 20, rotation: 0, properties: {} },
        { id: generateId(), definitionId: 'teensy41', refDes: 'U2', x: 25, y: 20, rotation: 0, properties: {} },
        { id: generateId(), definitionId: 'servo_standard', refDes: 'M1', x: 45, y: 10, rotation: 0, properties: {} },
        { id: generateId(), definitionId: 'servo_standard', refDes: 'M2', x: 45, y: 30, rotation: 0, properties: {} }
      );
      return p;
    }
  },
  {
    id: 'tpl-servo-control',
    name: 'Servo Control System',
    description: 'Dedicated PWM servo controller driving active fins for stabilization.',
    create: () => {
      const p = createBaseProject('Servo Control System', 'Dedicated PWM servo controller driving active fins.');
      const s = p.sheets[0];
      s.components.push(
        { id: generateId(), definitionId: 'lipo_2s_800mah', refDes: 'BT1', x: -10, y: 20, rotation: 0, properties: {} },
        { id: generateId(), definitionId: 'buck_5v', refDes: 'U1', x: 5, y: 20, rotation: 0, properties: {} },
        { id: generateId(), definitionId: 'rp2040_generic', refDes: 'U2', x: 20, y: 20, rotation: 0, properties: {} },
        { id: generateId(), definitionId: 'bno085', refDes: 'U3', x: 20, y: 5, rotation: 0, properties: {} },
        { id: generateId(), definitionId: 'servo_micro', refDes: 'M1', x: 40, y: 10, rotation: 0, properties: {} },
        { id: generateId(), definitionId: 'servo_micro', refDes: 'M2', x: 40, y: 20, rotation: 0, properties: {} },
        { id: generateId(), definitionId: 'servo_micro', refDes: 'M3', x: 40, y: 30, rotation: 0, properties: {} },
        { id: generateId(), definitionId: 'servo_micro', refDes: 'M4', x: 40, y: 40, rotation: 0, properties: {} }
      );
      return p;
    }
  }
];
