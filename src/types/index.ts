// ─── Core ID Types ────────────────────────────────────────────────────────────
export type ComponentInstanceId = string;
export type PinId = string;
export type NetId = string;
export type WireId = string;
export type ProjectId = string;
export type SheetId = string;
export type TemplateId = string;

// ─── Pin Types ────────────────────────────────────────────────────────────────
export type PinType =
  | 'POWER'
  | 'GROUND'
  | 'SIGNAL_IN'
  | 'SIGNAL_OUT'
  | 'SIGNAL_BIDIR'
  | 'ANALOG_IN'
  | 'ANALOG_OUT'
  | 'PASSIVE'
  | 'NC'
  | 'ANY';

export type PinProtocol =
  | 'UART_TX' | 'UART_RX'
  | 'I2C_SDA' | 'I2C_SCL'
  | 'SPI_MOSI' | 'SPI_MISO' | 'SPI_SCK' | 'SPI_CS'
  | 'CAN_H' | 'CAN_L'
  | 'PWM'
  | 'ADC'
  | 'GPIO'
  | 'POWER_IN' | 'POWER_OUT'
  | 'GND'
  | 'NONE';

// ─── Pin Definition (on a component definition) ──────────────────────────────
export interface PinDefinition {
  id: PinId;
  label: string;
  type: PinType;
  protocol?: PinProtocol;
  /** Position relative to component body, in schematic grid units */
  x: number;
  y: number;
  /** Direction the pin stub points: 'left'|'right'|'up'|'down' */
  direction?: 'left' | 'right' | 'up' | 'down';
  /** Whether this pin MUST be connected for a valid design */
  required?: boolean;
  /** For I2C devices, their default address */
  i2cAddress?: number;
}

// ─── Component Category ───────────────────────────────────────────────────────
export type ComponentCategory =
  | 'Power'
  | 'Compute'
  | 'Sensors'
  | 'Communications'
  | 'Actuation'
  | 'Connectivity'
  | 'Passives';

// ─── Editable Property Definition ─────────────────────────────────────────────
export interface PropertyDefinition {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'boolean';
  unit?: string;
  defaultValue: string | number | boolean;
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
}

// ─── Component Definition (catalog entry) ────────────────────────────────────
export interface ComponentDefinition {
  id: string;
  name: string;
  category: ComponentCategory;
  subcategory?: string;
  description: string;
  /** Reference designator prefix, e.g. "U", "R", "C", "BT" */
  refPrefix: string;
  pins: PinDefinition[];
  /** Schematic symbol width in grid units */
  width: number;
  /** Schematic symbol height in grid units */
  height: number;
  /** Nominal operating voltage in V */
  nominalVoltageV?: number;
  /** Minimum operating voltage in V */
  minVoltageV?: number;
  /** Maximum operating voltage in V */
  maxVoltageV?: number;
  /** Nominal supply current draw in mA */
  nominalCurrentMa?: number;
  /** Maximum/peak supply current in mA */
  maxCurrentMa?: number;
  /** Output/supply current capacity in mA (for sources/regulators) */
  outputCurrentMa?: number;
  /** Source voltage (for batteries/regulators) */
  outputVoltageV?: number;
  /** Battery capacity in mAh */
  capacityMah?: number;
  /** Component mass in grams */
  massGrams: number;
  /** Estimated unit cost in USD */
  costUsd?: number;
  /** Supported communication interfaces */
  interfaces?: PinProtocol[];
  /** Free-form tags for search */
  tags: string[];
  /** Editable instance properties beyond the defaults */
  editableProps: PropertyDefinition[];
  /** Whether this is a power source */
  isSource?: boolean;
  /** Whether this is a voltage regulator */
  isRegulator?: boolean;
  /** Regulator efficiency (0–1) */
  regulatorEfficiency?: number;
  /** Regulator input voltage range */
  regulatorInputMinV?: number;
  regulatorInputMaxV?: number;
  /** Regulator output voltage */
  regulatorOutputV?: number;
  /** Regulator dropout voltage */
  regulatorDropoutV?: number;
  /** Symbol style for rendering */
  symbolStyle?: 'ic' | 'battery' | 'resistor' | 'capacitor' | 'diode' | 'transistor' | 'connector' | 'generic';
}

