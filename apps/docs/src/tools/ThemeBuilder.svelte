<script lang="ts">
  // Prototyp Theme-Builder nach Spezifikation 04, 05 und 11. Rechnet mit @lazy-designsystem/engine.
  import {
    GROUP_LABEL,
    MODES,
    MODE_LABEL,
    PRESETS,
    buildTheme,
    cssVars,
    formatContrast,
    schemeOf,
    toCss,
    type GroupKey,
    type Mode,
    type PresetKey,
    type Token,
  } from '@lazy-designsystem/engine';
  import { defaultConfig, replaceStudio, snapshot, studio } from './store.svelte';
  import Preview from './Preview.svelte';
  import './tool.css';

  let mode: Mode = $state('light');
  let exportText = $state('');
  let notice = $state('');

  const theme = $derived(buildTheme(snapshot()));
  const result = $derived(theme.modes[mode]);
  const system = $derived(studio.scale.system);
  const signalOn = $derived(studio.options.signal);

  const CATEGORY: [string, (t: Token) => boolean][] = [
    ['Basic', (t) => t.path.startsWith('Basic/') && !t.path.startsWith('Basic/Outline')],
    ['Corporate', (t) => t.path.startsWith('Corporate/')],
    ['Feedback', (t) => t.path.startsWith('Feedback/')],
  ];
  const editable = $derived(result.tokens.filter((t) => t.kind === 'tint' && t.candidates));
  const automatic = $derived(result.tokens.filter((t) => !(t.kind === 'tint' && t.candidates) && t.kind !== 'derived'));
  const derived = $derived(result.tokens.filter((t) => t.kind === 'derived'));
  const counts = $derived(
    Object.fromEntries(MODES.map((m) => [m, theme.modes[m].tokens.filter((t) => t.status === 'error').length + '/' + theme.modes[m].tokens.filter((t) => t.status === 'warning' || t.status === 'adjusted').length])),
  );

  const groups: GroupKey[] = ['neutral', 'brand', 'action', 'signal', 'error', 'warning', 'success', 'information'];
  const optionalGroup = (g: GroupKey) => g === 'signal' || g === 'information';

  function setGroup(g: GroupKey, value: string) {
    studio.groups[g] = value || null;
    if (g === 'signal') studio.options.signal = !!value;
    if (g === 'information') studio.options.information = !!value;
  }

  function pick(t: Token, l: number) {
    (studio.overrides[mode] ??= {})[t.id] = l;
  }
  function reset(t: Token) {
    const o = studio.overrides[mode];
    if (o) delete o[t.id];
  }
  function resetMode() {
    studio.overrides[mode] = {};
  }

  const presetText = (key: PresetKey | undefined, kind: 'min' | 'max') =>
    key ? `${kind === 'min' ? 'min' : 'max'} ${PRESETS[key].label} (${system === 'apca' ? `Lc ${PRESETS[key].apca}` : `${PRESETS[key].wcag}:1`})` : '';

  const statusLabel: Record<Token['status'], string> = { ok: 'ok', override: 'manuell', adjusted: 'angepasst', warning: 'Hinweis', error: 'Fehler' };

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      notice = `${what} kopiert`;
    } catch {
      notice = 'Kopieren nicht möglich, bitte aus dem Feld kopieren';
    }
    setTimeout(() => (notice = ''), 2500);
  }
  function showCss() {
    exportText = toCss(theme);
  }
  function showJson() {
    exportText = JSON.stringify(snapshot(), null, 2);
  }
  function importJson() {
    try {
      replaceStudio(JSON.parse(exportText));
      notice = 'Konfiguration geladen';
    } catch {
      notice = 'Kein gültiges JSON';
    }
    setTimeout(() => (notice = ''), 2500);
  }

  const SCHEMES = ['light', 'dark'] as const;
  const opacityRows: [keyof typeof studio.options.opacity.light, string][] = [
    ['outlineSubtle', 'Outline Subtle'],
    ['outlineSubtler', 'Outline Subtler'],
    ['hovered', 'Hovered (ungefüllt)'],
    ['pressed', 'Pressed (ungefüllt)'],
    ['scrim', 'Scrim'],
    ['shadow', 'Shadow'],
  ];
  const pct = (v: number) => `${Math.round(v * 100)} %`;
</script>

