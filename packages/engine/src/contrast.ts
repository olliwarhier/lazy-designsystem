// Kontrast-Presets nach Spezifikation 05, Abschnitt 1.
import { apca, wcag } from '@lazy-designsystem/core';
import type { Rgb } from './palette.js';
import type { ContrastSystem } from './scale.js';

export type PresetKey = 'maximum' | 'caption' | 'body' | 'large' | 'nonText' | 'prominent' | 'subtle';

export interface Preset {
  key: PresetKey;
  label: string;
  /** APCA Lc (Betrag) */
  apca: number;
  /** WCAG-2-Verhältnis (AAA-Spalte) */
  wcag: number;
  /** WCAG 2.1 AA, gesetzlich gefordert (EAA) – nur zur Einordnung */
  wcagAA?: number;
}

export const PRESETS: Record<PresetKey, Preset> = {
  maximum: { key: 'maximum', label: 'Maximum', apca: 100, wcag: 15 },
  caption: { key: 'caption', label: 'Caption', apca: 90, wcag: 10 },
  body: { key: 'body', label: 'Body', apca: 75, wcag: 7, wcagAA: 4.5 },
  large: { key: 'large', label: 'Large', apca: 60, wcag: 4.5, wcagAA: 3 },
  nonText: { key: 'nonText', label: 'Non-Text', apca: 45, wcag: 3, wcagAA: 3 },
  prominent: { key: 'prominent', label: 'Prominent Division', apca: 30, wcag: 1.8 },
  subtle: { key: 'subtle', label: 'Subtle Division', apca: 15, wcag: 1.3 },
};

/** Kontrast im gewählten System: APCA als Betrag von Lc, WCAG als Verhältnis */
export function contrast(fg: Rgb, bg: Rgb, system: ContrastSystem): number {
  return system === 'apca' ? Math.abs(apca(fg, bg)) : wcag(fg, bg);
}

export const presetValue = (key: PresetKey, system: ContrastSystem) => PRESETS[key][system];

/** kleine Toleranz, damit gerundete Anzeigewerte und Prüfung zusammenpassen */
const EPS = { apca: 0.05, wcag: 0.005 };

export const meetsMin = (value: number, key: PresetKey, system: ContrastSystem) =>
  value >= presetValue(key, system) - EPS[system];
export const meetsMax = (value: number, key: PresetKey, system: ContrastSystem) =>
  value <= presetValue(key, system) + EPS[system];

export function formatContrast(value: number, system: ContrastSystem): string {
  return system === 'apca' ? `Lc ${Math.round(value)}` : `${value.toFixed(2).replace('.', ',')}:1`;
}

/** höchstes erfülltes Preset (für Anzeigen) */
export function ratePreset(value: number, system: ContrastSystem): Preset | null {
  for (const key of ['maximum', 'caption', 'body', 'large', 'nonText', 'prominent', 'subtle'] as PresetKey[]) {
    if (meetsMin(value, key, system)) return PRESETS[key];
  }
  return null;
}

/** Alpha-Komposition im sRGB-Raum (wie Figma und Browser) */
export function composite(fg: Rgb, alpha: number, bg: Rgb): Rgb {
  return {
    r: fg.r * alpha + bg.r * (1 - alpha),
    g: fg.g * alpha + bg.g * (1 - alpha),
    b: fg.b * alpha + bg.b * (1 - alpha),
  };
}
