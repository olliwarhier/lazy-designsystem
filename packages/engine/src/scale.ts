// Stufen-Skala nach Spezifikation 02 (2. Fassung), Abschnitt 3–5.
// Alle Lightness-Werte auf der Skala 0–100.
import { apca, oklchToRgb, wcag } from '@lazy-designsystem/core';

export type ContrastSystem = 'apca' | 'wcag';
/** Kontrast: gleiche Stufe = gleicher Kontrast. Lightness: gleiche Stufe = gleiches L. */
export type ScaleBasis = 'contrast' | 'lightness';

/** Farbe in OKLCH, Lightness 0–100 */
export interface Lch {
  l: number;
  c: number;
  h: number;
}

export interface ScaleSettings {
  /** Stepzahl gesamt, ungerade, 7–15 */
  steps: number;
  system: ContrastSystem;
  basis: ScaleBasis;
  /** Kontrast-Hintergründe, nur Messbezug (Spec 02, 4.1) */
  lightBg: Lch;
  darkBg: Lch;
  /** Regler „Verteilung" (nur Lightness): 1 = dynamisch, 0 = linear */
  distribution: number;
  /** Oberer Außenpunkt, 90–100 */
  upper: number;
  /** Unterer Außenpunkt, 0–20 */
  lower: number;
}

export const DEFAULT_SCALE: ScaleSettings = {
  steps: 11,
  system: 'apca',
  basis: 'contrast',
  lightBg: { l: 98, c: 0, h: 0 },
  darkBg: { l: 20, c: 0, h: 0 },
  distribution: 1,
  upper: 100,
  lower: 10,
};

/** Zentrum im Modus Lightness: Schwarz und Weiß haben hier den gleichen Kontrast */
export const CENTER: Record<ContrastSystem, number> = { apca: 70, wcag: 57 };

/** Mindestabstand: 3 L bei oberem Außenpunkt 100, sonst 2 L (Spec 02, 3) */
export const minGap = (upper: number) => (upper >= 100 ? 3 : 2);
/** Zentrumsabstand ist nur ein Minimum: bevorzugt 10, notfalls bis 8 (Spec 02, 5.2) */
export const CENTER_GAP = { preferred: 10, min: 8 };
/** r-Untergrenze (Spec 02, 5.3) */
export const RATIO_FLOOR = 0.5;

/** Pflicht-Presets je System, nach Priorität (Spec 02, 4.2) */
const TEXT_TARGETS: Record<ContrastSystem, { seven: number[]; more: number[] }> = {
  // Large 60 · Body 75 · Caption 90 · Maximum 100; bei 7 Stufen Large und Caption
  apca: { seven: [60, 90], more: [60, 75, 90, 100] },
  // WCAG ohne Large (zu nah am Zentrum): Body 7 · Caption 10 · Maximum 15; bei 7 Stufen Body und Maximum
  wcag: { seven: [7, 15], more: [7, 10, 15] },
};

export interface SideInfo {
  /** Steps dieser Seite (ohne Zentrum), vom Zentrum nach außen, ungerundet */
  raw: number[];
  /** Abstand des ersten Steps zum Zentrum */
  g: number;
  /** g wurde festgesetzt, weil der erste freie Abstand unter 10 lag */
  fixedG: boolean;
  /** verwendeter Faktor (nur Lightness) */
  r: number;
  /** kleinster erlaubter Faktor (nur Lightness) */
  rMin: number;
}

export interface Scale {
  basis: ScaleBasis;
  system: ContrastSystem;
  /** alle Steps absteigend (hell → dunkel), gerundet. Das ist auch der Stufenname. */
  values: number[];
  center: number;
  centerIndex: number;
  minGap: number;
  light: SideInfo;
  dark: SideInfo;
  /** Kontrast je Stufe gegen den Messbezug: hell gegen dunklen Hintergrund, dunkel gegen hellen, Zentrum gegen dunklen */
  contrasts: number[];
  /** Messbezug als RGB */
  lightBg: { r: number; g: number; b: number };
  darkBg: { r: number; g: number; b: number };
}

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const grey = (l: number) => oklchToRgb({ l: l / 100, c: 0, h: 0 });
const toRgb = (c: Lch) => oklchToRgb({ l: c.l / 100, c: c.c, h: c.h });
type Rgb = ReturnType<typeof grey>;
const measure = (system: ContrastSystem, fg: Rgb, bg: Rgb) => (system === 'apca' ? Math.abs(apca(fg, bg)) : wcag(fg, bg));

