/**
 * PWA-Manifest (Etappe 13c).
 *
 * Web App Manifest für Progressive Web App Funktionalität:
 * - Install-Button im Browser
 * - App-Shell (Home, Workshop, Mobile)
 * - Icons für Home Screen
 * - Offline-Unterstützung via Service Worker
 *
 * Konvention: Next.js 13+ verarbeitet diese Datei als GET /manifest.json
 */

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ALFRET — Autonome Langzeitforschung",
    short_name: "ALFRET",
    description: "Autonome Langzeitforschung im Kontext agentischer Systeme",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#09090b", // zinc-950
    theme_color: "#4f46e5",       // indigo-600
    orientation: "portrait-primary",

    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
    ],

    screenshots: [
      {
        src: "/screenshot-desktop.png",
        sizes: "1280x720",
        type: "image/png",
        form_factor: "wide",
      },
      {
        src: "/screenshot-mobile.png",
        sizes: "540x720",
        type: "image/png",
        form_factor: "narrow",
      },
    ],

    shortcuts: [
      {
        name: "Workshop",
        short_name: "Workshop",
        description: "Werkstatt — Demo-Zyklus und Live-Überwachung",
        url: "/workshop",
        icons: [
          {
            src: "/shortcut-workshop.png",
            sizes: "192x192",
            type: "image/png",
          },
        ],
      },
      {
        name: "Mobile",
        short_name: "Mobile",
        description: "Mobile Kontrolltafel — Nodes und Eskalationen",
        url: "/homelab/mobile",
        icons: [
          {
            src: "/shortcut-mobile.png",
            sizes: "192x192",
            type: "image/png",
          },
        ],
      },
    ],

    categories: ["productivity", "utilities"],
  };
}
