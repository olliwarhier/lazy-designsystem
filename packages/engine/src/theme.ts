// Theme-Builder: Zuweisung der Rollen zu Tints mit Kontrastprüfung.
// Spezifikation 05 (Tint-Zuweisung) und 11 (Theming, Dark Mode, High Contrast).
import { oklchToRgb, toHex, formatOklch } from '@lazy-designsystem/core';
import {
  PRESETS,
  composite,
  contrast,
  meetsMax,
  meetsMin,
  presetValue,
  type PresetKey,
} from './contrast.js';
import { generatePalette, type PaletteSettings, type Rgb, type Tint } from './palette.js';
import {
  MODES,
  buildSlots,
  isHighContrast,
  schemeOf,
  type GroupKey,
  type Mode,
  type RoleOptions,
  type Scheme,
  type SlotDef,
} from './roles.js';
import { lightnessScale, normalizeScale, type ContrastSystem, type Scale, type ScaleSettings } from './scale.js';

export interface OpacitySet {
  outlineSubtle: number;
  outlineSubtler: number;
  hovered: number;
  pressed: number;
  scrim: number;
  shadow: number;
}

export interface ThemeOptions extends RoleOptions {
  /** Grenze für die Richtung von Hover/Pressed gefüllter Elemente (L 0–100). Darüber dunkler, darunter heller. */
  hoverThreshold: number;
  hoverDelta: number;
  pressedDelta: number;
  /** Chroma-Faktor für helle Tints (über dem Zentrum) im Dark Mode. 1 = aus. */
  darkChromaFactor: number;
  opacity: Record<Scheme, OpacitySet>;
  /** zusätzlich zum gewählten System auch das andere anzeigen und warnen */
  checkBoth: boolean;
}

export interface ThemeConfig {
  scale: ScaleSettings;
  palettes: PaletteSettings[];
  /** Palette (ID) je Rollengruppe; Signal und Information optional */
  groups: Partial<Record<GroupKey, string | null>>;
  /** Fokusring außen: Palette (ID) oder null = Schwarz */
  focus: string | null;
  /** manuelle Tint-Wahl (L) je Mode und Slot */
  overrides: Partial<Record<Mode, Record<string, number>>>;
  options: ThemeOptions;
}

export const DEFAULT_OPTIONS: ThemeOptions = {
  signal: false,
  information: true,
  warningDecoupled: true,
  onBasePreset: 'body',
  hoverThreshold: 30,
  hoverDelta: 8,
  pressedDelta: 16,
  darkChromaFactor: 1,
  opacity: {
    light: { outlineSubtle: 0.32, outlineSubtler: 0.16, hovered: 0.08, pressed: 0.12, scrim: 0.32, shadow: 0.16 },
    dark: { outlineSubtle: 0.4, outlineSubtler: 0.24, hovered: 0.1, pressed: 0.16, scrim: 0.48, shadow: 0.4 },
  },
  checkBoth: true,
};

export type Status = 'ok' | 'override' | 'adjusted' | 'warning' | 'error';

export interface Candidate {
  l: number;
  name: string;
  hex: string;
  valid: boolean;
  reasons: string[];
  /** Kontrast gegen die Referenz im gewählten System */
  contrast: number | null;
}

export interface ContrastInfo {
  against: string;
  apca: number;
  wcag: number;
  /** Preset als Mindestwert bzw. Höchstwert */
  min?: PresetKey;
  max?: PresetKey;
}

export interface Token {
  id: string;
  path: string;
  cssVar: string;
  group?: GroupKey;
  kind: 'tint' | 'derived' | 'overlay' | 'fixed';
  /** Palette und Lightness, wenn der Wert auf einen Tint zeigt */
  paletteId?: string;
  l?: number;
  tintName?: string;
  rgb: Rgb;
  alpha: number;
  /** CSS-Wert: hex bzw. oklch(... / alpha) */
  css: string;
  hex: string;
  status: Status;
  messages: string[];
  contrast?: ContrastInfo;
  /** auswählbare Tints (nur bei Slots mit Tint-Wahl) */
  candidates?: Candidate[];
  /** Tint-Wahl möglich (sonst automatisch oder schreibgeschützt) */
  editable: boolean;
  /** Slot ohne eigene Auswahl, folgt einer synchronen Rolle */
  syncedTo?: string;
}

