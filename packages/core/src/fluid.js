// Fließende Werte zwischen zwei Viewport-Breiten (siehe Doku → Tokens → Modi).

const trim = (n, digits = 4) => String(Number(n.toFixed(digits)));

/** px → "1.25rem" */
export const rem = (px, root = 16) => (px === 0 ? '0rem' : `${trim(px / root)}rem`);

/**
 * Erzeugt einen clamp()-Ausdruck, der linear von `mobile` (bei `viewportMobile`)
 * zu `desktop` (bei `viewportDesktop`) wächst. Alle Angaben in px.
 * Sind beide Werte gleich, wird ein fester rem-Wert zurückgegeben.
 */
export function fluid(mobile, desktop, viewportMobile, viewportDesktop, root = 16) {
  if (mobile === desktop) return rem(mobile, root);
  const slope = (desktop - mobile) / (viewportDesktop - viewportMobile);
  const intercept = mobile - slope * viewportMobile;
  const preferred = `${trim(slope * 100)}vw ${intercept < 0 ? '-' : '+'} ${rem(Math.abs(intercept), root)}`;
  const [min, max] = mobile < desktop ? [mobile, desktop] : [desktop, mobile];
  return `clamp(${rem(min, root)}, calc(${preferred}), ${rem(max, root)})`;
}
