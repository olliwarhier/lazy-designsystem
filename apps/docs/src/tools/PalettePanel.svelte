<script lang="ts">
  // Seitenpanel (mobil Bottom Sheet) für die gewählte Palette, Konzept 13, 2.5.
  import { CHROMA_CAP, contrast, formatContrast, type PaletteSettings, type Scale, type Tint } from '@lazy-designsystem/engine';
  import { parseHex, rgbToOklch } from '@lazy-designsystem/core';
  import { hueName, studio, uniqueName } from './store.svelte';
  import ChromaChart from './ChromaChart.svelte';

  let {
    row,
    scale,
    tab = $bindable('oklch'),
    shared,
    categoryName,
    onclose,
    onremove,
  }: {
    row: { p: PaletteSettings; eff: PaletteSettings; tints: Tint[] };
    scale: Scale;
    tab: 'oklch' | 'farbe';
    shared: boolean;
    categoryName: string;
    onclose: () => void;
    onremove: () => void;
  } = $props();

  const p = $derived(row.p);
  const cap = $derived(CHROMA_CAP[row.eff.type]);
  const editChroma = $derived(!shared || p.ownChroma);
  let full = $state(false);

  function toggleOwn(on: boolean) {
    // beim Einschalten mit den bisherigen (gemeinsamen) Werten starten
    if (on) {
      p.chromaMax = row.eff.chromaMax;
      p.chromaMin = row.eff.chromaMin;
    }
    p.ownChroma = on;
  }

  function setCategory(id: string) {
    const cat = studio.categories.find((c) => c.id === id);
    if (!cat) return;
    p.category = cat.id;
    p.type = cat.type;
    p.chromaMax = Math.min(p.chromaMax, CHROMA_CAP[cat.type]);
    p.chromaMin = Math.min(p.chromaMin, p.chromaMax);
  }

  // Tab „Farbe": beliebige CSS-Farbe → Hue und Chroma
  let colorText = $state('');
  let colorMsg = $state('');
  let pickerValue = $state('#000000');
  let parsed = $state<{ l: number; c: number; h: number; hex: string } | null>(null);

  function parseColor(input: string) {
    const s = input.trim();
    if (!s) return null;
    const ok = s.match(/^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)/i);
    if (ok) {
      const l = ok[2] ? +ok[1] / 100 : +ok[1];
      return { l, c: +ok[3], h: +ok[4] };
    }
    // alles andere (Hex, rgb(), hsl(), Namen) übersetzt der Browser
    const ctx = document.createElement('canvas').getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#010203';
    ctx.fillStyle = s;
    const out = String(ctx.fillStyle);
    if (out === '#010203' && !/^#?010203$/i.test(s)) return null;
    let rgb;
    if (out.startsWith('#')) rgb = parseHex(out);
    else {
      const m = out.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const [r, g, b] = m[1].split(',').map((x) => +x / 255);
      rgb = { r, g, b };
    }
    return rgbToOklch(rgb);
  }

  function preview() {
    const c = parseColor(colorText);
    if (!c) {
      parsed = null;
      colorMsg = colorText.trim() ? 'Farbe nicht erkannt.' : '';
      return;
    }
    const l = c.l * 100;
    const nearest = row.tints.reduce((a, t) => (Math.abs(t.lReal - l) < Math.abs(a.lReal - l) ? t : a));
    parsed = { l, c: c.c, h: c.h, hex: '' };
    // Farbwähler mitführen (nur bei Hex-Eingabe exakt)
    if (/^#[0-9a-f]{6}$/i.test(colorText.trim())) pickerValue = colorText.trim();
    colorMsg = `L ${l.toFixed(1)} · C ${c.c.toFixed(3)} · H ${Math.round(c.h)}°. Am nächsten an Stufe ${nearest.l} (${nearest.name}, L ${nearest.lReal.toFixed(1)}).`;
  }

  function apply() {
    if (!parsed) return;
    p.hue = Math.round(parsed.h);
    if (parsed.c > 0.002) {
      p.ownChroma = shared ? true : p.ownChroma;
      p.chromaMax = Math.min(Math.round(parsed.c * 1000) / 1000, cap);
      p.chromaMin = Math.min(p.chromaMin, p.chromaMax);
    }
    tab = 'oklch';
  }

  const num = (v: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(v) ? v : min));
  const measureBg = (t: Tint) => (t.l >= scale.center ? scale.darkBg : scale.lightBg);
  const hueTrack = `linear-gradient(to right, ${[0, 45, 90, 135, 180, 225, 270, 315, 360].map((h) => `oklch(0.7 0.15 ${h})`).join(',')})`;
</script>

