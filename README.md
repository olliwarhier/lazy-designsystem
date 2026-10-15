# Lazy Design System

Design Tokens, Komponenten und Dokumentation des Lazy Design Systems. Quelle der Gestaltung ist Figma; dieses Repo macht daraus Code für verschiedene Frameworks – beginnend mit **Svelte** – und eine Doku-Website.

**Doku:** https://olliwarhier.github.io/lazy-designsystem/

## Struktur

```
packages/
  tokens/    @lazy-designsystem/tokens – Tokens aus Figma → CSS, JS, Doku-JSON
  svelte/    @lazy-designsystem/svelte – Svelte-5-Komponenten
apps/
  docs/      Astro + Starlight – die Doku-Website
docs-templates/
  komponente.mdx – Vorlage für neue Komponentenseiten
```

## Loslegen

Voraussetzungen: Node 20+ und pnpm (`corepack enable`).

```bash
pnpm install
pnpm dev        # baut die Pakete und startet die Doku auf localhost:4321
pnpm build      # baut alles
```

## Arbeitsweise

- **Tokens** ändern sich in Figma und werden nach `packages/tokens/src/` exportiert → `pnpm tokens`.
- **Komponenten**: erst Spezifikation in der Doku, dann Implementierung. Siehe Doku → Mitwirken.
- **Versionen**: jede Paketänderung bekommt einen Changeset (`pnpm changeset`).
- **Deployment**: jeder Push auf `master` baut die Doku und veröffentlicht sie über GitHub Pages.
