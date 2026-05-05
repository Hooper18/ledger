import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import viteCompression from 'vite-plugin-compression'

export default defineConfig({
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        // 把变化频次低的核心依赖单独拆出来，减少业务代码改动后用户重新下载的体积。
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
        },
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    viteCompression({ algorithm: 'gzip', ext: '.gz', threshold: 1024 }),
    viteCompression({ algorithm: 'brotliCompress', ext: '.br', threshold: 1024 }),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script-defer',
      includeAssets: ['favicon-32.png', 'apple-touch-icon.png'],
      workbox: {
        // pdf.worker + fileParsers chunks exceed the default 2 MiB limit.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // index.html 走 NetworkFirst，确保新版本能即时生效；资源走 CacheFirst。
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/auth\//],
        runtimeCaching: [
          {
            // 静态资源（JS/CSS/字体/图片）— 哈希命名，永不变化，CacheFirst。
            urlPattern: ({ request }) =>
              ['style', 'script', 'worker', 'font', 'image'].includes(request.destination),
            handler: 'CacheFirst',
            options: {
              cacheName: 'static-assets',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 30 * 24 * 60 * 60,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Supabase REST / RPC — NetworkFirst，弱网下回退到上次结果。
            // 学校弱网/无网场景下要保证用户上节课打开过的页面整学期都能离线访问，
            // 所以缓存周期拉长到 30 天，条目数也提到 200；networkTimeoutSeconds
            // 缩到 3 秒，弱网下更快回退到本地数据。
            urlPattern: /^https:\/\/.*\.supabase\.(co|in)\/rest\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-rest',
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 30 * 24 * 60 * 60,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Supabase Auth + Functions（claude-proxy）— 不缓存，纯透传走网络。
            urlPattern: /^https:\/\/.*\.supabase\.(co|in)\/(auth|functions)\//,
            handler: 'NetworkOnly',
          },
        ],
      },
      manifest: {
        name: 'XMUM Schedule',
        short_name: 'Schedule',
        description: 'AI 辅助的课程、作业与 DDL 管理',
        lang: 'zh-CN',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#3b82f6',
        background_color: '#ffffff',
        icons: [
          {
            src: '/pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    host: true,
  },
})
