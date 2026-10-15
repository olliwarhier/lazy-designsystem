// Kontrastberechnung – dieselben Verfahren wie im Plugin „Lazy Theme Builder APCA“.
/** @typedef {import('./color.js').Rgb} Rgb */

// APCA 0.1.9 (apca-w3, W3-Lizenz)
const SA98G = {
  mainTRC: 2.4,
  sRco: 0.2126729,
  sGco: 0.7151522,
  sBco: 0.072175,
  normBG: 0.56,
  normTXT: 0.57,
  revTXT: 0.62,
  revBG: 0.65,
  blkThrs: 0.022,
  blkClmp: 1.414,
  scaleBoW: 1.14,
  scaleWoB: 1.14,
  loBoWoffset: 0.027,
  loWoBoffset: 0.027,
  deltaYmin: 0.0005,
  loClip: 0.1,
};

const apcaY = ({ r, g, b }) =>
  SA98G.sRco * r ** SA98G.mainTRC + SA98G.sGco * g ** SA98G.mainTRC + SA98G.sBco * b ** SA98G.mainTRC;

/**
 * APCA-Kontrast Lc von Text auf Hintergrund.
 * Positiv: dunkle Schrift auf hellem Grund, negativ: helle Schrift auf dunklem Grund.
 * @param {Rgb} text
 * @param {Rgb} background
 */
export function apca(text, background) {
  let t = apcaY(text);
  let bg = apcaY(background);
  t = t > SA98G.blkThrs ? t : t + (SA98G.blkThrs - t) ** SA98G.blkClmp;
  bg = bg > SA98G.blkThrs ? bg : bg + (SA98G.blkThrs - bg) ** SA98G.blkClmp;
  if (Math.abs(bg - t) < SA98G.deltaYmin) return 0;
  if (bg > t) {
    const sapc = (bg ** SA98G.normBG - t ** SA98G.normTXT) * SA98G.scaleBoW;
    return sapc < SA98G.loClip ? 0 : (sapc - SA98G.loBoWoffset) * 100;
  }
  const sapc = (bg ** SA98G.revBG - t ** SA98G.revTXT) * SA98G.scaleWoB;
  return sapc > -SA98G.loClip ? 0 : (sapc + SA98G.loWoBoffset) * 100;
}

const luminance = ({ r, g, b }) => {
  const lin = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};

/** WCAG-2-Kontrastverhältnis (1–21), unabhängig von der Reihenfolge */
export function wcag(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
