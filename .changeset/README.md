# Changesets

Jede Änderung an `@lazy-designsystem/tokens` oder `@lazy-designsystem/svelte` bekommt einen Changeset:

```bash
pnpm changeset
```

Damit wählst du die betroffenen Pakete, die Art der Änderung (patch / minor / major) und schreibst eine kurze Beschreibung. Vor einem Release erzeugt `pnpm version-packages` daraus Versionen und Changelogs.
