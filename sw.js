/*
 * Copia Segura
 * Copyright (C) 2026 Fabio Britez
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/*
 * sw.js - Service worker: offline mode.
 *
 * Offline support is also the strongest privacy proof available: cut the
 * internet and process your document anyway. An app that works with no network
 * cannot be uploading anything. This worker only caches the application's own
 * same-origin files; user images are never stored.
 */

const CACHE_VERSION = 'copia-segura-v9';

// Must list EVERY module: a missing one breaks the app offline, and offline is
// the privacy proof.
const FILES = [
  './',
  './index.html',
  './como-funciona.html',
  './terminos.html',
  './verificacion.html',
  './css/base.css',
  './css/styles.css',
  './css/document.css',
  './js/main.js',
  './js/editor.js',
  './js/redact.js',
  './js/theme.js',
  './js/demos.js',
  './js/navigation.js',
  './js/templates.js',
  './js/geometry.js',
  './js/watermark.js',
  './js/export.js',
  './assets/icono.svg',
  './manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(FILES.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(names.filter((n) => n !== CACHE_VERSION).map((n) => caches.delete(n)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  // Same-origin resources only: this app talks to no one else.
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isNavigation =
    request.mode === 'navigate' ||
    (request.headers.get('accept') || '').includes('text/html');

  if (isNavigation) {
    // HTML: network first (to pick up updates), cache as fallback.
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match('./')))
    );
    return;
  }

  // Everything else: cache first, network as fallback.
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        })
    )
  );
});
