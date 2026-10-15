<script>
  /**
   * Setzt die Größe (Small, Medium, Large) für alle enthaltenen Komponenten.
   * @typedef {Object} Props
   * @property {import('./size.js').Size} size
   * @property {import('svelte').Snippet} children
   */
  import { provideSize } from './size.js';

  /** @type {Props} */
  let { size, children } = $props();
  provideSize(() => size);
</script>

{@render children()}