// ─── Component Instance (placed on sheet) ────────────────────────────────────
export interface ComponentInstance {
  id: ComponentInstanceId;
  definitionId: string;
  /** Reference designator, e.g. "U1", "R3" */
  refDes: string;
  x: number;
  y: number;
  rotation: number; // 0 | 90 | 180 | 270
  /** Overridden property values */
  properties: Record<string, string | number | boolean>;
  /** Resolved pin positions (computed, not stored) */
  // pins resolved at render time
}

// ─── Wire Segment ─────────────────────────────────────────────────────────────
export interface WireSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

// ─── Wire ─────────────────────────────────────────────────────────────────────
export interface Wire {
  id: WireId;
  netId: NetId;
  segments: WireSegment[];
  /** Connected pin endpoint A */
  pinA?: { componentId: ComponentInstanceId; pinId: PinId };
  /** Connected pin endpoint B */
  pinB?: { componentId: ComponentInstanceId; pinId: PinId };
}

// ─── Net ──────────────────────────────────────────────────────────────────────
export interface Net {
  id: NetId;
  name: string;
  /** All (componentId, pinId) pairs in this net */
  pins: Array<{ componentId: ComponentInstanceId; pinId: PinId }>;
  /** Inferred voltage from connected sources, null if unknown */
  inferredVoltageV: number | null;
  /** Whether this net is a power supply net */
  isPower: boolean;
  /** Whether this net is ground */
  isGround: boolean;
}

// ─── Net Label ────────────────────────────────────────────────────────────────
export interface NetLabel {
  id: string;
  x: number;
  y: number;
  name: string;
  netId?: NetId;
}

// ─── Junction (where wires cross and connect) ─────────────────────────────────
export interface Junction {
  id: string;
  x: number;
  y: number;
}

// ─── Circuit Sheet ────────────────────────────────────────────────────────────
export interface CircuitSheet {
  id: SheetId;
  name: string;
  components: ComponentInstance[];
  wires: Wire[];
  netLabels: NetLabel[];
  junctions: Junction[];
}

// ─── Project Settings ─────────────────────────────────────────────────────────
export interface ProjectSettings {
  /** Target operating duration in hours */
  targetRuntimeHours: number;
  /** Required battery reserve percentage (0–100) */
  batteryReservePercent: number;
  /** Nominal bus voltage in V */
  nominalBusVoltageV: number;
  /** Maximum desired avionics mass in grams */
  maxMassGrams: number;
  /** Total power budget in W */
  powerBudgetW: number;
}

// ─── Project ──────────────────────────────────────────────────────────────────
export interface Project {
  id: ProjectId;
  name: string;
  description: string;
  author: string;
  createdAt: string; // ISO
  modifiedAt: string; // ISO
  schemaVersion: number;
  sheets: CircuitSheet[];
  settings: ProjectSettings;
  /** Cached statistics for dashboard display */
  stats?: ProjectStats;
}

export interface ProjectStats {
  componentCount: number;
  netCount: number;
  errorCount: number;
  warningCount: number;
  totalMassGrams: number;
  estimatedRuntimeHours: number | null;
}

// ─── Analysis ─────────────────────────────────────────────────────────────────
export interface PowerSourceAnalysis {
  componentId: ComponentInstanceId;
  refDes: string;
  name: string;
  voltageV: number;
  capacityMah: number | null;
  /** Nominal current drawn from this source */
  nominalCurrentMa: number;
  peakCurrentMa: number;
  utilizationPercent: number;
}

export interface RegulatorAnalysis {
  componentId: ComponentInstanceId;
  refDes: string;
  name: string;
  inputVoltageV: number | null;
  outputVoltageV: number;
  nominalOutputCurrentMa: number;
  maxOutputCurrentMa: number;
  utilizationPercent: number;
  efficiencyPercent: number;
  headroomV: number | null;
  isOverloaded: boolean;
}

