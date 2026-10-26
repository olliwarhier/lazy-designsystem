// Farbrollen nach Spezifikation 04 und Presets nach 05, Abschnitt 4.
import type { PresetKey } from './contrast.js';

export type Mode = 'light' | 'dark' | 'light-hc' | 'dark-hc';
export const MODES: Mode[] = ['light', 'dark', 'light-hc', 'dark-hc'];
export const MODE_LABEL: Record<Mode, string> = {
  light: 'Light',
  dark: 'Dark',
  'light-hc': 'Light HC',
  'dark-hc': 'Dark HC',
};
export type Scheme = 'light' | 'dark';
export const schemeOf = (m: Mode): Scheme => (m.startsWith('dark') ? 'dark' : 'light');
export const isHighContrast = (m: Mode) => m.endsWith('-hc');
/** Standard-Mode desselben Schemas (Basis für High Contrast) */
export const baseModeOf = (m: Mode): Mode => schemeOf(m);

/** Rollengruppen: Einheit für die Palettenzuweisung (Spec 11, 8.1) */
export type GroupKey = 'neutral' | 'brand' | 'action' | 'signal' | 'error' | 'warning' | 'success' | 'information';

export const GROUP_LABEL: Record<GroupKey, string> = {
  neutral: 'Basic (Surface, On-Surface, Outline)',
  brand: 'Brand',
  action: 'Action',
  signal: 'Signal',
  error: 'Error',
  warning: 'Warning',
  success: 'Success',
  information: 'Information',
};

export type Emphasis = 'subtler' | 'subtle' | 'base' | 'bold';
export type Category = 'basic' | 'corporate' | 'feedback';
export type SlotKind = 'basic-surface' | 'on-surface' | 'surface' | 'on';

export interface SlotDef {
  /** z. B. „action/default/bold", „on-action/default/bold" */
  id: string;
  /** Figma-Pfad: Category/(On-)Role/Polarity/Emphasis */
  path: string;
  cssVar: string;
  kind: SlotKind;
  category: Category;
  group: GroupKey;
  role: string;
  polarity: 'default' | 'inverted';
  emphasis: Emphasis;
  min?: PresetKey;
  max?: PresetKey;
  /** Slot, gegen den geprüft wird (Spec 05, Abschnitt 3) */
  ref?: string;
  /** nächst stärkere Stufe: deren Kontrast ist Obergrenze (Kontrast-Leiter) */
  stronger?: string;
  /** Flächen-Rolle ↔ On-Rolle */
  pair?: string;
  /** synchron geführte Feedback-Rolle: übernimmt die Tints dieser Rolle */
  syncWith?: string;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const SURFACE_BASE = 'surface/default/base';

function slot(
  kind: SlotKind,
  category: Category,
  group: GroupKey,
  role: string,
  on: boolean,
  polarity: 'default' | 'inverted',
  emphasis: Emphasis,
  rest: Partial<SlotDef> = {},
): SlotDef {
  const roleName = on ? `on-${role}` : role;
  const id = `${roleName}/${polarity}/${emphasis}`;
  return {
    id,
    path: `${cap(category)}/${roleName.split('-').map(cap).join('-')}/${cap(polarity)}/${cap(emphasis)}`,
    cssVar: `--color-${roleName}-${polarity}-${emphasis}`,
    kind,
    category,
    group,
    role,
    polarity,
    emphasis,
    ...rest,
  };
}

export interface RoleOptions {
  signal: boolean;
  information: boolean;
  /** Warning eigenständig statt synchron mit Error/Success/Information */
  warningDecoupled: boolean;
  /**
   * Mindestkontrast der On-Rolle auf Base-Flächen. Spec 05: Body.
   * Zum Testen auch Large, weil zwischen Prominent Division und Body bei APCA kaum ein Tint ein Body-Paar hat.
   */
  onBasePreset?: PresetKey;
}

/** Alle Slots mit Tint-Auswahl, in Auswertungsreihenfolge (stärkere Stufe vor schwächerer) */
export function buildSlots(o: RoleOptions): SlotDef[] {
  const s: SlotDef[] = [];
  // Basic: Surface (Subtle = äußerster Tint, Bold = innerer)
  for (const polarity of ['default', 'inverted'] as const) {
    for (const e of ['subtle', 'base', 'bold'] as const) {
      s.push(
        slot('basic-surface', 'basic', 'neutral', 'surface', false, polarity, e, {
          ...(polarity === 'inverted' && e === 'bold' ? { min: 'body' as const, ref: SURFACE_BASE } : {}),
          pair: `on-surface/${polarity}/base`,
        }),
      );
    }
  }
  // On-Surface: gegen die stärkste Surface-Stufe derselben Polarity (schlechtester Fall)
  for (const polarity of ['default', 'inverted'] as const) {
    const ref = `surface/${polarity}/bold`;
    s.push(slot('on-surface', 'basic', 'neutral', 'surface', true, polarity, 'base', { min: 'body', ref }));
    s.push(slot('on-surface', 'basic', 'neutral', 'surface', true, polarity, 'subtle', { min: 'large', ref, stronger: `on-surface/${polarity}/base` }));
    s.push(slot('on-surface', 'basic', 'neutral', 'surface', true, polarity, 'subtler', { min: 'large', ref, stronger: `on-surface/${polarity}/subtle` }));
  }

  const filled = (category: Category, group: GroupKey, emphases: Emphasis[], syncWith?: string) => {
    const role = group;
    const order = [...emphases].reverse(); // stärkste zuerst
    order.forEach((e, i) => {
      const range: Partial<SlotDef> =
        e === 'bold' ? { min: 'body' } : e === 'base' ? { min: 'prominent', max: 'body' } : { max: 'prominent' };
      s.push(
        slot('surface', category, group, role, false, 'default', e, {
          ...range,
          ref: SURFACE_BASE,
          stronger: i > 0 ? `${role}/default/${order[i - 1]}` : undefined,
          pair: `on-${role}/default/${e}`,
          syncWith: syncWith ? `${syncWith}/default/${e}` : undefined,
        }),
      );
    });
    for (const e of order) {
      s.push(
        slot('on', category, group, role, true, 'default', e, {
          min: e === 'base' ? (o.onBasePreset ?? 'body') : 'body',
          ref: `${role}/default/${e}`,
          pair: `${role}/default/${e}`,
          syncWith: syncWith ? `on-${syncWith}/default/${e}` : undefined,
        }),
      );
    }
  };

  filled('corporate', 'brand', ['subtle', 'base', 'bold']);
  filled('corporate', 'action', ['subtle', 'base', 'bold']);
  if (o.signal) filled('corporate', 'signal', ['subtle', 'base', 'bold']);
  filled('feedback', 'error', ['subtle', 'base']);
  filled('feedback', 'success', ['subtle', 'base'], 'error');
  if (o.information) filled('feedback', 'information', ['subtle', 'base'], 'error');
  filled('feedback', 'warning', ['subtle', 'base'], o.warningDecoupled ? undefined : 'error');
  return s;
}
