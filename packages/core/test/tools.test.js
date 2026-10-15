import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generatePalette, lightnessScale, typescale } from '../src/index.js';

const TEMPLATE = { harmonize: true, steps: 13, distribution: 'dynamic', lightnessMax: 1, lightnessMin: 0.1, center: 70 };

test('Lightness-Stufen wie im DS Template', () => {
  assert.deepEqual(lightnessScale(TEMPLATE).values, [100, 98, 95, 91, 86, 79, 70, 60, 49, 38, 28, 18, 10]);
});

test('Palette Lime entspricht den Figma-Werten', () => {
  const lime = generatePalette({ ...TEMPLATE, hue: 127, chromaMax: 0.2, chromaMin: 0.05 });
  const hex = Object.fromEntries(lime.map((t) => [t.name, t.hex]));
  assert.equal(hex['70'], '#7db300');
  assert.equal(hex['98'], '#e7ffbf');
  assert.equal(hex['28'], '#1c3000');
  assert.equal(hex['10'], '#010500');
});

test('Chroma ist am Zentrum maximal', () => {
  const p = generatePalette({ ...TEMPLATE, hue: 253, chromaMax: 0.2, chromaMin: 0.05 });
  const center = p.find((t) => t.name === '70');
  assert.ok(p.every((t) => t.c <= center.c));
  assert.ok(Math.abs(p.at(0).c - 0.05) < 1e-9);
});

test('Typescale Desktop (18 px, Major Third) rastet auf die Base-Scale ein', () => {
  const base = [0, 1, 1.25, 1.5, 2, 3, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64];
  const { styles } = typescale(18, 1.25, base);
  assert.equal(styles.body.medium.px, 18);
  assert.equal(styles.heading.small.px, 18);
  assert.equal(styles.heading.large.px, 28);
  assert.equal(styles.heading['2xlarge'].px, 44);
  assert.equal(styles.display['2xlarge'].px, 56);
});