export interface ModeResult {
  mode: Mode;
  tokens: Token[];
  byId: Record<string, Token>;
}

export interface ThemeResult {
  scale: Scale;
  slots: SlotDef[];
  modes: Record<Mode, ModeResult>;
  /** Hinweise, die für alle Modes gelten (Palettenregeln) */
  warnings: string[];
}

const WHITE: Rgb = { r: 1, g: 1, b: 1 };
const BLACK: Rgb = { r: 0, g: 0, b: 0 };

const hueDistance = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

interface Ctx {
  mode: Mode;
  scheme: Scheme;
  system: ContrastSystem;
  scale: Scale;
  /** +1: im Light Mode liegt „außen" bei hellen Werten, −1 im Dark Mode */
  out: number;
  tints: Record<string, Tint[]>;
  paletteOf: (g: GroupKey) => string | null;
  assigned: Record<string, number>;
  slots: Record<string, SlotDef>;
  syncMembers: Record<string, SlotDef[]>;
  /** Slots ohne gültigen Tint: dienen nicht als Grenze der Kontrast-Leiter */
  failed: Set<string>;
}

const tintAt = (ctx: Ctx, pid: string, l: number) => ctx.tints[pid]?.find((t) => t.l === l);

function slotColor(ctx: Ctx, id: string): Rgb | null {
  const def = ctx.slots[id];
  const l = ctx.assigned[id];
  if (!def || l === undefined) return null;
  const pid = ctx.paletteOf(def.group);
  return pid ? tintAt(ctx, pid, l)?.rgb ?? null : null;
}

/** Prüft einen Tint für einen Slot in einer Palette. Gibt Gründe zurück, warum er nicht wählbar ist. */
function checkInPalette(ctx: Ctx, def: SlotDef, pid: string, l: number): { reasons: string[]; contrast: number | null } {
  const reasons: string[] = [];
  const { scale, out, system } = ctx;
  const tint = tintAt(ctx, pid, l);
  if (!tint) return { reasons: ['nicht in der Palette'], contrast: null };
  const name = (key: PresetKey) => PRESETS[key].label;

  // Regel 1: Zentrum nie wählbar
  if (l === scale.center) reasons.push('Zentrum ist nur für Outlines');

  const refRgb = def.ref ? slotColor(ctx, def.ref) : null;
  const c = refRgb ? contrast(tint.rgb, refRgb, system) : null;
  if (c !== null) {
    if (def.min && !meetsMin(c, def.min, system)) reasons.push(`unter ${name(def.min)}`);
    if (def.max && !meetsMax(c, def.max, system)) reasons.push(`über ${name(def.max)}`);
  }

  // Kontrast-Leiter: nie mehr Kontrast als die nächst stärkere Stufe
  if (def.stronger && refRgb && !ctx.failed.has(def.stronger)) {
    const strongerRgb = slotColor(ctx, def.stronger);
    if (strongerRgb && c !== null && c > contrast(strongerRgb, refRgb, system) + 0.05) {
      reasons.push('mehr Kontrast als die stärkere Stufe');
    }
  }

  if (def.kind === 'basic-surface') {
    const side = def.polarity === 'default' ? out : -out;
    if (side * (l - scale.center) <= 0) reasons.push(def.polarity === 'default' ? 'falsche Seite (Default)' : 'falsche Seite (Inverted)');
    const p = def.polarity;
    const sub = ctx.assigned[`surface/${p}/subtle`];
    const base = ctx.assigned[`surface/${p}/base`];
    if (def.emphasis === 'base' && sub !== undefined && side * (sub - l) < 0) reasons.push('weiter außen als Subtle');
    if (def.emphasis === 'bold' && base !== undefined && side * (base - l) <= 0) reasons.push('nicht innerhalb von Base');
    // keine zwei Basic-Flächen mit demselben Tint (außer Default/Base = Default/Subtle)
    for (const other of ['subtle', 'base', 'bold'].flatMap((e) => [`surface/default/${e}`, `surface/inverted/${e}`])) {
      if (other === def.id || ctx.assigned[other] !== l) continue;
      const allowed = (def.id === 'surface/default/base' && other === 'surface/default/subtle') || (def.id === 'surface/default/subtle' && other === 'surface/default/base');
      if (!allowed) reasons.push('Tint schon von einer anderen Basic-Fläche belegt');
    }
  }

  if (def.kind === 'surface') {
    // Regel 4: keine Default-Fläche weiter außen als Surface/Default/Base
    const bg = ctx.assigned['surface/default/base'];
    if (bg !== undefined && out * (l - bg) > 0) reasons.push('weiter außen als der Seitenhintergrund');
  }

  // Regel 2: Flächen ohne kontrastsicheres On-Paar sind nicht wählbar
  if ((def.kind === 'surface' || def.kind === 'basic-surface') && def.pair) {
    const onDef = ctx.slots[def.pair];
    const onPid = onDef ? ctx.paletteOf(onDef.group) : null;
    const preset = onDef?.min ?? 'body';
    const pool = onPid ? ctx.tints[onPid] : [];
    const has = pool.some((t) => t.l !== scale.center && meetsMin(contrast(t.rgb, tint.rgb, system), preset, system));
    if (!has) reasons.push(`kein On-Tint mit ${name(preset)}`);
  }

  return { reasons, contrast: c };
}

