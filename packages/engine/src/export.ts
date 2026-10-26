// CSS-Export nach Spezifikation 11, Abschnitt 7: data-scheme, data-contrast, Media Queries.
import { MODES, schemeOf, type Mode } from './roles.js';
import type { ThemeResult } from './theme.js';

const block = (selector: string, lines: string[]) => `${selector} {\n${lines.map((l) => `  ${l}`).join('\n')}\n}`;

function declarations(theme: ThemeResult, mode: Mode, signalFallback: boolean): string[] {
  const lines = [`color-scheme: ${schemeOf(mode)};`];
  for (const t of theme.modes[mode].tokens) lines.push(`${t.cssVar}: ${t.css};`);
  if (signalFallback) {
    // Fallback-Kette Signal → Action
    for (const e of ['subtle', 'base', 'bold']) {
      lines.push(`--color-signal-default-${e}: var(--color-action-default-${e});`);
      lines.push(`--color-on-signal-default-${e}: var(--color-on-action-default-${e});`);
    }
  }
  return lines;
}

const SELECTOR: Record<Mode, string> = {
  light: ':root, [data-scheme="light"]',
  dark: '[data-scheme="dark"]',
  'light-hc': '[data-contrast="more"], [data-scheme="light"][data-contrast="more"]',
  'dark-hc': '[data-scheme="dark"][data-contrast="more"]',
};

/**
 * Erzeugt CSS-Variablen für alle Modes. Standard über Media Queries,
 * ein gesetztes data-scheme bzw. data-contrast überschreibt sie.
 */
export function toCss(theme: ThemeResult, { signal = true }: { signal?: boolean } = {}): string {
  const fallback = signal && !theme.slots.some((s) => s.group === 'signal');
  const parts: string[] = ['/* Lazy Design System – Farbrollen (Prototyp, generiert) */'];
  for (const mode of MODES) parts.push(block(SELECTOR[mode], declarations(theme, mode, fallback)));
  const media = (query: string, mode: Mode, selector: string) =>
    `@media ${query} {\n${block(selector, declarations(theme, mode, fallback)).replace(/^/gm, '  ')}\n}`;
  parts.push(media('(prefers-color-scheme: dark)', 'dark', ':root:not([data-scheme])'));
  parts.push(media('(prefers-contrast: more)', 'light-hc', ':root:not([data-scheme]):not([data-contrast])'));
  parts.push(
    media('(prefers-color-scheme: dark) and (prefers-contrast: more)', 'dark-hc', ':root:not([data-scheme]):not([data-contrast])'),
  );
  return parts.join('\n\n') + '\n';
}

/** Werte eines Modes als einfache Map cssVar → Wert (z. B. für Inline-Styles in Vorschauen) */
export function cssVars(theme: ThemeResult, mode: Mode): Record<string, string> {
  return Object.fromEntries(theme.modes[mode].tokens.map((t) => [t.cssVar, t.css]));
}
