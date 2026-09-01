/* global self */

// This authenticated application deliberately does not cache HTML or family data.
// The worker exists only to support installation and Android share-target registration.
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
