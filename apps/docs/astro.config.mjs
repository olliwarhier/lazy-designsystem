// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import svelte from '@astrojs/svelte';

export default defineConfig({
  // GitHub Pages: https://olliwarhier.github.io/lazy-designsystem/
  // Bei eigener Domain: site auf die Domain setzen und base entfernen.
  site: 'https://olliwarhier.github.io',
  base: '/lazy-designsystem',
  integrations: [
    starlight({
      title: 'Lazy Design System',
      defaultLocale: 'root',
      locales: {
        root: { label: 'Deutsch', lang: 'de' },
      },
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/olliwarhier/lazy-designsystem' },
      ],
      editLink: {
        baseUrl: 'https://github.com/olliwarhier/lazy-designsystem/edit/master/apps/docs/',
      },
      customCss: ['@lazy-designsystem/tokens/tokens.css', './src/styles/custom.css'],
      sidebar: [
        {
          label: 'Einstieg',
          items: ['einstieg/installation'],
        },
        { label: 'Prinzipien', autogenerate: { directory: 'prinzipien' } },
        { label: 'Foundations', autogenerate: { directory: 'foundations' } },
        { label: 'Tokens', autogenerate: { directory: 'tokens' } },
        { label: 'Komponenten', autogenerate: { directory: 'komponenten' } },
        { label: 'Mitwirken', autogenerate: { directory: 'mitwirken' } },
      ],
    }),
    svelte(),
  ],
});