/** Prüft einen Tint für einen Slot – bei synchronen Feedback-Rollen für alle beteiligten Paletten */
function check(ctx: Ctx, def: SlotDef, l: number): { reasons: string[]; contrast: number | null } {
  const pid = ctx.paletteOf(def.group);
  if (!pid) return { reasons: ['keine Palette'], contrast: null };
  const own = checkInPalette(ctx, def, pid, l);
  const reasons = [...own.reasons];
  for (const member of ctx.syncMembers[def.id] ?? []) {
    const mpid = ctx.paletteOf(member.group);
    if (!mpid) continue;
    // die synchrone Rolle wird mit ihren eigenen Referenzen geprüft
    const r = checkInPalette(ctx, { ...member, syncWith: undefined }, mpid, l);
    if (r.reasons.length) reasons.push(...r.reasons.map((x) => `${member.role}: ${x}`));
  }
  return { reasons, contrast: own.contrast };
}

function candidates(ctx: Ctx, def: SlotDef): Candidate[] {
  const pid = ctx.paletteOf(def.group);
  if (!pid) return [];
  return ctx.tints[pid].map((t) => {
    const r = check(ctx, def, t.l);
    return { l: t.l, name: t.name, hex: t.hex, valid: r.reasons.length === 0, reasons: r.reasons, contrast: r.contrast };
  });
}

/** Tints von außen nach innen auf der Seite einer Polarity */
function sideList(ctx: Ctx, polarity: 'default' | 'inverted'): number[] {
  const desc = ctx.scale.values;
  const lightSide = desc.filter((l) => l > ctx.scale.center);
  const darkSide = desc.filter((l) => l < ctx.scale.center).reverse();
  const defaultSide = ctx.scheme === 'light' ? lightSide : darkSide;
  const invertedSide = ctx.scheme === 'light' ? darkSide : lightSide;
  return polarity === 'default' ? defaultSide : invertedSide;
}

