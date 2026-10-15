// Liest alle lokalen Variable Collections einer Figma-Datei und gibt sie im
// Austauschformat des Lazy Design Systems zurück (W3C-DTCG-JSON mit Modi).
//
// Läuft überall, wo die Figma Plugin API verfügbar ist:
//  - über den Figma-MCP-Server (use_figma): Inhalt einfügen und am Ende
//    `return await exportVariables()` ergänzen
//  - in einem Figma-Plugin: exportVariables() aufrufen und das Ergebnis speichern
//
// Das Ergebnis wird mit `node scripts/write-export.mjs <datei.json> [...]` in
// packages/tokens/src/ geschrieben (eine Datei je Collection).
//
// Der MCP-Server begrenzt die Größe einer Antwort. Mit den Optionen lässt sich
// der Export in Teile zerlegen, die write-export.mjs wieder zusammenführt:
//   exportVariables({ collection: 'Primitives', from: 0, to: 60 })
//
// Mit { fingerprint: true } wird statt der Tokens nur eine Prüfsumme je
// Collection zurückgegeben. write-export.mjs --check vergleicht sie mit den
// Dateien im Repo – so lässt sich prüfen, ob Repo und Figma übereinstimmen.
//
// Werte:
//  - Verweis auf eine andere Variable:      "{palette.clay.70}"
//  - Verweis mit eigener Deckkraft:         { "ref": "{palette.clay.70}", "alpha": 0.64 }
//  - Farbe:                                 "#rrggbb" bzw. "#rrggbbaa" (sRGB, wie in Figma)
//  - Zahl, Text, Boolean:                   unverändert
// Der Standard-Modus steht in $value, alle weiteren unter $extensions.lazy.modes.

async function exportVariables(options = {}) {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const variables = await figma.variables.getLocalVariablesAsync();
  const byId = new Map(variables.map((v) => [v.id, v]));

  const segment = (s) => s.trim().toLowerCase().replace(/\s+/g, '-');
  const pathOf = (name) => name.split('/').map(segment);
  const refOf = (id) => {
    const target = byId.get(id);
    if (!target) throw new Error('Verweis auf unbekannte Variable: ' + id);
    return '{' + pathOf(target.name).join('.') + '}';
  };
  const hex = (n) => Math.round(n * 255).toString(16).padStart(2, '0');

  const encode = (value) => {
    if (value === null || value === undefined) return null;
    if (typeof value !== 'object') return value;
    if (value.type === 'VARIABLE_ALIAS') return refOf(value.id);
    // Alias mit eigener Deckkraft (Figma speichert opacity in Prozent)
    if ('color' in value && value.color && value.color.type === 'VARIABLE_ALIAS') {
      const alpha = typeof value.opacity === 'number' ? value.opacity / 100 : 1;
      return { ref: refOf(value.color.id), alpha: Math.round(alpha * 1000) / 1000 };
    }
    if ('r' in value) {
      const a = typeof value.a === 'number' && value.a < 1 ? hex(value.a) : '';
      return '#' + hex(value.r) + hex(value.g) + hex(value.b) + a;
    }
    throw new Error('Unbekannter Werttyp: ' + JSON.stringify(value));
  };

  const typeOf = { COLOR: 'color', FLOAT: 'number', STRING: 'string', BOOLEAN: 'boolean' };

  const result = {
    source: { file: figma.root.name, exportedAt: new Date().toISOString() },
    collections: [],
  };

  for (const collection of collections) {
    if (options.collection && collection.name !== options.collection) continue;
    const defaultMode = collection.modes.find((m) => m.modeId === collection.defaultModeId);
    const otherModes = collection.modes.filter((m) => m.modeId !== collection.defaultModeId);
    const tokens = {};
    const own = variables.filter((v) => v.variableCollectionId === collection.id);
    const slice = own.slice(options.from ?? 0, options.to ?? own.length);

    for (const variable of slice) {
      const path = pathOf(variable.name);
      let node = tokens;
      for (const key of path.slice(0, -1)) {
        if (node[key] && '$value' in node[key]) throw new Error('Pfad ist Token und Gruppe zugleich: ' + variable.name);
        node = node[key] ||= {};
      }
      const leaf = path[path.length - 1];
      if (node[leaf]) throw new Error('Doppelter Pfad: ' + variable.name);

      const token = {
        $type: typeOf[variable.resolvedType],
        $value: encode(variable.valuesByMode[defaultMode.modeId]),
      };
      if (variable.description) token.$description = variable.description;

      const lazy = { figma: variable.name };
      if (otherModes.length) {
        lazy.modes = {};
        for (const mode of otherModes) lazy.modes[mode.name] = encode(variable.valuesByMode[mode.modeId]);
      }
      token.$extensions = { lazy };
      node[leaf] = token;
    }

    const entry = { name: collection.name, modes: [defaultMode.name, ...otherModes.map((m) => m.name)], count: own.length };
    if (options.fingerprint) entry.fingerprint = fingerprint(tokens);
    else entry.tokens = tokens;
    result.collections.push(entry);
  }

  return result;
}

// FNV-1a über eine kanonische JSON-Darstellung (Schlüssel sortiert).
// Dieselbe Funktion steht in write-export.mjs.
function fingerprint(value) {
  const canonical = (v) =>
    Array.isArray(v)
      ? '[' + v.map(canonical).join(',') + ']'
      : v && typeof v === 'object'
        ? '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}'
        : JSON.stringify(v);
  const text = canonical(value);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}
