import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lightnessScale, buildScale, generatePalette, resolvePalette, chromaAt, buildTheme, toCss, contrast, meetsMin, PRESETS } from '../dist/index.js';

const scale = (s) => lightnessScale(s).values.join(' ');
const std = (s) => buildScale(s).values.join(' ');

test('Kontrast (Standard): Skalen aus Spec 02, 4 (APCA, Hintergründe 0.98 / 0.2)', () => {
  assert.equal(std({ steps: 7 }), '100 92 77 70 62 37 10');
  assert.equal(std({ steps: 11 }), '100 97 92 85 77 70 62 51 37 23 10');
  assert.equal(std({ steps: 15 }), '100 97 92 88 85 81 77 70 62 57 51 44 37 23 10');
  const sc = buildScale({ steps: 11 });
  // Pflichtstufen: Large 60 · Body 75 · Caption 90 · Maximum 100, beidseitig
  assert.deepEqual(sc.contrasts.map(Math.round), [107, 100, 90, 76, 61, 49, 60, 75, 90, 100, 102]);
});

test('Kontrast (Standard): WCAG ohne Large, Zentrum 57', () => {
  assert.equal(std({ steps: 7, system: 'wcag' }), '100 94 71 57 45 25 10');
  assert.equal(std({ steps: 11, system: 'wcag' }), '100 94 81 71 64 57 51 45 37 25 10');
});

test('Lightness: Beispiele aus Spec 02, 5.4 (APCA, g nur als Minimum)', () => {
  assert.equal(scale({ steps: 11, distribution: 1 }), '100 97 93 87 80 70 52 37 26 17 10');
  assert.equal(scale({ steps: 11, distribution: 0.5 }), '100 96 91 86 80 70 55 42 30 19 10');
  assert.equal(scale({ steps: 11, distribution: 0 }), '100 95 90 85 80 70 58 46 34 22 10');
  assert.equal(scale({ steps: 15, distribution: 1 }), '100 97 94 91 87 84 80 70 58 47 37 29 22 15 10');
  assert.equal(scale({ steps: 7, distribution: 1 }), '100 96 87 70 44 25 10');
  assert.equal(scale({ steps: 7, distribution: 0 }), '100 90 80 70 50 30 10');
});

test('Lightness: Beispiele aus Spec 02, 5.4 (WCAG, Zentrum 57)', () => {
  assert.equal(scale({ steps: 11, system: 'wcag' }), '100 97 92 85 74 57 43 32 23 16 10');
  assert.equal(scale({ steps: 11, system: 'wcag', distribution: 0 }), '100 92 84 75 67 57 47 38 29 19 10');
  assert.equal(scale({ steps: 15, system: 'wcag' }), '100 97 93 89 83 76 68 57 47 39 32 25 20 14 10');
});

test('Lightness: Grenzfall 15 Steps, Außenpunkt 90 → g = 8, alle Abstände 2', () => {
  const { values } = lightnessScale({ steps: 15, upper: 90 });
  assert.deepEqual(values.slice(0, 8), [90, 88, 86, 84, 82, 80, 78, 70]);
});

test('Mindestabstand 3 L bei Außenpunkt 100, sonst 2 L, Zentrumsabstand ≥ 8 im Modus Lightness', () => {
  for (const basis of ['contrast', 'lightness'])
    for (const steps of [7, 9, 11, 13, 15])
      for (const upper of [90, 95, 100])
        for (const lower of [0, 10, 20])
          for (const distribution of [0, 0.5, 1])
            for (const system of ['apca', 'wcag']) {
              const sc = buildScale({ basis, steps, upper, lower, distribution, system });
              const v = sc.values;
              const gap = upper === 100 ? 3 : 2;
              assert.equal(v.length, steps);
              assert.equal(v[0], upper);
              assert.equal(v.at(-1), lower);
              for (let i = 1; i < v.length; i++) assert.ok(v[i - 1] - v[i] >= gap, `${basis} ${system} ${v}`);
              if (basis === 'lightness') {
                const c = sc.centerIndex;
                assert.ok(v[c - 1] - v[c] >= 8 && v[c] - v[c + 1] >= 8, `${system} ${v}`);
              }
            }
});

