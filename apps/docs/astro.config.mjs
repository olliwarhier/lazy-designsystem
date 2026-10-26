// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import svelte from '@astrojs/svelte';

// Navigation – Pfade sind englisch und für alle Sprachen gleich,
// die Beschriftungen werden je Sprache übersetzt.
const section = (label, en, directory) => ({ label, translations: { en }, autogenerate: { directory } });

export default defineConfig({
  // GitHub Pages: https://olliwarhier.github.io/lazy-designsystem/
  // Bei eigener Domain: site auf die Domain setzen und base entfernen.
  site: 'https://olliwarhier.github.io',
  base: '/lazy-designsystem',
  integrations: [
    starlight({
      title: 'Lazy Design System',
      // Deutsch ohne Präfix (/foundations/color/), Englisch unter /en/.
      // Fehlt eine Übersetzung, zeigt Starlight die deutsche Seite mit Hinweis.
      defaultLocale: 'root',
      locales: {
        root: { label: 'Deutsch', lang: 'de' },
        en: { label: 'English', lang: 'en' },
      },
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/olliwarhier/lazy-designsystem' },
      ],
      editLink: {
        baseUrl: 'https://github.com/olliwarhier/lazy-designsystem/edit/master/apps/docs/',
      },
      customCss: ['@lazy-designsystem/tokens/tokens.css', './src/styles/custom.css'],
      sidebar: [
        section('Einführung', 'Introduction', 'introduction'),
        section('Grundlagen', 'Foundations', 'foundations'),
        section('Komponenten', 'Components', 'components'),
        section('Projekt aufsetzen', 'Set up a project', 'setup'),
        section('Werkzeuge (Prototyp)', 'Tools (prototype)', 'tools'),
        section('Referenz', 'Reference', 'reference'),
      ],
    }),
    svelte(),
  ],
});
