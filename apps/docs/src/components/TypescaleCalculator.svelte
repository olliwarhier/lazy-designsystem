<script>
  // Live-Version der Typescale-Berechnung. Rechnet mit @lazy-designsystem/core –
  // derselben Logik wie das Plugin „Lazy Typescale & Spacing“.
  import { SCALE_RATIOS, typescale, fluid } from '@lazy-designsystem/core';

  /** @type {{ baseScale: number[], viewport: { mobile: number, desktop: number } }} */
  let { baseScale, viewport } = $props();

  let rootDesktop = $state(18);
  let ratioDesktop = $state('Major Third');
  let rootMobile = $state(16);
  let ratioMobile = $state('Major Second');

  const desktop = $derived(typescale(rootDesktop, SCALE_RATIOS[ratioDesktop], baseScale));
  const mobile = $derived(typescale(rootMobile, SCALE_RATIOS[ratioMobile], baseScale));
  const groups = ['display', 'heading', 'body'];
  const round = (n) => Math.round(n * 10) / 10;
</script>

<div class="calc not-content">
  <div class="controls">
    <fieldset>
      <legend>Desktop</legend>
      <label><span>Root (px)</span><input type="number" min="8" max="64" bind:value={rootDesktop} /></label>
      <label>
        <span>Skala</span>
        <select bind:value={ratioDesktop}>
          {#each Object.entries(SCALE_RATIOS) as [name, r]}<option value={name}>{name} ({r})</option>{/each}
        </select>
      </label>
    </fieldset>
    <fieldset>
      <legend>Mobile</legend>
      <label><span>Root (px)</span><input type="number" min="8" max="64" bind:value={rootMobile} /></label>
      <label>
        <span>Skala</span>
        <select bind:value={ratioMobile}>
          {#each Object.entries(SCALE_RATIOS) as [name, r]}<option value={name}>{name} ({r})</option>{/each}
        </select>
      </label>
    </fieldset>
  </div>

  <table>
    <thead>
      <tr><th>Stil</th><th>Stufe</th><th>Desktop</th><th>Mobile</th><th>Vorschau (Desktop)</th></tr>
    </thead>
    <tbody>
      {#each groups as group}
        {#each Object.entries(desktop.styles[group]).reverse() as [slot, d]}
          {@const m = mobile.styles[group][slot]}
          <tr>
            <td><code>{group}-{slot}</code></td>
            <td>{d.step}</td>
            <td>{d.px} px <small>({round(d.exact)})</small></td>
            <td>{m.px} px <small>({round(m.exact)})</small></td>
            <td class="sample" style="font-size:{d.px}px" title={fluid(m.px, d.px, viewport.mobile, viewport.desktop)}>Aa</td>
          </tr>
        {/each}
      {/each}
    </tbody>
  </table>
  <p class="hint">In Klammern der rechnerische Wert vor dem Einrasten auf die Base-Scale. Im CSS wird zwischen Mobile ({viewport.mobile} px) und Desktop ({viewport.desktop} px) fließend interpoliert.</p>
</div>

<style>
  .calc {
    display: grid;
    gap: 1rem;
    margin-block: 1.5rem;
    padding: 1.25rem;
    border: 1px solid var(--sl-color-gray-5);
    border-radius: 0.5rem;
    font-size: 0.8125rem;
  }
  .controls {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
  }
  fieldset {
    display: flex;
    gap: 0.75rem;
    border: 1px solid var(--sl-color-gray-5);
    border-radius: 0.375rem;
    padding: 0.5rem 0.75rem 0.75rem;
  }
  legend {
    padding-inline: 0.25rem;
    color: var(--sl-color-gray-2);
  }
  label {
    display: grid;
    gap: 0.25rem;
  }
  label span {
    color: var(--sl-color-gray-3);
  }
  input,
  select {
    font: inherit;
    padding: 0.25rem;
    background: var(--sl-color-bg);
    color: var(--sl-color-text);
    border: 1px solid var(--sl-color-gray-5);
    border-radius: 0.25rem;
  }
  input {
    width: 4.5rem;
  }
  table {
    width: 100%;
    border-collapse: collapse;
  }
  th,
  td {
    text-align: left;
    padding: 0.375rem 0.5rem;
    border-bottom: 1px solid var(--sl-color-gray-6);
    vertical-align: middle;
  }
  small {
    color: var(--sl-color-gray-3);
  }
  .sample {
    line-height: 1;
    white-space: nowrap;
  }
  .hint {
    margin: 0;
    color: var(--sl-color-gray-3);
  }
</style>
