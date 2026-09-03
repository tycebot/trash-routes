import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  optimizeDeps: {
    // MapLibre v6's ESM worker must not be rewritten by Vite's dependency optimizer.
    exclude: ['maplibre-gl'],
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{html,js,css,svg,png,webp}'],
      },
    }),
  ],
  build: {
    target: 'edge90',
    chunkSizeWarningLimit: 1300,
  },
})
