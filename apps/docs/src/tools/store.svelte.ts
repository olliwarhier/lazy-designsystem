// Gemeinsamer Zustand von Tint-Generator und Theme-Builder.
// Wird im Browser gespeichert (localStorage), damit beide Seiten dieselben Paletten nutzen.
import { DEFAULT_OPTIONS, DEFAULT_SCALE, withDefaults, type PaletteSettings, type ThemeConfig } from '@lazy-designsystem/engine';

const KEY = 'lazy-ds-prototyp-v1';

const palette = (id: string, name: string, hue: number, chromaMax: number, type: PaletteSettings['type'] = 'color', chromaMin = 0.05): PaletteSettings => ({
  id,
  name,
  type,
  hue,
  chromaMax,
  chromaMin,
  harmonize: true,
  chromaMode: 'absolute',
});

export const defaultConfig = (): ThemeConfig =>
  withDefaults({
    scale: { ...DEFAULT_SCALE },
    palettes: [
      palette('slate', 'slate', 253, 0.02, 'neutral', 0.005),
      palette('violet', 'violet', 295, 0.2),
      palette('blue', 'blue', 253, 0.2),
      palette('red', 'red', 25, 0.2),
      palette('amber', 'amber', 75, 0.17),
      palette('green', 'green', 145, 0.17),
    ],
    groups: { neutral: 'slate', brand: 'violet', action: 'blue', signal: null, error: 'red', warning: 'amber', success: 'green', information: 'blue' },
    focus: null,
    overrides: {},
    options: structuredClone(DEFAULT_OPTIONS),
  });

function load(): ThemeConfig {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return withDefaults(JSON.parse(raw));
  } catch {
    // privates Fenster, blockierter Speicher oder kaputte Daten: Standardwerte
  }
  return defaultConfig();
}

export const studio: ThemeConfig = $state(load());

$effect.root(() => {
  $effect(() => {
    const json = JSON.stringify(studio);
    try {
      localStorage.setItem(KEY, json);
    } catch {
      // Speichern ist nur Komfort
    }
  });
});

/** ersetzt den ganzen Zustand (Zurücksetzen, Import) */
export function replaceStudio(next: ThemeConfig) {
  const n = withDefaults(next);
  studio.scale = n.scale;
  studio.palettes = n.palettes;
  studio.groups = n.groups;
  studio.focus = n.focus;
  studio.overrides = n.overrides;
  studio.options = n.options;
}

export const snapshot = (): ThemeConfig => $state.snapshot(studio) as ThemeConfig;

let counter = 0;
export const newId = () => `p${Date.now().toString(36)}${(counter++).toString(36)}`;

/** Farbname zum Hue (Spec 02: Hue bestimmt den Farbnamen) */
export function hueName(h: number): string {
  // Orientierung wie in der Doku (Setup → Paletten)
  const names: [number, string][] = [
    [20, 'rose'], [38, 'red'], [60, 'orange'], [100, 'yellow'], [150, 'green'], [195, 'teal'],
    [258, 'blue'], [290, 'lavender'], [318, 'purple'], [345, 'pink'], [361, 'rose'],
  ];
  return names.find(([max]) => h < max)?.[1] ?? 'color';
}