<aside class="sheet" class:full aria-label="Palette {p.name}">
  <header>
    <button type="button" class="grab" onclick={() => (full = !full)} aria-label={full ? 'Panel verkleinern' : 'Panel vergrößern'}></button>
    <h3>{p.name} <small>{categoryName}</small></h3>
    <button type="button" class="ghost close" onclick={onclose} aria-label="Panel schließen">✕</button>
  </header>

  <div class="body">
    <label>
      <span>Name</span>
      <input type="text" value={p.name} onchange={(e) => (p.name = uniqueName(e.currentTarget.value.trim() || hueName(p.hue), p.id))} />
    </label>
    <label>
      <span>Kategorie</span>
      <select value={p.category} onchange={(e) => setCategory(e.currentTarget.value)}>
        {#each studio.categories as c}<option value={c.id}>{c.name} ({c.type === 'neutral' ? 'Neutral' : 'Color'})</option>{/each}
      </select>
    </label>
    {#if shared}
      <label class="check">
        <input type="checkbox" role="switch" checked={p.ownChroma} onchange={(e) => toggleOwn(e.currentTarget.checked)} />
        <span>Eigenes Chroma <small>{p.ownChroma ? '' : `(nutzt ${categoryName}: ${row.eff.chromaMax.toFixed(3)} / ${row.eff.chromaMin.toFixed(3)})`}</small></span>
      </label>
    {/if}

    <div class="tabs" role="tablist">
      <button type="button" role="tab" aria-selected={tab === 'oklch'} onclick={() => (tab = 'oklch')}>OKLCH</button>
      <button type="button" role="tab" aria-selected={tab === 'farbe'} onclick={() => (tab = 'farbe')}>Farbe</button>
    </div>

    {#if tab === 'oklch'}
      <label>
        <span>Hue <span class="pair"><input type="number" min="0" max="360" step="1" value={p.hue} onchange={(e) => (p.hue = num(+e.currentTarget.value, 0, 360))} />°</span></span>
        <input type="range" class="hue" min="0" max="360" step="1" bind:value={p.hue} style:--track={hueTrack} />
      </label>
      {#if editChroma}
        <label>
          <span>Chroma max <input type="number" min="0" max={cap} step="0.005" value={p.chromaMax} onchange={(e) => (p.chromaMax = num(+e.currentTarget.value, 0, cap))} /></span>
          <input type="range" min="0" max={cap} step="0.001" bind:value={p.chromaMax} />
        </label>
        <label>
          <span>Chroma min <input type="number" min="0" max={p.chromaMax} step="0.005" value={Math.min(p.chromaMin, p.chromaMax)} onchange={(e) => (p.chromaMin = num(+e.currentTarget.value, 0, p.chromaMax))} disabled={p.curve === 'constant'} /></span>
          <input type="range" min="0" max={p.chromaMax} step="0.001" bind:value={p.chromaMin} disabled={p.curve === 'constant'} />
        </label>
      {/if}
      <div class="field">
        <span>Chroma-Verlauf</span>
        <div class="seg" role="radiogroup" aria-label="Chroma-Verlauf">
          <button type="button" role="radio" aria-checked={p.curve !== 'constant'} onclick={() => (p.curve = 'falling')}>abfallend</button>
          <button type="button" role="radio" aria-checked={p.curve === 'constant'} onclick={() => (p.curve = 'constant')}>konstant</button>
        </div>
      </div>
    {:else}
      <label>
        <span>Farbe (Hex, rgb(), hsl(), oklch())</span>
        <span class="pair">
          <input type="color" aria-label="Farbwähler" value={pickerValue} oninput={(e) => ((colorText = e.currentTarget.value), preview())} />
          <input type="text" placeholder="#3366ff" bind:value={colorText} oninput={preview} />
        </span>
      </label>
      {#if colorMsg}<p class="hint">{colorMsg}</p>{/if}
      <button type="button" disabled={!parsed} onclick={apply}>Hue und Chroma übernehmen</button>
      <p class="hint">Übernommen werden Hue und Chroma (als Maximum, mit „Eigenes Chroma"). Die Stufen rechnet der Generator wie bei jeder Palette.</p>
    {/if}

    <ChromaChart tints={row.tints} hue={p.hue} center={scale.center} {cap} />

    <details open={full}>
      <summary>Stufen-Details</summary>
      <table class="details">
        <thead><tr><th>Stufe</th><th>L</th><th>C</th><th>Hex</th><th>Kontrast</th></tr></thead>
        <tbody>
          {#each row.tints as t}
            <tr class:center={t.isCenter}>
              <td><i style:background={t.hex}></i>{t.l}</td>
              <td>{t.lReal.toFixed(1)}</td>
              <td title="angefordert {t.c.toFixed(3)}">{t.cMapped.toFixed(3)}{#if t.clipped}<abbr title="Chroma durch sRGB gekappt (angefordert {t.c.toFixed(3)})"> ◆</abbr>{/if}</td>
              <td><code>{t.hex}</code></td>
              <td>{formatContrast(contrast(t.rgb, measureBg(t), scale.system), scale.system)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
      <p class="hint">Kontrast gegen den Messbezug: helle Stufen gegen den dunklen Hintergrund, dunkle gegen den hellen. ◆ = vom sRGB-Gamut gekappt.</p>
    </details>

    <button type="button" class="ghost danger remove" onclick={onremove}>Palette entfernen</button>
  </div>
</aside>

<style>
  .sheet {
    position: fixed;
    z-index: 20;
    top: calc(var(--sl-nav-height, 3.5rem) + 0.75rem);
    right: 0.75rem;
    bottom: 0.75rem;
    width: min(24rem, calc(100vw - 1.5rem));
    display: flex;
    flex-direction: column;
    background: var(--sl-color-bg);
    border: 1px solid var(--sl-color-gray-5);
    border-radius: 0.75rem;
    box-shadow: 0 12px 40px rgb(0 0 0 / 0.28);
  }
  header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 0.75rem 0.5rem 1rem;
    border-bottom: 1px solid var(--sl-color-gray-6);
  }
  header h3 {
    flex: 1;
  }
  .grab {
    display: none;
  }
  .close {
    min-width: 2rem;
  }
  .body {
    overflow: auto;
    padding: 0.75rem 1rem 1rem;
    display: grid;
    gap: 0.75rem;
    align-content: start;
  }
  .body > label > span,
  .field {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
  }
  .pair {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }
  .pair input[type='text'] {
    flex: 1;
  }
  input[type='color'] {
    width: 2rem;
    height: 1.75rem;
    padding: 0;
    border: 1px solid var(--sl-color-gray-5);
    border-radius: 0.25rem;
    background: none;
  }
  input.hue {
    appearance: none;
    height: 0.5rem;
    border-radius: 999px;
    background: var(--track);
  }
  .tabs {
    display: flex;
    border-bottom: 1px solid var(--sl-color-gray-5);
  }
  .tabs button {
    background: transparent;
    border: 0;
    border-bottom: 2px solid transparent;
    border-radius: 0;
    color: var(--sl-color-gray-2);
    padding: 0.375rem 0.75rem;
  }
  .tabs button[aria-selected='true'] {
    color: var(--sl-color-white);
    border-bottom-color: var(--sl-color-accent);
  }
  .seg {
    display: inline-flex;
    border: 1px solid var(--sl-color-gray-5);
    border-radius: 0.375rem;
    overflow: hidden;
  }
  .seg button {
    border: 0;
    border-radius: 0;
    background: transparent;
    color: var(--sl-color-text);
    padding: 0.2rem 0.6rem;
  }
  .seg button + button {
    border-left: 1px solid var(--sl-color-gray-5);
  }
  .seg button[aria-checked='true'] {
    background: var(--sl-color-accent);
    color: var(--sl-color-black);
  }
  summary {
    cursor: pointer;
    color: var(--sl-color-gray-2);
  }
  .details {
    width: 100%;
    margin-top: 0.5rem;
    border-collapse: collapse;
    font-size: 0.75rem;
    font-variant-numeric: tabular-nums;
    display: table;
  }
  .details th,
  .details td {
    text-align: left;
    padding: 0.2rem 0.25rem;
    border: 0;
    border-bottom: 1px solid var(--sl-color-gray-6);
  }
  .details i {
    display: inline-block;
    width: 0.75rem;
    height: 0.75rem;
    margin-right: 0.375rem;
    vertical-align: -0.1rem;
    border-radius: 0.125rem;
    border: 1px solid var(--sl-color-gray-5);
  }
  .details tr.center td {
    font-style: italic;
  }
  .details code {
    font-size: inherit;
    background: none;
    padding: 0;
  }
  abbr {
    text-decoration: none;
    cursor: help;
  }
  .hint {
    margin: 0;
  }
  .remove {
    justify-self: start;
  }

  /* Mobil: Bottom Sheet mit zwei Höhen */
  @media (max-width: 50rem) {
    .sheet {
      top: auto;
      left: 0;
      right: 0;
      bottom: 0;
      width: auto;
      height: 50dvh;
      border-radius: 0.75rem 0.75rem 0 0;
      transition: height 0.2s;
    }
    .sheet.full {
      height: 90dvh;
    }
    .grab {
      display: block;
      position: absolute;
      top: 0.3rem;
      left: 50%;
      translate: -50% 0;
      width: 3rem;
      height: 0.3rem;
      padding: 0;
      border: 0;
      border-radius: 999px;
      background: var(--sl-color-gray-4);
    }
  }
</style>
