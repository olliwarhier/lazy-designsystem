#!/usr/bin/env node
// Schreibt das Ergebnis von figma-export.js nach packages/tokens/src/.
//
//   node scripts/write-export.mjs teil-1.json teil-2.json …
//     Führt die Teile zusammen und schreibt eine Datei je Collection.
//
//   node scripts/write-export.mjs --check fingerprints.json
//     Vergleicht die Dateien in src/ mit den Prüfsummen aus Figma
//     (Ergebnis von exportVariables({ fingerprint: true })).
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const slug = (name) => name.trim().toLowerCase().replace(/\s+/g, '-');

export function fingerprint(value) {
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

function merge(target, source) {
  for (const [key, value] of Object.entries(source)) {
    if (value && typeof value === 'object' && !('$value' in value) && target[key]) merge(target[key], value);
    else if (target[key]) throw new Error('Doppelter Token: ' + key);
    else target[key] = value;
  }
  return target;
}

function readSources() {
  const result = {};
  for (const file of readdirSync(SRC).filter((f) => f.endsWith('.json'))) {
    const { $extensions, ...tokens } = JSON.parse(readFileSync(join(SRC, file), 'utf8'));
    result[$extensions.lazy.collection] = tokens;
  }
  return result;
}

const args = process.argv.slice(2);

if (args[0] === '--check') {
  const expected = JSON.parse(readFileSync(args[1], 'utf8')).collections;
  const actual = readSources();
  let ok = true;
  for (const c of expected) {
    const got = actual[c.name] ? fingerprint(actual[c.name]) : '(fehlt)';
    const same = got === c.fingerprint;
    ok &&= same;
    console.log(`${same ? '✓' : '✗'} ${c.name.padEnd(12)} Figma ${c.fingerprint}  Repo ${got}`);
  }
  process.exit(ok ? 0 : 1);
}

if (!args.length) {
  console.error('Verwendung: node scripts/write-export.mjs <export.json> [...] | --check <fingerprints.json>');
  process.exit(1);
}

const collections = new Map();
for (const file of args) {
  for (const c of JSON.parse(readFileSync(file, 'utf8')).collections) {
    const entry = collections.get(c.name) ?? { name: c.name, modes: c.modes, tokens: {} };
    merge(entry.tokens, c.tokens);
    collections.set(c.name, entry);
  }
}

mkdirSync(SRC, { recursive: true });
for (const c of collections.values()) {
  const file = join(SRC, slug(c.name) + '.json');
  const content = { $extensions: { lazy: { collection: c.name, modes: c.modes } }, ...c.tokens };
  writeFileSync(file, JSON.stringify(content, null, 2) + '\n');
  console.log(`${c.name} → src/${slug(c.name)}.json`);
}
