// Baut aus den Figma-Variablen in src/*.json die CSS-Variablen nach der
// Token-Spezifikation (Doku → Tokens). Ausgabe:
//   dist/tokens.css   – alle globalen Tokens für jedes Framework
//   dist/tokens.json  – aufgelöste Tokens für Doku, Tools und LLMs
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hexToOklch, rem, fluid } from '@lazy-designsystem/core';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SRC = join(ROOT, 'src');
const DIST = join(ROOT, 'dist');

// ── Einlesen ─────────────────────────────────────────────────────────────────

/** @type {Map<string, { name: string, modes: string[] }>} */
const collections = new Map();
/** @type {Map<string, any>} Token je Pfad, z. B. "palette.clay.70" */
const tokens = new Map();

for (const file of readdirSync(SRC).filter((f) => f.endsWith('.json')).sort()) {
  const { $extensions, ...tree } = JSON.parse(readFileSync(join(SRC, file), 'utf8'));
  const { collection, modes } = $extensions.lazy;
  collections.set(collection, { name: collection, modes });
  (function walk(node, path) {
    if ('$value' in node) {
      const values = { [modes[0]]: node.$value, ...(node.$extensions?.lazy?.modes ?? {}) };
      tokens.set(path.join('.'), {
        path,
        collection,
        type: node.$type,
        figma: node.$extensions?.lazy?.figma ?? path.join('/'),
        description: node.$description ?? '',
        values,
      });
      return;
    }
    for (const [key, child] of Object.entries(node)) walk(child, [...path, key]);
  })(tree, []);
}

const need = (name) => {
  const c = collections.get(name);
  if (!c) throw new Error(`Collection „${name}“ fehlt in src/`);
  return c;
};
const SYSTEM = need('System');
const RESPONSIVE = need('Responsive');
const THEME = collections.get('Theme');
const SHAPES = collections.get('Shapes');

// ── Verweise auflösen ────────────────────────────────────────────────────────

const isRef = (v) => typeof v === 'string' && /^\{.+\}$/.test(v);
const refPath = (v) => v.slice(1, -1);
const target = (v) => {
  const t = tokens.get(refPath(v));
  if (!t) throw new Error('Unbekannter Verweis: ' + v);
  return t;
};

/** Standard-Kontext: in welchem Modus jede Collection gelesen wird */
const baseContext = Object.fromEntries([...collections.values()].map((c) => [c.name, c.modes[0]]));

/** Wert eines Tokens im Kontext (Modus je Collection) */
const valueIn = (token, ctx) => token.values[ctx[token.collection]] ?? token.values[collections.get(token.collection).modes[0]];

/** Folgt Verweisen bis zu einem festen Wert */
function resolve(value, ctx) {
  if (isRef(value)) return resolve(valueIn(target(value), ctx), ctx);
  if (value && typeof value === 'object' && 'ref' in value) return { ...value, ref: resolve(value.ref, ctx) };
  return value;
}

// ── Benennung (Doku → Tokens → Benennung) ───────────────────────────────────

const META_RESPONSIVE = ['mode', 'breakpoint', 'clamp', 'typescale.specs'];

function cssName(token) {
  const p = token.path;
  switch (token.collection) {
    case 'Primitives':
      if (p[0] === 'palette' && (p[2] === 'specs' || p[1] === 'scale')) return null;
      return p.join('-');
    case 'System':
      return ['color', ...p.slice(2)].join('-'); // Kategorie entfällt
    case 'Responsive':
      if (META_RESPONSIVE.some((m) => p.join('.').startsWith(m))) return null;
      return p.join('-');
    default:
      return null; // Theme, Components und Shapes werden anders abgebildet
  }
}

const names = new Map();
for (const token of tokens.values()) {
  token.css = cssName(token);
  if (!token.css) continue;
  if (names.has(token.css)) {
    throw new Error(`CSS-Name doppelt: --${token.css} (${names.get(token.css)} und ${token.figma}). Rollennamen müssen eindeutig sein.`);
  }
  names.set(token.css, token.figma);
}

// ── Werte in CSS ─────────────────────────────────────────────────────────────

const varOf = (token) => `var(--${token.css})`;

/**
 * CSS-Ausdruck für einen Farbwert. Verweise auf Primitives und System bleiben
 * als var() erhalten, Verweise durch die Theme-Collection werden aufgelöst.
 */
function colorExpr(value, ctx) {
  if (value && typeof value === 'object' && 'ref' in value) {
    return `oklch(from ${colorExpr(value.ref, ctx)} l c h / ${value.alpha})`;
  }
  if (isRef(value)) {
    const t = target(value);
    if (t.css && t.collection !== 'Responsive') return varOf(t);
    return colorExpr(valueIn(t, ctx), ctx);
  }
  if (typeof value === 'string' && value.startsWith('#')) return hexToOklch(value);
  throw new Error('Kein Farbwert: ' + JSON.stringify(value));
}

