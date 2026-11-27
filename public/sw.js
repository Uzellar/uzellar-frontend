// Service worker mínimo do Uzellar — existe só para o navegador
// oferecer "Instalar app". Ele NÃO guarda nada em cache de propósito:
// assim cada atualização publicada chega na hora pra todo mundo, sem
// risco de alguém ficar preso numa versão antiga.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {
  // Sem respondWith: o navegador busca tudo normalmente pela internet.
});

// Notificações no celular (11/2026): lembretes das anotações do
// condomínio. O servidor manda {titulo, corpo, url, tag}.
self.addEventListener('push', (event) => {
  let dados = {};
  try {
    dados = event.data ? event.data.json() : {};
  } catch {
    dados = { corpo: event.data ? event.data.text() : '' };
  }
  const escopo = self.registration.scope;
  event.waitUntil(
    self.registration.showNotification(dados.titulo || 'Uzellar', {
      body: dados.corpo || '',
      icon: escopo + 'icons/icon-192.png',
      badge: escopo + 'icons/favicon-48.png',
      tag: dados.tag || undefined,
      data: { url: dados.url || '#/anotacoes' },
    }),
  );
});

// Tocar na notificação abre o Uzellar na anotação.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const destino = self.registration.scope + ((event.notification.data && event.notification.data.url) || '#/anotacoes');
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
      for (const janela of janelas) {
        if (janela.url.startsWith(self.registration.scope) && 'focus' in janela) {
          return janela.focus().then((j) => (j && 'navigate' in j ? j.navigate(destino) : j));
        }
      }
      return self.clients.openWindow(destino);
    }),
  );
});
