<script lang="ts">
  // Prototyp Tint-Generator nach Spezifikation 02. Rechnet mit @lazy-designsystem/engine.
  import { CENTER, CHROMA_CAP, contrast, generatePalette, lightnessScale, maxChroma, type PaletteSettings } from '@lazy-designsystem/engine';
  import { defaultConfig, hueName, newId, replaceStudio, studio } from './store.svelte';
  import ChromaChart from './ChromaChart.svelte';
  import './tool.css';

  const WHITE = { r: 1, g: 1, b: 1 };
  const BLACK = { r: 0, g: 0, b: 0 };

  const scale = $derived(lightnessScale(studio.scale));
  const palettes = $derived(
    studio.palettes.map((p) => {
      const tints = generatePalette(p, scale).map((t) => {
        const w = contrast(t.rgb, WHITE, studio.scale.system);
        const k = contrast(t.rgb, BLACK, studio.scale.system);
        return { ...t, text: w > k ? '#fff' : '#000', vsWhite: w, vsBlack: k };
      });
      return { p, tints };
    }),
  );

  let copied = $state('');

  function addPalette() {
    const hue = Math.round(Math.random() * 360);
    studio.palettes.push({ id: newId(), name: hueName(hue), type: 'color', hue, chromaMax: 0.16, chromaMin: 0.05, harmonize: true, chromaMode: 'absolute' });
  }
  function removePalette(id: string) {
    studio.palettes = studio.palettes.filter((p) => p.id !== id);
    for (const [g, pid] of Object.entries(studio.groups)) if (pid === id) studio.groups[g as keyof typeof studio.groups] = null;
  }
  function setType(p: PaletteSettings, type: PaletteSettings['type']) {
    p.type = type;
    p.chromaMax = Math.min(p.chromaMax, CHROMA_CAP[type]);
    if (type === 'neutral' && p.chromaMax > 0.03) p.chromaMax = 0.02;
    p.chromaMin = Math.min(p.chromaMin, p.chromaMax);
  }
  async function copyJson() {
    const out = Object.fromEntries(palettes.map(({ p, tints }) => [p.name, Object.fromEntries(tints.map((t) => [t.l, { hex: t.hex, oklch: t.oklch, clipped: t.clipped }]))]));
    try {
      await navigator.clipboard.writeText(JSON.stringify(out, null, 2));
      copied = 'Kopiert';
    } catch {
      copied = 'Kopieren nicht möglich';
    }
    setTimeout(() => (copied = ''), 2000);
  }

  const fmt = (v: number) => (studio.scale.system === 'apca' ? `Lc ${Math.round(v)}` : `${v.toFixed(1)}:1`);
  const hueTrack = `linear-gradient(to right, ${[0, 45, 90, 135, 180, 225, 270, 315, 360].map((h) => `oklch(0.7 0.15 ${h})`).join(',')})`;
</script>

