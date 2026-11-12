/* CemenQtime Service Worker — Web Push & Real-Time Notifications */

const SW_VERSION = 'cemenqtime-sw-v1';
const LOGO_ICON = '/assets/aistudio/623410255_1517285780403715_965041871524205859_n_cf013194.jpg';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Escuchar eventos Push estándar del navegador (Push API)
self.addEventListener('push', (event) => {
  let payload = {
    title: 'CemenQtime · Módulo de Recursos Humanos',
    body: 'Tienes una nueva actualización de nómina o incidencia.',
    tag: 'cemenqtime-alert',
    data: { targetTab: 'trabajar_listas' },
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      payload = { ...payload, ...parsed };
    } catch {
      payload.body = event.data.text() || payload.body;
    }
  }

  const options = {
    body: payload.body,
    icon: payload.icon || LOGO_ICON,
    badge: payload.badge || LOGO_ICON,
    tag: payload.tag || `cemenqtime-${Date.now()}`,
    renotify: true,
    requireInteraction: Boolean(payload.requireInteraction),
    vibrate: [180, 80, 180],
    data: payload.data || { targetTab: 'trabajar_listas' },
    actions: [
      { action: 'open', title: 'Abrir en CemenQtime' },
      { action: 'dismiss', title: 'Cerrar' },
    ],
  };

  event.waitUntil(self.registration.showNotification(payload.title, options));
});

// Escuchar mensajes directos desde el cliente web para disparar notificaciones nativas del SO
self.addEventListener('message', (event) => {
  const msg = event.data;
  if (!msg || msg.type !== 'SHOW_PUSH_NOTIFICATION') return;

  const title = msg.title || 'CemenQtime · Alerta en Tiempo Real';
  const options = {
    body: msg.body || '',
    icon: msg.icon || LOGO_ICON,
    badge: msg.badge || LOGO_ICON,
    tag: msg.tag || `cemenqtime-${Date.now()}`,
    renotify: true,
    requireInteraction: Boolean(msg.requireInteraction),
    vibrate: [180, 80, 180],
    data: msg.data || { targetTab: 'trabajar_listas' },
    actions: [
      { action: 'open', title: 'Ir al Módulo' },
      { action: 'dismiss', title: 'Cerrar' },
    ],
  };

  if (self.registration && typeof self.registration.showNotification === 'function') {
    event.waitUntil(self.registration.showNotification(title, options));
  }
});

// Al hacer clic en la notificación nativa, enfocar la pestaña abierta y navegar al módulo correspondiente
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const targetData = event.notification.data || {};

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          client.postMessage({
            type: 'NOTIFICATION_CLICK',
            data: targetData,
          });
          return;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
    })
  );
});
