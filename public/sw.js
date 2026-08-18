/* eslint-disable no-restricted-globals */

/**
 * Self-removing service worker.
 *
 * This file used to cache the public shell. It was removed after a client
 * reported the site loading forever and never finishing — the symptom of a
 * worker serving assets cached from an earlier deployment.
 *
 * The file has to keep existing, and has to stay valid JavaScript. A browser
 * with the old worker installed will fetch /sw.js again when it checks for an
 * update; if it 404s, some browsers keep running the worker they already have.
 * Serving this instead guarantees the old one is replaced by one that deletes
 * every cache and unregisters itself.
 *
 * Do not "clean this up" by deleting the file until you are confident no
 * visitor still has the old worker installed.
 */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      await self.registration.unregister();

      // Reload open tabs so they drop this worker and fetch from the network.
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const client of clients) client.navigate(client.url);
    })(),
  );
});

// No fetch handler: every request goes straight to the network.
