import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hexToOklch, parseHex, rgbToOklch, oklchToRgb, toHex, apca, wcag, fluid, rem } from '../src/index.js';

test('Hex → OKLCH', () => {
  assert.equal(hexToOklch('#ffffff'), 'oklch(1 0 0)');
  assert.equal(hexToOklch('#000000'), 'oklch(0 0 0)');
  // Palette/Clay/70 aus dem DS Template: L 0.70, Hue 127
  const clay = rgbToOklch(parseHex('#9da099'));
  assert.ok(Math.abs(clay.l - 0.7) < 0.005);
  assert.ok(Math.abs(clay.h - 127) < 3);
});

test('OKLCH → Hex ist umkehrbar', () => {
  for (const hex of ['#9da099', '#983c59', '#007ff0', '#ffc300']) {
    assert.equal(toHex(oklchToRgb(rgbToOklch(parseHex(hex)))), hex);
  }
});

test('Gamut-Mapping bleibt im sRGB-Raum', () => {
  const rgb = oklchToRgb({ l: 0.98, c: 0.2, h: 253 });
  for (const v of [rgb.r, rgb.g, rgb.b]) assert.ok(v >= 0 && v <= 1);
});

test('Kontrast', () => {
  const black = parseHex('#000000');
  const white = parseHex('#ffffff');
  assert.equal(Math.round(wcag(black, white)), 21);
  assert.ok(apca(black, white) > 100);
  assert.ok(apca(white, black) < -100);
});

test('fluid()', () => {
  assert.equal(rem(16), '1rem');
  assert.equal(fluid(16, 16, 430, 1440), '1rem');
  // 12 px bei 430 px Viewport, 16 px bei 1440 px: 0,396 vw × 4,3 + 10,3 px = 12 px
  assert.equal(fluid(12, 16, 430, 1440), 'clamp(0.75rem, calc(0.396vw + 0.6436rem), 1rem)');
});
