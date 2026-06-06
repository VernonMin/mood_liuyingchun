self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || '刘迎春的开心小角落', {
      body: data.body || '',
      icon: '/avatar.png',
      badge: '/avatar.png',
      lang: 'zh-CN',
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/'));
});