/** Standardwahl im Light Mode (bzw. Index-Spiegel für Basic-Flächen im Dark Mode) */
function defaultPick(ctx: Ctx, def: SlotDef, valid: Candidate[]): number | undefined {
  if (!valid.length) return undefined;
  const byContrast = [...valid].sort((a, b) => (a.contrast ?? 0) - (b.contrast ?? 0));
  const towardCenter = (a: Candidate, b: Candidate) => Math.abs(a.l - ctx.scale.center) - Math.abs(b.l - ctx.scale.center);
  switch (def.kind) {
    case 'basic-surface': {
      // Default 100 · 98 · 95, Inverted 10 · 17 · 26 … (Subtle außen, Bold innen)
      const list = sideList(ctx, def.polarity);
      const idx = { subtle: 0, base: 1, bold: 2, subtler: 0 }[def.emphasis];
      const want = list[Math.min(idx, list.length - 1)];
      return valid.find((c) => c.l === want)?.l ?? [...valid].sort((a, b) => Math.abs(a.l - want) - Math.abs(b.l - want))[0].l;
    }
    case 'on-surface': {
      if (def.emphasis === 'base') return byContrast.at(-1)!.l; // stärkster Text
      if (def.emphasis === 'subtler') return byContrast[0].l; // schwächster gültiger
      return byContrast[Math.floor((byContrast.length - 1) / 2)].l;
    }
    case 'surface': {
      if (def.emphasis === 'subtle') {
        const target = presetValue('subtle', ctx.system);
        // möglichst nicht dieselbe Lightness wie eine Surface-Stufe (Regel 6)
        const surfaces = ['subtle', 'base', 'bold'].map((e) => ctx.assigned[`surface/default/${e}`]);
        const distinct = valid.filter((c) => !surfaces.includes(c.l));
        return [...(distinct.length ? distinct : valid)].sort((a, b) => Math.abs((a.contrast ?? 0) - target) - Math.abs((b.contrast ?? 0) - target))[0].l;
      }
      // Base und Bold: so nah am Zentrum wie erlaubt (kräftigste Farbe)
      return [...valid].sort(towardCenter)[0].l;
    }
    case 'on':
      return byContrast.at(-1)!.l;
  }
}

/** Dark Mode: Tint, dessen Kontrast dem Light-Wert am nächsten kommt (Spec 11, 2.1) */
function mirrorPick(def: SlotDef, valid: Candidate[], lightContrast: number | null): number | undefined {
  if (!valid.length) return undefined;
  if (lightContrast === null) return undefined;
  return [...valid].sort((a, b) => Math.abs((a.contrast ?? 0) - lightContrast) - Math.abs((b.contrast ?? 0) - lightContrast))[0].l;
}

/** High Contrast aus dem Standard-Mode desselben Schemas (Spec 11, 3) */
function highContrastPick(ctx: Ctx, def: SlotDef, valid: Candidate[], baseL: number | undefined): number | undefined {
  if (!valid.length) return undefined;
  const has = (l: number | undefined) => l !== undefined && valid.some((c) => c.l === l);
  const values = ctx.scale.values;
  const byContrast = [...valid].sort((a, b) => (a.contrast ?? 0) - (b.contrast ?? 0));
  switch (def.kind) {
    case 'basic-surface':
      return has(baseL) ? baseL : undefined;
    case 'on':
      return byContrast.at(-1)!.l;
    case 'on-surface': {
      if (def.emphasis === 'base') return byContrast.at(-1)!.l;
      // eine Stufe mehr Kontrast als im Standard-Mode
      const i = byContrast.findIndex((c) => c.l === baseL);
      if (i < 0) return undefined;
      return byContrast[Math.min(i + 1, byContrast.length - 1)].l;
    }
    case 'surface': {
      if (def.emphasis !== 'base' || baseL === undefined) return has(baseL) ? baseL : undefined;
      // Base-Flächen rücken einen Step vom Zentrum weg
      const i = values.indexOf(baseL);
      const next = values[baseL > ctx.scale.center ? i - 1 : i + 1];
      return has(next) ? next : has(baseL) ? baseL : undefined;
    }
  }
}

