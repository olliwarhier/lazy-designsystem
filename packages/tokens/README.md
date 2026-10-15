# @lazy-designsystem/tokens

Design Tokens des Lazy Design Systems. Quelle der Wahrheit sind die **Figma Variables**; die JSON-Dateien in `src/` werden daraus exportiert (W3C-DTCG-Format mit `$value` / `$type`).

> Die aktuellen Werte sind Platzhalter, bis der erste Export aus Figma vorliegt.

## Aufbau

| Ordner | Inhalt |
| --- | --- |
| `src/primitives/` | Rohwerte (Farbpaletten). Nie direkt in Komponenten verwenden. |
| `src/semantic/` | Bedeutungs-Tokens, die auf Primitives verweisen (`{color.brand.600}`). Komponenten nutzen nur diese. |
| `src/space.json`, `src/typography.json` | Abstände, Radien, Schrift |

## Build

```bash
pnpm --filter @lazy-designsystem/tokens build
```

Erzeugt in `dist/`:

- `tokens.css` – CSS Custom Properties mit Präfix `--lazy-` (für alle Frameworks)
- `tokens.js` – ES-Modul mit Konstanten
- `docs.json` – Token-Liste für die Doku-Website

## Figma-Sync

1. Variables in Figma exportieren (z. B. mit einem DTCG-Export-Plugin oder Tokens Studio).
2. JSON nach `src/` legen, bestehende Dateien ersetzen.
3. `pnpm tokens` ausführen, Diff prüfen, Changeset anlegen.
