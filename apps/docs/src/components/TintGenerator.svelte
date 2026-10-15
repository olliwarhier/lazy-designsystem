<script>
  // Live-Version des Tint-Generators. Rechnet mit @lazy-designsystem/core –
  // derselben Logik wie das Plugin „Lazy Tints OKLCH“.
  import { generatePalette, apca, parseHex } from '@lazy-designsystem/core';

  let hue = $state(253);
  let chromaMax = $state(0.2);
  let chromaMin = $state(0.05);
  let harmonize = $state(true);
  let steps = $state(13);
  let distribution = $state('dynamic');
  let center = $state(70);

  const white = parseHex('#ffffff');
  const black = parseHex('#000000');

  const palette = $derived(
    generatePalette({ hue, chromaMax, chromaMin: Math.min(chromaMin, chromaMax), harmonize, steps, distribution, center }).map((t) => {
      const onWhite = Math.abs(apca(t.rgb, white));
      const onBlack = Math.abs(apca(t.rgb, black));
      return { ...t, text: onWhite > onBlack ? '#000000' : '#ffffff', lc: Math.round(Math.max(onWhite, onBlack)) };
    }),
  );
</script>

<div class="tint not-content">
  <div class="controls">
    <label>
      <span>Hue <output>{hue}°</output></span>
      <input type="range" min="0" max="360" bind:value={hue} style="--hue-track: linear-gradient(to right, {[0, 60, 120, 180, 240, 300, 360].map((h) => `oklch(0.7 0.15 ${h})`).join(',')})" class="hue" />
    </label>
    <label>
      <span>Chroma max <output>{chromaMax.toFixed(3)}</output></span>
      <input type="range" min="0" max="0.25" step="0.005" bind:value={chromaMax} />
    </label>
    <label>
      <span>Chroma min <output>{chromaMin.toFixed(3)}</output></span>
      <input type="range" min="0" max="0.25" step="0.005" bind:value={chromaMin} disabled={!harmonize} />
    </label>
    <label class="inline">
      <input type="checkbox" bind:checked={harmonize} />
      <span>Chroma harmonisieren</span>
    </label>
    <label>
      <span>Stufen</span>
      <select bind:value={steps}>
        {#each [7, 9, 11, 13, 15] as n}<option value={n}>{n}</option>{/each}
      </select>
    </label>
    <label>
      <span>Verteilung</span>
      <select bind:value={distribution}>
        <option value="even">Even</option>
        <option value="smooth">Smooth</option>
        <option value="dynamic">Dynamic</option>
      </select>
    </label>
    <label>
      <span>Zentrum</span>
      <select bind:value={center}>
        <option value={70}>70 (APCA)</option>
        <option value={60}>60 (WCAG)</option>
      </select>
    </label>
  </div>

  <div class="swatches">
    {#each palette as t}
      <div class="swatch" style="background:{t.hex}; color:{t.text}" title="{t.oklch} · {t.hex}">
        <strong>{t.name}</strong>
        <span>{t.hex}</span>
        <span>C {t.c.toFixed(3)}</span>
        <span>Lc {t.lc}</span>
      </div>
    {/each}
  </div>
</div>

<style>
  .tint {
    display: grid;
    gap: 1.25rem;
    margin-block: 1.5rem;
    padding: 1.25rem;
    border: 1px solid var(--sl-color-gray-5);
    border-radius: 0.5rem;
    font-size: 0.8125rem;
  }
  .controls {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
    gap: 0.75rem 1.25rem;
    align-items: end;
  }
  label {
    display: grid;
    gap: 0.25rem;
  }
  label span {
    display: flex;
    justify-content: space-between;
    color: var(--sl-color-gray-2);
  }
  label.inline {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }
  input[type='range'] {
    width: 100%;
    accent-color: var(--sl-color-accent);
  }
  input.hue {
    appearance: none;
    height: 0.5rem;
    border-radius: 999px;
    background: var(--hue-track);
  }
  select {
    font: inherit;
    padding: 0.25rem;
    background: var(--sl-color-bg);
    color: var(--sl-color-text);
    border: 1px solid var(--sl-color-gray-5);
    border-radius: 0.25rem;
  }
  .swatches {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(4.75rem, 1fr));
    gap: 0.25rem;
  }
  .swatch {
    display: grid;
    gap: 0.125rem;
    padding: 0.5rem;
    min-height: 5.5rem;
    border-radius: 0.25rem;
    font-size: 0.6875rem;
    line-height: 1.3;
  }
  .swatch strong {
    font-size: 0.875rem;
  }
</style>
