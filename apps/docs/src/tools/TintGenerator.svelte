<script lang="ts">
  // Prototyp Tint-Generator nach Spezifikation 02 (2. Fassung) und Konzept 13: Matrix mit Seitenpanel.
  import {
    buildScale,
    CHROMA_CAP,
    contrast,
    effectivePalette,
    generatePalette,
    type PaletteCategory,
    type PaletteSettings,
    type PaletteType,
    type Tint,
  } from '@lazy-designsystem/engine';
  import { defaultConfig, historyState, hueName, newId, redo, replaceStudio, shareLink, studio, undo, uniqueName } from './store.svelte';
  import PalettePanel from './PalettePanel.svelte';
  import './tool.css';

  const WHITE = { r: 1, g: 1, b: 1 };
  const BLACK = { r: 0, g: 0, b: 0 };

  const scale = $derived(buildScale(studio.scale));
  const system = $derived(studio.scale.system);
  const isContrast = $derived(studio.scale.basis === 'contrast');

  type Row = { p: PaletteSettings; eff: PaletteSettings; tints: (Tint & { text: string; value: number })[] };
  const rows = $derived(
    studio.palettes.map((p): Row => {
      const eff = effectivePalette(p, studio);
      const tints = generatePalette(eff, scale).map((t) => {
        const w = contrast(t.rgb, WHITE, system);
        const k = contrast(t.rgb, BLACK, system);
        // Wert im Swatch (nur Lightness): helle Stufen gegen Schwarz, dunkle gegen Weiß
        return { ...t, text: w > k ? '#fff' : '#000', value: t.l >= scale.center ? k : w };
      });
      return { p, eff, tints };
    }),
  );
  const byCategory = $derived(studio.categories.map((c) => ({ c, rows: rows.filter((r) => r.eff.category === c.id) })));

  let selectedId = $state<string | null>(null);
  const selected = $derived(rows.find((r) => r.p.id === selectedId) ?? null);
  let panelTab = $state<'oklch' | 'farbe'>('oklch');

  // Aktionsleiste
  let menu = $state<'' | 'add' | 'export' | 'more'>('');
  let note = $state('');
  let newCat = $state({ name: '', type: 'color' as PaletteType });
  const flash = (t: string) => {
    note = t;
    setTimeout(() => (note = ''), 2200);
  };

  function addPalette(categoryId: string) {
    const cat = studio.categories.find((c) => c.id === categoryId)!;
    const inCat = studio.palettes.filter((p) => p.category === categoryId);
    const prev = inCat.at(-1) ?? studio.palettes.at(-1);
    const hue = prev ? Math.round((prev.hue + 45) % 360) : 250;
    const p: PaletteSettings = {
      id: newId(),
      name: uniqueName(cat.type === 'neutral' ? 'gray' : hueName(hue)),
      type: cat.type,
      category: cat.id,
      hue,
      ownChroma: false,
      chromaMax: cat.chromaMax,
      chromaMin: cat.chromaMin,
      curve: 'falling',
    };
    // neue Zeile unten in der Kategorie
    const last = studio.palettes.findLastIndex((x) => x.category === categoryId);
    studio.palettes.splice(last + 1, 0, p);
    selectedId = p.id;
    panelTab = 'oklch';
    menu = '';
  }

  function addCategory() {
    const name = newCat.name.trim();
    if (!name) return;
    const base = studio.categories.find((c) => c.type === newCat.type) ?? studio.categories[0];
    const id = `cat-${newId()}`;
    studio.categories.push({ id, name, type: newCat.type, chromaMax: base.chromaMax, chromaMin: base.chromaMin });
    newCat = { name: '', type: 'color' };
    addPalette(id);
  }

  function removeCategory(c: PaletteCategory) {
    const n = studio.palettes.filter((p) => p.category === c.id).length;
    if (n && !confirm(`Kategorie „${c.name}" mit ${n} Palette(n) entfernen?`)) return;
    for (const p of studio.palettes.filter((p) => p.category === c.id)) removePalette(p.id);
    studio.categories = studio.categories.filter((x) => x.id !== c.id);
  }

  function removePalette(id: string) {
    studio.palettes = studio.palettes.filter((p) => p.id !== id);
    for (const [g, pid] of Object.entries(studio.groups)) if (pid === id) studio.groups[g as keyof typeof studio.groups] = null;
    if (studio.focus === id) studio.focus = null;
    if (selectedId === id) selectedId = null;
  }

  async function copy(text: string, done: string) {
    try {
      await navigator.clipboard.writeText(text);
      flash(done);
    } catch {
      flash('Kopieren nicht möglich');
    }
    menu = '';
  }
  const cssVars = () =>
    `:root {\n${rows.flatMap(({ tints }) => tints.map((t) => `  --${t.name}: ${t.hex};`)).join('\n')}\n}\n`;
  const json = () =>
    JSON.stringify(
      Object.fromEntries(rows.map(({ p, tints }) => [p.name, Object.fromEntries(tints.map((t) => [t.l, { hex: t.hex, oklch: t.oklch, clipped: t.clipped }]))])),
      null,
      2,
    );

  // Hintergründe als Farbeingabe (oklch oder Hex)
  const bgText = (c: { l: number; c: number; h: number }) => `oklch(${+(c.l / 100).toFixed(3)} ${+c.c.toFixed(3)} ${Math.round(c.h)})`;
  function setBg(which: 'lightBg' | 'darkBg', value: string) {
    const m = value.trim().match(/^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)/i);
    if (!m) return flash('Bitte als oklch(L C H) eingeben');
    const l = m[2] ? +m[1] : +m[1] * 100;
    studio.scale[which] = { l, c: +m[3], h: +m[4] };
  }
  const css = (c: { l: number; c: number; h: number }) => `oklch(${c.l / 100} ${c.c} ${c.h})`;

  const fmt = (v: number) => (system === 'apca' ? `${Math.round(v)}` : v.toFixed(1).replace('.', ','));
  const step = (v: number, min: number, max: number) => {
    const x = Math.min(max, Math.max(min, Math.round(v * 1000) / 1000));
    return Number.isFinite(x) ? x : min;
  };

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      if (menu) menu = '';
      else selectedId = null;
    }
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'z' && !(e.target instanceof HTMLInputElement)) {
      e.preventDefault();
      e.shiftKey ? redo() : undo();
    }
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="tool tg not-content" class:has-panel={selected}>
  <!-- 1. Aktionsleiste -->
  <div class="bar" role="toolbar" aria-label="Aktionen">
    <strong class="title">Tint-Generator</strong>
    <div class="actions">
      <button type="button" class="ghost icon" onclick={undo} disabled={!historyState.canUndo} title="Rückgängig (Strg+Z)" aria-label="Rückgängig">↶</button>
      <button type="button" class="ghost icon" onclick={redo} disabled={!historyState.canRedo} title="Wiederholen (Strg+Umschalt+Z)" aria-label="Wiederholen">↷</button>
      <span class="split">
        <button type="button" onclick={() => addPalette('color')} title="Color-Palette hinzufügen">+ Palette</button>
        <button type="button" class="chev" aria-label="Weitere Möglichkeiten" aria-expanded={menu === 'add'} onclick={() => (menu = menu === 'add' ? '' : 'add')}>▾</button>
        {#if menu === 'add'}
          <div class="menu">
            {#each studio.categories as c}
              <button type="button" class="ghost" onclick={() => addPalette(c.id)}>{c.name}</button>
            {/each}
            <form class="newcat" onsubmit={(e) => (e.preventDefault(), addCategory())}>
              <span>Neue Kategorie</span>
              <input type="text" placeholder="z. B. Accent" bind:value={newCat.name} aria-label="Name der Kategorie" />
              <select bind:value={newCat.type} aria-label="Typ der Kategorie">
                <option value="color">Typ Color</option>
                <option value="neutral">Typ Neutral</option>
              </select>
              <button type="submit">Anlegen</button>
            </form>
          </div>
        {/if}
      </span>
      <span class="split">
        <button type="button" class="ghost" aria-expanded={menu === 'export'} onclick={() => (menu = menu === 'export' ? '' : 'export')}>Export ▾</button>
        {#if menu === 'export'}
          <div class="menu">
            <button type="button" class="ghost" onclick={() => copy(cssVars(), 'CSS-Variablen kopiert')}>CSS-Variablen kopieren</button>
            <button type="button" class="ghost" onclick={() => copy(json(), 'JSON kopiert')}>JSON kopieren</button>
          </div>
        {/if}
      </span>
      <button type="button" class="ghost" onclick={() => copy(shareLink(), 'Link kopiert')}>Teilen</button>
      <span class="split">
        <button type="button" class="ghost icon" aria-label="Mehr" aria-expanded={menu === 'more'} onclick={() => (menu = menu === 'more' ? '' : 'more')}>⋯</button>
        {#if menu === 'more'}
          <div class="menu right">
            <button type="button" class="ghost danger" onclick={() => (menu = '', confirm('Alle Paletten und Einstellungen zurücksetzen?') && (replaceStudio(defaultConfig()), (selectedId = null)))}>Zurücksetzen</button>
          </div>
        {/if}
      </span>
      {#if note}<span class="hint" role="status">{note}</span>{/if}
    </div>
  </div>

  <!-- 2. Globale Einstellungen -->
  <section class="panel global">
    <div class="row">
      <span class="lbl">Algorithmus</span>
      <div class="seg" role="radiogroup" aria-label="Algorithmus">
        <button type="button" role="radio" aria-checked={system === 'apca'} onclick={() => (studio.scale.system = 'apca')}>APCA</button>
        <button type="button" role="radio" aria-checked={system === 'wcag'} onclick={() => (studio.scale.system = 'wcag')}>WCAG 2</button>
      </div>
      <small>{system === 'apca' ? 'Wahrnehmungsbasiert, genauer bei dunklen Farben und Schriftgrößen.' : 'Gesetzlicher Standard (EU: European Accessibility Act).'}</small>
    </div>
    <div class="row">
      <span class="lbl">Stufen-Basis</span>
      <div class="seg" role="radiogroup" aria-label="Stufen-Basis">
        <button type="button" role="radio" aria-checked={isContrast} onclick={() => (studio.scale.basis = 'contrast')}>Kontrast</button>
        <button type="button" role="radio" aria-checked={!isContrast} onclick={() => (studio.scale.basis = 'lightness')}>Lightness</button>
      </div>
      <small>{isContrast ? 'Gleiche Stufe = gleicher Kontrast in allen Paletten.' : 'Gleiche Stufe = gleiche OKLCH-Lightness, Verteilung über eine Kurve.'}</small>
    </div>
    {#if isContrast}
      <div class="row">
        <span class="lbl">Hintergründe</span>
        <label class="bg">
          <i style:background={css(studio.scale.lightBg)}></i> Hell
          <input type="text" value={bgText(studio.scale.lightBg)} onchange={(e) => setBg('lightBg', e.currentTarget.value)} aria-label="Heller Kontrast-Hintergrund" />
        </label>
        <label class="bg">
          <i style:background={css(studio.scale.darkBg)}></i> Dunkel
          <input type="text" value={bgText(studio.scale.darkBg)} onchange={(e) => setBg('darkBg', e.currentTarget.value)} aria-label="Dunkler Kontrast-Hintergrund" />
        </label>
        <small>Nur Messbezug für die Stufen.</small>
      </div>
    {/if}
    <div class="row">
      <span class="lbl">Stufen</span>
      <div class="seg" role="radiogroup" aria-label="Stufenzahl">
        {#each [7, 9, 11, 13, 15] as n}
          <button type="button" role="radio" aria-checked={studio.scale.steps === n} onclick={() => (studio.scale.steps = n)}>{n}</button>
        {/each}
      </div>
    </div>
    <div class="row top">
      <span class="lbl">Gemeinsames Chroma</span>
      <label class="switch">
        <input type="checkbox" role="switch" bind:checked={studio.sharedChroma} />
        <span>{studio.sharedChroma ? 'an' : 'aus'}</span>
      </label>
      {#if studio.sharedChroma}
        <div class="cats">
          {#each studio.categories as c}
            <div class="cat">
              <span>{c.name}</span>
              <label>Max <input type="number" min="0" max={CHROMA_CAP[c.type]} step="0.005" value={c.chromaMax} onchange={(e) => (c.chromaMax = step(+e.currentTarget.value, 0, CHROMA_CAP[c.type]))} /></label>
              <label>Min <input type="number" min="0" max={c.chromaMax} step="0.005" value={c.chromaMin} onchange={(e) => (c.chromaMin = step(+e.currentTarget.value, 0, c.chromaMax))} /></label>
            </div>
          {/each}
        </div>
      {:else}
        <small>Jede Palette nutzt ihre eigenen Werte (im Panel).</small>
      {/if}
    </div>
    <details class="advanced">
      <summary>Erweitert</summary>
      <div class="grid">
        {#if !isContrast}
          <label>
            <span>Verteilung <output>{studio.scale.distribution.toFixed(2)}</output></span>
            <input type="range" min="0" max="1" step="0.05" bind:value={studio.scale.distribution} />
            <small>1 = dynamisch (Stufen zum Rand), 0 = linear</small>
          </label>
        {/if}
        <label>
          <span>Oberer Außenpunkt <output>{studio.scale.upper}</output></span>
          <input type="range" min="90" max="100" step="1" bind:value={studio.scale.upper} />
          <small>Mindestabstand {scale.minGap} L</small>
        </label>
        <label>
          <span>Unterer Außenpunkt <output>{studio.scale.lower}</output></span>
          <input type="range" min="0" max="20" step="1" bind:value={studio.scale.lower} />
        </label>
        <label class="check">
          <input type="checkbox" bind:checked={studio.chromaRelative} />
          <span>Chroma relativ zum Gamut <small>(Test)</small></span>
        </label>
      </div>
      {#if !isContrast}
        <p class="meta">
          Hell: erster Abstand {scale.light.g.toFixed(1)}{scale.light.fixedG ? ' (festgesetzt)' : ''}, r {scale.light.r.toFixed(2)} ·
          Dunkel: erster Abstand {scale.dark.g.toFixed(1)}{scale.dark.fixedG ? ' (festgesetzt)' : ''}, r {scale.dark.r.toFixed(2)}
        </p>
      {/if}
    </details>
  </section>

  <!-- 3. Matrix -->
  <div class="matrix-wrap">
    <table class="matrix" style:--n={scale.values.length}>
      <thead>
        <tr class="steps">
          <th scope="col" class="name">Stufe</th>
          {#each scale.values as l, i}
            <th scope="col" class:center={i === scale.centerIndex}>{l}</th>
          {/each}
        </tr>
        {#if isContrast}
          <tr class="contrasts">
            <th scope="row" class="name">{system === 'apca' ? 'Kontrast Lc' : 'Kontrast'}</th>
            {#each scale.values as l, i}
              {@const light = l >= scale.center}
              <th
                class:center={i === scale.centerIndex}
                style:background={css(light ? studio.scale.darkBg : studio.scale.lightBg)}
                style:color={css(light ? studio.scale.lightBg : studio.scale.darkBg)}
                title={i === scale.centerIndex ? 'Zentrum: gleicher Kontrast zu beiden Hintergründen, nur für Outlines' : light ? 'gegen den dunklen Hintergrund' : 'gegen den hellen Hintergrund'}
              >{fmt(scale.contrasts[i])}</th>
            {/each}
          </tr>
        {/if}
      </thead>
      {#each byCategory as { c, rows: catRows } (c.id)}
        <tbody>
          <tr class="cat-head">
            <th scope="rowgroup" colspan={scale.values.length + 1}>
              <span class="cat-name">
                {c.name}
                <small>{c.type === 'neutral' ? 'Neutral' : 'Color'}</small>
                {#if c.id !== 'neutral' && c.id !== 'color'}
                  <button type="button" class="ghost danger mini" onclick={() => removeCategory(c)}>Kategorie entfernen</button>
                {/if}
                <button type="button" class="ghost mini" onclick={() => addPalette(c.id)}>+ {c.name}</button>
              </span>
            </th>
          </tr>
          {#each catRows as { p, tints } (p.id)}
            <tr class="pal" class:dim={selectedId && selectedId !== p.id} class:sel={selectedId === p.id} onclick={() => (selectedId = selectedId === p.id ? null : p.id)}>
              <th scope="row" class="name">
                <button type="button" class="rowbtn" aria-pressed={selectedId === p.id} onclick={(e) => (e.stopPropagation(), (selectedId = selectedId === p.id ? null : p.id))}>
                  {p.name}
                  <small>{Math.round(p.hue)}°</small>
                </button>
              </th>
              {#each tints as t, i (t.l)}
                <td class="sw" class:center={i === scale.centerIndex} style:background={t.hex} style:color={t.text} title="{t.name} · {t.oklch} → {t.hex}">
                  {#if isContrast}
                    <span>L {Math.round(t.lReal)}</span>
                  {:else}
                    <span>{fmt(t.value)}</span>
                  {/if}
                  <span class="c">C {t.cMapped.toFixed(3).slice(1)}</span>
                </td>
              {/each}
            </tr>
          {:else}
            <tr><td class="empty" colspan={scale.values.length + 1}>Noch keine Palette in dieser Kategorie.</td></tr>
          {/each}
        </tbody>
      {/each}
    </table>
  </div>
  <p class="legend">
    {#if isContrast}
      Kopfzeile: Kontrast jeder Stufe, hell gegen den dunklen Hintergrund, dunkel gegen den hellen. Er gilt für alle Paletten. Im Swatch: echtes L und Chroma.
    {:else}
      Im Swatch: Kontrast ({system === 'apca' ? 'Lc' : 'Verhältnis'}), helle Stufen gegen Schwarz, dunkle gegen Weiß, darunter das Chroma.
    {/if}
    Die markierte Spalte ist das Zentrum (nur für Outlines). Zeile anklicken öffnet die Einstellungen der Palette.
  </p>

  <!-- 4. Fußzeile -->
  <footer class="foot">
    <a href="#so-wird-gerechnet">Mehr zur Berechnung →</a>
    <a href="../theme-builder/">Weiter zum Theme-Builder →</a>
  </footer>

  <!-- 5. Seitenpanel / Bottom Sheet -->
  {#if selected}
    <PalettePanel
      row={selected}
      {scale}
      bind:tab={panelTab}
      shared={studio.sharedChroma}
      categoryName={studio.categories.find((c) => c.id === selected.eff.category)?.name ?? ''}
      onclose={() => (selectedId = null)}
      onremove={() => confirm(`Palette „${selected.p.name}" entfernen?`) && removePalette(selected.p.id)}
    />
  {/if}
</div>

<style>
  .tg {
    position: relative;
  }
  .bar {
    position: sticky;
    top: var(--sl-nav-height, 3.5rem);
    z-index: 5;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem 1rem;
    padding: 0.5rem 0.75rem;
    background: var(--sl-color-bg-nav, var(--sl-color-bg));
    border: 1px solid var(--sl-color-gray-5);
    border-radius: 0.5rem;
  }
  .title {
    font-size: 0.9375rem;
    color: var(--sl-color-white);
  }
  .icon {
    min-width: 2rem;
  }
  button:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .split {
    position: relative;
    display: inline-flex;
  }
  .split > button:first-child:not(:only-of-type) {
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
  }
  .chev {
    border-top-left-radius: 0 !important;
    border-bottom-left-radius: 0 !important;
    border-left: 1px solid color-mix(in srgb, var(--sl-color-black) 30%, transparent) !important;
    padding-inline: 0.45rem !important;
  }
  .menu {
    position: absolute;
    top: calc(100% + 0.25rem);
    left: 0;
    z-index: 10;
    display: grid;
    gap: 0.25rem;
    min-width: 12rem;
    padding: 0.5rem;
    background: var(--sl-color-bg);
    border: 1px solid var(--sl-color-gray-5);
    border-radius: 0.5rem;
    box-shadow: 0 8px 24px rgb(0 0 0 / 0.2);
  }
  .menu.right {
    left: auto;
    right: 0;
  }
  .menu > button {
    text-align: left;
  }
  .newcat {
    display: grid;
    gap: 0.25rem;
    padding-top: 0.375rem;
    margin-top: 0.125rem;
    border-top: 1px solid var(--sl-color-gray-5);
    color: var(--sl-color-gray-2);
  }

  .global {
    display: grid;
    gap: 0.625rem;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.375rem 0.75rem;
  }
  .row.top {
    align-items: flex-start;
  }
  .row small {
    color: var(--sl-color-gray-3);
  }
  .lbl {
    width: 9.5rem;
    color: var(--sl-color-gray-2);
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
    padding: 0.25rem 0.7rem;
  }
  .seg button + button {
    border-left: 1px solid var(--sl-color-gray-5);
  }
  .seg button[aria-checked='true'] {
    background: var(--sl-color-accent);
    color: var(--sl-color-black);
  }
  .bg {
    display: inline-flex !important;
    align-items: center;
    gap: 0.375rem !important;
  }
  .bg i {
    width: 1.1rem;
    height: 1.1rem;
    border-radius: 50%;
    border: 1px solid var(--sl-color-gray-4);
  }
  .bg input {
    width: 10rem;
  }
  .switch {
    display: inline-flex !important;
    align-items: center;
    gap: 0.375rem !important;
  }
  .cats {
    display: grid;
    gap: 0.25rem;
  }
  .cat {
    display: flex;
    gap: 0.75rem;
    align-items: center;
  }
  .cat > span {
    width: 5.5rem;
  }
  .cat label {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }
  .cat input,
  :global(.tg input[type='number']) {
    width: 4.75rem;
    font: inherit;
    padding: 0.2rem 0.3rem;
    background: var(--sl-color-bg);
    color: var(--sl-color-text);
    border: 1px solid var(--sl-color-gray-5);
    border-radius: 0.25rem;
  }
  .advanced summary {
    cursor: pointer;
    color: var(--sl-color-gray-2);
  }
  .advanced .grid {
    margin-top: 0.625rem;
  }
  .meta {
    margin: 0.5rem 0 0;
    color: var(--sl-color-gray-3);
  }

  /* Matrix: eigener Scrollbereich, damit Kopf und Namensspalte stehen bleiben */
  .matrix-wrap {
    overflow: auto;
    max-height: calc(100dvh - var(--sl-nav-height, 3.5rem) - 5rem);
    border: 1px solid var(--sl-color-gray-5);
    border-radius: 0.5rem;
    overscroll-behavior: contain;
  }
  .matrix {
    border-collapse: separate;
    border-spacing: 0;
    width: 100%;
    min-width: calc(7rem + var(--n) * 3.6rem);
    margin: 0;
    font-variant-numeric: tabular-nums;
    display: table;
  }
  .matrix th,
  .matrix td {
    border: 0;
    padding: 0;
  }
  thead th {
    position: sticky;
    z-index: 2;
    background: var(--sl-color-bg);
    font-weight: 600;
    text-align: center;
    padding: 0.375rem 0.25rem;
  }
  .steps th {
    top: 0;
    color: var(--sl-color-white);
  }
  .contrasts th {
    top: 2rem;
    font-weight: 500;
    font-size: 0.75rem;
  }
  thead .center {
    box-shadow: inset 1px 0 0 var(--sl-color-gray-4), inset -1px 0 0 var(--sl-color-gray-4);
  }
  .name {
    position: sticky;
    left: 0;
    z-index: 3;
    width: 7rem;
    min-width: 7rem;
    text-align: left !important;
    background: var(--sl-color-bg) !important;
    color: var(--sl-color-gray-2) !important;
    font-weight: 500;
  }
  thead .name {
    z-index: 4;
  }
  .cat-head th {
    text-align: left;
    padding: 0.75rem 0.5rem 0.25rem;
    background: var(--sl-color-bg);
  }
  .cat-name {
    position: sticky;
    left: 0.5rem;
    display: inline-flex;
    align-items: baseline;
    gap: 0.5rem;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--sl-color-white);
  }
  .cat-name small {
    text-transform: none;
    letter-spacing: 0;
    color: var(--sl-color-gray-3);
    font-weight: 400;
  }
  .mini {
    font-size: 0.6875rem !important;
    padding: 0.05rem 0.4rem !important;
    text-transform: none;
    letter-spacing: 0;
  }
  .pal {
    cursor: pointer;
    transition: opacity 0.15s;
  }
  .pal.dim {
    opacity: 0.3;
  }
  .pal .name {
    padding: 0 0.25rem;
  }
  .rowbtn {
    all: unset;
    box-sizing: border-box;
    display: flex;
    justify-content: space-between;
    gap: 0.25rem;
    width: 100%;
    padding: 0.5rem 0.25rem;
    border-radius: 0.25rem;
    cursor: pointer;
    color: var(--sl-color-white);
  }
  .rowbtn small {
    color: var(--sl-color-gray-3);
  }
  .rowbtn:focus-visible {
    outline: 2px solid var(--sl-color-text-accent);
  }
  .pal.sel .rowbtn {
    background: var(--sl-color-gray-6);
  }
  .sw {
    height: 3.25rem;
    min-width: 3.6rem;
    padding: 0.3rem 0.35rem !important;
    vertical-align: top;
    font-size: 0.6875rem;
    line-height: 1.3;
  }
  .sw span {
    display: block;
  }
  .sw .c {
    opacity: 0.8;
  }
  .sw.center {
    box-shadow: inset 0 0 0 2px var(--sl-color-bg), inset 0 0 0 3px currentColor;
  }
  .empty {
    padding: 0.5rem !important;
    color: var(--sl-color-gray-3);
  }
  .legend {
    margin: 0;
    color: var(--sl-color-gray-3);
    font-size: 0.75rem;
  }
  .foot {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 0.5rem;
  }
  /* Panel überdeckt die Matrix, aber nicht die Aktionsleiste */
  @media (min-width: 50.01rem) {
    .tg.has-panel .bar {
      margin-right: min(24rem, calc(100vw - 1.5rem));
    }
  }
  @media (max-width: 40rem) {
    .lbl {
      width: 100%;
    }
  }
</style>
