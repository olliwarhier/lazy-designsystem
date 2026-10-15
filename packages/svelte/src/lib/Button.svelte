<script>
  /**
   * Button – löst eine Aktion aus.
   * Figma: Components/Button · Spezifikation: Doku → Komponenten → Button
   *
   * @typedef {Object} Props
   * @property {'filled' | 'outlined' | 'text'} [variant='filled'] Figma: Type
   * @property {import('./size.js').Size} [size] Small, Medium, Large – sonst vom umgebenden Bereich
   * @property {'auto' | 'darker' | 'lighter'} [interaction='auto'] Figma: Interaction – Hover dunkler oder heller; auto richtet sich nach der Helligkeit der Fläche
   * @property {boolean} [disabled=false]
   * @property {'button' | 'submit' | 'reset'} [type='button']
   * @property {import('svelte').Snippet} [leading] Icon vor dem Label
   * @property {import('svelte').Snippet} [trailing] Icon nach dem Label
   * @property {import('svelte').Snippet} [children] Label
   */
  import { resolveSize } from './size.js';

  /** @type {Props & import('svelte/elements').HTMLButtonAttributes} */
  let {
    variant = 'filled',
    size,
    interaction = 'auto',
    disabled = false,
    type = 'button',
    leading,
    trailing,
    children,
    ...rest
  } = $props();

  const currentSize = $derived(resolveSize(size));
</script>

<button
  {...rest}
  {type}
  {disabled}
  class="lazy-button"
  data-variant={variant}
  data-size={currentSize}
  data-interaction={interaction === 'auto' ? undefined : interaction}
>
  {#if leading}<span class="icon">{@render leading()}</span>{/if}
  {@render children?.()}
  {#if trailing}<span class="icon">{@render trailing()}</span>{/if}
</button>

<style>
  .lazy-button {
    /* Components/Button – Medium */
    --button-gap: var(--spacing-dynamic-2xsmall);
    --button-padding-y: var(--spacing-dynamic-xsmall);
    --button-padding-x: var(--spacing-dynamic-small);
    --button-icon-size: var(--sizing-icon-medium);
    --button-font-size: var(--typescale-body-medium-size);
    --button-content-min-height: var(--sizing-icon-medium);

    --button-height: calc(var(--button-content-min-height) + 2 * var(--button-padding-y));
    --button-background: var(--color-action-default-base);
    --button-foreground: var(--color-on-action-default-base);
    --button-border: transparent;
    /* nur für Varianten ohne Fläche */
    --button-hovered: var(--color-hovered-default-base);
    --button-pressed: var(--color-pressed-default-base);

    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--button-gap);
    min-height: var(--button-height);
    padding: var(--button-padding-y) var(--button-padding-x);
    border: var(--base-border-width-xsmall) solid var(--button-border);
    border-radius: calc(var(--shape) * var(--button-height) / 2);
    background-color: var(--button-background);
    color: var(--button-foreground);
    font-family: var(--typescale-body-medium-family);
    font-size: var(--button-font-size);
    font-weight: var(--typescale-body-medium-bold-weight);
    line-height: 1;
    cursor: pointer;
    transition: border-radius 120ms ease;
  }

  .lazy-button[data-size='large'] {
    --button-gap: var(--spacing-dynamic-xsmall);
    --button-padding-y: var(--spacing-dynamic-small);
    --button-padding-x: var(--spacing-dynamic-medium);
    --button-icon-size: var(--sizing-icon-large);
    --button-font-size: var(--typescale-body-large-size);
    --button-content-min-height: var(--sizing-icon-large);
  }

  .lazy-button[data-size='small'] {
    --button-gap: var(--spacing-static-3xsmall);
    --button-padding-y: var(--spacing-static-2xsmall);
    --button-padding-x: var(--spacing-dynamic-xsmall);
    --button-icon-size: var(--sizing-icon-small);
    --button-font-size: var(--typescale-body-small-size);
    --button-content-min-height: var(--sizing-icon-small);
  }

  .lazy-button[data-variant='outlined'] {
    --button-background: transparent;
    --button-foreground: var(--color-on-surface-default-base);
    --button-border: var(--color-outline-default-base);
  }

  .lazy-button[data-variant='text'] {
    --button-background: transparent;
    --button-foreground: var(--color-on-surface-default-action);
  }

  .lazy-button[data-interaction='lighter'] {
    --button-hovered: var(--color-hovered-inverted-base);
    --button-pressed: var(--color-pressed-inverted-base);
  }

  /* Mit Fläche: Lightness der Fläche verschieben (Doku → Tokens → Farbformate) */
  .lazy-button:hover:not(:disabled) {
    background-color: oklch(from var(--button-background) var(--interaction-hovered-l) c h);
  }

  .lazy-button:active:not(:disabled) {
    background-color: oklch(from var(--button-background) var(--interaction-pressed-l) c h);
  }

  /* Ohne Fläche: halbtransparente Interaction-Farbe */
  .lazy-button:is([data-variant='outlined'], [data-variant='text']):hover:not(:disabled) {
    background-color: var(--button-hovered);
  }

  .lazy-button:is([data-variant='outlined'], [data-variant='text']):active:not(:disabled) {
    background-color: var(--button-pressed);
  }

  .lazy-button:focus-visible {
    outline: var(--base-border-width-focus) solid var(--color-focused-default-base);
    outline-offset: var(--base-border-width-focus);
  }

  .lazy-button:disabled {
    opacity: var(--color-disabled-opacity);
    cursor: not-allowed;
  }

  .icon {
    display: inline-grid;
    place-items: center;
    width: var(--button-icon-size);
    height: var(--button-icon-size);
    font-size: var(--button-icon-size);
  }
</style>
