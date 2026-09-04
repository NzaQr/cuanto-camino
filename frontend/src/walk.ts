import type { BoardAlightStop, WalkUnit } from './types.ts';

/** Slider limits per unit. Mirrors WALK_LIMITS on the backend. */
export const WALK_LIMITS: Record<WalkUnit, { min: number; max: number; step: number; default: number }> = {
  minutes: { min: 2, max: 30, step: 1, default: 8 },
  meters: { min: 150, max: 2500, step: 50, default: 600 },
};

/** Walk speed used only to convert between units and for the on-map estimate: 4.5 km/h. */
export const ESTIMATED_WALK_SPEED_MPS = 1.25;

function snap(unit: WalkUnit, value: number): number {
  const { min, max, step } = WALK_LIMITS[unit];
  return Math.min(max, Math.max(min, Math.round(value / step) * step));
}

/** Same budget expressed in the other unit, snapped to that unit's slider. */
export function convertBudget(from: WalkUnit, to: WalkUnit, value: number): number {
  if (from === to) return value;
  return to === 'meters'
    ? snap('meters', value * 60 * ESTIMATED_WALK_SPEED_MPS)
    : snap('minutes', value / (60 * ESTIMATED_WALK_SPEED_MPS));
}

/** "8 min" or "600 m". */
export function formatBudget(unit: WalkUnit, value: number): string {
  return unit === 'meters' ? `${value} m` : `${value} min`;
}

/** Straight-line radius drawn before a search answers. */
export function estimatedRadiusMeters(unit: WalkUnit, value: number): number {
  return unit === 'meters' ? value : Math.round(value * 60 * ESTIMATED_WALK_SPEED_MPS);
}

/** "1 min", "12 min". Rounds up so a 40 s walk does not show as 0. */
export function formatWalkMinutes(seconds: number): string {
  return `${Math.max(1, Math.ceil(seconds / 60))} min`;
}

export function formatWalkMeters(meters: number): string {
  return `${meters}m`;
}

/** "5 min · 380m" when the walk time is known, else "380m". */
export function formatWalk(stop: BoardAlightStop): string {
  if (stop.walkSeconds != null) {
    return `${formatWalkMinutes(stop.walkSeconds)} · ${formatWalkMeters(stop.walkMeters)}`;
  }
  return formatWalkMeters(stop.walkMeters);
}

/** Short form for the summary line: "5 min" when known, else "380m". */
export function formatWalkShort(stop: BoardAlightStop): string {
  return stop.walkSeconds != null
    ? formatWalkMinutes(stop.walkSeconds)
    : formatWalkMeters(stop.walkMeters);
}