function tintToken(ctx: Ctx, def: SlotDef, l: number, status: Status, messages: string[], cands: Candidate[]): Token {
  const pid = ctx.paletteOf(def.group)!;
  const tint = tintAt(ctx, pid, l)!;
  const refRgb = def.ref ? slotColor(ctx, def.ref) : null;
  return {
    id: def.id,
    path: def.path,
    cssVar: def.cssVar,
    group: def.group,
    kind: 'tint',
    paletteId: pid,
    l,
    tintName: tint.name,
    rgb: tint.rgb,
    alpha: 1,
    css: tint.hex,
    hex: tint.hex,
    status,
    messages,
    contrast:
      refRgb && def.ref
        ? {
            against: ctx.slots[def.ref]?.path ?? def.ref,
            apca: contrast(tint.rgb, refRgb, 'apca'),
            wcag: contrast(tint.rgb, refRgb, 'wcag'),
            min: def.min,
            max: def.max,
          }
        : undefined,
    candidates: cands,
    editable: !def.syncWith,
    syncedTo: def.syncWith,
  };
}

const rgbCss = (rgb: Rgb, alpha: number) => {
  const hex = toHex({ ...rgb, a: 1 });
  if (alpha >= 1) return hex;
  const to = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 255);
  return `rgb(${to(rgb.r)} ${to(rgb.g)} ${to(rgb.b)} / ${Math.round(alpha * 100)}%)`;
};

function fixedToken(id: string, path: string, rgb: Rgb, alpha: number, kind: Token['kind'], extra: Partial<Token> = {}): Token {
  return {
    id,
    path,
    cssVar: `--color-${id.replaceAll('/', '-')}`,
    kind,
    rgb,
    alpha,
    css: rgbCss(rgb, alpha),
    hex: toHex({ ...rgb, a: 1 }),
    status: 'ok',
    messages: [],
    editable: false,
    ...extra,
  };
}

interface ResolveInput {
  config: ThemeConfig;
  scale: Scale;
  slots: SlotDef[];
  tints: Record<Scheme, Record<string, Tint[]>>;
}

