// Baut die Design Tokens aus src/**/*.json (W3C-DTCG-Format) in alle Zielformate.
// Quelle der Wahrheit sind die Figma Variables – die JSON-Dateien werden daraus exportiert.
import StyleDictionary from 'style-dictionary';

const rawValue = (token) => token.original.$value ?? token.original.value;

// Eigenes Format für die Doku: eine Liste aller Tokens mit CSS-Variable, Wert und Referenz.
StyleDictionary.registerFormat({
  name: 'json/docs',
  format: ({ dictionary }) =>
    JSON.stringify(
      dictionary.allTokens.map((token) => {
        const raw = rawValue(token);
        return {
          path: token.path.join('.'),
          cssVar: `--${token.name}`,
          value: token.$value ?? token.value,
          type: token.$type ?? token.type,
          reference: typeof raw === 'string' && raw.startsWith('{') ? raw : null,
          description: token.$description ?? token.comment ?? '',
        };
      }),
      null,
      2,
    ),
});

const sd = new StyleDictionary({
  source: ['src/**/*.json'],
  platforms: {
    css: {
      prefix: 'lazy',
      transforms: ['attribute/cti', 'name/kebab', 'color/css'],
      buildPath: 'dist/',
      files: [
        {
          destination: 'tokens.css',
          format: 'css/variables',
          options: { outputReferences: true },
        },
        {
          destination: 'docs.json',
          format: 'json/docs',
        },
      ],
    },
    js: {
      transforms: ['attribute/cti', 'name/camel', 'color/css'],
      buildPath: 'dist/',
      files: [
        {
          destination: 'tokens.js',
          format: 'javascript/es6',
        },
      ],
    },
  },
});

await sd.cleanAllPlatforms();
await sd.buildAllPlatforms();
