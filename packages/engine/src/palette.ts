// Paletten nach Spezifikation 02 (2. Fassung), Abschnitt 6 (Chroma) und 7 (Gamut-Mapping).
import { apca, oklchToRgb, rgbToOklch, toHex, formatOklch, wcag } from '@lazy-designsystem/core';
import { buildScale, solve, type Scale, type ScaleSettings } from './scale.js';

export interface Rgb {
  r: number;
  g: number;
  b: number;
  a?: number;
}

export type PaletteType = 'color' | 'neutral';

export type ChromaCurve = 'falling' | 'constant';

/** Kategorie in der Matrix (Neutral, Color oder eigene). Bestimmt Typ und gemeinsames Chroma. */
export interface PaletteCategory {
  id: string;
  name: string;
  type: PaletteType;
  chromaMax: number;
  chromaMin: number;
}

export const DEFAULT_CATEGORIES: PaletteCategory[] = [
  { id: 'neutral', name: 'Neutral', type: 'neutral', chromaMax: 0.02, chromaMin: 0 },
  { id: 'color', name: 'Color', type: 'color', chromaMax: 0.16, chromaMin: 0.05 },
];

export interface PaletteSettings {
  id: string;
  /** Farbname, z. B. „blue" → Tints blue-93, blue-70 … */
  name: string;
  /** ergibt sich aus der Kategorie */
  type: PaletteType;
  /** ID der Kategorie */
  category?: string;
  hue: number;
  /** eigene Chroma-Werte statt der Kategorie (nur wirksam mit ownChroma oder ohne gemeinsames Chroma) */
  ownChroma?: boolean;
  /** Deckel: Color bis 0,25, Neutral bis 0,05 */
  chromaMax: number;
  /** Chroma an den eingestellten Außenpunkten (hell voll, dunkel halb) */
  chromaMin: number;
  /** abfallend: Kurve von Max zum Min; konstant: überall Max */
  curve?: ChromaCurve;
  /** @deprecated alter Name für curve: true = abfallend */
  harmonize?: boolean;
  /**
   * absolute: Kurve in absoluten Chroma-Werten, danach Gamut-Kappung (Spec).
   * relative: Kurve als Anteil am möglichen Chroma der jeweiligen Lightness (Spec 02, 7: vorgemerkt, zum Testen).
   */
  chromaMode?: 'absolute' | 'relative';
}

export const CHROMA_CAP: Record<PaletteType, number> = { color: 0.25, neutral: 0.05 };

export interface Tint {
  /** z. B. „blue-93" */
  name: string;
  /** Stufe (Lightness der Neutral-Stufe, 0–100) – Name und Identität des Tints */
  l: number;
  /** echte OKLCH-Lightness der Farbe. Im Modus Kontrast weicht sie von der Stufe ab. */
  lReal: number;
  /** angefordertes Chroma laut Kurve */
  c: number;
  /** tatsächliches Chroma nach Gamut-Mapping */
  cMapped: number;
  h: number;
  /** Chroma wurde durch das sRGB-Gamut gekappt */
  clipped: boolean;
  isCenter: boolean;
  hex: string;
  /** originales OKLCH (vor Gamut-Mapping) als CSS-String */
  oklch: string;
  rgb: Rgb;
}

const L = (l: number) => l / 100;

/** größtes Chroma, das bei Lightness l (0–100) und Hue h in sRGB passt */
export function maxChroma(l: number, h: number): number {
  if (l <= 0 || l >= 100) return 0;
  // In-Gamut-Test über Hin- und Rückweg: weicht das Chroma nach dem Mapping ab, war es außerhalb
  const fits = (c: number) => Math.abs(rgbToOklch(oklchToRgb({ l: L(l), c, h })).c - c) < 0.0015;
  let lo = 0;
  let hi = 0.4;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) lo = mid;
    else hi = mid;
  }
  return lo;
}

/**
 * Chroma-Kurve: C = Min + (Max − Min) × (1 − d²), d über die Lightness gemessen.
 * Auf der dunklen Seite wirkt das Minimum nur halb.
 */
const curveOf = (p: PaletteSettings): ChromaCurve => p.curve ?? (p.harmonize === false ? 'constant' : 'falling');

/**
 * Wirksame Chroma-Werte einer Palette: bei gemeinsamem Chroma die der Kategorie,
 * sonst (oder mit „Eigenes Chroma") die eigenen. Typ kommt aus der Kategorie.
 */