const px = (value, ctx) => {
  const v = resolve(value, ctx);
  if (typeof v !== 'number') throw new Error('Keine Zahl: ' + JSON.stringify(value));
  return v;
};

function primitiveValue(token) {
  const v = token.values[collections.get('Primitives').modes[0]];
  if (token.type === 'color') return colorExpr(v, baseContext);
  if (isRef(v)) return varOf(target(v));
  if (token.path[0] === 'font' && token.path[1] === 'family') return `'${v}'`;
  if (token.path[0] === 'font' && token.path[1] === 'weight') return String(Number(v));
  if (typeof v === 'number') return rem(v);
  return String(v);
}

// Viewport-Breiten für fließende Werte aus „Breakpoint“
const breakpoint = tokens.get('breakpoint');
const [DESKTOP, MOBILE] = RESPONSIVE.modes;
const viewport = {
  desktop: breakpoint ? px(breakpoint.values[DESKTOP], baseContext) : 1440,
  mobile: breakpoint ? px(breakpoint.values[MOBILE], baseContext) : 375,
};

function responsiveValue(token) {
  const d = token.values[DESKTOP];
  const m = token.values[MOBILE];
  const last = token.path.at(-1);
  // gleicher Verweis in beiden Modi → Verweis beibehalten
  if (isRef(d) && d === m && target(d).css) return varOf(target(d));
  if (last === 'line-height') {
    const pct = String(resolve(d, baseContext));
    return pct.endsWith('%') ? String(parseFloat(pct) / 100) : pct;
  }
  if (token.type === 'string') return String(resolve(d, baseContext));
  const ctxD = { ...baseContext, Responsive: DESKTOP };
  const ctxM = { ...baseContext, Responsive: MOBILE };
  return fluid(px(m, ctxM), px(d, ctxD), viewport.mobile, viewport.desktop);
}

/** System-Farbe im gegebenen Theme: light-dark(), wenn sich die Modi unterscheiden */
function systemValue(token, theme) {
  const [LIGHT, DARK] = SYSTEM.modes;
  if (token.type !== 'color') {
    const v = resolve(token.values[LIGHT], baseContext);
    return token.path.at(-1) === 'opacity' && v > 1 ? String(v / 100) : String(v);
  }
  const ctx = (mode) => ({ ...baseContext, System: mode, ...(THEME ? { Theme: theme } : {}) });
  const light = colorExpr(token.values[LIGHT], ctx(LIGHT));
  const dark = DARK ? colorExpr(token.values[DARK] ?? token.values[LIGHT], ctx(DARK)) : light;
  return light === dark ? light : `light-dark(${light}, ${dark})`;
}

// ── Ausgabe CSS ──────────────────────────────────────────────────────────────

// Sortierung: Zahlen aufsteigend, Größen und Emphasis nach ihrer Reihe, sonst Figma-Reihenfolge
const LADDERS = [
  ['none', '4xsmall', '3xsmall', '2xsmall', 'xsmall', 'small', 'medium', 'large', 'xlarge', '2xlarge', '2large', '3xlarge', '4xlarge', 'full'],
  ['subtler', 'subtle', 'base', 'bold', 'bolder'],
];
const firstSeen = new Map();
[...tokens.values()].forEach((t, i) => t.path.forEach((s) => firstSeen.has(s) || firstSeen.set(s, i)));
const rank = (s) => {
  if (/^\d+$/.test(s)) return [0, Number(s)];
  for (const [i, ladder] of LADDERS.entries()) if (ladder.includes(s)) return [1 + i, ladder.indexOf(s)];
  return [9, firstSeen.get(s)];
};
const compare = (a, b) => {
  for (let i = 0; i < Math.min(a.path.length, b.path.length); i++) {
    if (a.path[i] === b.path[i]) continue;
    const [ga, ra] = rank(a.path[i]);
    const [gb, rb] = rank(b.path[i]);
    return ga === gb ? ra - rb : firstSeen.get(a.path[i]) - firstSeen.get(b.path[i]);
  }
  return a.path.length - b.path.length;
};

const byCollection = (name) => [...tokens.values()].filter((t) => t.collection === name && t.css).sort(compare);
const decl = (name, value) => `  --${name}: ${value};`;
const block = (selector, lines) => `${selector} {\n${lines.join('\n')}\n}\n`;
const section = (title, lines) => (lines.length ? [`\n  /* ${title} */`, ...lines] : []);

const themes = THEME ? THEME.modes : [null];
const slug = (s) => s.toLowerCase().replace(/\s+/g, '-');

