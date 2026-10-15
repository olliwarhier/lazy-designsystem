<script>
  /**
   * Button – löst eine Aktion aus.
   * Spezifikation: https://olliwarhier.github.io/lazy-designsystem/komponenten/button/
   *
   * @typedef {Object} Props
   * @property {'primary' | 'secondary' | 'ghost'} [variant='primary'] Visuelle Gewichtung der Aktion
   * @property {'sm' | 'md' | 'lg'} [size='md'] Größe
   * @property {boolean} [disabled=false] Deaktiviert den Button
   * @property {'button' | 'submit' | 'reset'} [type='button'] Natives button-type-Attribut
   * @property {import('svelte').Snippet} [children] Beschriftung
   */

  /** @type {Props & import('svelte/elements').HTMLButtonAttributes} */
  let {
    variant = 'primary',
    size = 'md',
    disabled = false,
    type = 'button',
    children,
    ...rest
  } = $props();
</script>

<button
  {...rest}
  {type}
  {disabled}
  class="lazy-button lazy-button--{variant} lazy-button--{size}"
>
  {@render children?.()}
</button>

<style>
  .lazy-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--lazy-space-2);
    border: 1px solid transparent;
    border-radius: var(--lazy-radius-md);
    font-family: var(--lazy-font-family-base);
    font-weight: var(--lazy-font-weight-medium);
    line-height: var(--lazy-font-line-height-tight);
    cursor: pointer;
    transition: background-color 120ms ease, border-color 120ms ease;
  }

  .lazy-button:focus-visible {
    outline: 2px solid var(--lazy-color-focus-ring);
    outline-offset: 2px;
  }

  .lazy-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Größen */
  .lazy-button--sm {
    padding: var(--lazy-space-1) var(--lazy-space-3);
    font-size: var(--lazy-font-size-sm);
  }
  .lazy-button--md {
    padding: var(--lazy-space-2) var(--lazy-space-4);
    font-size: var(--lazy-font-size-md);
  }
  .lazy-button--lg {
    padding: var(--lazy-space-3) var(--lazy-space-6);
    font-size: var(--lazy-font-size-lg);
  }

  /* Varianten */
  .lazy-button--primary {
    background: var(--lazy-color-action-primary-default);
    color: var(--lazy-color-text-on-action);
  }
  .lazy-button--primary:hover:not(:disabled) {
    background: var(--lazy-color-action-primary-hover);
  }

  .lazy-button--secondary {
    background: var(--lazy-color-action-secondary-default);
    color: var(--lazy-color-text-default);
    border-color: var(--lazy-color-border-default);
  }
  .lazy-button--secondary:hover:not(:disabled) {
    background: var(--lazy-color-action-secondary-hover);
  }

  .lazy-button--ghost {
    background: transparent;
    color: var(--lazy-color-action-primary-default);
  }
  .lazy-button--ghost:hover:not(:disabled) {
    background: var(--lazy-color-bg-subtle);
  }
</style>
