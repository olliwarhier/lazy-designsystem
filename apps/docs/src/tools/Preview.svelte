<script lang="ts">
  // Beispiel-Oberfläche, die nur die generierten Rollen-Variablen nutzt.
  let { vars, label, signal = false }: { vars: Record<string, string>; label: string; signal?: boolean } = $props();

  const style = $derived(
    Object.entries(vars)
      .map(([k, v]) => `${k}:${v}`)
      .join(';'),
  );
  const feedback = ['error', 'warning', 'success', 'information'] as const;
  const feedbackLabel = { error: 'Fehler', warning: 'Warnung', success: 'Erfolg', information: 'Info' };
  const has = (role: string) => `--color-${role}-default-base` in vars;
</script>

<div class="pv" {style}>
  <div class="pv-label">{label}</div>
  <div class="pv-brand">
    <strong>Lazy</strong>
    <span class="pv-chip brand">Neu</span>
  </div>

  <div class="pv-body">
    <div class="pv-card">
      <h4>Kartentitel</h4>
      <p class="subtle">Subtle-Text für Beschreibungen, nicht kleiner als Body/Medium.</p>
      <p class="subtler">Subtler: Metadaten · 26. Oktober</p>
      <hr />
      <div class="pv-row">
        <button class="btn bold">Action</button>
        <button class="btn bold is-hover" tabindex="-1">Hover</button>
        <button class="btn bold is-pressed" tabindex="-1">Pressed</button>
      </div>
      <div class="pv-row">
        <button class="btn base">Base</button>
        <button class="btn subtle">Subtle</button>
        <button class="btn ghost">Ghost</button>
        <button class="btn ghost is-hover" tabindex="-1">Ghost Hover</button>
      </div>
      <div class="pv-row">
        <span class="pv-input">Eingabe</span>
        <span class="pv-input is-focus">Fokus</span>
        {#if signal}<span class="pv-chip signal">Signal</span>{/if}
      </div>
    </div>

    <div class="pv-alerts">
      {#each feedback as f}
        {#if has(f)}
          <div class="pv-alert {f}">
            <span class="pv-badge {f}">{feedbackLabel[f]}</span>
            <span>Hinweistext auf Subtle</span>
          </div>
        {/if}
      {/each}
    </div>

    <div class="pv-bold">
      <span>Surface Bold</span>
      <span class="subtle">mit On-Surface Subtle</span>
    </div>

    <div class="pv-inverted">
      <strong>Inverted</strong>
      <span class="subtle">Tooltip oder Toast</span>
    </div>

    <div class="pv-elevated">
      <div class="pv-scrim"><span>Scrim</span></div>
      <div class="pv-raised">Schatten</div>
    </div>
  </div>
</div>

<style>
  .pv {
    font-family: system-ui, sans-serif;
    font-size: 0.8125rem;
    line-height: 1.4;
    background: var(--color-surface-default-base);
    color: var(--color-on-surface-default-base);
    color-scheme: normal;
    border: 1px solid var(--sl-color-gray-5);
    border-radius: 0.5rem;
    overflow: hidden;
    min-width: 0;
  }
  .pv-label {
    padding: 0.25rem 0.75rem;
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--color-on-surface-default-subtler);
    background: var(--color-surface-default-bold);
  }
  .pv-brand {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0.75rem;
    background: var(--color-brand-default-bold);
    color: var(--color-on-brand-default-bold);
  }
  .pv-body {
    display: grid;
    gap: 0.625rem;
    padding: 0.75rem;
  }
  .pv-card {
    display: grid;
    gap: 0.375rem;
    padding: 0.75rem;
    background: var(--color-surface-default-subtle);
    border: 1px solid var(--color-outline-default-subtle);
    border-radius: 0.5rem;
  }
  h4 {
    margin: 0;
    font-size: 0.9375rem;
    color: var(--color-on-surface-default-base);
  }
  p {
    margin: 0;
  }
  .subtle {
    color: var(--color-on-surface-default-subtle);
  }
  .subtler {
    color: var(--color-on-surface-default-subtler);
    font-size: 0.75rem;
  }
  hr {
    border: 0;
    border-top: 1px solid var(--color-outline-default-subtler);
    margin: 0.25rem 0;
    width: 100%;
  }
  .pv-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
    align-items: center;
  }
  .btn {
    font: inherit;
    font-weight: 600;
    padding: 0.3rem 0.7rem;
    border-radius: 0.375rem;
    border: 1px solid transparent;
    cursor: pointer;
    position: relative;
  }
  .btn.bold {
    background: var(--color-action-default-bold);
    color: var(--color-on-action-default-bold);
  }
  .btn.bold:hover,
  .btn.bold.is-hover {
    background: var(--color-action-default-bold-hovered);
  }
  .btn.bold:active,
  .btn.bold.is-pressed {
    background: var(--color-action-default-bold-pressed);
  }
  .btn.base {
    background: var(--color-action-default-base);
    color: var(--color-on-action-default-base);
  }
  .btn.base:hover {
    background: var(--color-action-default-base-hovered);
  }
  .btn.base:active {
    background: var(--color-action-default-base-pressed);
  }
  .btn.subtle {
    background: var(--color-action-default-subtle);
    color: var(--color-on-action-default-subtle);
  }
  .btn.ghost {
    background: transparent;
    color: var(--color-action-default-bold);
  }
  .btn.ghost:hover,
  .btn.ghost.is-hover {
    background: var(--color-hovered-default-base);
  }
  .btn.ghost:active {
    background: var(--color-pressed-default-base);
  }
  .btn:focus-visible,
  .pv-input.is-focus {
    outline: 2px solid var(--color-focused-default-inner);
    box-shadow: 0 0 0 4px var(--color-focused-default-base);
  }
  .pv-input {
    padding: 0.3rem 0.6rem;
    min-width: 6rem;
    border: 1px solid var(--color-outline-default-bold);
    border-radius: 0.375rem;
    color: var(--color-on-surface-default-subtler);
    background: var(--color-surface-default-subtle);
  }
  .pv-chip {
    padding: 0.1rem 0.5rem;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 600;
  }
  .pv-chip.brand {
    background: var(--color-brand-default-subtle);
    color: var(--color-on-brand-default-subtle);
  }
  .pv-chip.signal {
    background: var(--color-signal-default-base);
    color: var(--color-on-signal-default-base);
  }
  .pv-alerts {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
    gap: 0.375rem;
  }
  .pv-alert {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    padding: 0.4rem 0.5rem;
    border-radius: 0.375rem;
  }
  .pv-badge {
    padding: 0.05rem 0.4rem;
    border-radius: 0.25rem;
    font-size: 0.6875rem;
    font-weight: 700;
  }
  .pv-alert.error {
    background: var(--color-error-default-subtle);
    color: var(--color-on-error-default-subtle);
  }
  .pv-badge.error {
    background: var(--color-error-default-base);
    color: var(--color-on-error-default-base);
  }
  .pv-alert.warning {
    background: var(--color-warning-default-subtle);
    color: var(--color-on-warning-default-subtle);
  }
  .pv-badge.warning {
    background: var(--color-warning-default-base);
    color: var(--color-on-warning-default-base);
  }
  .pv-alert.success {
    background: var(--color-success-default-subtle);
    color: var(--color-on-success-default-subtle);
  }
  .pv-badge.success {
    background: var(--color-success-default-base);
    color: var(--color-on-success-default-base);
  }
  .pv-alert.information {
    background: var(--color-information-default-subtle);
    color: var(--color-on-information-default-subtle);
  }
  .pv-badge.information {
    background: var(--color-information-default-base);
    color: var(--color-on-information-default-base);
  }
  .pv-bold {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: var(--color-surface-default-bold);
    border-radius: 0.375rem;
  }
  .pv-inverted {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: var(--color-surface-inverted-bold);
    color: var(--color-on-surface-inverted-base);
    border-radius: 0.375rem;
  }
  .pv-inverted .subtle {
    color: var(--color-on-surface-inverted-subtle);
  }
  .pv-elevated {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }
  .pv-scrim {
    position: relative;
    min-height: 3.25rem;
    border-radius: 0.375rem;
    background: linear-gradient(135deg, var(--color-brand-default-base), var(--color-action-default-bold));
    overflow: hidden;
  }
  .pv-scrim::after {
    content: '';
    position: absolute;
    inset: 0 0 0 50%;
    background: var(--color-scrim-default-base);
  }
  .pv-scrim span {
    position: absolute;
    right: 0.5rem;
    bottom: 0.25rem;
    z-index: 1;
    color: #fff;
    font-weight: 600;
  }
  .pv-raised {
    display: grid;
    place-items: center;
    border-radius: 0.375rem;
    background: var(--color-surface-default-subtle);
    box-shadow:
      0 1px 2px var(--color-shadow-default-base),
      0 4px 12px var(--color-shadow-default-base);
  }
</style>
