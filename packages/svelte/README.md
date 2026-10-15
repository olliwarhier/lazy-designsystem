# @lazy-designsystem/svelte

Svelte-5-Implementierung des Lazy Design Systems.

## Verwendung

```svelte
<script>
  import '@lazy-designsystem/tokens/tokens.css';
  import { Button } from '@lazy-designsystem/svelte';
</script>

<Button>Speichern</Button>
```

## Regeln

- Komponenten verwenden **nur** System- und Shape-Tokens (`var(--color-action-default-base)`), nie Hex-Werte oder Primitives. Component-Tokens werden lokal in der Komponente mit dem Figma-Namen definiert (`--button-padding-x`).
- Props, Varianten und Zustände folgen der framework-neutralen Spezifikation in der Doku (`apps/docs/src/content/docs/komponenten/`).
- Neue Komponente: Datei in `src/lib/`, Export in `src/lib/index.js`, Doku-Seite anlegen, Changeset schreiben.
