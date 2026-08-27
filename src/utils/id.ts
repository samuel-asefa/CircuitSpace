import { v4 as uuidv4 } from 'uuid';

export const generateId = (): string => uuidv4();

/**
 * Generate a reference designator like "U1", "R3" etc.
 * Finds the next available number for the given prefix.
 */
export function generateRefDes(prefix: string, existingRefDes: string[]): string {
  const nums = existingRefDes
    .filter(r => r.startsWith(prefix))
    .map(r => parseInt(r.slice(prefix.length), 10))
    .filter(n => !isNaN(n));
  const next = nums.length === 0 ? 1 : Math.max(...nums) + 1;
  return `${prefix}${next}`;
}

/**
 * Clamp a value between min and max.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Deep clone an object (JSON-serializable).
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Debounce a function call.
 */
export function debounce<T extends (...args: unknown[]) => unknown>(fn: T, delay: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: unknown[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  }) as T;
}
