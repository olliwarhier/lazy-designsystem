// Lightness-Skala nach Spezifikation 02 (Tint-Generator), Abschnitt 3 und 4.
// Alle Lightness-Werte auf der Skala 0–100.

export type ContrastSystem = 'apca' | 'wcag';

export interface ScaleSettings {
  /** Stepzahl gesamt, ungerade, 7–15 */
  steps: number;
  /** Kontrastsystem bestimmt das Zentrum */
  system: ContrastSystem;
  /** Regler „Verteilung": 1 = dynamisch (max. Schub nach außen), 0 = linear */
  distribution: number;
  /** Oberer Außenpunkt, 90–100 */
  upper: number;
  /** Unterer Außenpunkt, 0–20 */
  lower: number;
  /**
   * Untergrenze für den Faktor r (Spec 02, Abschnitt 8: offener Punkt „wenige Steps mit Regler 1").
   * 0 = wie spezifiziert, 0,5 = Vorschlag zum Testen.
   */
  minRatio?: number;
}

export const DEFAULT_SCALE: ScaleSettings = {
  steps: 11,
  system: 'apca',
  distribution: 1,
  upper: 100,
  lower: 10,
  minRatio: 0,
};

/** Zentrum: Schwarz und Weiß haben hier den gleichen Kontrast zur Farbe */
export const CENTER: Record<ContrastSystem, number> = { apca: 70, wcag: 57 };

/** Mindestabstand zwischen zwei Steps in L-Punkten */
export const MIN_GAP = 2;
/** Bevorzugter und kleinster Abstand des ersten Steps zum Zentrum */
export const CENTER_GAP = { preferred: 10, min: 8 };

export interface SideInfo {
  /** Steps dieser Seite (ohne Zentrum), vom Zentrum nach außen, ungerundet */
  raw: number[];
  /** Abstand des ersten Steps zum Zentrum */
  g: number;
  /** verwendeter Faktor */
  r: number;
  /** kleinster erlaubter Faktor */
  rMin: number;
}

export interface Scale {
  /** alle Steps absteigend (hell → dunkel), gerundet */
  values: number[];
  center: number;
  centerIndex: number;
  light: SideInfo;
  dark: SideInfo;
}

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

/** Abstände g, a, a·r, …, a·r^(n−2) für eine Seite mit Spanne R */
function gaps(R: number, n: number, g: number, r: number): number[] {
  const rest = R - g;
  const count = n - 1;
  if (count <= 0) return [R];
  const a = Math.abs(1 - r) < 1e-9 ? rest / count : (rest * (1 - r)) / (1 - r ** count);
  return [g, ...Array.from({ length: count }, (_, i) => a * r ** i)];
}

/** kleinster Faktor r, bei dem der letzte Abstand noch ≥ MIN_GAP ist (Bisektion) */
function minRatio(R: number, n: number, g: number): number {
  const last = (r: number) => gaps(R, n, g, r).at(-1)!;
  if (n <= 1 || last(1) < MIN_GAP) return 1;
  let lo = 1e-4;
  let hi = 1;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (last(mid) >= MIN_GAP) hi = mid;
    else lo = mid;
  }
  return hi;
}

function side(center: number, outer: number, n: number, push: number, floor: number): SideInfo {
  const R = Math.abs(outer - center);
  const dir = Math.sign(outer - center) || 1;
  // Zentrumsabstand: bevorzugt 10, bei zu wenig Spanne bis minimal 8 (notfalls weniger)
  let g = CENTER_GAP.preferred;
  if (R - g < (n - 1) * MIN_GAP) g = Math.max(CENTER_GAP.min, R - (n - 1) * MIN_GAP);
  if (R - g < (n - 1) * MIN_GAP) g = Math.max(MIN_GAP, R - (n - 1) * MIN_GAP);
  const rMin = minRatio(R, n, g);
  const r = Math.max(1 - push * (1 - rMin), floor, rMin);
  let pos = center;
  const raw = gaps(R, n, g, r).map((d) => (pos += dir * d));
  raw[raw.length - 1] = outer; // Rundungsfehler der Reihe ausgleichen
  return { raw, g, r, rMin };
}

/** Rundet eine Seite auf ganze L und stellt den Mindestabstand wieder her (vom Außenpunkt nach innen) */
function roundSide(center: number, raw: number[]): number[] {
  const dir = Math.sign(raw.at(-1)! - center) || 1;
  const out = raw.map(Math.round);
  for (let i = out.length - 2; i >= 0; i--) {
    if (dir * (out[i + 1] - out[i]) < MIN_GAP) out[i] = out[i + 1] - dir * MIN_GAP;
  }
  for (let i = 0; i < out.length; i++) {
    const prev = i === 0 ? center : out[i - 1];
    if (dir * (out[i] - prev) < MIN_GAP) out[i] = prev + dir * MIN_GAP;
  }
  return out;
}

export function normalizeScale(s: Partial<ScaleSettings>): ScaleSettings {
  const m = { ...DEFAULT_SCALE, ...s };
  let steps = clamp(Math.round(m.steps), 7, 15);
  if (steps % 2 === 0) steps += 1;
  return {
    steps: Math.min(steps, 15),
    system: m.system === 'wcag' ? 'wcag' : 'apca',
    distribution: clamp(m.distribution, 0, 1),
    upper: clamp(Math.round(m.upper), 90, 100),
    lower: clamp(Math.round(m.lower), 0, 20),
    minRatio: clamp(m.minRatio ?? 0, 0, 1),
  };
}

/** Lightness-Skala nach Spec 02 */
export function lightnessScale(settings: Partial<ScaleSettings> = {}): Scale {
  const s = normalizeScale(settings);
  const center = CENTER[s.system];
  const n = (s.steps - 1) / 2;
  const floor = s.minRatio ?? 0;
  // Hell: voller Schub, Dunkel: halber Schub
  const light = side(center, s.upper, n, s.distribution, floor);
  const dark = side(center, s.lower, n, s.distribution * 0.5, floor);
  const up = roundSide(center, light.raw);
  const down = roundSide(center, dark.raw);
  const values = [...up.reverse(), center, ...down];
  return { values, center, centerIndex: n, light, dark };
}