const blue = { id: 'b', name: 'blue', type: 'color', hue: 253, chromaMax: 0.2, chromaMin: 0.05 };

test('Chroma: über Lightness gemessen, Minimum hell voll und dunkel halb', () => {
  const sc = lightnessScale({ steps: 11 });
  assert.equal(chromaAt(70, sc, blue), 0.2);
  assert.ok(Math.abs(chromaAt(100, sc, blue) - 0.05) < 1e-9);
  assert.ok(Math.abs(chromaAt(10, sc, blue) - 0.125) < 1e-9);
  // gleiche Lightness → gleiches Chroma, unabhängig von der Stepzahl
  assert.equal(chromaAt(80, lightnessScale({ steps: 11 }), blue), chromaAt(80, lightnessScale({ steps: 15 }), blue));
});

test('Palette: Namen nach Lightness, Weiß ohne Chroma, Gamut-Kappung markiert', () => {
  const p = generatePalette(blue, { steps: 11, basis: 'lightness' });
  assert.equal(p[0].name, 'blue-100');
  assert.equal(p[0].hex, '#ffffff');
  assert.equal(p[0].clipped, false);
  assert.ok(p.find((t) => t.l === 70).isCenter);
  assert.ok(p.some((t) => t.clipped));
});

test('Kontrast: jede Palette hat je Stufe denselben Kontrast wie Neutral', () => {
  const sc = buildScale({ steps: 11 });
  for (const hue of [30, 90, 150, 250]) {
    const p = generatePalette(resolvePalette({ id: 'x', name: 'x', type: 'color', hue, chromaMax: 0, chromaMin: 0 }), sc);
    p.forEach((t, i) => {
      const bg = t.l >= sc.center ? sc.darkBg : sc.lightBg;
      assert.ok(Math.abs(contrast(t.rgb, bg, 'apca') - sc.contrasts[i]) < 0.5, `H ${hue} ${t.name}: ${contrast(t.rgb, bg, 'apca')} statt ${sc.contrasts[i]}`);
    });
  }
});

test('Gemeinsames Chroma: Kategorie gilt, außer bei eigenem Chroma', () => {
  const cats = [{ id: 'color', name: 'Color', type: 'color', chromaMax: 0.16, chromaMin: 0.05 }];
  const p = { id: 'x', name: 'x', type: 'color', category: 'color', hue: 250, chromaMax: 0.2, chromaMin: 0.1 };
  assert.equal(resolvePalette(p, cats, true).chromaMax, 0.16);
  assert.equal(resolvePalette({ ...p, ownChroma: true }, cats, true).chromaMax, 0.2);
  assert.equal(resolvePalette(p, cats, false).chromaMax, 0.2);
});

const palettes = [
  { id: 'n', name: 'slate', type: 'neutral', hue: 250, chromaMax: 0.02, chromaMin: 0 },
  { id: 'v', name: 'violet', type: 'color', hue: 295, chromaMax: 0.16, chromaMin: 0.05 },
  blue,
  { id: 'r', name: 'red', type: 'color', hue: 30, chromaMax: 0.16, chromaMin: 0.05 },
  { id: 'a', name: 'yellow', type: 'color', hue: 90, chromaMax: 0.16, chromaMin: 0.05 },
  { id: 'g', name: 'green', type: 'color', hue: 150, chromaMax: 0.16, chromaMin: 0.05 },
];
const groups = { neutral: 'n', brand: 'v', action: 'b', error: 'r', warning: 'a', success: 'g', information: 'b' };
const config = (extra = {}) => ({ scale: { steps: 11 }, palettes, groups, ...extra, options: { onBasePreset: 'large', ...extra.options } });

test('Theme: Basic-Flächen Light 100 · 97 · 92, Inverted 10 · 23 · 37 (Kontrast-Skala)', () => {
  const { light } = buildTheme(config()).modes;
  const l = (id) => light.byId[id].l;
  assert.deepEqual([l('surface/default/subtle'), l('surface/default/base'), l('surface/default/bold')], [100, 97, 92]);
  assert.deepEqual([l('surface/inverted/subtle'), l('surface/inverted/base'), l('surface/inverted/bold')], [10, 23, 37]);
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
