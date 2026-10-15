// Farbräume: sRGB ⇄ OKLab ⇄ OKLCH
// Matrizen nach Björn Ottosson (https://bottosson.github.io/posts/oklab/),
// dieselben Werte wie im Plugin „Lazy Tints OKLCH“.

/** @typedef {{ r: number, g: number, b: number, a?: number }} Rgb  Kanäle 0–1 */
/** @typedef {{ l: number, c: number, h: number, a?: number }} Oklch */

const toLinear = (x) => (x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4));
const toGamma = (x) => (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055);
const clamp01 = (x) => Math.max(0, Math.min(1, x));

/** "#rrggbb" oder "#rrggbbaa" → Rgb */
export function parseHex(hex) {
  const h = hex.replace('#', '');
  const n = (i) => parseInt(h.slice(i, i + 2), 16) / 255;
  return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? n(6) : 1 };
}

/** Rgb → "#rrggbb" (bzw. "#rrggbbaa" bei Alpha < 1) */
export function toHex({ r, g, b, a = 1 }) {
  const x = (v) => Math.round(clamp01(v) * 255).toString(16).padStart(2, '0');
  return '#' + x(r) + x(g) + x(b) + (a < 1 ? x(a) : '');
}

function linearSrgbToOklab(r, g, b) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function oklabToLinearSrgb(L, a, b) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/** Rgb → Oklch */
export function rgbToOklch({ r, g, b, a = 1 }) {
  const [L, A, B] = linearSrgbToOklab(toLinear(r), toLinear(g), toLinear(b));
  const c = Math.sqrt(A * A + B * B);
  let h = (Math.atan2(B, A) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { l: L, c, h: c < 0.0005 ? 0 : h, a };
}

const inGamut = (rgb) => rgb.every((v) => v >= -0.0001 && v <= 1.0001);
const deltaE = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);

/**
 * Oklch → Rgb mit Gamut-Mapping nach CSS Color 4 (MINDE):
 * Chroma wird reduziert, bis die beschnittene Farbe weniger als einen
 * wahrnehmbaren Unterschied (JND 0,02) vom Ziel entfernt ist.
 */
export function oklchToRgb({ l, c, h, a = 1 }) {
  if (l >= 1) return { r: 1, g: 1, b: 1, a };
  if (l <= 0) return { r: 0, g: 0, b: 0, a };
  const rad = (h * Math.PI) / 180;
  const lab = (chroma) => [l, chroma * Math.cos(rad), chroma * Math.sin(rad)];
  const clip = (lin) => lin.map((v) => clamp01(toGamma(Math.max(0, v))));
  const clippedLab = (rgb) => linearSrgbToOklab(...rgb.map(toLinear));
  const out = (rgb) => ({ r: rgb[0], g: rgb[1], b: rgb[2], a });

  const direct = oklabToLinearSrgb(...lab(c));
  if (inGamut(direct)) return out(clip(direct));

  const JND = 0.02;
  if (deltaE(lab(c), clippedLab(clip(direct))) - JND <= 0.0002) return out(clip(direct));

  let min = 0;
  let max = c;
  let minInGamut = true;
  while (max - min > 0.0001) {
    const mid = (min + max) / 2;
    const lin = oklabToLinearSrgb(...lab(mid));
    if (minInGamut && inGamut(lin)) {
      min = mid;
      continue;
    }
    const clipped = clip(lin);
    const e = deltaE(lab(mid), clippedLab(clipped));
    if (e - JND < 0.0002) {
      if (JND - e < 0.0002) return out(clipped);
      minInGamut = false;
      min = mid;
    } else {
      max = mid;
    }
  }
  return out(clip(oklabToLinearSrgb(...lab(min))));
}

const trim = (n, digits) => String(Number(n.toFixed(digits)));

/** Oklch → "oklch(0.7 0.01 127)" – L auf 3, C auf 3 Stellen, H ganzzahlig */
export function formatOklch({ l, c, h, a = 1 }) {
  const body = `${trim(l, 3)} ${trim(c, 3)} ${Math.round(h)}`;
  return a < 1 ? `oklch(${body} / ${trim(a, 3)})` : `oklch(${body})`;
}

/** "#rrggbb" → "oklch(…)" */
export const hexToOklch = (hex) => formatOklch(rgbToOklch(parseHex(hex)));
