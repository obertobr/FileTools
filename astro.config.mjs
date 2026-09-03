import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  output: 'static',
  integrations: [react()],
  vite: {
    plugins: [
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        // App Shell only — não pré-cachear rotas SSG individuais
        // (economiza banda; rotas /converter/[from]-para-[to] são servidas sob demanda)
        workbox: {
          // Pré-cachear apenas o shell (JS/CSS/HTML raiz)
          globPatterns: ['**/*.{js,css,woff2}', 'index.html'],
          // Runtine cache para rotas SSG e binários wasm
          runtimeCaching: [
            {
              // Páginas SSG do catálogo (cache-first, stale-while-revalidate)
              urlPattern: ({ url }) => url.pathname.startsWith('/converter/'),
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'ssg-pages',
                expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 7 },
              },
            },
            {
              // Binários WASM (cache-first; são imutáveis por versão)
              urlPattern: ({ url }) =>
                url.pathname.endsWith('.wasm') || url.pathname.startsWith('/wasm/'),
              handler: 'CacheFirst',
              options: {
                cacheName: 'wasm-binaries',
                expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
          ],
          // Não fazer pre-cache das rotas HTML do SSG (são muitas)
          // navigateFallback não definido = rotas SSG são servidas pela rede normalmente
        },
        manifest: {
          name: 'FileTools',
          short_name: 'FileTools',
          description: 'Conversor de arquivos universal — 100% offline, no seu navegador.',
          theme_color: '#1f2937',
          background_color: '#171b24',
          display: 'standalone',
          start_url: '/',
          icons: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          ],
        },
      }),
    ],
    // Headers COOP/COEP — críticos para SharedArrayBuffer e WebAssembly multi-thread
    server: {
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
      },
    },
    // Preview server também precisa dos headers
    preview: {
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
      },
    },
  },
});