export interface LoadAnalysis {
  componentId: ComponentInstanceId;
  refDes: string;
  name: string;
  category: ComponentCategory;
  nominalCurrentMa: number;
  peakCurrentMa: number;
  supplyVoltageV: number | null;
}

export interface MassBreakdown {
  category: ComponentCategory;
  massGrams: number;
  componentCount: number;
}

export interface AnalysisResult {
  /** Timestamp of this analysis */
  timestamp: number;
  powerSources: PowerSourceAnalysis[];
  regulators: RegulatorAnalysis[];
  loads: LoadAnalysis[];
  totalNominalCurrentMa: number;
  totalPeakCurrentMa: number;
  totalPowerW: number;
  estimatedRuntimeHours: number | null;
  batteryCapacityMah: number;
  batteryReservePercent: number;
  totalMassGrams: number;
  massByCategory: MassBreakdown[];
  componentCount: number;
  netCount: number;
  connectedPinCount: number;
  unconnectedRequiredPinCount: number;
  warningCount: number;
  errorCount: number;
  /** Is the analysis valid (enough power sources present) */
  isValid: boolean;
  notes: string[];
}

// ─── ERC Validation ──────────────────────────────────────────────────────────
export type ValidationSeverity = 'error' | 'warning' | 'info' | 'passed';

export interface ValidationIssue {
  id: string;
  ruleId: string;
  severity: ValidationSeverity;
  title: string;
  message: string;
  /** Affected component ID (for zoom/highlight) */
  componentId?: ComponentInstanceId;
  /** Affected net ID */
  netId?: NetId;
  /** Affected wire ID */
  wireId?: WireId;
  remediation?: string;
}

export interface ValidationRule {
  id: string;
  title: string;
  description: string;
  severity: ValidationSeverity;
  check: (
    sheet: CircuitSheet,
    nets: Map<string, Net>,
    analysis?: AnalysisResult | null,
    settings?: ProjectSettings
  ) => ValidationIssue[];
}

// ─── BOM ──────────────────────────────────────────────────────────────────────
export interface BOMEntry {
  definitionId: string;
  refDesignators: string[];
  name: string;
  category: ComponentCategory;
  description: string;
  quantity: number;
  massGrams: number;
  totalMassGrams: number;
  unitCostUsd: number | null;
  totalCostUsd: number | null;
  /** Key value property, e.g. "10kΩ" or "3.3V" */
  value: string;
}

// ─── Netlist ──────────────────────────────────────────────────────────────────
export interface NetlistEntry {
  netId: NetId;
  name: string;
  inferredVoltageV: number | null;
  isPower: boolean;
  isGround: boolean;
  pins: Array<{
    componentId: ComponentInstanceId;
    refDes: string;
    componentName: string;
    pinId: PinId;
    pinLabel: string;
    pinType: PinType;
    protocol?: PinProtocol;
  }>;
}

// ─── Design Template ──────────────────────────────────────────────────────────
export interface DesignTemplate {
  id: TemplateId;
  name: string;
  description: string;
  category: string;
  tags: string[];
  /** Pre-built sheet data */
  sheet: CircuitSheet;
  settings: Partial<ProjectSettings>;
  previewDescription: string;
  componentCount: number;
  netCount: number;
}

// ─── Export ───────────────────────────────────────────────────────────────────
export type ExportFormat = 'cspace' | 'svg' | 'png' | 'pdf' | 'csv-bom' | 'netlist';

export interface ExportConfig {
  format: ExportFormat;
  filename: string;
  includeAnalysis?: boolean;
  includeValidation?: boolean;
}

// ─── Editor State ─────────────────────────────────────────────────────────────
export type EditorTool = 'select' | 'wire' | 'pan' | 'place';

export interface ViewState {
  scale: number;
  panX: number;
  panY: number;
}

export interface WiringState {
  active: boolean;
  startComponentId: ComponentInstanceId | null;
  startPinId: PinId | null;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  /** Segments drawn so far */
  segments: WireSegment[];
}

// ─── History ──────────────────────────────────────────────────────────────────
export interface HistoryEntry {
  description: string;
  sheet: CircuitSheet;
}