export function resolvePalette(p: PaletteSettings, categories: PaletteCategory[] = DEFAULT_CATEGORIES, sharedChroma = true): PaletteSettings {
  const cat = categories.find((c) => c.id === p.category) ?? categories.find((c) => c.type === p.type);
  const type = cat?.type ?? p.type;
  const useCat = cat && sharedChroma && !p.ownChroma;
  return {
    ...p,
    type,
    category: cat?.id ?? p.category,
    chromaMax: useCat ? cat.chromaMax : p.chromaMax,
    chromaMin: useCat ? cat.chromaMin : p.chromaMin,
    curve: curveOf(p),
  };
}

export function chromaAt(l: number, scale: Scale, p: PaletteSettings): number {
  const max = Math.min(p.chromaMax, CHROMA_CAP[p.type]);
  if (curveOf(p) === 'constant') return max;
  const minFull = Math.min(p.chromaMin, max);
  const isLight = l >= scale.center;
  const outer = isLight ? scale.values[0] : scale.values.at(-1)!;
  const span = Math.abs(outer - scale.center) || 1;
  const d = Math.min(1, Math.abs(l - scale.center) / span);
  const min = isLight ? minFull : max - (max - minFull) / 2;
  return min + (max - min) * (1 - d * d);
}

function makeTint(name: string, step: number, l: number, c: number, h: number, isCenter: boolean): Tint {
  const oklch = { l: L(l), c, h };
  const rgb = oklchToRgb(oklch);
  const cMapped = l >= 100 || l <= 0 ? 0 : rgbToOklch(rgb).c;
  return {
    name: `${name}-${step}`,
    l: step,
    lReal: Math.round(l * 10) / 10,
    c,
    cMapped,
    h,
    clipped: c - cMapped > 0.002,
    isCenter,
    hex: toHex(rgb),
    oklch: formatOklch(oklch),
    rgb,
  };
}

/** Erzeugt alle Tints einer Palette (absteigend nach Lightness) */
export function generatePalette(
  p: PaletteSettings,
  scaleOrSettings: Scale | Partial<ScaleSettings>,
  { chromaFactor = 1, chromaFactorFrom = -1 }: { chromaFactor?: number; chromaFactorFrom?: number } = {},
): Tint[] {
  const scale = 'values' in scaleOrSettings ? scaleOrSettings : buildScale(scaleOrSettings);
  const max = Math.min(p.chromaMax, CHROMA_CAP[p.type]);
  const centerGamut = maxChroma(scale.center, p.hue) || 1;
  return scale.values.map((l) => {
    // Weiß und Schwarz haben kein Chroma
    let c = l >= 100 || l <= 0 ? 0 : chromaAt(l, scale, p);
    if (p.chromaMode === 'relative' && l > 0 && l < 100) {
      // Anteil der Kurve am Maximum, angewendet auf das mögliche Chroma bei dieser Lightness.
      // Der Faktor max/centerGamut hält das Zentrum gleich wie im absoluten Modus.
      const share = max > 0 ? c / max : 0;
      c = Math.min(max, share * maxChroma(l, p.hue) * Math.min(1, max / centerGamut));
    }
    // Dark-Faktor (Spec 11, 2.3: zum Testen): Chroma heller Tints im Dark Mode reduzieren
    if (chromaFactorFrom >= 0 && l > chromaFactorFrom) c *= chromaFactor;
    const real = scale.basis === 'contrast' ? matchContrast(scale, l, c, p.hue) : l;
    return makeTint(p.name, l, real, c, p.hue, l === scale.center);
  });
}

/**
 * Modus Kontrast (Spec 02, 4.3): echtes L, bei dem die Farbe (nach Gamut-Mapping) denselben Kontrast
 * zum Messbezug hat wie die Neutral-Stufe. APCA und WCAG hängen nur von der Luminanz ab.
 */
export function matchContrast(scale: Scale, step: number, c: number, h: number): number {
  if (step >= 100 || step <= 0 || c <= 0) return step;
  const bg = step >= scale.center ? scale.darkBg : scale.lightBg;
  const m = (l: number) => {
    const rgb = oklchToRgb({ l: L(l), c, h });
    return scale.system === 'apca' ? Math.abs(apca(rgb, bg)) : wcag(rgb, bg);
  };
  const greyRgb = oklchToRgb({ l: L(step), c: 0, h: 0 });
  const target = scale.system === 'apca' ? Math.abs(apca(greyRgb, bg)) : wcag(greyRgb, bg);
  // Suche nur zwischen den Hintergründen, damit der Kontrast monoton im L ist
  const light = step >= scale.center;
  const lo = light ? Math.max(scale.center - 15, rgbToOklch(scale.darkBg).l * 100 + 1) : 0.5;
  const hi = light ? 99.9 : Math.min(scale.center + 15, rgbToOklch(scale.lightBg).l * 100 - 1);
  if (light && m(hi) < target) return hi;
  if (!light && m(lo) < target) return lo;
  return solve((l) => m(l) - target, lo, hi, 40);
}
