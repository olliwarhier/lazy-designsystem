// Typen für @lazy-designsystem/core (JavaScript mit JSDoc, ohne eigene .d.ts).
declare module '@lazy-designsystem/core' {
  export interface Rgb { r: number; g: number; b: number; a?: number }
  export interface Oklch { l: number; c: number; h: number; a?: number }
  export function parseHex(hex: string): Rgb;
  export function toHex(rgb: Rgb): string;
  export function rgbToOklch(rgb: Rgb): Oklch;
  export function oklchToRgb(oklch: Oklch): Rgb;
  export function formatOklch(oklch: Oklch): string;
  export function apca(text: Rgb, background: Rgb): number;
  export function wcag(a: Rgb, b: Rgb): number;
}