function resolveMode(input: ResolveInput, mode: Mode, results: Partial<Record<Mode, ModeResult>>): ModeResult {
  const { config, scale, slots } = input;
  const scheme = schemeOf(mode);
  const system = config.scale.system;
  const otherSystem: ContrastSystem = system === 'apca' ? 'wcag' : 'apca';
  const paletteOf = (g: GroupKey) => {
    const id = config.groups[g];
    return id && input.tints[scheme][id] ? id : null;
  };
  const slotMap = Object.fromEntries(slots.map((s) => [s.id, s]));
  const syncMembers: Record<string, SlotDef[]> = {};
  for (const s of slots) if (s.syncWith) (syncMembers[s.syncWith] ??= []).push(s);

  const ctx: Ctx = {
    mode,
    scheme,
    system,
    scale,
    out: scheme === 'light' ? 1 : -1,
    tints: input.tints[scheme],
    paletteOf,
    assigned: {},
    slots: slotMap,
    syncMembers,
    failed: new Set(),
  };

  const overrides = config.overrides[mode] ?? {};
  const lightResult = results.light;
  const baseResult = isHighContrast(mode) ? results[scheme] : undefined;
  const tokens: Token[] = [];

  for (const def of slots) {
    if (!paletteOf(def.group)) continue;
    if (def.syncWith) {
      // übernimmt den Tint der führenden Rolle
      const l = ctx.assigned[def.syncWith];
      if (l === undefined) continue;
      ctx.assigned[def.id] = l;
      const own = checkInPalette(ctx, { ...def, syncWith: undefined }, paletteOf(def.group)!, l);
      tokens.push(tintToken(ctx, def, l, own.reasons.length ? 'error' : 'ok', own.reasons, []));
      continue;
    }
    const cands = candidates(ctx, def);
    const valid = cands.filter((c) => c.valid);
    const messages: string[] = [];
    let status: Status = 'ok';
    let l: number | undefined;

    const manual = overrides[def.id];
    if (manual !== undefined) {
      if (valid.some((c) => c.l === manual)) {
        l = manual;
        status = 'override';
      } else if (valid.length) {
        // sanitize: nächster gültiger Tint
        l = [...valid].sort((a, b) => Math.abs(a.l - manual) - Math.abs(b.l - manual))[0].l;
        status = 'adjusted';
        messages.push(`Gewählter Tint ${manual} ist ungültig, ersetzt durch ${l}.`);
      }
    }
    if (l === undefined) {
      if (baseResult) l = highContrastPick(ctx, def, valid, baseResult.byId[def.id]?.l);
      else if (mode === 'dark' && lightResult && def.kind !== 'basic-surface') {
        const lt = lightResult.byId[def.id];
        const lc = lt?.contrast ? lt.contrast[system] : null;
        l = mirrorPick(def, valid, lc);
      }
      l ??= defaultPick(ctx, def, valid);
    }
    if (l === undefined) {
      // nichts gültig: bestmöglicher Wert mit Fehler
      const fallback = [...cands].sort((a, b) => a.reasons.length - b.reasons.length || Math.abs(a.l - scale.center) - Math.abs(b.l - scale.center))[0];
      if (!fallback) continue;
      l = fallback.l;
      status = 'error';
      ctx.failed.add(def.id);
      messages.push(`Kein gültiger Tint: ${[...new Set(cands.flatMap((c) => c.reasons))].slice(0, 3).join(', ')}.`);
    }
    ctx.assigned[def.id] = l;
    const token = tintToken(ctx, def, l, status, messages, cands);

    // Zusatzprüfung im jeweils anderen System (z. B. WCAG AA im APCA-Modus, Spec 04, 6)
    if (config.options.checkBoth && token.contrast && def.min) {
      const v = token.contrast[otherSystem];
      if (!meetsMin(v, def.min, otherSystem)) {
        token.messages.push(`${otherSystem.toUpperCase()}: ${PRESETS[def.min].label} nicht erfüllt.`);
        if (token.status === 'ok' || token.status === 'override') token.status = 'warning';
      }
    }
    // Regel 6: Subtle-Flächen mit gleichem L wie eine Surface-Stufe
    if (def.kind === 'surface' && def.emphasis === 'subtle') {
      const same = ['subtle', 'base', 'bold'].find((e) => ctx.assigned[`surface/default/${e}`] === l);
      if (same) {
        token.messages.push(`Gleiche Lightness wie Surface/Default/${same[0].toUpperCase() + same.slice(1)}: verschwindet dort fast.`);
        if (token.status === 'ok') token.status = 'warning';
      }
    }
    tokens.push(token);
  }

  const byId: Record<string, Token> = Object.fromEntries(tokens.map((t) => [t.id, t]));
  const bg = byId['surface/default/base']?.rgb ?? (scheme === 'light' ? WHITE : BLACK);
  const op = config.options.opacity[scheme];
  const add = (t: Token) => {
    tokens.push(t);
    byId[t.id] = t;
  };

  // Hover und Pressed gefüllter Elemente: berechnet (Spec 04, 4)
  for (const def of slots) {
    if (def.kind !== 'surface' || def.emphasis === 'subtle') continue;
    const t = byId[def.id];
    const on = byId[`on-${def.role}/default/${def.emphasis}`];
    if (!t || t.l === undefined) continue;
    const tint = tintAt(ctx, t.paletteId!, t.l)!;
    for (const [state, delta] of [['hovered', config.options.hoverDelta], ['pressed', config.options.pressedDelta]] as const) {
      const dir = t.l > config.options.hoverThreshold ? -1 : 1;
      const l2 = Math.max(0, Math.min(100, t.l + dir * delta));
      const oklch = { l: l2 / 100, c: tint.c, h: tint.h };
      const rgb = oklchToRgb(oklch);
      const tok = fixedToken(`${def.id}-${state}`, `${def.path}/${state === 'hovered' ? 'Hovered' : 'Pressed'}`, rgb, 1, 'derived', {
        cssVar: `${def.cssVar}-${state}`,
        group: def.group,
        l: l2,
        css: toHex(rgb),
      });
      tok.messages.push(`${formatOklch(oklch)} · L ${dir < 0 ? '−' : '+'}${delta}`);
      if (on) {
        const a = contrast(on.rgb, rgb, 'apca');
        const w = contrast(on.rgb, rgb, 'wcag');
        tok.contrast = { against: on.path, apca: a, wcag: w, min: 'body' };
        if (!meetsMin(system === 'apca' ? a : w, 'body', system)) {
          tok.status = 'warning';
          tok.messages.push(`On-Farbe erreicht hier nur ${system === 'apca' ? `Lc ${Math.round(a)}` : `${w.toFixed(2)}:1`}.`);
        }
      }
      add(tok);
    }
  }

  // Outlines: nur Palette wählbar, Tint automatisch (Spec 05, 7)
  const neutral = paletteOf('neutral');
  if (neutral) {
    const values = scale.values;
    const ci = scale.centerIndex;
    // Richtung Schrift: im Light Mode dunkler, im Dark Mode heller
    const toward = (k: number) => values[Math.max(0, Math.min(values.length - 1, ci + (scheme === 'light' ? k : -k)))];
    const hc = isHighContrast(mode);
    const at = (l: number) => tintAt(ctx, neutral, l)!;
    const centerT = at(scale.center);
    const outline = (e: string, tint: Tint, alpha: number, min: PresetKey | null) => {
      const shown = alpha < 1 ? composite(tint.rgb, alpha, bg) : tint.rgb;
      const tok = fixedToken(`outline/default/${e}`, `Basic/Outline/Default/${e[0].toUpperCase() + e.slice(1)}`, tint.rgb, alpha, 'tint', {
        group: 'neutral',
        paletteId: neutral,
        l: tint.l,
        tintName: tint.name,
      });
      tok.contrast = {
        against: 'Basic/Surface/Default/Base',
        apca: contrast(shown, bg, 'apca'),
        wcag: contrast(shown, bg, 'wcag'),
        min: min ?? undefined,
      };
      if (min && !meetsMin(tok.contrast[system], min, system)) {
        tok.status = 'warning';
        tok.messages.push(`unter ${PRESETS[min].label}`);
      }
      if (min && config.options.checkBoth && !meetsMin(tok.contrast[otherSystem], min, otherSystem)) {
        tok.messages.push(`${otherSystem.toUpperCase()}: ${PRESETS[min].label} nicht erfüllt.`);
        if (tok.status === 'ok') tok.status = 'warning';
      }
      add(tok);
    };
    if (!hc) {
      outline('bold', at(toward(1)), 1, 'nonText');
      outline('base', centerT, 1, 'prominent');
      outline('subtle', centerT, op.outlineSubtle, 'subtle');
      outline('subtler', centerT, op.outlineSubtler, null);
    } else {
      // High Contrast: eine Stufe stärker und deckend
      outline('bold', at(toward(2)), 1, 'nonText');
      outline('base', at(toward(1)), 1, 'prominent');
      outline('subtle', centerT, 1, 'subtle');
      outline('subtler', centerT, op.outlineSubtle, null);
    }

    // Shadow: dunkelster Tint, Stärke über Opacity
    const darkest = at(values.at(-1)!);
    add(fixedToken('shadow/default/base', 'Effects/Shadow/Default/Base', darkest.rgb, op.shadow, 'overlay', { paletteId: neutral, l: darkest.l, tintName: darkest.name }));
  }

  // Interaction: Overlays für ungefüllte Elemente (schreibgeschützt)
  for (const polarity of ['default', 'inverted'] as const) {
    const on = byId[`on-surface/${polarity}/base`];
    if (!on) continue;
    const P = polarity[0].toUpperCase() + polarity.slice(1);
    add(fixedToken(`hovered/${polarity}/base`, `Interaction/Hovered/${P}/Base`, on.rgb, op.hovered, 'overlay'));
    add(fixedToken(`pressed/${polarity}/base`, `Interaction/Pressed/${P}/Base`, on.rgb, op.pressed, 'overlay'));
  }

  // Fokusring: außen schwarz oder Tint mit höchstem Chroma ≥ Non-Text, innen weiß.
  // Gilt in allen Modes gleich und wird gegen die helle Default-Fläche geprüft.
  {
    let outer = BLACK;
    let extra: Partial<Token> = {};
    const msgs: string[] = [];
    if (config.focus && input.tints.light[config.focus]) {
      const lightBg = results.light?.byId['surface/default/base']?.rgb ?? bg;
      const pool = input.tints.light[config.focus].filter((t) => meetsMin(contrast(t.rgb, lightBg, system), 'nonText', system));
      const best = [...pool].sort((a, b) => b.cMapped - a.cMapped)[0];
      if (best) {
        outer = best.rgb;
        extra = { paletteId: config.focus, l: best.l, tintName: best.name };
      } else msgs.push('Kein Tint der Palette erreicht Non-Text, Schwarz verwendet.');
    }
    const focus = fixedToken('focused/default/base', 'Interaction/Focused/Default/Base', outer, 1, 'fixed', extra);
    focus.messages.push(...msgs);
    add(focus);
    add(fixedToken('focused/default/inner', 'Interaction/Focused/Default/Inner', WHITE, 1, 'fixed'));
  }

  add(fixedToken('scrim/default/base', 'Effects/Scrim/Default/Base', BLACK, op.scrim, 'overlay'));

  return { mode, tokens, byId };
}

