<script lang="ts">
  // Chroma über Lightness: angefordert (Kurve), tatsächlich (nach Gamut-Mapping) und sRGB-Grenze.
  import { maxChroma, type Tint } from '@lazy-designsystem/engine';

  let { tints, hue, center, cap }: { tints: Tint[]; hue: number; center: number; cap: number } = $props();

  const W = 600;
  const H = 120;
  const pad = { l: 34, r: 18, t: 8, b: 20 };
  const yMax = $derived(Math.max(cap, 0.05));
  // L 100 links, wie bei den Swatches
  const x = (l: number) => pad.l + ((100 - l) / 100) * (W - pad.l - pad.r);
  const y = (c: number) => H - pad.b - (Math.min(c, yMax) / yMax) * (H - pad.t - pad.b);

  const gamut = $derived(
    Array.from({ length: 51 }, (_, i) => i * 2)
      .map((l) => `${x(l)},${y(maxChroma(l, hue))}`)
      .join(' '),
  );
  // x = echtes L (im Modus Kontrast weicht es von der Stufe ab)
  const sorted = $derived([...tints].sort((a, b) => a.lReal - b.lReal));
  const requested = $derived(sorted.map((t) => `${x(t.lReal)},${y(t.c)}`).join(' '));
  const mapped = $derived(sorted.map((t) => `${x(t.lReal)},${y(t.cMapped)}`).join(' '));
  const ticks = $derived([0, yMax / 2, yMax]);
</script>

<figure class="chart">
  <svg viewBox="0 0 {W} {H}" role="img" aria-label="Chroma über Lightness">
    {#each ticks as c}
      <line x1={pad.l} x2={W - pad.r} y1={y(c)} y2={y(c)} class="grid" />
      <text x={pad.l - 4} y={y(c) + 3} text-anchor="end">{c.toFixed(2)}</text>
    {/each}
    {#each [100, 75, 50, 25, 0] as l}
      <text x={x(l)} y={H - 6} text-anchor="middle">L {l}</text>
    {/each}
    <line x1={x(center)} x2={x(center)} y1={pad.t} y2={H - pad.b} class="center" />
    <polyline points={gamut} class="gamut" />
    <polyline points={requested} class="requested" />
    <polyline points={mapped} class="mapped" />
    {#each sorted as t}
      <circle cx={x(t.lReal)} cy={y(t.cMapped)} r="3.5" fill={t.hex} class:clipped={t.clipped} />
    {/each}
  </svg>
  <figcaption>
    <span class="key gamut"></span> sRGB-Grenze
    <span class="key requested"></span> Kurve (angefordert)
    <span class="key mapped"></span> tatsächlich · Punkte mit Rand: gekappt
  </figcaption>
</figure>

<style>
  .chart {
    margin: 0.75rem 0 0;
  }
  svg {
    width: 100%;
    height: auto;
    display: block;
  }
  text {
    font-size: 10px;
    fill: var(--sl-color-gray-3);
  }
  .grid {
    stroke: var(--sl-color-gray-6);
  }
  .center {
    stroke: var(--sl-color-gray-4);
    stroke-dasharray: 3 3;
  }
  polyline {
    fill: none;
    stroke-width: 2;
  }
  .gamut {
    stroke: var(--sl-color-gray-5);
    stroke-width: 6;
    stroke-linejoin: round;
  }
  .requested {
    stroke: var(--sl-color-gray-3);
    stroke-dasharray: 5 4;
  }
  .mapped {
    stroke: var(--sl-color-text);
  }
  circle {
    stroke: var(--sl-color-bg);
    stroke-width: 1;
  }
  circle.clipped {
    stroke: var(--sl-color-text);
    stroke-width: 1.5;
  }
  figcaption {
    font-size: 0.75rem;
    color: var(--sl-color-gray-3);
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 0.75rem;
    align-items: center;
  }
  .key {
    display: inline-block;
    width: 1.25rem;
    height: 0;
    border-top: 2px solid var(--sl-color-text);
    margin-right: -0.5rem;
  }
  .key.gamut {
    border-top: 6px solid var(--sl-color-gray-5);
  }
  .key.requested {
    border-top: 2px dashed var(--sl-color-gray-3);
  }
</style>