/** Bisektion: x in [lo, hi] mit f(x) = 0, f monoton */
export function solve(f: (x: number) => number, lo: number, hi: number, steps = 50): number {
  const up = f(hi) > f(lo);
  for (let i = 0; i < steps; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) > 0 === up) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

/** Geometrische Reihe a, a·r, …, a·r^(count−1) mit Summe R */
function series(R: number, count: number, r: number): number[] {
  if (count <= 0) return [];
  const a = Math.abs(1 - r) < 1e-9 ? R / count : (R * (1 - r)) / (1 - r ** count);
  return Array.from({ length: count }, (_, i) => a * r ** i);
}

/** kleinster Faktor r ≥ RATIO_FLOOR, bei dem der letzte Abstand noch ≥ gap ist */
function ratioMin(make: (r: number) => number[], gap: number): number {
  const last = (r: number) => make(r).at(-1) ?? gap;
  if (last(1) < gap) return 1;
  let lo = 1e-4;
  let hi = 1;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (last(mid) >= gap) hi = mid;
    else lo = mid;
  }
  return Math.max(hi, RATIO_FLOOR);
}

/** Lightness-Seite (Spec 02, 5.2): erst frei verteilen, g = 10 nur, wenn der erste Abstand darunter liegt */
function lightnessSide(center: number, outer: number, n: number, push: number, gap: number): SideInfo {
  const R = Math.abs(outer - center);
  const dir = Math.sign(outer - center) || 1;
  const pick = (make: (r: number) => number[]) => {
    const rMin = ratioMin(make, gap);
    const r = 1 - push * (1 - rMin);
    return { gaps: make(r), r, rMin };
  };
  let res = pick((r) => series(R, n, r));
  let g = res.gaps[0];
  let fixedG = false;
  if (n > 1 && g < CENTER_GAP.preferred) {
    fixedG = true;
    g = CENTER_GAP.preferred;
    if (R - g < (n - 1) * gap) g = Math.max(CENTER_GAP.min, R - (n - 1) * gap);
    if (R - g < (n - 1) * gap) g = Math.max(gap, R - (n - 1) * gap);
    const rest = pick((r) => series(R - g, n - 1, r));
    res = { ...rest, gaps: [g, ...rest.gaps] };
  }
  let pos = center;
  const raw = res.gaps.map((d) => (pos += dir * d));
  raw[raw.length - 1] = outer; // Rundungsfehler der Reihe ausgleichen
  return { raw, g, fixedG, r: res.r, rMin: res.rMin };
}

/**
 * Kontrast-Seite (Spec 02, 4.2): Pflicht-Presets, die zwischen Zentrum und Außenpunkt erreichbar sind,
 * dazu der Außenpunkt; weitere Stufen halbieren die größte Kontrastlücke (APCA linear, WCAG logarithmisch).
 */
function contrastSide(system: ContrastSystem, center: number, outer: number, n: number, bg: Rgb): SideInfo {
  const f = (l: number) => measure(system, grey(l), bg);
  const cv = f(center);
  const ov = f(outer);
  const lo = Math.min(center, outer);
  const hi = Math.max(center, outer);
  let raw: number[];
  if (!(ov > cv * 1.001)) {
    // Außenpunkt kontrastärmer als das Zentrum (ungewöhnliche Hintergründe): gleichmäßig in L
    raw = series(Math.abs(outer - center), n, 1).map((_, i, a) => center + Math.sign(outer - center) * a.slice(0, i + 1).reduce((s, x) => s + x, 0));
  } else {
    const t = TEXT_TARGETS[system];
    const prio = n <= 3 ? t.seven : t.more;
    const pts = [...prio.filter((v) => v > cv * 1.0001 && v < ov * 0.999).slice(0, n - 1), ov].sort((a, b) => a - b);
    const tr = system === 'apca' ? (x: number) => x : Math.log;
    while (pts.length < n) {
      const all = [cv, ...pts];
      let gi = 1;
      let gv = -1;
      for (let i = 1; i < all.length; i++) {
        const d = tr(all[i]) - tr(all[i - 1]);
        if (d > gv) {
          gv = d;
          gi = i;
        }
      }
      pts.push(system === 'apca' ? (all[gi] + all[gi - 1]) / 2 : Math.sqrt(all[gi] * all[gi - 1]));
      pts.sort((a, b) => a - b);
    }
    raw = pts.map((v) => (v >= ov * 0.9999 ? outer : solve((l) => f(l) - v, lo, hi)));
  }
  return { raw, g: Math.abs(raw[0] - center), fixedG: false, r: 1, rMin: 1 };
}

