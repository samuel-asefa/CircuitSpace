/**
 * Centralized engineering unit formatting.
 * All formatting functions return compact strings with units.
 */

export function formatVoltage(v: number | null | undefined): string {
  if (v == null) return '—';
  if (Math.abs(v) < 0.001) return '0 V';
  return `${Number(v.toFixed(2))} V`;
}

export function formatCurrentMa(ma: number | null | undefined): string {
  if (ma == null) return '—';
  if (Math.abs(ma) >= 1000) {
    return `${Number((ma / 1000).toFixed(2))} A`;
  }
  return `${Number(ma.toFixed(1))} mA`;
}

export function formatPowerW(w: number | null | undefined): string {
  if (w == null) return '—';
  if (Math.abs(w) < 0.001) return '0 W';
  if (Math.abs(w) >= 1) {
    return `${Number(w.toFixed(2))} W`;
  }
  return `${Number((w * 1000).toFixed(0))} mW`;
}

export function formatMassG(g: number | null | undefined): string {
  if (g == null) return '—';
  if (Math.abs(g) >= 1000) {
    return `${Number((g / 1000).toFixed(2))} kg`;
  }
  return `${Number(g.toFixed(1))} g`;
}

export function formatTimeHours(h: number | null | undefined): string {
  if (h == null) return '—';
  if (h < 0.0167) {
    return `${Math.round(h * 3600)} s`;
  }
  if (h < 1) {
    return `${Math.round(h * 60)} min`;
  }
  return `${Number(h.toFixed(1))} h`;
}

export function formatPercent(p: number | null | undefined, decimals = 0): string {
  if (p == null) return '—';
  return `${Number(p.toFixed(decimals))}%`;
}

export function formatFrequencyHz(hz: number | null | undefined): string {
  if (hz == null) return '—';
  if (hz >= 1_000_000) return `${(hz / 1_000_000).toFixed(1)} MHz`;
  if (hz >= 1_000) return `${(hz / 1_000).toFixed(1)} kHz`;
  return `${hz} Hz`;
}

export function formatResistanceOhm(ohm: number | null | undefined): string {
  if (ohm == null) return '—';
  if (ohm >= 1_000_000) return `${(ohm / 1_000_000).toFixed(2)} MΩ`;
  if (ohm >= 1_000) return `${(ohm / 1_000).toFixed(2)} kΩ`;
  return `${ohm} Ω`;
}

export function formatCapacitanceUf(uf: number | null | undefined): string {
  if (uf == null) return '—';
  if (uf >= 1000) return `${(uf / 1000).toFixed(1)} mF`;
  if (uf < 0.001) return `${(uf * 1_000_000).toFixed(0)} pF`;
  if (uf < 1) return `${(uf * 1000).toFixed(0)} nF`;
  return `${uf} μF`;
}

export function formatCostUsd(usd: number | null | undefined): string {
  if (usd == null) return '—';
  return `$${usd.toFixed(2)}`;
}

/**
 * Round to nearest multiple of grid size.
 */
export function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

/**
 * Format a number to a given number of significant figures.
 */
export function sigfig(n: number, sig = 3): number {
  if (n === 0) return 0;
  const d = Math.ceil(Math.log10(Math.abs(n)));
  const pow = sig - d;
  const magnitude = Math.pow(10, pow);
  return Math.round(n * magnitude) / magnitude;
}