const root = [
  '  color-scheme: light dark;',
  ...section('Primitives', byCollection('Primitives').map((t) => decl(t.css, primitiveValue(t)))),
  ...section('System · Responsive', byCollection('Responsive').map((t) => decl(t.css, responsiveValue(t)))),
  ...section('System · Farbe', byCollection('System').map((t) => decl(t.css, systemValue(t, themes[0])))),
];

// Shape: ein Regler, Figma-Modi als Messpunkte
const shapeModes = SHAPES ? SHAPES.modes : ['Square', 'Rounded-Subtle', 'Rounded-Medium', 'Rounded-Bold', 'Pill'];
const shapeValue = (i) => String(Number((i / (shapeModes.length - 1)).toFixed(3)));
root.push(
  ...section('Shape', [
    decl('shape', shapeValue(0)),
    decl('shape-container-max', 'var(--base-scale-300)'),
    decl('shape-mark-max', 'var(--base-scale-100)'),
  ]),
);

// Abgeleitete Radien werden überall dort neu berechnet, wo --shape gesetzt
// werden kann – sonst würde ein data-shape auf einem Bereich nicht wirken.
const shapeDerived = [
  decl('shape-radius-container', 'calc(var(--shape) * var(--shape-container-max))'),
  decl('shape-radius-mark', 'calc(var(--shape) * var(--shape-mark-max))'),
];

let css = `/* Lazy Design System – generiert aus Figma (${[...collections.keys()].join(', ')}).\n   Nicht von Hand bearbeiten: Änderungen in Figma vornehmen und neu exportieren. */\n\n`;
css += block(':root', root);
css += "\n[data-color-scheme='light'] {\n  color-scheme: light;\n}\n\n[data-color-scheme='dark'] {\n  color-scheme: dark;\n}\n";

// Ein Theme überschreibt die Farben, die sich ändern – und alle, die auf
// andere Farben verweisen, damit sie im Theme-Bereich neu berechnet werden.
for (const theme of themes.slice(1)) {
  const lines = byCollection('System')
    .map((t) => [t, systemValue(t, theme)])
    .filter(([t, v]) => v !== systemValue(t, themes[0]) || v.includes('var(--color-'))
    .map(([t, v]) => decl(t.css, v));
  css += '\n' + block(`[data-theme='${slug(theme)}']`, lines);
}

css += '\n' + shapeModes.map((m, i) => `[data-shape='${slug(m)}'] {\n  --shape: ${shapeValue(i)};\n}\n`).join('\n');
css += '\n' + block(':root,\n[data-shape]', shapeDerived);

// ── Ausgabe JSON ─────────────────────────────────────────────────────────────

/** Festwert eines Tokens je Modus – für Vorschauen in der Doku */
function literal(token, ctx) {
  const v = resolve(valueIn(token, ctx), ctx);
  if (v && typeof v === 'object' && 'ref' in v) {
    const alpha = Math.round(v.alpha * 255).toString(16).padStart(2, '0');
    return v.ref + alpha;
  }
  return v;
}

const modeTable = (token) => {
  const c = collections.get(token.collection);
  return Object.fromEntries(c.modes.map((m) => [m, literal(token, { ...baseContext, [token.collection]: m })]));
};

const json = {
  generated: new Date().toISOString(),
  viewport,
  shapes: shapeModes.map((m, i) => ({ mode: m, shape: Number(shapeValue(i)) })),
  themes: themes.filter(Boolean),
  tokens: [...tokens.values()]
    .filter((t) => t.css)
    .sort((a, b) => (a.collection === b.collection ? compare(a, b) : 0))
    .map((t) => ({
      css: `--${t.css}`,
      figma: t.figma,
      collection: t.collection,
      type: t.type,
      description: t.description,
      value:
        t.collection === 'Primitives' ? primitiveValue(t) : t.collection === 'Responsive' ? responsiveValue(t) : systemValue(t, themes[0]),
      modes: modeTable(t),
    })),
  components: [...tokens.values()]
    .filter((t) => t.collection === 'Components')
    .map((t) => ({
      css: `--${t.path.join('-')}`,
      figma: t.figma,
      modes: Object.fromEntries(
        Object.entries(t.values).map(([m, v]) => [m, isRef(v) && target(v).css ? varOf(target(v)) : String(resolve(v, baseContext))]),
      ),
    })),
};

mkdirSync(DIST, { recursive: true });
writeFileSync(join(DIST, 'tokens.css'), css);
writeFileSync(join(DIST, 'tokens.json'), JSON.stringify(json, null, 2) + '\n');
console.log(`tokens.css: ${json.tokens.length} Tokens · tokens.json: ${json.components.length} Component-Tokens`);