<div class="tool not-content">
  <section class="panel">
    <header>
      <h3>Skala <small>gilt für alle Paletten</small></h3>
      <div class="actions">
        <button type="button" onclick={copyJson}>Tints als JSON kopieren</button>
        <button type="button" class="ghost" onclick={() => confirm('Alle Paletten und Einstellungen zurücksetzen?') && replaceStudio(defaultConfig())}>Zurücksetzen</button>
        {#if copied}<span class="hint">{copied}</span>{/if}
      </div>
    </header>
    <div class="grid">
      <label>
        <span>Stepzahl</span>
        <select bind:value={studio.scale.steps}>
          {#each [7, 9, 11, 13, 15] as n}<option value={n}>{n} ({(n - 1) / 2} pro Seite)</option>{/each}
        </select>
      </label>
      <label>
        <span>Kontrastsystem</span>
        <select bind:value={studio.scale.system}>
          <option value="apca">APCA (Zentrum {CENTER.apca})</option>
          <option value="wcag">WCAG 2 (Zentrum {CENTER.wcag})</option>
        </select>
      </label>
      <label>
        <span>Verteilung <output>{studio.scale.distribution.toFixed(2)}</output></span>
        <input type="range" min="0" max="1" step="0.05" bind:value={studio.scale.distribution} />
        <small>1 = dynamisch, 0 = linear</small>
      </label>
      <label>
        <span>Oberer Außenpunkt <output>{studio.scale.upper}</output></span>
        <input type="range" min="90" max="100" step="1" bind:value={studio.scale.upper} />
      </label>
      <label>
        <span>Unterer Außenpunkt <output>{studio.scale.lower}</output></span>
        <input type="range" min="0" max="20" step="1" bind:value={studio.scale.lower} />
      </label>
      <label class="check">
        <input
          type="checkbox"
          checked={(studio.scale.minRatio ?? 0) > 0}
          onchange={(e) => (studio.scale.minRatio = e.currentTarget.checked ? 0.5 : 0)}
        />
        <span>r mindestens 0,5 <small>(offener Punkt: wenige Steps mit Regler 1)</small></span>
      </label>
    </div>
    <p class="meta">
      Skala: <strong>{scale.values.join(' · ')}</strong><br />
      Hell: g {scale.light.g.toFixed(0)}, r {scale.light.r.toFixed(2)} (r<sub>min</sub> {scale.light.rMin.toFixed(2)}) · Dunkel: g {scale.dark.g.toFixed(0)}, r {scale.dark.r.toFixed(2)} (r<sub>min</sub> {scale.dark.rMin.toFixed(2)})
    </p>
  </section>

  {#each palettes as { p, tints } (p.id)}
    <section class="panel palette">
      <header>
        <h3>
          <input class="name" bind:value={p.name} aria-label="Name der Palette" />
          <small>{p.type === 'neutral' ? 'Neutral' : 'Color'}</small>
        </h3>
        <div class="actions">
          <button type="button" class="ghost" onclick={() => (p.name = hueName(p.hue))} title="Namen aus dem Hue ableiten">Name aus Hue</button>
          <button type="button" class="ghost danger" onclick={() => removePalette(p.id)}>Entfernen</button>
        </div>
      </header>
      <div class="grid">
        <label>
          <span>Typ</span>
          <select value={p.type} onchange={(e) => setType(p, e.currentTarget.value as PaletteSettings['type'])}>
            <option value="color">Color (Chroma bis 0,25)</option>
            <option value="neutral">Neutral (Chroma bis 0,05)</option>
          </select>
        </label>
        <label>
          <span>Hue <output>{p.hue}°</output></span>
          <input type="range" class="hue" min="0" max="360" step="1" bind:value={p.hue} style:--track={hueTrack} />
        </label>
        <label>
          <span>Chroma max <output>{p.chromaMax.toFixed(3)}</output></span>
          <input type="range" min="0" max={CHROMA_CAP[p.type]} step={p.type === 'neutral' ? 0.001 : 0.005} bind:value={p.chromaMax} />
          <small>Gamut bei L {scale.center}: {maxChroma(scale.center, p.hue).toFixed(3)}</small>
        </label>
        <label>
          <span>Chroma min <output>{Math.min(p.chromaMin, p.chromaMax).toFixed(3)}</output></span>
          <input type="range" min="0" max={p.chromaMax} step={p.type === 'neutral' ? 0.001 : 0.005} bind:value={p.chromaMin} disabled={!p.harmonize} />
          <small>an den Außenpunkten, dunkel halb</small>
        </label>
        <label class="check">
          <input type="checkbox" bind:checked={p.harmonize} />
          <span>Chroma harmonisieren</span>
        </label>
        <label>
          <span>Chroma-Kurve</span>
          <select bind:value={p.chromaMode}>
            <option value="absolute">absolut (Spec)</option>
            <option value="relative">relativ zum Gamut (Test)</option>
          </select>
        </label>
      </div>

      <div class="swatches" style:--n={tints.length}>
        {#each tints as t (t.l)}
          <div class="swatch" class:center={t.isCenter} style:background={t.hex} style:color={t.text} title="{t.oklch} → {t.hex}">
            <strong>{t.l}</strong>
            <span>{t.hex}</span>
            <span>C {t.cMapped.toFixed(3)}{#if t.clipped}<abbr title="Chroma durch sRGB gekappt (angefordert {t.c.toFixed(3)})"> ◆</abbr>{/if}</span>
            <span class="lc">⚪ {fmt(t.vsWhite)}</span>
            <span class="lc">⚫ {fmt(t.vsBlack)}</span>
            {#if t.isCenter}<em>Outline</em>{/if}
          </div>
        {/each}
      </div>
      <ChromaChart {tints} hue={p.hue} center={scale.center} cap={CHROMA_CAP[p.type]} />
    </section>
  {/each}

  <button type="button" class="add" onclick={addPalette}>+ Palette hinzufügen</button>
</div>

<style>
  .palette .name {
    font: inherit;
    font-weight: 600;
    width: 10rem;
    padding: 0.125rem 0.375rem;
    background: transparent;
    color: inherit;
    border: 1px solid transparent;
    border-radius: 0.25rem;
  }
  .palette .name:hover,
  .palette .name:focus {
    border-color: var(--sl-color-gray-5);
  }
  .meta {
    margin: 0.75rem 0 0;
    color: var(--sl-color-gray-2);
    line-height: 1.6;
  }
  .swatches {
    display: grid;
    grid-template-columns: repeat(var(--n), minmax(0, 1fr));
    gap: 2px;
    margin-top: 1rem;
    overflow-x: auto;
  }
  .swatch {
    display: grid;
    align-content: start;
    gap: 0.125rem;
    min-width: 4.25rem;
    min-height: 7.5rem;
    padding: 0.5rem 0.375rem;
    font-size: 0.6875rem;
    line-height: 1.3;
    font-variant-numeric: tabular-nums;
  }
  .swatch strong {
    font-size: 0.9375rem;
  }
  .swatch.center {
    outline: 2px dashed currentColor;
    outline-offset: -5px;
  }
  .swatch em {
    font-style: normal;
    font-weight: 600;
  }
  .swatch abbr {
    text-decoration: none;
    cursor: help;
  }
  .lc {
    opacity: 0.85;
  }
  .add {
    justify-self: start;
  }
  input.hue {
    appearance: none;
    height: 0.5rem;
    border-radius: 999px;
    background: var(--track);
  }
</style>