<div class="tool not-content">
  <section class="panel">
    <header>
      <h3>Einstellungen</h3>
      <div class="actions">
        <a href="../tint-generator/">Paletten bearbeiten →</a>
      </div>
    </header>
    <div class="grid">
      <label>
        <span>Kontrastsystem</span>
        <select bind:value={studio.scale.system}>
          <option value="apca">APCA</option>
          <option value="wcag">WCAG 2 (AAA-Presets)</option>
        </select>
      </label>
      <label class="check">
        <input type="checkbox" bind:checked={studio.options.checkBoth} />
        <span>anderes System zusätzlich prüfen</span>
      </label>
      <label class="check">
        <input type="checkbox" bind:checked={studio.options.warningDecoupled} />
        <span>Warning entkoppelt <small>(sonst synchron mit Error)</small></span>
      </label>
      <label>
        <span>Fokusring außen</span>
        <select bind:value={studio.focus}>
          <option value={null}>Schwarz (Standard)</option>
          {#each studio.palettes as p}<option value={p.id}>{p.name}</option>{/each}
        </select>
      </label>
    </div>

    <h4>Paletten je Rollengruppe</h4>
    <div class="grid">
      {#each groups as g}
        <label>
          <span>{GROUP_LABEL[g]}</span>
          <select value={studio.groups[g] ?? ''} onchange={(e) => setGroup(g, e.currentTarget.value)}>
            {#if optionalGroup(g)}<option value="">{g === 'signal' ? 'aus (Fallback auf Action)' : 'aus'}</option>{/if}
            {#each studio.palettes.filter((p) => (g === 'neutral' ? p.type === 'neutral' : true)) as p}
              <option value={p.id}>{p.name}{p.type === 'neutral' ? ' (Neutral)' : ''}</option>
            {/each}
          </select>
        </label>
      {/each}
    </div>
    {#if theme.warnings.length}
      <ul class="warnings">
        {#each theme.warnings as w}<li>{w}</li>{/each}
      </ul>
    {/if}
  </section>

  <section class="panel">
    <header>
      <h3>Offene Punkte zum Ausprobieren <small>Spec 11, 2.3 und Funde aus dem Prototyp</small></h3>
    </header>
    <div class="grid">
      <label>
        <span>Dark-Faktor Chroma <output>{studio.options.darkChromaFactor.toFixed(2)}</output></span>
        <input type="range" min="0.4" max="1" step="0.05" bind:value={studio.options.darkChromaFactor} />
        <small>reduziert Chroma heller Tints im Dark Mode, 1 = aus</small>
      </label>
      <label>
        <span>Dunkelster Hintergrund <output>L {studio.scale.lower}</output></span>
        <input type="range" min="0" max="20" step="1" bind:value={studio.scale.lower} />
        <small>unterer Außenpunkt (Material ≈ 6, Tailwind ≈ 15)</small>
      </label>
      <label>
        <span>Hover-Grenze gefüllter Elemente</span>
        <select bind:value={studio.options.hoverThreshold}>
          <option value={30}>L 0,3 (Vorschlag)</option>
          <option value={50}>L 0,5 (Ausgangspunkt)</option>
        </select>
        <small>darüber dunkler, darunter heller (±0,08 / ±0,16)</small>
      </label>
      <label>
        <span>On-Rollen auf Base-Flächen</span>
        <select bind:value={studio.options.onBasePreset}>
          <option value="body">Body (Spec 05)</option>
          <option value="large">Large</option>
        </select>
        <small>Bei APCA findet sich mit Body kaum eine Base-Fläche</small>
      </label>
    </div>
    <table class="opacity">
      <thead><tr><th>Opacity</th><th>Light</th><th>Dark</th></tr></thead>
      <tbody>
        {#each opacityRows as [key, label]}
          <tr>
            <th scope="row">{label}</th>
            {#each SCHEMES as s}
              <td>
                <input type="range" min="0" max="0.8" step="0.02" bind:value={studio.options.opacity[s][key]} aria-label="{label} {s}" />
                <output>{pct(studio.options.opacity[s][key])}</output>
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </section>

  <section class="panel">
    <header>
      <h3>Vorschau <small>alle vier Modes, Hover und Pressed live</small></h3>
    </header>
    <div class="previews">
      {#each MODES as m}
        <Preview vars={cssVars(theme, m)} label={MODE_LABEL[m]} signal={signalOn} />
      {/each}
    </div>
  </section>

  <section class="panel">
    <header>
      <h3>Rollen</h3>
      <div class="actions">
        <div class="tabs" role="tablist" aria-label="Mode">
          {#each MODES as m}
            <button type="button" role="tab" aria-selected={mode === m} class:active={mode === m} onclick={() => (mode = m)}>
              {MODE_LABEL[m]} <small title="Fehler / Hinweise">{counts[m]}</small>
            </button>
          {/each}
        </div>
        <button type="button" class="ghost" onclick={resetMode}>Manuelle Wahl in {MODE_LABEL[mode]} zurücksetzen</button>
      </div>
    </header>
    <p class="hint">
      {#if mode === 'light'}Light ist die Basis. Klick auf einen Tint setzt ihn manuell, ausgegraute Tints sind nicht wählbar (Grund im Tooltip).
      {:else if mode === 'dark'}Dark wird nach Kontrast gespiegelt: je Rolle der gültige Tint, dessen Kontrast dem Light-Wert am nächsten kommt.
      {:else}High Contrast leitet sich aus {MODE_LABEL[schemeOf(mode)]} ab: On-Rollen nach außen, Base-Flächen weg vom Zentrum, Outlines stärker und deckend.{/if}
    </p>

    {#each CATEGORY as [name, match]}
      <h4>{name}</h4>
      <div class="roles">
        {#each editable.filter(match) as t (t.id)}
          <div class="role" class:synced={!!t.syncedTo}>
            <div class="role-name">
              <code>{t.path}</code>
              <span class="badge {t.status}">{statusLabel[t.status]}</span>
              {#if t.status === 'override' || t.status === 'adjusted'}
                <button type="button" class="link" onclick={() => reset(t)} title="Automatische Wahl">↺</button>
              {/if}
            </div>
            <div class="strip">
              {#if t.syncedTo}
                <span class="hint">folgt {t.syncedTo.split('/')[0]} (synchron)</span>
              {:else}
                {#each t.candidates ?? [] as c (c.l)}
                  <button
                    type="button"
                    class="chip"
                    class:invalid={!c.valid}
                    class:selected={c.l === t.l}
                    style:background={c.hex}
                    disabled={!c.valid}
                    title="{c.name}{c.contrast !== null ? ` · ${formatContrast(c.contrast, system)}` : ''}{c.valid ? '' : ` · ${c.reasons.join(', ')}`}"
                    onclick={() => pick(t, c.l)}
                    aria-label="{c.name}{c.valid ? '' : ' (nicht wählbar)'}"
                  ></button>
                {/each}
              {/if}
            </div>
            <div class="role-value">
              <span class="sw" style:background={t.css}></span>
              <strong>{t.tintName}</strong>
              {#if t.contrast}
                <span class:active={system === 'apca'}>Lc {Math.round(t.contrast.apca)}</span>
                <span class:active={system === 'wcag'}>{t.contrast.wcag.toFixed(2).replace('.', ',')}:1</span>
                <small>{presetText(t.contrast.min, 'min')} {presetText(t.contrast.max, 'max')} · gegen {t.contrast.against}</small>
              {/if}
            </div>
            {#if t.messages.length}<div class="msgs">{t.messages.join(' ')}</div>{/if}
          </div>
        {/each}
      </div>
    {/each}

    <h4>Automatisch und schreibgeschützt</h4>
    <table class="auto">
      <tbody>
        {#each automatic as t (t.id)}
          <tr>
            <td><span class="sw" style:background={t.css}></span></td>
            <td><code>{t.path}</code></td>
            <td>{t.tintName ?? ''} <small>{t.css}</small></td>
            <td>
              {#if t.contrast}
                <span class:active={system === 'apca'}>Lc {Math.round(t.contrast.apca)}</span> ·
                <span class:active={system === 'wcag'}>{t.contrast.wcag.toFixed(2).replace('.', ',')}:1</span>
                {#if t.contrast.min}<small>{presetText(t.contrast.min, 'min')}</small>{/if}
              {/if}
            </td>
            <td><span class="badge {t.status}">{statusLabel[t.status]}</span> <small>{t.messages.join(' ')}</small></td>
          </tr>
        {/each}
      </tbody>
    </table>

    <h4>Hover und Pressed gefüllter Elemente <small>gegen die On-Farbe geprüft</small></h4>
    <table class="auto">
      <tbody>
        {#each derived as t (t.id)}
          <tr>
            <td><span class="sw" style:background={t.css}></span></td>
            <td><code>{t.path}</code></td>
            <td><small>{t.messages[0]}</small></td>
            <td>
              {#if t.contrast}
                <span class:active={system === 'apca'}>Lc {Math.round(t.contrast.apca)}</span> ·
                <span class:active={system === 'wcag'}>{t.contrast.wcag.toFixed(2).replace('.', ',')}:1</span>
              {/if}
            </td>
            <td><span class="badge {t.status}">{statusLabel[t.status]}</span> <small>{t.messages.slice(1).join(' ')}</small></td>
          </tr>
        {/each}
      </tbody>
    </table>
  </section>

  <section class="panel">
    <header>
      <h3>Export</h3>
      <div class="actions">
        <button type="button" onclick={showCss}>CSS anzeigen</button>
        <button type="button" class="ghost" onclick={showJson}>Konfiguration (JSON)</button>
        <button type="button" class="ghost" onclick={importJson} disabled={!exportText.trim().startsWith('{')}>JSON laden</button>
        <button type="button" class="ghost" onclick={() => copy(exportText, 'Text')} disabled={!exportText}>Kopieren</button>
        <button type="button" class="ghost danger" onclick={() => confirm('Alles auf die Standardwerte zurücksetzen?') && replaceStudio(defaultConfig())}>Alles zurücksetzen</button>
        {#if notice}<span class="hint">{notice}</span>{/if}
      </div>
    </header>
    <textarea bind:value={exportText} rows="12" spellcheck="false" placeholder="CSS oder Konfiguration erscheinen hier. Eine Konfiguration kann hier auch eingefügt und geladen werden."></textarea>
  </section>
</div>

<style>
  h4 {
    margin: 1rem 0 0.5rem;
    font-size: 0.875rem;
    color: var(--sl-color-white);
  }
  h4 small {
    font-weight: 400;
    color: var(--sl-color-gray-3);
  }
  a {
    color: var(--sl-color-text-accent);
  }
  .warnings {
    margin: 0.75rem 0 0;
    padding-left: 1.25rem;
    color: var(--sl-color-orange-high, #fb923c);
  }
  .opacity {
    margin-top: 1rem;
    border-collapse: collapse;
    width: 100%;
    max-width: 40rem;
  }
  .opacity th,
  .opacity td {
    padding: 0.2rem 0.5rem 0.2rem 0;
    text-align: left;
    font-weight: 400;
    border: 0;
  }
  .opacity td {
    width: 40%;
  }
  .opacity td input {
    width: calc(100% - 3.5rem);
    vertical-align: middle;
  }
  .opacity td output {
    display: inline-block;
    width: 3rem;
    text-align: right;
  }
  .previews {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(max(19rem, calc(50% - 0.75rem)), 1fr));
    gap: 0.75rem;
  }
  .tabs {
    display: inline-flex;
    border: 1px solid var(--sl-color-gray-5);
    border-radius: 0.375rem;
    overflow: hidden;
  }
  .tabs button {
    border: 0;
    border-radius: 0;
    background: transparent;
    color: var(--sl-color-text);
  }
  .tabs button.active {
    background: var(--sl-color-accent);
    color: var(--sl-color-black);
  }
  .tabs small {
    opacity: 0.7;
    font-size: 0.6875rem;
  }
  .hint {
    color: var(--sl-color-gray-3);
    margin: 0;
  }
  .roles {
    display: grid;
    gap: 0.25rem;
  }
  .role {
    display: grid;
    grid-template-columns: minmax(15rem, 1.1fr) minmax(12rem, 1.3fr) minmax(14rem, 1.6fr);
    gap: 0.25rem 0.75rem;
    align-items: center;
    padding: 0.35rem 0.5rem;
    border-radius: 0.375rem;
    background: var(--sl-color-gray-7, var(--sl-color-bg-nav));
  }
  @media (max-width: 60rem) {
    .role {
      grid-template-columns: 1fr;
    }
  }
  .role.synced {
    opacity: 0.85;
  }
  .role-name {
    display: flex;
    gap: 0.375rem;
    align-items: center;
    flex-wrap: wrap;
  }
  code {
    font-size: 0.75rem;
    background: none;
    padding: 0;
    color: var(--sl-color-white);
  }
  .strip {
    display: flex;
    gap: 2px;
    flex-wrap: wrap;
  }
  .chip {
    width: 1.375rem;
    height: 1.375rem;
    padding: 0;
    border: 1px solid var(--sl-color-gray-5);
    border-radius: 0.25rem;
  }
  .chip.invalid {
    cursor: not-allowed;
    opacity: 0.35;
    background-image: linear-gradient(135deg, transparent 45%, var(--sl-color-gray-3) 45%, var(--sl-color-gray-3) 55%, transparent 55%) !important;
  }
  .chip.selected {
    outline: 2px solid var(--sl-color-text);
    outline-offset: 1px;
  }
  .role-value {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    flex-wrap: wrap;
    font-variant-numeric: tabular-nums;
  }
  .role-value small,
  .auto small {
    color: var(--sl-color-gray-3);
  }
  .active {
    font-weight: 700;
    color: var(--sl-color-white);
  }
  .sw {
    display: inline-block;
    width: 1.25rem;
    height: 1.25rem;
    border-radius: 0.25rem;
    border: 1px solid var(--sl-color-gray-5);
    background-image: none;
    vertical-align: middle;
  }
  .msgs {
    grid-column: 1 / -1;
    font-size: 0.75rem;
    color: var(--sl-color-orange-high, #fb923c);
  }
  .link {
    background: none;
    border: 0;
    color: var(--sl-color-text-accent);
    padding: 0 0.25rem;
  }
  .auto {
    width: 100%;
    border-collapse: collapse;
    display: table;
  }
  .auto td {
    padding: 0.25rem 0.5rem 0.25rem 0;
    border: 0;
    border-bottom: 1px solid var(--sl-color-gray-6);
    vertical-align: middle;
  }
  textarea {
    width: 100%;
    font-family: var(--sl-font-mono, monospace);
    font-size: 0.75rem;
  }
</style>
