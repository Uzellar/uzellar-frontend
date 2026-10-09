// Service worker mínimo do Uzellar — existe só para o navegador
// oferecer "Instalar app". Ele NÃO guarda nada em cache de propósito:
// assim cada atualização publicada chega na hora pra todo mundo, sem
// risco de alguém ficar preso numa versão antiga.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {
  // Sem respondWith: o navegador busca tudo normalmente pela internet.
});