/** Rundet eine Seite auf ganze L und stellt den Mindestabstand wieder her */
function roundSide(center: number, raw: number[], gap: number): number[] {
  const dir = Math.sign(raw.at(-1)! - center) || 1;
  const out = raw.map(Math.round);
  for (let i = out.length - 2; i >= 0; i--) {
    if (dir * (out[i + 1] - out[i]) < gap) out[i] = out[i + 1] - dir * gap;
  }
  for (let i = 0; i < out.length; i++) {
    const prev = i === 0 ? center : out[i - 1];
    if (dir * (out[i] - prev) < gap) out[i] = prev + dir * gap;
  }
  return out;
}

const normLch = (c: Partial<Lch> | undefined, fallback: Lch, lo: number, hi: number): Lch => ({
  l: clamp(Number(c?.l ?? fallback.l), lo, hi),
  c: clamp(Number(c?.c ?? fallback.c), 0, 0.1),
  h: ((Number(c?.h ?? fallback.h) % 360) + 360) % 360,
});

export function normalizeScale(s: Partial<ScaleSettings>): ScaleSettings {
  const m = { ...DEFAULT_SCALE, ...s };
  let steps = clamp(Math.round(m.steps), 7, 15);
  if (steps % 2 === 0) steps += 1;
  return {
    steps: Math.min(steps, 15),
    system: m.system === 'wcag' ? 'wcag' : 'apca',
    basis: m.basis === 'lightness' ? 'lightness' : 'contrast',
    lightBg: normLch(m.lightBg, DEFAULT_SCALE.lightBg, 80, 100),
    darkBg: normLch(m.darkBg, DEFAULT_SCALE.darkBg, 0, 40),
    distribution: clamp(m.distribution, 0, 1),
    upper: clamp(Math.round(m.upper), 90, 100),
    lower: clamp(Math.round(m.lower), 0, 20),
  };
}

/** Zentrum im Modus Kontrast: gleicher Kontrast zu beiden Hintergründen */
export function contrastCenter(system: ContrastSystem, lightBg: Rgb, darkBg: Rgb): number {
  return solve((l) => measure(system, grey(l), darkBg) - measure(system, grey(l), lightBg), 25, 95);
}

/** Skala nach Spec 02 – Kontrast (Standard) oder Lightness (Erweitert) */
export function buildScale(settings: Partial<ScaleSettings> = {}): Scale {
  const s = normalizeScale(settings);
  const n = (s.steps - 1) / 2;
  const gap = minGap(s.upper);
  const lightBg = toRgb(s.lightBg);
  const darkBg = toRgb(s.darkBg);
  let center: number;
  let light: SideInfo;
  let dark: SideInfo;
  if (s.basis === 'contrast') {
    const exact = contrastCenter(s.system, lightBg, darkBg);
    center = Math.round(exact);
    light = contrastSide(s.system, exact, s.upper, n, darkBg);
    dark = contrastSide(s.system, exact, s.lower, n, lightBg);
  } else {
    center = CENTER[s.system];
    // Hell: voller Schub, Dunkel: halber Schub
    light = lightnessSide(center, s.upper, n, s.distribution, gap);
    dark = lightnessSide(center, s.lower, n, s.distribution * 0.5, gap);
  }
  const up = roundSide(center, light.raw, gap);
  const down = roundSide(center, dark.raw, gap);
  const values = [...up.reverse(), center, ...down];
  const contrasts = values.map((l) => measure(s.system, grey(l), l >= center ? darkBg : lightBg));
  return { basis: s.basis, system: s.system, values, center, centerIndex: n, minGap: gap, light, dark, contrasts, lightBg, darkBg };
}

/** Lightness-Skala (Erweitert). Kurzform für buildScale mit basis „lightness". */
export const lightnessScale = (settings: Partial<ScaleSettings> = {}) => buildScale({ ...settings, basis: 'lightness' });
