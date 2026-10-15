// Tint-Generator – dieselbe Logik wie im Plugin „Lazy Tints OKLCH“.
// Doku → Werkzeuge → Tint-Generator
import { oklchToRgb, toHex, formatOklch } from './color.js';

/**
 * @typedef {Object} PaletteParams
 * @property {number} hue            Farbton 0–360
 * @property {number} chromaMax      Chroma am Zentrum (Farben bis 0,25, Neutral bis 0,05)
 * @property {number} [chromaMin]    Chroma an den Enden, wenn harmonisiert
 * @property {boolean} [harmonize]   Chroma zu den hellen und dunklen Enden abschwächen
 * @property {number} [steps]        Anzahl Tints: 7, 9, 11, 13 oder 15
 * @property {'even'|'smooth'|'dynamic'} [distribution] Verteilung der Lightness-Stufen
 * @property {number} [lightnessMax] hellste Stufe 0,9–1
 * @property {number} [lightnessMin] dunkelste Stufe 0–0,2
 * @property {70|60} [center]        Zentrum der Skala (70 für APCA, 60 für WCAG)
 */

const INTENSITY = { even: 0, smooth: 0.5, dynamic: 1 };

// Kubische Bézierkurve von (0,0) nach (1,1) mit den Kontrollpunkten (x1,y1), (x2,y2)
const bezier = (t, p1, p2) => 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t ** 2 * p2 + t ** 3;
function bezierYForX(x, x1, y1, x2, y2) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  let t = x;
  for (let i = 0; i < 8; i++) {
    const dx = bezier(t, x1, x2) - x;
    if (Math.abs(dx) < 1e-6) break;
    const slope = 3 * (1 - 3 * x2 + 3 * x1) * t * t + 2 * (3 * x2 - 6 * x1) * t + 3 * x1;
    if (Math.abs(slope) < 1e-6) break;
    t -= dx / slope;
  }
  return bezier(t, y1, y2);
}

/**
 * Lightness-Stufen: zwei Bézierkurven vom Zentrum nach oben und nach unten.
 * Ergebnis absteigend sortiert, Werte als ganze Zahlen (L × 100), mindestens 2 auseinander.
 * @returns {{ values: number[], centerIndex: number }}
 */
export function lightnessScale({ steps = 13, distribution = 'dynamic', lightnessMax = 1, lightnessMin = 0.1, center = 70 } = {}) {
  const n = Math.round((steps - 1) / 2);
  const k = INTENSITY[distribution] ?? 1;
  const maxL = Math.round(lightnessMax * 100);
  const minL = Math.round(lightnessMin * 100);

  const upper = [];
  const lower = [];
  for (let i = 1; i <= n; i++) {
    upper.push(Math.round(center + (maxL - center) * bezierYForX(i / n, 0.15 * k, 0.45 * k, 1 - 0.2 * k, 1)));
    lower.push(Math.round(center - (center - minL) * bezierYForX(i / n, 0.15 * k, 0.15 * k, 1 - 0.15 * k, 1 - 0.08 * k)));
  }

  const values = [...upper, center, ...lower].sort((a, b) => b - a);
  const centerIndex = values.indexOf(center);
  const GAP = 2;
  for (let i = 1; i < centerIndex; i++) if (values[i] > values[i - 1] - GAP) values[i] = values[i - 1] - GAP;
  for (let i = values.length - 2; i > centerIndex; i--) if (values[i] < values[i + 1] + GAP) values[i] = values[i + 1] + GAP;
  return { values, centerIndex };
}

/**
 * Chroma einer Stufe. Harmonisiert fällt sie quadratisch vom Zentrum zu den Enden
 * von chromaMax auf chromaMin ab – helle und dunkle Töne wirken dadurch ruhiger.
 */
export function chromaAt(index, centerIndex, count, { chromaMax, chromaMin = 0, harmonize = true }) {
  if (!harmonize) return chromaMax;
  const maxDistance = Math.max(centerIndex, count - 1 - centerIndex) || 1;
  const t = Math.abs(index - centerIndex) / maxDistance;
  return chromaMax - (chromaMax - chromaMin) * t * t;
}

/**
 * Erzeugt eine Palette. Jede Stufe ist nach ihrer Lightness benannt („70“ = L 0,70).
 * @param {PaletteParams} params
 */
export function generatePalette(params) {
  const { values, centerIndex } = lightnessScale(params);
  return values.map((v, i) => {
    const oklch = { l: v / 100, c: chromaAt(i, centerIndex, values.length, params), h: params.hue };
    const rgb = oklchToRgb(oklch);
    return { name: String(v), ...oklch, hex: toHex(rgb), oklch: formatOklch(oklch), rgb };
  });
}
