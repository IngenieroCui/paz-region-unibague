import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['logos/web/favicon.ico', 'logos/web/apple-touch-icon.png'],
      manifest: {
        id: '/', name: 'Paz y Región — Universidad de Ibagué', short_name: 'Paz y Región',
        description: 'Plataforma de gestión del programa Paz y Región.',
        lang: 'es', start_url: '/', scope: '/', display: 'standalone',
        theme_color: '#0D192B', background_color: '#F7F8FA',
        icons: [
          { src: '/logos/web/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/logos/web/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/logos/web/icon-192-maskable.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/logos/web/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html}', 'logos/web/*.{png,ico}'],
        cleanupOutdatedCaches: true,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/dev(?:\/|$)/, /^\/auth(?:\/|$)/, /^\/reset-password(?:\/|$)/, /^\/api(?:\/|$)/],
        // No runtime caching of Supabase Auth, database or storage requests.
        runtimeCaching: [],
      },
      devOptions: { enabled: false },
    }),
  ],
})
