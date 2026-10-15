<script>
  // Live-Demo des Shape-Reglers. Die Formeln entsprechen der Spezifikation
  // auf der Seite „Shape“ – Werte hier bewusst ohne Tokens, damit die Demo
  // unabhängig vom Projekt-Theme funktioniert.
  const presets = [
    { name: 'Square', value: 0 },
    { name: 'Rounded-Subtle', value: 0.25 },
    { name: 'Rounded-Medium', value: 0.5 },
    { name: 'Rounded-Bold', value: 0.75 },
    { name: 'Pill', value: 1 },
  ];

  let shape = $state(0.5);

  const CONTAINER_MAX = 24;
  const MARK_MAX = 8;
  const CARD_PADDING = 12;

  const control = (height) => (shape * height) / 2;
  const container = $derived(shape * CONTAINER_MAX);
  const mark = $derived(shape * MARK_MAX);
  const nested = $derived(Math.max(0, container - CARD_PADDING));
  const fmt = (n) => `${Math.round(n * 10) / 10}px`;
</script>

<div class="shape-demo not-content" style="--shape: {shape}">
  <div class="controls">
    <label>
      <span><code>--shape</code>: {shape.toFixed(2)}</span>
      <input type="range" min="0" max="1" step="0.01" bind:value={shape} />
    </label>
    <div class="presets" role="group" aria-label="Figma-Modi">
      {#each presets as p}
        <button type="button" class:active={shape === p.value} onclick={() => (shape = p.value)}>
          {p.name}
        </button>
      {/each}
    </div>
  </div>

  <div class="stage">
    <div class="col">
      <span class="label">Controls</span>
      <span class="btn" style="border-radius: {fmt(control(40))}">Button</span>
      <span class="chip" style="border-radius: {fmt(control(32))}">Chip</span>
      <span class="field" style="border-radius: {fmt(control(48))}">Text-Field</span>
      <small>{fmt(control(40))} bei 40px Höhe</small>
    </div>

    <div class="col">
      <span class="label">Marker</span>
      <span class="row">
        <span class="checkbox" style="border-radius: {fmt(mark)}">✓</span>
        <span class="radio"></span>
      </span>
      <small>Checkbox {fmt(mark)} – bleibt von Radio unterscheidbar</small>
    </div>

    <div class="col wide">
      <span class="label">Container</span>
      <div class="card" style="border-radius: {fmt(container)}">
        <div class="inner" style="border-radius: {fmt(nested)}">Verschachtelt: {fmt(nested)}</div>
        <span class="btn small" style="border-radius: {fmt(control(32))}">Aktion</span>
      </div>
      <small>Card {fmt(container)} · innen = außen − Padding</small>
    </div>
  </div>
</div>

<style>
  .shape-demo {
    margin-block: 1.5rem;
    padding: 1.5rem;
    border: 1px solid var(--sl-color-gray-5);
    border-radius: 0.5rem;
    background: var(--sl-color-bg);
    display: grid;
    gap: 1.5rem;
    font-size: 0.875rem;
  }
  .controls {
    display: grid;
    gap: 0.75rem;
  }
  label {
    display: grid;
    gap: 0.25rem;
  }
  input[type='range'] {
    width: 100%;
    accent-color: var(--sl-color-accent);
  }
  .presets {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
  }
  .presets button {
    font: inherit;
    font-size: 0.75rem;
    padding: 0.25rem 0.625rem;
    border-radius: 999px;
    border: 1px solid var(--sl-color-gray-5);
    background: transparent;
    color: var(--sl-color-text);
    cursor: pointer;
  }
  .presets button.active {
    background: var(--sl-color-accent);
    border-color: var(--sl-color-accent);
    color: var(--sl-color-black);
  }
  .stage {
    display: flex;
    flex-wrap: wrap;
    gap: 2rem;
    align-items: flex-start;
  }
  .col {
    display: grid;
    gap: 0.5rem;
    justify-items: start;
  }
  .col.wide {
    flex: 1 1 14rem;
  }
  .label {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--sl-color-gray-3);
  }
  small {
    color: var(--sl-color-gray-3);
  }
  .btn,
  .chip,
  .field,
  .checkbox,
  .radio,
  .card,
  .inner {
    transition: border-radius 120ms ease;
  }
  .btn {
    display: inline-flex;
    align-items: center;
    height: 40px;
    padding: 0 1.25rem;
    background: var(--sl-color-accent);
    color: var(--sl-color-black);
    font-weight: 600;
  }
  .btn.small {
    height: 32px;
    padding: 0 0.875rem;
    justify-self: end;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    height: 32px;
    padding: 0 0.875rem;
    border: 1px solid var(--sl-color-gray-4);
  }
  .field {
    display: inline-flex;
    align-items: center;
    height: 48px;
    width: 12rem;
    padding: 0 1rem;
    border: 1px solid var(--sl-color-gray-4);
    color: var(--sl-color-gray-3);
  }
  .row {
    display: flex;
    gap: 0.75rem;
    align-items: center;
  }
  .checkbox {
    display: grid;
    place-items: center;
    width: 20px;
    height: 20px;
    background: var(--sl-color-accent);
    color: var(--sl-color-black);
    font-size: 0.75rem;
  }
  .radio {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 2px solid var(--sl-color-gray-3);
  }
  .card {
    display: grid;
    gap: 12px;
    padding: 12px;
    width: 100%;
    max-width: 20rem;
    background: var(--sl-color-gray-6);
    border: 1px solid var(--sl-color-gray-5);
  }
  .inner {
    padding: 1.5rem 1rem;
    background: var(--sl-color-gray-5);
  }
</style>
