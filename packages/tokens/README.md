# @lazy-designsystem/tokens

Design Tokens des Lazy Design Systems. Quelle der Wahrheit sind die **Figma Variables** – die JSON-Dateien in `src/` sind ein Export daraus (aktuell: DS Template).

## Aufbau

| Datei | Figma-Collection |
| --- | --- |
| `src/primitives.json` | Primitives – Base-Scale, Paletten, Schriften |
| `src/theme.json` | Theme – Paletten-Zuordnung je Theme |
| `src/system.json` | System – Farbrollen (Light / Dark) |
| `src/responsive.json` | Responsive – Typescale, Spacing, Sizing (Desktop / Mobile) |
| `src/components.json` | Components – Größen je Komponente (Small / Medium / Large) |
| `src/shapes.json` | Shapes – Rundungen |

Format und Regeln: Doku → Tokens → [Austauschformat](https://olliwarhier.github.io/lazy-designsystem/tokens/austauschformat/).

## Build

```bash
pnpm --filter @lazy-designsystem/tokens build
```

Erzeugt in `dist/`:

- `tokens.css` – CSS Custom Properties nach der Token-Spezifikation (für alle Frameworks)
- `tokens.json` – alle Tokens aufgelöst je Modus, inkl. Hex-Werten und Component-Tokens (für Doku, Tools und LLMs)

## Aus Figma aktualisieren

1. `scripts/figma-export.js` in der Figma-Datei ausführen (per Figma-MCP-Server oder Plugin), Ergebnis speichern.
2. `node scripts/write-export.mjs <export.json> […]` schreibt die Dateien in `src/`.
3. Optional prüfen: `node scripts/write-export.mjs --check <fingerprints.json>`.
4. `pnpm tokens`, Diff prüfen, Changeset anlegen.
