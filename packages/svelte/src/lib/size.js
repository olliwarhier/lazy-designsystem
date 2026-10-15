import { getContext, setContext } from 'svelte';

/** @typedef {'small' | 'medium' | 'large'} Size */

const KEY = Symbol('lazy-size');

/**
 * Gibt eine Größe an alle Komponenten darunter weiter – wie ein Figma-Modus
 * der Components-Collection auf einem Frame. Eine Angabe an der Komponente gewinnt.
 * @param {() => Size} size
 */
export const provideSize = (size) => setContext(KEY, size);

/**
 * Größe einer Komponente: eigene Angabe, sonst die des umgebenden Bereichs, sonst Medium.
 * @param {Size | undefined} own
 * @returns {Size}
 */
export const resolveSize = (own) => own ?? getContext(KEY)?.() ?? 'medium';
