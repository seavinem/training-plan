import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const theme = "#0c0d0f";

export default defineConfig({
  base: process.env.VITE_BASE || "/",
  server: {
    fs: {
      allow: [fileURLToPath(new URL("..", import.meta.url))],
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      includeAssets: ["apple-touch-icon.png", "icon.svg"],
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,json,woff2}"],
        navigateFallbackDenylist: [/^https:\/\/api\.github\.com/, /\/workers\.dev\//],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.github\.com\//,
            handler: "NetworkOnly",
          },
          {
            urlPattern: /^https:\/\/.*\.workers\.dev\//,
            handler: "NetworkOnly",
          },
        ],
      },
      manifest: {
        name: "Зал — Кирил",
        short_name: "Зал",
        description: "Full Body ABC: подходы, веса, отдых",
        lang: "ru",
        display: "standalone",
        orientation: "portrait",
        background_color: theme,
        theme_color: theme,
        icons: [
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@data": fileURLToPath(new URL("../data", import.meta.url)),
    },
  },
});
