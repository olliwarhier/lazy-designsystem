// Gemeinsamer Zustand von Tint-Generator und Theme-Builder.
// Wird im Browser gespeichert (localStorage), damit beide Seiten dieselben Paletten nutzen.
import { DEFAULT_CATEGORIES, DEFAULT_OPTIONS, DEFAULT_SCALE, withDefaults, type PaletteSettings, type ThemeConfig } from '@lazy-designsystem/engine';

// v2: Kontrast-Skala, Kategorien und neue Standardpaletten (Spec 02, 2. Fassung)
const KEY = 'lazy-ds-prototyp-v2';

const palette = (id: string, name: string, hue: number, category: 'neutral' | 'color'): PaletteSettings => {
  const cat = DEFAULT_CATEGORIES.find((c) => c.id === category)!;
  return { id, name, type: cat.type, category, hue, ownChroma: false, chromaMax: cat.chromaMax, chromaMin: cat.chromaMin, curve: 'falling' };
};

/** Standardwerte nach Olli (29.10.2026) */
export const defaultConfig = (): ThemeConfig =>
  withDefaults({
    scale: structuredClone(DEFAULT_SCALE),
    categories: structuredClone(DEFAULT_CATEGORIES),
    sharedChroma: true,
    chromaRelative: false,
    palettes: [
      palette('slate', 'slate', 250, 'neutral'),
      palette('blue', 'blue', 250, 'color'),
      palette('red', 'red', 30, 'color'),
      palette('yellow', 'yellow', 90, 'color'),
      palette('green', 'green', 150, 'color'),
    ],
    groups: { neutral: 'slate', brand: 'blue', action: 'blue', signal: null, error: 'red', warning: 'yellow', success: 'green', information: 'blue' },
    focus: null,
    overrides: {},
    options: structuredClone(DEFAULT_OPTIONS),
  });

/** Konfiguration aus dem Link (#c=…), siehe shareLink */
function fromHash(): ThemeConfig | null {
  try {
    const m = location.hash.match(/[#&]c=([^&]+)/);
    if (!m) return null;
    const json = decodeURIComponent(escape(atob(m[1].replace(/-/g, '+').replace(/_/g, '/'))));
    history.replaceState(null, '', location.pathname + location.search);
    return withDefaults(JSON.parse(json));
  } catch {
    return null;
  }
}

function load(): ThemeConfig {
  const shared = typeof location !== 'undefined' ? fromHash() : null;
  if (shared) return shared;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return withDefaults(JSON.parse(raw));
  } catch {
    // privates Fenster, blockierter Speicher oder kaputte Daten: Standardwerte
  }
  return defaultConfig();
}

export const studio: ThemeConfig = $state(load());

// Rückgängig/Wiederholen: Schnappschüsse, Reglerbewegungen werden zusammengefasst
const past: string[] = [];
const future: string[] = [];
let current = JSON.stringify(studio);
let restoring = false;
let timer: ReturnType<typeof setTimeout> | undefined;
export const historyState = $state({ canUndo: false, canRedo: false });

$effect.root(() => {
  $effect(() => {
    const json = JSON.stringify(studio);
    try {
      localStorage.setItem(KEY, json);
    } catch {
      // Speichern ist nur Komfort
    }
    if (restoring) {
      restoring = false;
      current = json;
      return;
    }
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (json === current) return;
      past.push(current);
      if (past.length > 100) past.shift();
      future.length = 0;
      current = json;
      historyState.canUndo = true;
      historyState.canRedo = false;
    }, 350);
  });
});

/** ersetzt den ganzen Zustand (Zurücksetzen, Import, Rückgängig) */
export function replaceStudio(next: ThemeConfig) {
  const n = withDefaults(next);
  studio.scale = n.scale;
  studio.categories = n.categories;
  studio.sharedChroma = n.sharedChroma;
  studio.chromaRelative = n.chromaRelative;
  studio.palettes = n.palettes;
  studio.groups = n.groups;
  studio.focus = n.focus;
  studio.overrides = n.overrides;
  studio.options = n.options;
}

function restore(json: string) {
  clearTimeout(timer);
  restoring = true;
  replaceStudio(JSON.parse(json));
  historyState.canUndo = past.length > 0;
  historyState.canRedo = future.length > 0;
}

export function undo() {
  clearTimeout(timer);
  const now = JSON.stringify(studio);
  if (now !== current) past.push(current), (current = now);
  const prev = past.pop();
  if (!prev) return;
  future.push(current);
  current = prev;
  restore(prev);
}

export function redo() {
  const next = future.pop();
  if (!next) return;
  past.push(current);
  current = next;
  restore(next);
}

export const snapshot = (): ThemeConfig => $state.snapshot(studio) as ThemeConfig;

/** Link mit der ganzen Konfiguration im Hash, kein Server nötig */
export function shareLink(): string {
  const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(snapshot()))))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `${location.origin}${location.pathname}#c=${b64}`;
}

let counter = 0;
export const newId = () => `p${Date.now().toString(36)}${(counter++).toString(36)}`;

/** Farbname zum Hue (Spec 02: Hue bestimmt den Farbnamen) */
export function hueName(h: number): string {
  const hue = ((h % 360) + 360) % 360;
  // Orientierung an den Standardpaletten: red 30, yellow 90, green 150, blue 250
  const names: [number, string][] = [
    [15, 'rose'], [45, 'red'], [70, 'orange'], [110, 'yellow'], [135, 'lime'], [170, 'green'], [200, 'teal'],
    [230, 'cyan'], [270, 'blue'], [295, 'violet'], [325, 'purple'], [350, 'pink'], [361, 'rose'],
  ];
  return names.find(([max]) => hue < max)?.[1] ?? 'color';
}

/** Name, der in den Paletten noch frei ist (blue, blue-2, …) */
export function uniqueName(base: string, ignoreId?: string): string {
  const taken = new Set(studio.palettes.filter((p) => p.id !== ignoreId).map((p) => p.name));
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}
