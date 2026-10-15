// Typescale – dieselbe Logik wie im Plugin „Lazy Typescale & Spacing“.
// Doku → Werkzeuge → Typescale & Spacing

export const SCALE_RATIOS = {
  'Minor Second': 1.067,
  'Major Second': 1.125,
  'Minor Third': 1.2,
  'Major Third': 1.25,
  'Perfect Fourth': 1.333,
  'Augmented Fourth': 1.414,
  'Perfect Fifth': 1.5,
  'Golden Ratio': 1.618,
};

/** Stufen relativ zur Root-Größe (Exponent des Skalenfaktors) */
export const TYPE_STEPS = [
  { name: 'xsmall', exp: -2 },
  { name: 'small', exp: -1 },
  { name: 'medium', exp: 0 },
  { name: 'large', exp: 1 },
  { name: 'xlarge', exp: 2 },
  { name: '2xlarge', exp: 3 },
  { name: '3xlarge', exp: 4 },
  { name: '4xlarge', exp: 5 },
];

/**
 * Welche Stufe ein Textstil bekommt: Body beginnt an der Root (Body/Medium = Root),
 * Heading eine Stufe höher (Heading/Small = Root), Display zwei Stufen höher.
 */
export const STYLE_OFFSETS = { body: 0, heading: 1, display: 2 };
export const STYLE_SLOTS = {
  body: ['small', 'medium', 'large'],
  heading: ['xsmall', 'small', 'medium', 'large', 'xlarge', '2xlarge'],
  display: ['xsmall', 'small', 'medium', 'large', 'xlarge', '2xlarge'],
};

/** Theoretische Größen: Root × Faktor^Stufe */
export const typeSteps = (root, ratio) => TYPE_STEPS.map((s) => ({ ...s, px: root * ratio ** s.exp }));

/**
 * Rastet die Stufen auf die Base-Scale ein:
 *  - Root (medium): nächstgelegener Base-Scale-Wert
 *  - small / xsmall: die nächsten ein bzw. zwei Base-Scale-Werte darunter (ohne Faktor)
 *  - darüber: nächstgelegener Wert, aber immer mindestens einen Schritt größer als die Stufe davor
 * @param {{ name: string, exp: number, px: number }[]} steps
 * @param {number[]} baseScale aufsteigende px-Werte der Base-Scale
 */
export function snapToBaseScale(steps, baseScale) {
  const nearest = (px) => baseScale.reduce((best, v, i) => (Math.abs(v - px) < Math.abs(baseScale[best] - px) ? i : best), 0);
  const root = steps.find((s) => s.exp === 0);
  const rootIndex = nearest(root.px);
  let previous = rootIndex;
  const result = {};
  for (const step of [...steps].sort((a, b) => a.exp - b.exp)) {
    let index;
    if (step.exp === 0) index = rootIndex;
    else if (step.exp < 0) index = Math.max(0, rootIndex + step.exp);
    else {
      index = nearest(step.px);
      if (index <= previous) index = Math.min(previous + 1, baseScale.length - 1);
      previous = index;
    }
    result[step.name] = { ...step, snapped: baseScale[index] };
  }
  return result;
}

/** Größe je Textstil, z. B. styles.heading.large → px */
export function typescale(root, ratio, baseScale) {
  const snapped = snapToBaseScale(typeSteps(root, ratio), baseScale);
  const names = TYPE_STEPS.map((s) => s.name);
  const styles = {};
  for (const [group, slots] of Object.entries(STYLE_SLOTS)) {
    styles[group] = {};
    for (const slot of slots) {
      const step = names[names.indexOf(slot) + STYLE_OFFSETS[group]];
      if (step) styles[group][slot] = { step, px: snapped[step].snapped, exact: snapped[step].px };
    }
  }
  return { steps: snapped, styles };
}
