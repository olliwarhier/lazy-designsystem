import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lightnessScale, generatePalette, chromaAt, buildTheme, toCss, contrast, meetsMin, PRESETS } from '../dist/index.js';

const scale = (s) => lightnessScale(s).values.join(' ');

test('Lightness: Beispiele aus Spec 02, 4.6 (APCA)', () => {
  assert.equal(scale({ steps: 11, distribution: 1 }), '100 98 95 89 80 70 60 40 26 17 10');
  assert.equal(scale({ steps: 11, distribution: 0.5 }), '100 97 92 87 80 70 60 44 31 20 10');
  assert.equal(scale({ steps: 15, distribution: 1 }), '100 98 96 93 89 85 80 70 60 47 36 28 21 15 10');
  assert.equal(scale({ steps: 7, distribution: 1 }), '100 98 80 70 60 27 10');
  // Spec nennt 22 statt 23: 60 − 3 × 12,5 = 22,5 wird hier aufgerundet
  assert.equal(scale({ steps: 11, distribution: 0 }), '100 95 90 85 80 70 60 48 35 23 10');
});

test('Lightness: Beispiele aus Spec 02, 4.6 (WCAG, Zentrum 57)', () => {
  assert.equal(scale({ steps: 11, system: 'wcag' }), '100 98 94 85 67 57 47 33 23 15 10');
  assert.equal(scale({ steps: 15, system: 'wcag' }), '100 98 95 91 86 78 67 57 47 38 30 24 18 14 10');
});

test('Lightness: Grenzfall 15 Steps, Außenpunkt 90 → g = 8, alle Abstände 2', () => {
  const { values } = lightnessScale({ steps: 15, upper: 90 });
  assert.deepEqual(values.slice(0, 8), [90, 88, 86, 84, 82, 80, 78, 70]);
});

test('Lightness: Untergrenze für r (offener Punkt 7 Steps)', () => {
  assert.equal(scale({ steps: 7, minRatio: 0.5 }).split(' ').slice(0, 3).join(' '), '100 93 80');
});

test('Lightness: nie zwei Steps mit weniger als 2 Abstand', () => {
  for (const steps of [7, 9, 11, 13, 15])
    for (const upper of [90, 95, 100])
      for (const lower of [0, 10, 20])
        for (const distribution of [0, 0.5, 1])
          for (const system of ['apca', 'wcag']) {
            const { values } = lightnessScale({ steps, upper, lower, distribution, system });
            assert.equal(values.length, steps);
            for (let i = 1; i < values.length; i++) assert.ok(values[i - 1] - values[i] >= 2, `${values}`);
          }
});

const blue = { id: 'b', name: 'blue', type: 'color', hue: 253, chromaMax: 0.2, chromaMin: 0.05, harmonize: true };

test('Chroma: über Lightness gemessen, Minimum hell voll und dunkel halb', () => {
  const sc = lightnessScale({ steps: 11 });
  assert.equal(chromaAt(70, sc, blue), 0.2);
  assert.ok(Math.abs(chromaAt(100, sc, blue) - 0.05) < 1e-9);
  assert.ok(Math.abs(chromaAt(10, sc, blue) - 0.125) < 1e-9);
  // gleiche Lightness → gleiches Chroma, unabhängig von der Stepzahl
  assert.equal(chromaAt(80, lightnessScale({ steps: 11 }), blue), chromaAt(80, lightnessScale({ steps: 15 }), blue));
});

test('Palette: Namen nach Lightness, Weiß ohne Chroma, Gamut-Kappung markiert', () => {
  const p = generatePalette(blue, { steps: 11 });
  assert.equal(p[0].name, 'blue-100');
  assert.equal(p[0].hex, '#ffffff');
  assert.equal(p[0].clipped, false);
  assert.ok(p.find((t) => t.l === 70).isCenter);
  assert.ok(p.some((t) => t.clipped));
});

const palettes = [
  { id: 'n', name: 'slate', type: 'neutral', hue: 253, chromaMax: 0.02, chromaMin: 0.005, harmonize: true },
  { id: 'v', name: 'violet', type: 'color', hue: 295, chromaMax: 0.2, chromaMin: 0.05, harmonize: true },
  blue,
  { id: 'r', name: 'red', type: 'color', hue: 25, chromaMax: 0.2, chromaMin: 0.05, harmonize: true },
  { id: 'a', name: 'amber', type: 'color', hue: 75, chromaMax: 0.17, chromaMin: 0.05, harmonize: true },
  { id: 'g', name: 'green', type: 'color', hue: 145, chromaMax: 0.17, chromaMin: 0.05, harmonize: true },
];
const groups = { neutral: 'n', brand: 'v', action: 'b', error: 'r', warning: 'a', success: 'g', information: 'b' };
const config = (extra = {}) => ({ scale: { steps: 11 }, palettes, groups, ...extra, options: { onBasePreset: 'large', ...extra.options } });

