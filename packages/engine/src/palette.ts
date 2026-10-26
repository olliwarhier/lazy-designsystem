// Paletten nach Spezifikation 02, Abschnitt 5 (Chroma) und 6 (Gamut-Mapping).
import { oklchToRgb, rgbToOklch, toHex, formatOklch } from '@lazy-designsystem/core';
import { lightnessScale, type Scale, type ScaleSettings } from './scale.js';

export interface Rgb {
  r: number;
  g: number;
  b: number;
  a?: number;
}

export type PaletteType = 'color' | 'neutral';

export interface PaletteSettings {
  id: string;
  /** Farbname, z. B. „blue" → Tints blue-93, blue-70 … */
  name: string;
  type: PaletteType;
  hue: number;
  /** Deckel: Color bis 0,25, Neutral bis 0,05 */
  chromaMax: number;
  /** Chroma an den eingestellten Außenpunkten (hell voll, dunkel halb) */
  chromaMin: number;
  /** aus: Chroma überall gleich (Minimum = Maximum) */
  harmonize: boolean;
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
  /** Lightness 0–100 */
  l: number;
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
export function chromaAt(l: number, scale: Scale, p: PaletteSettings): number {
  const max = Math.min(p.chromaMax, CHROMA_CAP[p.type]);
  if (!p.harmonize) return max;
  const minFull = Math.min(p.chromaMin, max);
  const isLight = l >= scale.center;
  const outer = isLight ? scale.values[0] : scale.values.at(-1)!;
  const span = Math.abs(outer - scale.center) || 1;
  const d = Math.min(1, Math.abs(l - scale.center) / span);
  const min = isLight ? minFull : max - (max - minFull) / 2;
  return min + (max - min) * (1 - d * d);
}

function makeTint(name: string, l: number, c: number, h: number, isCenter: boolean): Tint {
  const oklch = { l: L(l), c, h };
  const rgb = oklchToRgb(oklch);
  const cMapped = l >= 100 || l <= 0 ? 0 : rgbToOklch(rgb).c;
  return {
    name: `${name}-${l}`,
    l,
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
  const scale = 'values' in scaleOrSettings ? scaleOrSettings : lightnessScale(scaleOrSettings);
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
    return makeTint(p.name, l, c, p.hue, l === scale.center);
  });
}