/** Normalisiert eine (z. B. aus localStorage geladene) Konfiguration */
export function withDefaults(config: Partial<ThemeConfig> & Pick<ThemeConfig, 'scale' | 'palettes'>): ThemeConfig {
  return {
    groups: {},
    focus: null,
    overrides: {},
    ...config,
    scale: normalizeScale(config.scale),
    options: {
      ...DEFAULT_OPTIONS,
      ...config.options,
      opacity: {
        light: { ...DEFAULT_OPTIONS.opacity.light, ...config.options?.opacity?.light },
        dark: { ...DEFAULT_OPTIONS.opacity.dark, ...config.options?.opacity?.dark },
      },
    },
  };
}

/** Berechnet alle vier Modes. Reihenfolge: Light → Dark (gespiegelt) → Light HC → Dark HC. */
export function buildTheme(input: Partial<ThemeConfig> & Pick<ThemeConfig, 'scale' | 'palettes'>): ThemeResult {
  const config = withDefaults(input);
  const scale = lightnessScale(config.scale);
  const slots = buildSlots(config.options);
  const factor = config.options.darkChromaFactor;
  const tints: Record<Scheme, Record<string, Tint[]>> = { light: {}, dark: {} };
  for (const p of config.palettes) {
    tints.light[p.id] = generatePalette(p, scale);
    tints.dark[p.id] = factor === 1 ? tints.light[p.id] : generatePalette(p, scale, { chromaFactor: factor, chromaFactorFrom: scale.center });
  }

  const results: Partial<Record<Mode, ModeResult>> = {};
  for (const mode of MODES) results[mode] = resolveMode({ config, scale, slots, tints }, mode, results);

  const warnings: string[] = [];
  const pal = (g: GroupKey) => config.palettes.find((p) => p.id === config.groups[g]);
  const error = pal('error');
  if (error) {
    for (const g of ['brand', 'action', 'signal', 'neutral', 'warning', 'success', 'information'] as GroupKey[]) {
      if (config.groups[g] === error.id) warnings.push(`Die Error-Palette darf nicht von ${g} genutzt werden.`);
    }
    for (const g of ['brand', 'action'] as GroupKey[]) {
      const p = pal(g);
      if (p && p.id !== error.id && hueDistance(p.hue, error.hue) < 20) warnings.push(`${g === 'brand' ? 'Brand' : 'Action'} liegt im Hue weniger als 20° von Error entfernt.`);
    }
  }
  for (const g of ['neutral'] as GroupKey[]) {
    const p = pal(g);
    if (p && p.type !== 'neutral') warnings.push('Basic-Rollen sollten eine Neutral-Palette nutzen.');
  }

  return { scale, slots, modes: results as Record<Mode, ModeResult>, warnings };
}