test('Theme: Basic-Flächen Light 100 · 98 · 95, Inverted 10 · 17 · 26', () => {
  const { light } = buildTheme(config()).modes;
  const l = (id) => light.byId[id].l;
  assert.deepEqual([l('surface/default/subtle'), l('surface/default/base'), l('surface/default/bold')], [100, 98, 95]);
  assert.deepEqual([l('surface/inverted/subtle'), l('surface/inverted/base'), l('surface/inverted/bold')], [10, 17, 26]);
});

test('Theme: jeder gültige Slot erfüllt sein Preset, das Zentrum wird nie gewählt', () => {
  const theme = buildTheme(config());
  for (const mode of Object.values(theme.modes)) {
    for (const t of mode.tokens) {
      if (t.kind !== 'tint' || !t.candidates || t.status === 'error') continue;
      assert.notEqual(t.l, theme.scale.center, `${mode.mode} ${t.path}`);
      if (t.contrast?.min) assert.ok(meetsMin(t.contrast.apca, t.contrast.min, 'apca'), `${mode.mode} ${t.path}`);
    }
  }
});

test('Theme: Kontrast-Leiter – Subtle nie stärker als Base', () => {
  const theme = buildTheme(config());
  for (const mode of Object.values(theme.modes)) {
    const c = (id) => mode.byId[id].contrast.apca;
    assert.ok(c('on-surface/default/subtle') <= c('on-surface/default/base') + 0.05);
    assert.ok(c('on-surface/default/subtler') <= c('on-surface/default/subtle') + 0.05);
    assert.ok(c('action/default/subtle') <= c('action/default/base') + 0.05);
  }
});

test('Dark Mode: gespiegelt nach Kontrast, Action/Bold wird hell', () => {
  const { light, dark } = buildTheme(config()).modes;
  assert.ok(light.byId['action/default/bold'].l < 70);
  assert.ok(dark.byId['action/default/bold'].l > 70);
  const diff = Math.abs(dark.byId['action/default/bold'].contrast.apca - light.byId['action/default/bold'].contrast.apca);
  assert.ok(diff < 10, `Abweichung ${diff}`);
});

test('High Contrast: On-Surface/Subtle bekommt mehr Kontrast, Outlines deckend', () => {
  const { light, 'light-hc': hc } = buildTheme(config()).modes;
  assert.ok(hc.byId['on-surface/default/subtle'].contrast.apca > light.byId['on-surface/default/subtle'].contrast.apca);
  assert.equal(hc.byId['outline/default/subtle'].alpha, 1);
  assert.ok(light.byId['outline/default/subtle'].alpha < 1);
});

test('Override: ungültiger Tint wird auf den nächsten gültigen gesetzt', () => {
  const { light } = buildTheme(config({ overrides: { light: { 'action/default/bold': 80 } } })).modes;
  const t = light.byId['action/default/bold'];
  assert.equal(t.status, 'adjusted');
  assert.ok(meetsMin(t.contrast.apca, 'body', 'apca'));
});

test('Feedback synchron: Error, Success und Information teilen die Tints', () => {
  const { light } = buildTheme(config()).modes;
  for (const e of ['base', 'subtle']) {
    assert.equal(light.byId[`success/default/${e}`].l, light.byId[`error/default/${e}`].l);
    assert.equal(light.byId[`information/default/${e}`].l, light.byId[`error/default/${e}`].l);
  }
});

test('Hover/Pressed: Richtung nach Grenze, Prüfung gegen die On-Farbe', () => {
  const { light } = buildTheme(config()).modes;
  const bold = light.byId['action/default/bold'];
  assert.equal(light.byId['action/default/bold-hovered'].l, bold.l - 8);
  assert.equal(light.byId['action/default/bold-pressed'].l, bold.l - 16);
  assert.ok(light.byId['action/default/bold-pressed'].contrast);
});

test('Palettenregeln: Error-Palette exklusiv, Hue-Abstand zu Brand/Action', () => {
  const t = buildTheme(config({ groups: { ...groups, brand: 'r' } }));
  assert.ok(t.warnings.some((w) => w.includes('Error-Palette')));
});

test('Kontrast: WCAG-Werte wie erwartet', () => {
  const w = { r: 1, g: 1, b: 1 };
  const k = { r: 0, g: 0, b: 0 };
  assert.equal(Math.round(contrast(w, k, 'wcag')), 21);
  assert.equal(PRESETS.body.wcag, 7);
});

test('CSS-Export: data-scheme, data-contrast und Media Queries', () => {
  const css = toCss(buildTheme(config()));
  assert.match(css, /\[data-scheme="dark"\]/);
  assert.match(css, /\[data-contrast="more"\]/);
  assert.match(css, /prefers-color-scheme: dark/);
  assert.match(css, /--color-action-default-bold: #/);
  // Signal nicht aktiv → Fallback auf Action
  assert.match(css, /--color-signal-default-base: var\(--color-action-default-base\)/);
});
